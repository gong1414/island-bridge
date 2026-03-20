import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../lib/args.js';

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
});
