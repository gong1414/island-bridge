import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFolderName } from '../lib/config.js';
import { buildRsyncArgs } from '../lib/sync.js';
import { rsyncExitMessage } from '../lib/summary.js';

describe('extractFolderName', () => {
  it('extracts basic folder name', () => {
    assert.equal(extractFolderName('/var/www/app'), 'app');
  });

  it('handles trailing slash', () => {
    assert.equal(extractFolderName('/var/www/app/'), 'app');
  });

  it('handles single component', () => {
    assert.equal(extractFolderName('/data'), 'data');
  });

  it('rejects root path', () => {
    assert.throws(() => extractFolderName('/'), /root or is empty/);
  });

  it('rejects empty string', () => {
    assert.throws(() => extractFolderName(''), /root or is empty/);
  });
});

describe('buildRsyncArgs', () => {
  it('builds pull args correctly', () => {
    const args = buildRsyncArgs('deploy', '192.168.1.100', '/var/www/app', 'app', 'pull');
    assert.ok(args.includes('-avz'));
    assert.ok(args.includes('--delete'));
    assert.ok(args.includes('--no-owner'));
    assert.ok(args.includes('--no-group'));
    assert.ok(args.includes('--info=progress2'));
    assert.ok(args.includes('--filter=:- .gitignore'));
    assert.ok(args.includes('--'));
    // Remote before local for pull
    const remote = args.find(a => a.includes('@'));
    const local = args.find(a => a === 'app/');
    assert.ok(args.indexOf(remote) < args.indexOf(local));
  });

  it('builds push args correctly', () => {
    const args = buildRsyncArgs('deploy', 'server', '/etc/nginx/conf.d', 'conf.d', 'push');
    // Local before remote for push
    const remote = args.find(a => a.includes('@'));
    const local = args.find(a => a === 'conf.d/');
    assert.ok(args.indexOf(local) < args.indexOf(remote));
  });

  it('handles trailing slashes in paths', () => {
    const args = buildRsyncArgs('u', 'h', '/path/with/slash/', 'slash', 'pull');
    const remote = args.find(a => a.includes('@'));
    assert.ok(remote.endsWith('/path/with/slash/'));
    assert.ok(!remote.includes('//'));
  });
});

describe('rsyncExitMessage', () => {
  it('returns correct messages for known codes', () => {
    assert.equal(rsyncExitMessage(0), 'success');
    assert.equal(rsyncExitMessage(23), 'partial transfer: some files could not be synced');
    assert.equal(rsyncExitMessage(255), 'SSH connection failed: check your SSH config and connectivity');
  });

  it('returns generic message for unknown codes', () => {
    assert.match(rsyncExitMessage(99), /exit code 99/);
  });
});
