import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

/**
 * Format a Date as a filesystem-safe timestamp.
 */
function formatTimestamp(date) {
  return date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
}

/**
 * Generate a backup directory path.
 * @param {string} baseDir - e.g. '.island-bridge-backups'
 * @param {string} folderName - e.g. 'app'
 * @param {Date} [date]
 * @returns {string}
 */
export function generateBackupDir(baseDir, folderName, date = new Date()) {
  const ts = formatTimestamp(date);
  return `${baseDir}/${ts}/${folderName}`;
}

/**
 * Build rsync backup args.
 * @param {string} direction - 'pull' or 'push'
 * @param {string|null} localDir - local backup base dir
 * @param {string|null} remoteDir - remote backup base dir
 * @param {string} folderName
 * @param {Date} [date]
 * @returns {string[]}
 */
export function buildBackupArgs(direction, localDir, remoteDir, folderName, date = new Date()) {
  if (direction === 'pull' && localDir) {
    const backupDir = generateBackupDir(localDir, folderName, date);
    return ['--backup', `--backup-dir=${backupDir}`];
  }
  if (direction === 'push' && remoteDir) {
    const backupDir = generateBackupDir(remoteDir, folderName, date);
    return ['--backup', `--backup-dir=${backupDir}`];
  }
  return [];
}

/**
 * Parse a list of directory names and return valid timestamped ones, sorted ascending.
 * @param {string[]} dirs
 * @returns {{ name: string, date: Date }[]}
 */
export function parseBackupDirs(dirs) {
  return dirs
    .filter(d => TIMESTAMP_RE.test(d))
    .map(d => ({
      name: d,
      date: new Date(d.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z')),
    }))
    .sort((a, b) => a.date - b.date);
}

/**
 * List local backups.
 * @param {string} baseDir
 * @returns {{ name: string, date: Date }[]}
 */
export function listBackups(baseDir) {
  if (!existsSync(baseDir)) return [];
  const dirs = readdirSync(baseDir).filter(d => {
    const full = join(baseDir, d);
    return statSync(full).isDirectory();
  });
  return parseBackupDirs(dirs);
}

/**
 * Restore a backup by copying files back.
 * @param {string} baseDir - backup base directory
 * @param {string} timestamp - e.g. '2026-04-07T14-30-00'
 * @param {string} [targetDir] - where to restore (defaults to cwd)
 */
export function restoreBackup(baseDir, timestamp, targetDir = '.') {
  const backupPath = join(baseDir, timestamp);
  if (!existsSync(backupPath)) {
    throw new Error(`Backup not found: ${timestamp}`);
  }

  const folders = readdirSync(backupPath).filter(d =>
    statSync(join(backupPath, d)).isDirectory()
  );

  const results = [];
  for (const folder of folders) {
    const src = join(backupPath, folder) + '/';
    const dst = join(targetDir, folder) + '/';
    try {
      execFileSync('rsync', ['-av', '--', src, dst], { stdio: 'pipe' });
      results.push({ folder, success: true, error: null });
    } catch (err) {
      results.push({ folder, success: false, error: err.message });
    }
  }
  return results;
}

/**
 * Clean old backups, keeping the N most recent.
 * @param {string} baseDir
 * @param {number} keep
 * @returns {string[]} removed directory names
 */
export function cleanBackups(baseDir, keep) {
  const backups = listBackups(baseDir);
  if (backups.length <= keep) return [];

  const toRemove = backups.slice(0, backups.length - keep);
  const removed = [];
  for (const b of toRemove) {
    const fullPath = join(baseDir, b.name);
    rmSync(fullPath, { recursive: true, force: true });
    removed.push(b.name);
  }
  return removed;
}
