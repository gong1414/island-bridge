#!/usr/bin/env node

import { parseArgs } from '../lib/args.js';
import { loadConfig, extractFolderName } from '../lib/config.js';
import { checkRsync, syncAll, diffPreview } from '../lib/sync.js';
import { Reporter } from '../lib/reporter.js';
import { startWatch } from '../lib/watch.js';
import { recordSync, showHistory } from '../lib/history.js';
import { runHook } from '../lib/hooks.js';
import { selectPaths } from '../lib/interactive.js';
import { runInit } from '../lib/init.js';
import { runStatus } from '../lib/status.js';
import { listBackups, restoreBackup, cleanBackups } from '../lib/backup.js';
import { getErrorHint } from '../lib/summary.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const USAGE = `
island-bridge v${pkg.version} - Sync remote folders via rsync over SSH

Usage:
  island-bridge <command> [options]

Commands:
  pull        Pull remote folders to local directory
  push        Push local folders to remote server
  watch       Watch local folders and auto-push on changes
  diff        Preview changes without syncing
  history     Show sync history
  init        Create island-bridge.json config interactively
  status      Show config, SSH, rsync, and paths status
  backup      Manage sync backups (list, restore, clean)

Options:
  -n, --dry-run        Preview sync without making changes
  -v, --verbose        Show detailed output
  -q, --quiet          Suppress output (exit code only)
  -c, --config <path>  Use specific config file
      --env <name>     Use named profile from config
      --bwlimit <KB/s> Limit transfer bandwidth
  -s, --select         Interactively select folders to sync
      --path <name>    Sync specific folder by name (repeatable)
      --json           Output in JSON format (for scripts/AI)
      --no-backup      Skip backup for this sync
  -V, --version        Show version
  -h, --help           Show this help message

Backup subcommands:
  backup list                  List available backups
  backup restore <timestamp>   Restore files from a backup
  backup clean --keep <N>      Remove old backups, keep N most recent
