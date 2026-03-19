import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extractFolderName } from './config.js';
import { streamProgress } from './progress.js';
import { rsyncExitMessage } from './summary.js';

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
 */
export function buildRsyncArgs(user, host, remotePath, localPath, direction) {
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
    '--', // terminate option parsing to prevent injection
  ];

  if (direction === 'pull') {
    args.push(remote, local);
  } else {
    args.push(local, remote);
  }

  return args;
}

/**
 * Execute sync for all configured remote paths.
 */
export async function syncAll(config, direction) {
  const results = [];
  const { host, user, paths } = config.remote;

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
      console.log(`\x1b[33mWarning: local folder '${folderName}' does not exist, skipping push\x1b[0m`);
      results.push({
        folderName,
        remotePath,
        success: false,
        error: `local folder '${folderName}' does not exist`,
      });
      continue;
    }

    const label = direction === 'pull' ? 'Pulling' : 'Pushing';
    console.log(`\n\x1b[1m${label} ${folderName}\x1b[0m (${remotePath})`);

    const args = buildRsyncArgs(user, host, remotePath, folderName, direction);
    const result = await runRsync(args, folderName, remotePath);
    results.push(result);
  }

  return results;
}

/**
 * Run a single rsync command and return the result.
 */
function runRsync(args, folderName, remotePath) {
  return new Promise((resolve) => {
    const child = spawn('rsync', args, {
      stdio: ['inherit', 'pipe', 'pipe'], // stdin inherited for SSH password prompts
    });

    // Stream stdout for progress display
    streamProgress(child.stdout);

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
      if (code === 0) {
        resolve({ folderName, remotePath, success: true, error: null });
      } else {
        const exitCode = code ?? -1;
        const message = rsyncExitMessage(exitCode);
        resolve({
          folderName,
          remotePath,
          success: false,
          error: `${message}${stderr.trim() ? ` (${stderr.trim()})` : ''}`,
          exitCode,
        });
      }
    });
  });
}
