import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateBackupDir, buildBackupArgs, parseBackupDirs } from '../lib/backup.js';

describe('generateBackupDir', () => {
  it('generates timestamped local backup path', () => {
    const dir = generateBackupDir('.island-bridge-backups', 'app', new Date('2026-04-07T14:30:00Z'));
    assert.equal(dir, '.island-bridge-backups/2026-04-07T14-30-00/app');
  });

  it('generates remote backup path', () => {
    const dir = generateBackupDir('~/.island-bridge-backups', 'conf.d', new Date('2026-04-07T14:30:00Z'));
    assert.equal(dir, '~/.island-bridge-backups/2026-04-07T14-30-00/conf.d');
  });
});

describe('buildBackupArgs', () => {
  it('returns --backup and --backup-dir args for pull', () => {
    const args = buildBackupArgs('pull', '.island-bridge-backups', '~/.island-bridge-backups', 'app', new Date('2026-04-07T14:30:00Z'));
    assert.ok(args.includes('--backup'));
    assert.ok(args.some(a => a.startsWith('--backup-dir=')));
    assert.ok(args.some(a => a.includes('.island-bridge-backups/2026-04-07T14-30-00/app')));
  });

  it('returns --backup and --backup-dir args for push', () => {
    const args = buildBackupArgs('push', '.island-bridge-backups', '~/.island-bridge-backups', 'app', new Date('2026-04-07T14:30:00Z'));
    assert.ok(args.includes('--backup'));
    assert.ok(args.some(a => a.includes('.island-bridge-backups/2026-04-07T14-30-00/app')));
  });

  it('returns empty array when disabled', () => {
    const args = buildBackupArgs('pull', null, null, 'app');
    assert.deepStrictEqual(args, []);
  });
});

describe('parseBackupDirs', () => {
  it('parses timestamp directories correctly', () => {
    const dirs = ['2026-04-07T14-30-00', '2026-04-06T10-00-00', 'not-a-timestamp'];
    const parsed = parseBackupDirs(dirs);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].name, '2026-04-06T10-00-00');
    assert.equal(parsed[1].name, '2026-04-07T14-30-00');
  });

  it('returns empty array for no valid dirs', () => {
    const parsed = parseBackupDirs(['foo', 'bar']);
    assert.deepStrictEqual(parsed, []);
  });
});
