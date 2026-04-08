import { spawn, execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extractFolderName } from './config.js';
import { streamProgress } from './progress.js';
import { rsyncExitMessage, getErrorHint } from './summary.js';
import { buildBackupArgs } from './backup.js';
import type { IslandBridgeConfig, SyncResult, SyncOptions, DiffResult } from './types.js';
import type { Reporter } from './reporter.js';

/**
 * Check that rsync is available in PATH.
 */
export function checkRsync(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('rsync', ['--version'], (err: Error | null) => {
      resolve(!err);
    });
  });
}

/**
 * Build rsync arguments for a single path sync.
 * @param user
 * @param host
 * @param remotePath
 * @param localPath
 * @param direction - 'pull' or 'push'
 * @param options
 * @param options.dryRun - Preview only
 * @param options.verbose - Extra verbosity
 * @param options.exclude - Exclude patterns
 * @param options.bwlimit - Bandwidth limit in KB/s
 * @param options.itemize - Show itemized changes (for diff preview)
 */
export function buildRsyncArgs(
  user: string,
  host: string,
  remotePath: string,
  localPath: string,
  direction: string,
  options: SyncOptions = {}
): string[] {
  const remote = `${user}@${host}:${remotePath.replace(/\/+$/, '')}/`;
  const local = `${localPath.replace(/\/+$/, '')}/`;

  const args: string[] = [
    '-avz',
    '--delete',
    '--no-owner',
    '--no-group',
    '--info=progress2',
    '--filter=:- .gitignore',
    '-e', 'ssh',
  ];

  if (options.dryRun) {
    args.push('--dry-run');
  }

  if (options.verbose) {
    args.push('--verbose');
  }

  if (options.itemize) {
    args.push('--itemize-changes');
  }

  if (options.bwlimit) {
    args.push(`--bwlimit=${options.bwlimit}`);
  }

  if (options.exclude) {
    for (const pattern of options.exclude) {
      args.push(`--exclude=${pattern}`);
    }
  }

  args.push('--'); // terminate option parsing to prevent injection

  if (direction === 'pull') {
    args.push(remote, local);
  } else {
    args.push(local, remote);
  }

  return args;
}

/**
 * Execute sync for all configured remote paths.
 * @param config - Parsed config
 * @param direction - 'pull' or 'push'
 * @param options - CLI options
 */
export async function syncAll(
  config: IslandBridgeConfig,
  direction: string,
  options: SyncOptions = {},
  reporter: Reporter | null = null
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const { host, user, paths } = config.remote;
  const mergedExclude = [...(config.exclude || []), ...(options.exclude || [])];
  const mergedBwlimit = options.bwlimit || config.bwlimit || null;

  for (const remotePath of paths) {
    let folderName: string;
    try {
      folderName = extractFolderName(remotePath);
    } catch (err) {
      results.push({ folderName: remotePath, remotePath, success: false, error: (err as Error).message });
      continue;
    }

    // For push: check local folder exists
    if (direction === 'push' && !existsSync(folderName)) {
      if (reporter) {
        reporter.warn(`local folder '${folderName}' does not exist, skipping push`);
      } else if (!options.quiet) {
        console.log(`\x1b[33mWarning: local folder '${folderName}' does not exist, skipping push\x1b[0m`);
      }
      results.push({
        folderName,
        remotePath,
        success: false,
        error: `local folder '${folderName}' does not exist`,
      });
      continue;
    }

    if (reporter) {
      reporter.syncStart(direction, folderName, remotePath, options);
    } else if (!options.quiet) {
      const label = direction === 'pull' ? 'Pulling' : 'Pushing';
      const dryLabel = options.dryRun ? ' (dry-run)' : '';
      console.log(`\n\x1b[1m${label} ${folderName}\x1b[0m (${remotePath})${dryLabel}`);
    }

    const rsyncOptions: SyncOptions = {
      dryRun: options.dryRun,
      verbose: options.verbose,
      exclude: mergedExclude,
      bwlimit: mergedBwlimit,
    };

    // Build backup args
    let backupRsyncArgs: string[] = [];
    if (!options.noBackup && config.backup && config.backup.enabled) {
      const now = options._backupTimestamp || new Date();
      backupRsyncArgs = buildBackupArgs(
        direction,
        config.backup.localDir,
        config.backup.remoteDir,
        folderName,
        now
      );
    }

    const args = buildRsyncArgs(user, host, remotePath, folderName, direction, rsyncOptions);

    // Insert backup args before the '--' separator
    if (backupRsyncArgs.length > 0) {
      const sepIndex = args.indexOf('--');
      args.splice(sepIndex, 0, ...backupRsyncArgs);
    }

    const result = await runRsync(args, folderName, remotePath, options, reporter);
    results.push(result);
  }

  return results;
}

/**
 * Run rsync in diff/preview mode — returns itemized changes.
 */
export async function diffPreview(
  config: IslandBridgeConfig,
  direction: string,
  options: SyncOptions = {}
): Promise<DiffResult[]> {
  const results: DiffResult[] = [];
  const { host, user, paths } = config.remote;
  const mergedExclude = [...(config.exclude || []), ...(options.exclude || [])];

  for (const remotePath of paths) {
    let folderName: string;
    try {
      folderName = extractFolderName(remotePath);
    } catch {
      continue;
    }

    const rsyncOptions: SyncOptions = {
      dryRun: true,
      itemize: true,
      exclude: mergedExclude,
      bwlimit: options.bwlimit || config.bwlimit || null,
    };

    const args = buildRsyncArgs(user, host, remotePath, folderName, direction, rsyncOptions);
    const changes = await runRsyncCapture(args);
    if (changes.length > 0) {
      results.push({ folderName, remotePath, changes });
    }
  }

  return results;
}

/**
 * Run rsync and capture full output (for diff preview).
 */
function runRsyncCapture(args: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const child: ChildProcess = spawn('rsync', args, {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout!.on('data', (data) => { stdout += data.toString(); });
    child.stderr!.resume();
    child.on('error', () => resolve([]));
    child.on('close', () => {
      const lines = stdout.split('\n').filter(l => l.trim() && !l.startsWith(' ') && l !== './');
      resolve(lines);
    });
  });
}

/**
 * Run a single rsync command and return the result.
 */
function runRsync(
  args: string[],
  folderName: string,
  remotePath: string,
  options: SyncOptions = {},
  reporter: Reporter | null = null
): Promise<SyncResult> {
  return new Promise((resolve) => {
    const child: ChildProcess = spawn('rsync', args, {
      stdio: ['inherit', 'pipe', 'pipe'], // stdin inherited for SSH password prompts
    });

    // Stream stdout for progress display (unless quiet)
    if (reporter) {
      streamProgress(child.stdout!, reporter, options);
    } else if (!options.quiet) {
      streamProgress(child.stdout!, null, options);
    } else {
      child.stdout!.resume(); // drain stdout to prevent backpressure
    }

    // Capture stderr
    let stderr = '';
    child.stderr!.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      resolve({
        folderName,
        remotePath,
        success: false,
        error: err.message,
      });
    });

    child.on('close', (code: number | null) => {
      let result: SyncResult;
      if (code === 0) {
        result = { folderName, remotePath, success: true, error: null };
      } else {
        const exitCode = code ?? -1;
        const message = rsyncExitMessage(exitCode);
        result = {
          folderName,
          remotePath,
          success: false,
          error: `${message}${stderr.trim() ? ` (${stderr.trim()})` : ''}`,
          exitCode,
        };
      }
      if (reporter) {
        reporter.syncEnd(folderName, result);
      }
      resolve(result);
    });
  });
}
