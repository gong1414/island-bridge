import { execFile } from 'node:child_process';
import { extractFolderName, backupDefaults } from './config.js';
import { listBackups } from './backup.js';
import type { IslandBridgeConfig } from './types.js';
import type { Reporter } from './reporter.js';

/**
 * Parse rsync version from --version output.
 * @param output
 * @returns version string or null
 */
export function parseRsyncVersion(output: string): string | null {
  const match = output.match(/rsync\s+version\s+([\d.]+)/);
  return match ? match[1] : null;
}

/**
 * Check rsync availability and return version.
 */
export function checkRsyncVersion(): Promise<{ available: boolean; version: string | null }> {
  return new Promise((resolve) => {
    execFile('rsync', ['--version'], (err, stdout) => {
      if (err) {
        resolve({ available: false, version: null });
      } else {
        resolve({ available: true, version: parseRsyncVersion(stdout) });
      }
    });
  });
}

/**
 * Check SSH connectivity.
 * @param user
 * @param host
 */
export function checkSsh(user: string, host: string): Promise<{ connected: boolean; error: string | null }> {
  return new Promise((resolve) => {
    execFile('ssh', ['-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes', `${user}@${host}`, 'echo ok'], {
      timeout: 10000,
    }, (err, stdout) => {
      if (err) {
        resolve({ connected: false, error: err.message });
      } else {
        resolve({ connected: stdout.trim() === 'ok', error: null });
      }
    });
  });
}

/**
 * Check if remote paths exist.
 * @param user
 * @param host
 * @param paths
 */
export async function checkRemotePaths(
  user: string,
  host: string,
  paths: string[]
): Promise<{ path: string; folder: string; exists: boolean }[]> {
  const results: { path: string; folder: string; exists: boolean }[] = [];
  for (const p of paths) {
    const folder = extractFolderName(p);
    try {
      await new Promise<void>((resolve, reject) => {
        execFile('ssh', [
          '-o', 'ConnectTimeout=5',
          '-o', 'BatchMode=yes',
          `${user}@${host}`,
          `test -d "${p}"`,
        ], { timeout: 10000 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      results.push({ path: p, folder, exists: true });
    } catch {
      results.push({ path: p, folder, exists: false });
    }
  }
  return results;
}

/**
 * Run the status command.
 * @param config - loaded config
 * @param reporter
 */
export async function runStatus(config: IslandBridgeConfig, reporter: Reporter): Promise<void> {
  const { host, user, paths } = config.remote;

  reporter.info(`Config:    ${config._filePath}`);
  reporter.info(`Remote:    ${user}@${host}`);

  // Check rsync
  const rsync = await checkRsyncVersion();
  if (rsync.available) {
    reporter.info(`rsync:     \u2713 available (v${rsync.version})`);
  } else {
    reporter.error('rsync:     \u2717 not found', 'Install rsync: sudo apt install rsync');
  }

  // Check SSH
  const ssh = await checkSsh(user, host);
  if (ssh.connected) {
    reporter.info('SSH:       \u2713 connected');
  } else {
    reporter.error('SSH:       \u2717 connection failed', `ssh ${user}@${host}`);
  }

  // Check remote paths
  if (ssh.connected) {
    const pathResults = await checkRemotePaths(user, host, paths);
    reporter.info('Paths:');
    for (const p of pathResults) {
      const status = p.exists ? '\u2713 exists' : '\u2717 not found';
      reporter.info(`  ${p.folder.padEnd(12)} ${p.path.padEnd(24)} ${status}`);
    }
  }

  // Backup info
  const backupConfig = config.backup || backupDefaults();
  if (backupConfig.enabled) {
    const backups = listBackups(backupConfig.localDir);
    reporter.info(`Backup:    enabled (${backups.length} backups)`);
  } else {
    reporter.info('Backup:    disabled');
  }
}
