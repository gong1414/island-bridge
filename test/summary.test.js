import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rsyncExitMessage, getErrorHint } from '../lib/summary.js';

describe('getErrorHint', () => {
  it('returns SSH hint for exit code 255', () => {
    const hint = getErrorHint(255, { host: 'example.com', user: 'deploy' });
    assert.ok(hint.includes('ssh'));
    assert.ok(hint.includes('deploy@example.com'));
  });

  it('returns disk hint for exit code 11', () => {
    const hint = getErrorHint(11);
    assert.ok(hint.includes('disk') || hint.includes('quota'));
  });

  it('returns null for unknown exit code', () => {
    const hint = getErrorHint(99);
    assert.equal(hint, null);
  });

  it('returns config hint for config-not-found error', () => {
    const hint = getErrorHint('config-not-found');
    assert.ok(hint.includes('island-bridge init'));
  });

  it('returns rsync install hint', () => {
    const hint = getErrorHint('rsync-not-found');
    assert.ok(hint.includes('install rsync'));
  });
});
