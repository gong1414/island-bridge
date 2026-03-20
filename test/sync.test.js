import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRsyncArgs } from '../lib/sync.js';

describe('buildRsyncArgs with options', () => {
  it('adds --dry-run flag', () => {
    const args = buildRsyncArgs('u', 'h', '/path', 'local', 'pull', { dryRun: true });
    assert.ok(args.includes('--dry-run'));
  });

  it('adds --verbose flag', () => {
    const args = buildRsyncArgs('u', 'h', '/path', 'local', 'pull', { verbose: true });
    assert.ok(args.includes('--verbose'));
  });

  it('adds --bwlimit flag', () => {
    const args = buildRsyncArgs('u', 'h', '/path', 'local', 'pull', { bwlimit: 500 });
    assert.ok(args.includes('--bwlimit=500'));
  });

  it('adds exclude patterns', () => {
    const args = buildRsyncArgs('u', 'h', '/path', 'local', 'pull', {
      exclude: ['node_modules', '*.log'],
    });
    assert.ok(args.includes('--exclude=node_modules'));
    assert.ok(args.includes('--exclude=*.log'));
  });

  it('adds --itemize-changes flag', () => {
    const args = buildRsyncArgs('u', 'h', '/path', 'local', 'pull', { itemize: true });
    assert.ok(args.includes('--itemize-changes'));
  });

  it('options come before -- separator', () => {
    const args = buildRsyncArgs('u', 'h', '/path', 'local', 'pull', {
      dryRun: true,
      bwlimit: 100,
      exclude: ['*.tmp'],
    });
    const separatorIndex = args.indexOf('--');
    assert.ok(args.indexOf('--dry-run') < separatorIndex);
    assert.ok(args.indexOf('--bwlimit=100') < separatorIndex);
    assert.ok(args.indexOf('--exclude=*.tmp') < separatorIndex);
  });

  it('combines multiple options correctly', () => {
    const args = buildRsyncArgs('deploy', 'server', '/var/www', 'www', 'push', {
      dryRun: true,
      verbose: true,
      bwlimit: 256,
      exclude: ['node_modules', '.git'],
    });
    assert.ok(args.includes('--dry-run'));
    assert.ok(args.includes('--verbose'));
    assert.ok(args.includes('--bwlimit=256'));
    assert.ok(args.includes('--exclude=node_modules'));
    assert.ok(args.includes('--exclude=.git'));
    // Still has base flags
    assert.ok(args.includes('-avz'));
    assert.ok(args.includes('--delete'));
  });

  it('no options does not add extra flags', () => {
    const args = buildRsyncArgs('u', 'h', '/path', 'local', 'pull');
    assert.ok(!args.includes('--dry-run'));
    assert.ok(!args.includes('--verbose'));
    assert.ok(!args.includes('--itemize-changes'));
  });
});
