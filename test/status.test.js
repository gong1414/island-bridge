import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRsyncVersion } from '../lib/status.js';

describe('parseRsyncVersion', () => {
  it('extracts version from rsync --version output', () => {
    const output = 'rsync  version 3.2.7  protocol version 31\nSomething else';
    assert.equal(parseRsyncVersion(output), '3.2.7');
  });

  it('returns null for unrecognized output', () => {
    assert.equal(parseRsyncVersion('not rsync'), null);
  });

  it('handles version with two segments', () => {
    const output = 'rsync  version 3.2  protocol version 31';
    assert.equal(parseRsyncVersion(output), '3.2');
  });
});
