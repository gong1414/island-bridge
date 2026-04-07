import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { BackupEntry, RestoreResult } from './types.js';

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

/**
 * Format a Date as a filesystem-safe timestamp.
 */
function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
}

/**
 * Generate a backup directory path.
 */
export function generateBackupDir(baseDir: string, folderName: string, date: Date = new Date()): string {
  const ts = formatTimestamp(date);
  return `${baseDir}/${ts}/${folderName}`;
}

/**
 * Build rsync backup args.
 */
export function buildBackupArgs(
  direction: string,
  localDir: string | null,
  remoteDir: string | null,
  folderName: string,
  date: Date = new Date()
): string[] {
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
 */
export function parseBackupDirs(dirs: string[]): BackupEntry[] {
  return dirs
    .filter(d => TIMESTAMP_RE.test(d))
    .map(d => ({
      name: d,
      date: new Date(d.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z')),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * List local backups.
 */
export function listBackups(baseDir: string): BackupEntry[] {
  if (!existsSync(baseDir)) return [];
  const dirs = readdirSync(baseDir).filter(d => {
    const full = join(baseDir, d);
    return statSync(full).isDirectory();
  });
  return parseBackupDirs(dirs);
}

/**
 * Restore a backup by copying files back.
 */
export function restoreBackup(baseDir: string, timestamp: string, targetDir: string = '.'): RestoreResult[] {
  const backupPath = join(baseDir, timestamp);
  if (!existsSync(backupPath)) {
    throw new Error(`Backup not found: ${timestamp}`);
  }

  const folders = readdirSync(backupPath).filter(d =>
    statSync(join(backupPath, d)).isDirectory()
  );

  const results: RestoreResult[] = [];
  for (const folder of folders) {
    const src = join(backupPath, folder) + '/';
    const dst = join(targetDir, folder) + '/';
    try {
      execFileSync('rsync', ['-av', '--', src, dst], { stdio: 'pipe' });
      results.push({ folder, success: true, error: null });
    } catch (err) {
      results.push({ folder, success: false, error: (err as Error).message });
    }
  }
  return results;
}

/**
 * Clean old backups, keeping the N most recent.
 * @returns removed directory names
 */
export function cleanBackups(baseDir: string, keep: number): string[] {
  const backups = listBackups(baseDir);
  if (backups.length <= keep) return [];

  const toRemove = backups.slice(0, backups.length - keep);
  const removed: string[] = [];
  for (const b of toRemove) {
    const fullPath = join(baseDir, b.name);
    rmSync(fullPath, { recursive: true, force: true });
    removed.push(b.name);
  }
  return removed;
}