`.trim();

async function main() {
  let args;
  try {
    args = parseArgs();
  } catch (err) {
    console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    process.exit(1);
  }

  const reporter = new Reporter(args.json ? 'json' : 'human');

  if (args.help || (!args.command && !args.version)) {
    console.log(USAGE);
    process.exit(0);
  }

  if (args.version) {
    if (args.json) {
      reporter.setCommand('version');
      reporter.info(pkg.version);
      reporter.flush();
    } else {
      console.log(`island-bridge v${pkg.version}`);
    }
    process.exit(0);
  }

  const validCommands = ['pull', 'push', 'watch', 'diff', 'history', 'init', 'status', 'backup'];
  if (!validCommands.includes(args.command)) {
    reporter.error(
      `Unknown command: ${args.command}`,
      `Valid commands: ${validCommands.join(', ')}`
    );
    if (args.json) reporter.flush();
    process.exit(1);
  }

  reporter.setCommand(args.command);

  // === Init ===
  if (args.command === 'init') {
    const ok = await runInit(args, reporter);
    if (args.json) reporter.flush();
    process.exit(ok ? 0 : 1);
  }

  // === History (doesn't need rsync) ===
  if (args.command === 'history') {
    let config;
    try {
      config = loadConfig({ configPath: args.config, env: args.env });
    } catch {
      // Show history from cwd if no config found
    }
    if (args.json) {
      const { readFileSync: rfs, existsSync: efs } = await import('node:fs');
      const { dirname: dn, join: jn } = await import('node:path');
      const historyFile = config?._filePath
        ? jn(dn(config._filePath), '.island-bridge-history.json')
        : '.island-bridge-history.json';
      let entries = [];
      if (efs(historyFile)) {
        try {
          const parsed = JSON.parse(rfs(historyFile, 'utf-8'));
          entries = Array.isArray(parsed) ? parsed : [];
        } catch { /* ignore */ }
      }
      reporter.historyReport(entries);
      reporter.flush();
    } else {
      showHistory(config?._filePath);
    }
    process.exit(0);
  }

  // === Backup ===
  if (args.command === 'backup') {
    let config;
    try {
      config = loadConfig({ configPath: args.config, env: args.env });
    } catch {
      config = { backup: { enabled: true, localDir: '.island-bridge-backups', remoteDir: '~/.island-bridge-backups', maxCount: 10 } };
    }
    const backupConfig = config.backup;

    if (args.subcommand === 'list') {
      const backups = listBackups(backupConfig.localDir);
      if (args.json) {
        reporter.historyReport(backups.map(b => ({ timestamp: b.name, date: b.date.toISOString() })));
        reporter.flush();
      } else {
        if (backups.length === 0) {
          console.log('No backups found.');
        } else {
          console.log('\n--- Backups ---\n');
          for (const b of backups) {
            console.log(`  ${b.name}  (${b.date.toLocaleString()})`);
          }
          console.log(`\n${backups.length} backup(s) found.`);
        }
      }
      process.exit(0);
    }

    if (args.subcommand === 'restore') {
      if (!args.backupTimestamp) {
        reporter.error('backup restore requires a timestamp', 'Run "island-bridge backup list" to see available backups');
        if (args.json) reporter.flush();
        process.exit(1);
      }
      try {
        const results = restoreBackup(backupConfig.localDir, args.backupTimestamp);
        if (args.json) {
          for (const r of results) {
            reporter.syncEnd(r.folder, r);
          }
          reporter.flush();
        } else {
          for (const r of results) {
            if (r.success) {
              console.log(`  \x1b[32m\u2713\x1b[0m ${r.folder} restored`);
            } else {
              console.log(`  \x1b[31m\u2717\x1b[0m ${r.folder} \u2014 ${r.error}`);
            }
          }
        }
      } catch (err) {
        reporter.error(err.message, 'Run "island-bridge backup list" to see available backups');
        if (args.json) reporter.flush();
        process.exit(1);
      }
      process.exit(0);
    }

    if (args.subcommand === 'clean') {
      const keep = args.keep || backupConfig.maxCount || 10;
      const removed = cleanBackups(backupConfig.localDir, keep);
      if (args.json) {
        reporter.info(`Removed ${removed.length} backup(s), keeping ${keep}`);
        reporter.flush();
      } else {
        if (removed.length === 0) {
          console.log(`No backups to remove (keeping ${keep}).`);
        } else {
          for (const name of removed) {
            console.log(`  Removed: ${name}`);
          }
          console.log(`\nRemoved ${removed.length} backup(s), keeping ${keep}.`);
        }
      }
      process.exit(0);
    }

    reporter.error(
      'Unknown backup subcommand',
      'Usage: island-bridge backup <list|restore|clean>'
    );
    if (args.json) reporter.flush();
    process.exit(1);
  }

  // === Pre-flight: check rsync ===
  const rsyncOk = await checkRsync();
  if (!rsyncOk) {
    reporter.error(
      'rsync is required but not found in PATH',
      getErrorHint('rsync-not-found')
    );
    if (args.json) reporter.flush();
    process.exit(1);
  }

  // === Load config ===
  let config;
  try {
    config = loadConfig({ configPath: args.config, env: args.env });
  } catch (err) {
    const hint = err.message.includes('Cannot find')
      ? getErrorHint('config-not-found')
      : null;
    reporter.error(err.message, hint);
    if (args.json) reporter.flush();
    process.exit(1);
  }

  if (args.env) {
    reporter.info(`Using profile: ${args.env}`);
  }
  if (config._filePath) {
    reporter.info(`Config: ${config._filePath}`);
  }

  // === Status ===
  if (args.command === 'status') {
    await runStatus(config, reporter);
    if (args.json) reporter.flush();
    process.exit(0);
  }

  // === --path filter ===
  if (args.path.length > 0) {
    const allNames = config.remote.paths.map(p => extractFolderName(p));
    const invalid = args.path.filter(name => !allNames.includes(name));
    if (invalid.length > 0) {
      reporter.error(
        `Unknown folder name(s): ${invalid.join(', ')}`,
        `Available folders: ${allNames.join(', ')}`
      );
      if (args.json) reporter.flush();
      process.exit(1);
    }
    config.remote.paths = config.remote.paths.filter(p =>
      args.path.includes(extractFolderName(p))
    );
  }

  // === Interactive selection ===
  if (args.select && !args.json && ['pull', 'push', 'diff'].includes(args.command)) {
    config.remote.paths = await selectPaths(config.remote.paths, reporter);
  }

  // === Watch mode ===
  if (args.command === 'watch') {
    startWatch(config, {
      dryRun: args.dryRun,
      verbose: args.verbose,
      quiet: args.quiet,
      bwlimit: args.bwlimit,
      noBackup: args.noBackup,
    }, reporter);
    return;
  }

  // === Diff preview ===
  if (args.command === 'diff') {
    const diffs = await diffPreview(config, 'pull', {
      bwlimit: args.bwlimit,
      exclude: config.exclude,
    });
    reporter.diffReport(diffs);
    if (args.json) reporter.flush();
    process.exit(0);
  }

  // === Pull or Push ===
  const options = {
    dryRun: args.dryRun,
    verbose: args.verbose,
    quiet: args.quiet,
    bwlimit: args.bwlimit,
    noBackup: args.noBackup,
  };

  // Disable hooks from configs found via upward search
  if (!config._explicitConfig && config._filePath !== join(process.cwd(), 'island-bridge.json')) {
    if (config.hooks.beforeSync || config.hooks.afterSync) {
      reporter.warn(`hooks ignored from inherited config ${config._filePath}`);
      reporter.warn(`Use --config ${config._filePath} to explicitly enable hooks.`);
      config.hooks = {};
    }
  }

  // Run beforeSync hook
  if (config.hooks.beforeSync) {
    runHook('beforeSync', config.hooks.beforeSync, args.quiet, reporter);
  }

  const results = await syncAll(config, args.command, options, reporter);

  // Run afterSync hook
  if (config.hooks.afterSync) {
    runHook('afterSync', config.hooks.afterSync, args.quiet, reporter);
  }

  // Record history
  recordSync(config._filePath, args.command, results);

  // Print summary
  if (!args.quiet || args.json) {
    reporter.summary(results);
    if (!args.json && args.dryRun) {
      reporter.info('(dry-run mode \u2014 no changes were made)');
    }
  }

  if (args.json) reporter.flush();

  const hasFailed = results.some(r => !r.success);
  process.exit(hasFailed ? 1 : 0);
}

main();
