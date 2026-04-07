import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Reporter } from '../lib/reporter.js';

const noop = { write: () => {} };

describe('Reporter — json mode', () => {
  it('collects info messages', () => {
    const r = new Reporter('json', noop);
    r.info('hello');
    r.info('world');
    const output = r.flush();
    assert.deepStrictEqual(output.messages, [
      { level: 'info', text: 'hello' },
      { level: 'info', text: 'world' },
    ]);
  });

  it('collects warn messages', () => {
    const r = new Reporter('json', noop);
    r.warn('caution');
    const output = r.flush();
    assert.deepStrictEqual(output.messages, [
      { level: 'warn', text: 'caution' },
    ]);
  });

  it('collects errors with hints', () => {
    const r = new Reporter('json', noop);
    r.error('broken', 'try fixing it');
    const output = r.flush();
    assert.deepStrictEqual(output.errors, [
      { message: 'broken', hint: 'try fixing it' },
    ]);
  });

  it('collects errors without hints', () => {
    const r = new Reporter('json', noop);
    r.error('broken');
    const output = r.flush();
    assert.deepStrictEqual(output.errors, [
      { message: 'broken', hint: null },
    ]);
  });

  it('collects sync results', () => {
    const r = new Reporter('json', noop);
    r.syncStart('pull', 'app', '/var/www/app', {});
    r.syncFileChange('add', 'index.js');
    r.syncFileChange('delete', 'old.css');
    r.syncEnd('app', { success: true });
    const output = r.flush();
    assert.equal(output.results.length, 1);
    assert.equal(output.results[0].folder, 'app');
    assert.deepStrictEqual(output.results[0].changes, [
      { type: 'add', file: 'index.js' },
      { type: 'delete', file: 'old.css' },
    ]);
    assert.equal(output.results[0].success, true);
  });

  it('flush returns complete structure', () => {
    const r = new Reporter('json', noop);
    r.setCommand('pull');
    const output = r.flush();
    assert.equal(output.command, 'pull');
    assert.ok(output.version);
    assert.deepStrictEqual(output.messages, []);
    assert.deepStrictEqual(output.errors, []);
    assert.deepStrictEqual(output.results, []);
  });
});

describe('Reporter — human mode', () => {
  it('info writes to stdout', () => {
    const lines = [];
    const r = new Reporter('human', { write: (s) => lines.push(s) });
    r.info('hello');
    assert.ok(lines.some(l => l.includes('hello')));
  });

  it('error writes red text with hint', () => {
    const lines = [];
    const r = new Reporter('human', {
      write: (s) => lines.push(s),
      writeErr: (s) => lines.push(s),
    });
    r.error('broken', 'fix it');
    const joined = lines.join('');
    assert.ok(joined.includes('broken'));
    assert.ok(joined.includes('fix it'));
  });

  it('flush is a no-op', () => {
    const r = new Reporter('human');
    const output = r.flush();
    assert.equal(output, null);
  });
});
