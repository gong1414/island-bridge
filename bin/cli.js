#!/usr/bin/env node

import { parseArgs } from '../lib/args.js';
import { loadConfig } from '../lib/config.js';
import { checkRsync, syncAll, diffPreview } from '../lib/sync.js';
import { printSummary } from '../lib/summary.js';
import { startWatch } from '../lib/watch.js';
import { recordSync, showHistory } from '../lib/history.js';
import { runHook } from '../lib/hooks.js';
import { selectPaths } from '../lib/interactive.js';
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

Options:
  -n, --dry-run        Preview sync without making changes
  -v, --verbose        Show detailed output
  -q, --quiet          Suppress output (exit code only)
  -c, --config <path>  Use specific config file
      --env <name>     Use named profile from config
      --bwlimit <KB/s> Limit transfer bandwidth
  -s, --select         Interactively select folders to sync
  -V, --version        Show version
  -h, --help           Show this help message

Config (island-bridge.json):
  {
    "remote": { "host": "...", "user": "...", "paths": [...] },
    "exclude": ["node_modules", "*.log"],
    "bwlimit": 1000,
    "hooks": { "beforeSync": "...", "afterSync": "..." },
    "profiles": { "staging": { "remote": { ... } } }
  }
`.trim();

async function main() {
  let args;
  try {
    args = parseArgs();
  } catch (err) {
    console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    process.exit(1);
  }

  if (args.help || (!args.command && !args.version)) {
    console.log(USAGE);
    process.exit(0);
  }

  if (args.version) {
    console.log(`island-bridge v${pkg.version}`);
    process.exit(0);
  }

  const validCommands = ['pull', 'push', 'watch', 'diff', 'history'];
  if (!validCommands.includes(args.command)) {
    console.error(`Unknown command: ${args.command}`);
    console.error(`Valid commands: ${validCommands.join(', ')}`);
    process.exit(1);
  }

  // History doesn't need rsync
  if (args.command === 'history') {
    let config;
    try {
      config = loadConfig({ configPath: args.config, env: args.env });
    } catch {
      // Show history from cwd if no config found
    }
    showHistory(config?._filePath);
    process.exit(0);
  }

  // Pre-flight: check rsync
  const rsyncOk = await checkRsync();
  if (!rsyncOk) {
    console.error('\x1b[31mError: rsync is required but not found in PATH. Install rsync and try again.\x1b[0m');
    process.exit(1);
  }

  // Load config
  let config;
  try {
    config = loadConfig({ configPath: args.config, env: args.env });
  } catch (err) {
    console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    process.exit(1);
  }

  if (!args.quiet && args.env) {
    console.log(`\x1b[90mUsing profile: ${args.env}\x1b[0m`);
  }

  if (!args.quiet && config._filePath) {
    console.log(`\x1b[90mConfig: ${config._filePath}\x1b[0m`);
  }

  // Interactive selection
  if (args.select && ['pull', 'push', 'diff'].includes(args.command)) {
    config.remote.paths = await selectPaths(config.remote.paths);
  }

  // Watch mode
  if (args.command === 'watch') {
    startWatch(config, {
      dryRun: args.dryRun,
      verbose: args.verbose,
      quiet: args.quiet,
      bwlimit: args.bwlimit,
    });
    return; // watch runs indefinitely
  }

  // Diff preview
  if (args.command === 'diff') {
    const diffs = await diffPreview(config, 'pull', {
      bwlimit: args.bwlimit,
      exclude: config.exclude,
    });

    if (diffs.length === 0) {
      console.log('\nNo changes detected.');
    } else {
      for (const d of diffs) {
        console.log(`\n\x1b[1m${d.folderName}\x1b[0m (${d.remotePath}):`);
        for (const line of d.changes) {
          if (line.startsWith('*deleting')) {
            console.log(`  \x1b[31m- ${line}\x1b[0m`);
          } else if (line.startsWith('>') || line.startsWith('<')) {
            console.log(`  \x1b[32m+ ${line}\x1b[0m`);
          } else {
            console.log(`  \x1b[33m~ ${line}\x1b[0m`);
          }
        }
      }
    }
    process.exit(0);
  }

  // Pull or Push
  const options = {
    dryRun: args.dryRun,
    verbose: args.verbose,
    quiet: args.quiet,
    bwlimit: args.bwlimit,
  };

  // Disable hooks from configs found via upward search (planted-config protection)
  if (!config._explicitConfig && config._filePath !== join(process.cwd(), 'island-bridge.json')) {
    if (config.hooks.beforeSync || config.hooks.afterSync) {
      console.warn(`\x1b[33mWarning: hooks ignored from inherited config ${config._filePath}\x1b[0m`);
      console.warn(`\x1b[33mUse --config ${config._filePath} to explicitly enable hooks.\x1b[0m`);
      config.hooks = {};
    }
  }

  // Run beforeSync hook
  if (config.hooks.beforeSync) {
    runHook('beforeSync', config.hooks.beforeSync, args.quiet);
  }

  const results = await syncAll(config, args.command, options);

  // Run afterSync hook
  if (config.hooks.afterSync) {
    runHook('afterSync', config.hooks.afterSync, args.quiet);
  }

  // Record history
  recordSync(config._filePath, args.command, results);

  // Print summary (unless quiet)
  if (!args.quiet) {
    printSummary(results);
    if (args.dryRun) {
      console.log('\n\x1b[90m(dry-run mode \u2014 no changes were made)\x1b[0m');
    }
  }

  const hasFailed = results.some(r => !r.success);
  process.exit(hasFailed ? 1 : 0);
}

main();
