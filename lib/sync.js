import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extractFolderName } from './config.js';
import { streamProgress } from './progress.js';
import { rsyncExitMessage, getErrorHint } from './summary.js';

/**
 * Check that rsync is available in PATH.
 */
export async function checkRsync() {
  return new Promise((resolve) => {
    execFile('rsync', ['--version'], (err) => {
      resolve(!err);
    });
  });
}

/**
 * Build rsync arguments for a single path sync.
 * @param {string} user
 * @param {string} host
 * @param {string} remotePath
 * @param {string} localPath
 * @param {string} direction - 'pull' or 'push'
 * @param {object} [options]
 * @param {boolean} [options.dryRun] - Preview only
 * @param {boolean} [options.verbose] - Extra verbosity
 * @param {string[]} [options.exclude] - Exclude patterns
 * @param {number} [options.bwlimit] - Bandwidth limit in KB/s
 * @param {boolean} [options.itemize] - Show itemized changes (for diff preview)
 */
export function buildRsyncArgs(user, host, remotePath, localPath, direction, options = {}) {
  const remote = `${user}@${host}:${remotePath.replace(/\/+$/, '')}/`;
  const local = `${localPath.replace(/\/+$/, '')}/`;

  const args = [
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
 * @param {object} config - Parsed config
 * @param {string} direction - 'pull' or 'push'
 * @param {object} [options] - CLI options
 */
export async function syncAll(config, direction, options = {}, reporter = null) {
  const results = [];
  const { host, user, paths } = config.remote;
  const mergedExclude = [...(config.exclude || []), ...(options.exclude || [])];
  const mergedBwlimit = options.bwlimit || config.bwlimit || null;

  for (const remotePath of paths) {
    let folderName;
    try {
      folderName = extractFolderName(remotePath);
    } catch (err) {
      results.push({ folderName: remotePath, remotePath, success: false, error: err.message });
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

    const rsyncOptions = {
      dryRun: options.dryRun,
      verbose: options.verbose,
      exclude: mergedExclude,
      bwlimit: mergedBwlimit,
    };

    const args = buildRsyncArgs(user, host, remotePath, folderName, direction, rsyncOptions);
    const result = await runRsync(args, folderName, remotePath, options, reporter);
    results.push(result);
  }

  return results;
}

/**
 * Run rsync in diff/preview mode — returns itemized changes.
 */
export async function diffPreview(config, direction, options = {}) {
  const results = [];
  const { host, user, paths } = config.remote;
  const mergedExclude = [...(config.exclude || []), ...(options.exclude || [])];

  for (const remotePath of paths) {
    let folderName;
    try {
      folderName = extractFolderName(remotePath);
    } catch {
      continue;
    }

    const rsyncOptions = {
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
function runRsyncCapture(args) {
  return new Promise((resolve) => {
    const child = spawn('rsync', args, {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.resume();
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
function runRsync(args, folderName, remotePath, options = {}, reporter = null) {
  return new Promise((resolve) => {
    const child = spawn('rsync', args, {
      stdio: ['inherit', 'pipe', 'pipe'], // stdin inherited for SSH password prompts
    });

    // Stream stdout for progress display (unless quiet)
    if (reporter) {
      streamProgress(child.stdout, reporter, options);
    } else if (!options.quiet) {
      streamProgress(child.stdout, null, options);
    } else {
      child.stdout.resume(); // drain stdout to prevent backpressure
    }

    // Capture stderr
    let stderr = '';
    child.stderr.on('data', (data) => {
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

    child.on('close', (code) => {
      let result;
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
