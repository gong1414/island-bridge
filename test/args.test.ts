import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/lib/args.js';

describe('parseArgs', () => {
  it('parses pull command', () => {
    assert.equal(parseArgs(['pull']).command, 'pull');
  });

  it('parses push command', () => {
    assert.equal(parseArgs(['push']).command, 'push');
  });

  it('parses watch command', () => {
    assert.equal(parseArgs(['watch']).command, 'watch');
  });

  it('parses diff command', () => {
    assert.equal(parseArgs(['diff']).command, 'diff');
  });

  it('parses history command', () => {
    assert.equal(parseArgs(['history']).command, 'history');
  });

  it('parses --dry-run flag', () => {
    assert.equal(parseArgs(['pull', '--dry-run']).dryRun, true);
  });

  it('parses -n shorthand for dry-run', () => {
    assert.equal(parseArgs(['push', '-n']).dryRun, true);
  });

  it('parses --verbose and --quiet', () => {
    assert.equal(parseArgs(['pull', '--verbose']).verbose, true);
    assert.equal(parseArgs(['pull', '-v']).verbose, true);
    assert.equal(parseArgs(['pull', '--quiet']).quiet, true);
    assert.equal(parseArgs(['pull', '-q']).quiet, true);
  });

  it('rejects --verbose and --quiet together', () => {
    assert.throws(() => parseArgs(['pull', '--verbose', '--quiet']), /Cannot use/);
  });

  it('parses --config path', () => {
    assert.equal(parseArgs(['pull', '--config', '/tmp/my.json']).config, '/tmp/my.json');
    assert.equal(parseArgs(['pull', '-c', '/tmp/my.json']).config, '/tmp/my.json');
  });

  it('parses --env name', () => {
    assert.equal(parseArgs(['pull', '--env', 'staging']).env, 'staging');
  });

  it('parses --bwlimit', () => {
    assert.equal(parseArgs(['pull', '--bwlimit', '500']).bwlimit, 500);
  });

  it('rejects non-numeric bwlimit', () => {
    assert.throws(() => parseArgs(['pull', '--bwlimit', 'fast']), /numeric/);
  });

  it('parses --select flag', () => {
    assert.equal(parseArgs(['pull', '--select']).select, true);
    assert.equal(parseArgs(['pull', '-s']).select, true);
  });

  it('parses --help', () => {
    assert.equal(parseArgs(['--help']).help, true);
    assert.equal(parseArgs(['-h']).help, true);
  });

  it('parses --version', () => {
    assert.equal(parseArgs(['--version']).version, true);
    assert.equal(parseArgs(['-V']).version, true);
  });

  it('handles multiple flags combined', () => {
    const args = parseArgs(['push', '-n', '-v', '--bwlimit', '100', '--env', 'prod']);
    assert.equal(args.command, 'push');
    assert.equal(args.dryRun, true);
    assert.equal(args.verbose, true);
    assert.equal(args.bwlimit, 100);
    assert.equal(args.env, 'prod');
  });

  it('defaults all flags to false/null', () => {
    const args = parseArgs(['pull']);
    assert.equal(args.dryRun, false);
    assert.equal(args.verbose, false);
    assert.equal(args.quiet, false);
    assert.equal(args.config, null);
    assert.equal(args.env, null);
    assert.equal(args.bwlimit, null);
    assert.equal(args.select, false);
  });

  it('parses --json flag', () => {
    assert.equal(parseArgs(['pull', '--json']).json, true);
  });

  it('parses --path single value', () => {
    assert.deepStrictEqual(parseArgs(['pull', '--path', 'app']).path, ['app']);
  });

  it('parses --path multiple values', () => {
    assert.deepStrictEqual(
      parseArgs(['pull', '--path', 'app', '--path', 'conf.d']).path,
      ['app', 'conf.d']
    );
  });

  it('parses --no-backup flag', () => {
    assert.equal(parseArgs(['pull', '--no-backup']).noBackup, true);
  });

  it('parses init command', () => {
    assert.equal(parseArgs(['init']).command, 'init');
  });

  it('parses status command', () => {
    assert.equal(parseArgs(['status']).command, 'status');
  });

  it('parses backup command with subcommand', () => {
    const args = parseArgs(['backup', 'list']);
    assert.equal(args.command, 'backup');
    assert.equal(args.subcommand, 'list');
  });

  it('parses backup restore with timestamp', () => {
    const args = parseArgs(['backup', 'restore', '2026-04-07T14-30-00']);
    assert.equal(args.command, 'backup');
    assert.equal(args.subcommand, 'restore');
    assert.equal(args.backupTimestamp, '2026-04-07T14-30-00');
  });

  it('parses backup clean --keep', () => {
    const args = parseArgs(['backup', 'clean', '--keep', '5']);
    assert.equal(args.command, 'backup');
    assert.equal(args.subcommand, 'clean');
    assert.equal(args.keep, 5);
  });

  it('parses init flags for non-interactive mode', () => {
    const args = parseArgs(['init', '--host', 'example.com', '--user', 'deploy', '--paths', '/var/www/app,/etc/nginx']);
    assert.equal(args.command, 'init');
    assert.equal(args.host, 'example.com');
    assert.equal(args.user, 'deploy');
    assert.equal(args.paths, '/var/www/app,/etc/nginx');
  });

  it('--json and --quiet together is allowed', () => {
    const args = parseArgs(['pull', '--json', '--quiet']);
    assert.equal(args.json, true);
    assert.equal(args.quiet, true);
  });
});
