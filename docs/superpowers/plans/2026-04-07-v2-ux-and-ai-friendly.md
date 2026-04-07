# island-bridge v2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the output layer into a unified Reporter abstraction (human/json), then add init, status, backup commands, --path option, and error hints to make island-bridge user-friendly and AI-callable.

**Architecture:** A new `Reporter` class replaces all direct `console.log` / `process.stdout.write` calls across the codebase. It supports two modes: `human` (colored terminal output, identical to v1) and `json` (structured JSON to stdout). All new and existing modules receive a `reporter` instance as a parameter. New features (init, status, backup) are each in their own file.

**Tech Stack:** Node.js >= 18, zero dependencies, node:test for testing, ESM modules.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/reporter.js` | Create | Reporter class — human/json dual-mode output |
| `lib/args.js` | Modify | Add `--json`, `--path`, `--no-backup`, `init`/`status`/`backup` commands |
| `lib/config.js` | Modify | Add `backup` config section parsing and defaults |
| `lib/summary.js` | Modify | Add hint map for rsync errors; expose `errorWithHint()` |
| `lib/sync.js` | Modify | Accept reporter, use it for all output; add backup args to rsync |
| `lib/progress.js` | Modify | Accept reporter, delegate output |
| `lib/hooks.js` | Modify | Accept reporter |
| `lib/interactive.js` | Modify | Accept reporter |
| `lib/watch.js` | Modify | Accept reporter |
| `lib/init.js` | Create | `init` command — interactive + flag-based config generation |
| `lib/status.js` | Create | `status` command — SSH/rsync/paths diagnostics |
| `lib/backup.js` | Create | Backup list/restore/clean logic |
| `bin/cli.js` | Modify | Create Reporter instance, inject into modules, route new commands |
| `test/reporter.test.js` | Create | Reporter human/json mode tests |
| `test/args.test.js` | Modify | Tests for new flags and commands |
| `test/config.test.js` | Modify | Tests for backup config validation |
| `test/init.test.js` | Create | Tests for config generation |
| `test/status.test.js` | Create | Tests for status checks |
| `test/backup.test.js` | Create | Tests for backup path generation, list, restore |

---

## Task 1: Reporter class — core

**Files:**
- Create: `lib/reporter.js`
- Create: `test/reporter.test.js`

- [ ] **Step 1: Write failing tests for Reporter**

```js
// test/reporter.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Reporter } from '../lib/reporter.js';

describe('Reporter — json mode', () => {
  it('collects info messages', () => {
    const r = new Reporter('json');
    r.info('hello');
    r.info('world');
    const output = r.flush();
    assert.deepStrictEqual(output.messages, [
      { level: 'info', text: 'hello' },
      { level: 'info', text: 'world' },
    ]);
  });

  it('collects warn messages', () => {
    const r = new Reporter('json');
    r.warn('caution');
    const output = r.flush();
    assert.deepStrictEqual(output.messages, [
      { level: 'warn', text: 'caution' },
    ]);
  });

  it('collects errors with hints', () => {
    const r = new Reporter('json');
    r.error('broken', 'try fixing it');
    const output = r.flush();
    assert.deepStrictEqual(output.errors, [
      { message: 'broken', hint: 'try fixing it' },
    ]);
  });

  it('collects errors without hints', () => {
    const r = new Reporter('json');
    r.error('broken');
    const output = r.flush();
    assert.deepStrictEqual(output.errors, [
      { message: 'broken', hint: null },
    ]);
  });

  it('collects sync results', () => {
    const r = new Reporter('json');
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
    const r = new Reporter('json');
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/reporter.test.js`
Expected: FAIL — `reporter.js` does not exist yet.

- [ ] **Step 3: Implement Reporter**

```js
// lib/reporter.js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

export class Reporter {
  /**
   * @param {'human'|'json'} mode
   * @param {object} [io] — override stdout/stderr for testing
   * @param {function} [io.write] — stdout writer
   * @param {function} [io.writeErr] — stderr writer
   */
  constructor(mode = 'human', io = {}) {
    this.mode = mode;
    this._write = io.write || ((s) => process.stdout.write(s));
    this._writeErr = io.writeErr || ((s) => process.stderr.write(s));

    // JSON accumulator
    this._command = null;
    this._messages = [];
    this._errors = [];
    this._results = [];
    this._currentResult = null;
  }

  setCommand(command) {
    this._command = command;
  }

  info(message) {
    if (this.mode === 'json') {
      this._messages.push({ level: 'info', text: message });
    } else {
      this._write(`\x1b[90m${message}\x1b[0m\n`);
    }
  }

  warn(message) {
    if (this.mode === 'json') {
      this._messages.push({ level: 'warn', text: message });
    } else {
      this._write(`\x1b[33mWarning: ${message}\x1b[0m\n`);
    }
  }

  error(message, hint = null) {
    if (this.mode === 'json') {
      this._errors.push({ message, hint });
    } else {
      this._writeErr(`\x1b[31mError: ${message}\x1b[0m\n`);
      if (hint) {
        this._writeErr(`  \x1b[90mhint: ${hint}\x1b[0m\n`);
      }
    }
  }

  syncStart(direction, folderName, remotePath, opts = {}) {
    this._currentResult = {
      folder: folderName,
      remotePath,
      direction,
      changes: [],
      success: null,
      error: null,
    };
    if (this.mode === 'human') {
      const label = direction === 'pull' ? 'Pulling' : 'Pushing';
      const dryLabel = opts.dryRun ? ' (dry-run)' : '';
      this._write(`\n\x1b[1m${label} ${folderName}\x1b[0m (${remotePath})${dryLabel}\n`);
    }
  }

  syncProgress(data) {
    if (this.mode === 'human') {
      this._write(`\r\x1b[K  \x1b[36m${data}\x1b[0m`);
    }
    // json mode: ignore progress updates
  }

  syncFileChange(type, filename) {
    if (this._currentResult) {
      this._currentResult.changes.push({ type, file: filename });
    }
    if (this.mode === 'human') {
      const colors = { add: '32', delete: '33', modify: '36' };
      const symbols = { add: '+', delete: '-', modify: '~' };
      const c = colors[type] || '0';
      const s = symbols[type] || '?';
      this._write(`\r\x1b[K  \x1b[${c}m${s} ${filename}\x1b[0m\n`);
    }
  }

  syncEnd(folderName, result) {
    if (this._currentResult) {
      this._currentResult.success = result.success;
      this._currentResult.error = result.error || null;
      this._results.push(this._currentResult);
      this._currentResult = null;
    }
  }

  summary(results) {
    if (this.mode === 'human') {
      this._write('\n--- Sync Summary ---\n');
      for (const r of results) {
        if (r.success) {
          this._write(`  \x1b[32m\u2713\x1b[0m ${r.folderName || r.folder} \u2014 synced successfully\n`);
        } else {
          this._write(`  \x1b[31m\u2717\x1b[0m ${r.folderName || r.folder} \u2014 ${r.error}\n`);
        }
      }
      const failed = results.filter(r => !r.success).length;
      const total = results.length;
      this._write(`\n${total - failed}/${total} folders synced successfully.\n`);
    }
    // json mode: results are already collected via syncEnd
  }

  diffReport(diffs) {
    if (this.mode === 'human') {
      if (diffs.length === 0) {
        this._write('\nNo changes detected.\n');
        return;
      }
      for (const d of diffs) {
        this._write(`\n\x1b[1m${d.folderName}\x1b[0m (${d.remotePath}):\n`);
        for (const line of d.changes) {
          if (line.startsWith('*deleting')) {
            this._write(`  \x1b[31m- ${line}\x1b[0m\n`);
          } else if (line.startsWith('>') || line.startsWith('<')) {
            this._write(`  \x1b[32m+ ${line}\x1b[0m\n`);
          } else {
            this._write(`  \x1b[33m~ ${line}\x1b[0m\n`);
          }
        }
      }
    } else {
      // json: store diffs in results
      for (const d of diffs) {
        this._results.push({
          folder: d.folderName,
          remotePath: d.remotePath,
          changes: d.changes,
          success: true,
          error: null,
        });
      }
    }
  }

  historyReport(entries) {
    if (this.mode === 'human') {
      if (entries.length === 0) {
        this._write('No sync history found.\n');
        return;
      }
      this._write('\n--- Sync History ---\n\n');
      const recent = entries.slice(-20);
      for (const entry of recent) {
        const date = new Date(entry.timestamp).toLocaleString();
        const status = entry.success ? '\x1b[32m\u2713\x1b[0m' : '\x1b[31m\u2717\x1b[0m';
        const dir = entry.direction === 'pull' ? '\u2193 pull' : '\u2191 push';
        const folders = entry.folders.map(f => f.name).join(', ');
        const stats = `${entry.total - entry.failed}/${entry.total} ok`;
        this._write(`  ${status} ${date}  ${dir}  [${folders}]  ${stats}\n`);
      }
      this._write(`\nShowing last ${recent.length} of ${entries.length} entries.\n`);
    } else {
      // json: put entries directly into results
      this._results = entries;
    }
  }

  /**
   * JSON mode: return the accumulated output object.
   * Human mode: return null (output was already written).
   */
  flush() {
    if (this.mode === 'json') {
      const output = {
        version: pkg.version,
        command: this._command,
        success: this._errors.length === 0 && this._results.every(r => r.success !== false),
        results: this._results,
        messages: this._messages,
        errors: this._errors,
      };
      this._write(JSON.stringify(output, null, 2) + '\n');
      return output;
    }
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/reporter.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reporter.js test/reporter.test.js
git commit -m "feat: add Reporter class with human/json dual-mode output"
```

---

## Task 2: Extend args parser — new flags and commands

**Files:**
- Modify: `lib/args.js`
- Modify: `test/args.test.js`

- [ ] **Step 1: Write failing tests for new args**

Add to `test/args.test.js`:

```js
// Append to existing describe('parseArgs', ...)

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

it('rejects --json and --quiet together is allowed', () => {
  // --json + --quiet is fine: json output with no extra human text
  const args = parseArgs(['pull', '--json', '--quiet']);
  assert.equal(args.json, true);
  assert.equal(args.quiet, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/args.test.js`
Expected: FAIL — new properties not yet in parseArgs.

- [ ] **Step 3: Implement new args parsing**

Replace the full content of `lib/args.js`:

```js
/**
 * Lightweight CLI argument parser for island-bridge.
 * Zero dependencies.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    command: null,
    subcommand: null,
    dryRun: false,
    verbose: false,
    quiet: false,
    json: false,
    config: null,
    env: null,
    bwlimit: null,
    select: false,
    noBackup: false,
    path: [],
    help: false,
    version: false,
    // init-specific
    host: null,
    user: null,
    paths: null,
    // backup-specific
    backupTimestamp: null,
    keep: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--dry-run':
      case '-n':
        args.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        args.verbose = true;
        break;
      case '--quiet':
      case '-q':
        args.quiet = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--config':
      case '-c':
        args.config = argv[++i];
        if (!args.config || args.config.startsWith('-')) throw new Error('--config requires a file path');
        break;
      case '--env':
        args.env = argv[++i];
        if (!args.env || args.env.startsWith('-')) throw new Error('--env requires a profile name');
        break;
      case '--bwlimit':
        args.bwlimit = argv[++i];
        if (!args.bwlimit || isNaN(Number(args.bwlimit))) {
          throw new Error('--bwlimit requires a numeric value (KB/s)');
        }
        args.bwlimit = Number(args.bwlimit);
        break;
      case '--select':
      case '-s':
        args.select = true;
        break;
      case '--no-backup':
        args.noBackup = true;
        break;
      case '--path':
        {
          const val = argv[++i];
          if (!val || val.startsWith('-')) throw new Error('--path requires a folder name');
          args.path.push(val);
        }
        break;
      case '--host':
        args.host = argv[++i];
        if (!args.host) throw new Error('--host requires a value');
        break;
      case '--user':
        args.user = argv[++i];
        if (!args.user) throw new Error('--user requires a value');
        break;
      case '--paths':
        args.paths = argv[++i];
        if (!args.paths) throw new Error('--paths requires a value');
        break;
      case '--keep':
        args.keep = argv[++i];
        if (!args.keep || isNaN(Number(args.keep))) {
          throw new Error('--keep requires a numeric value');
        }
        args.keep = Number(args.keep);
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--version':
      case '-V':
        args.version = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          if (!args.command) {
            args.command = arg;
          } else if (args.command === 'backup' && !args.subcommand) {
            args.subcommand = arg;
          } else if (args.command === 'backup' && args.subcommand === 'restore' && !args.backupTimestamp) {
            args.backupTimestamp = arg;
          }
        }
        break;
    }
  }

  if (args.verbose && args.quiet) {
    throw new Error('Cannot use --verbose and --quiet together');
  }

  return args;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/args.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/args.js test/args.test.js
git commit -m "feat: add --json, --path, --no-backup flags and init/status/backup commands to arg parser"
```

---

## Task 3: Extend config — backup section

**Files:**
- Modify: `lib/config.js`
- Modify: `test/config.test.js`

- [ ] **Step 1: Write failing tests for backup config**

Add to `test/config.test.js`:

```js
import { loadConfig, extractFolderName, backupDefaults } from '../lib/config.js';

describe('backupDefaults', () => {
  it('returns default backup config', () => {
    const defaults = backupDefaults();
    assert.equal(defaults.enabled, true);
    assert.equal(defaults.maxCount, 10);
    assert.equal(defaults.localDir, '.island-bridge-backups');
    assert.equal(defaults.remoteDir, '~/.island-bridge-backups');
  });
});

describe('config backup validation', () => {
  it('rejects non-object backup', () => {
    // We test this via loadConfig by creating a temp config file
    // For unit test, test the validate function indirectly
    const { validateBackupConfig } = await import('../lib/config.js');
    assert.throws(
      () => validateBackupConfig('not-an-object'),
      /backup.*must be an object/
    );
  });

  it('rejects non-boolean enabled', () => {
    const { validateBackupConfig } = await import('../lib/config.js');
    assert.throws(
      () => validateBackupConfig({ enabled: 'yes' }),
      /enabled.*must be a boolean/
    );
  });

  it('rejects non-positive maxCount', () => {
    const { validateBackupConfig } = await import('../lib/config.js');
    assert.throws(
      () => validateBackupConfig({ maxCount: 0 }),
      /maxCount.*must be a positive/
    );
  });

  it('accepts valid backup config', () => {
    const { validateBackupConfig } = await import('../lib/config.js');
    assert.doesNotThrow(() =>
      validateBackupConfig({ enabled: true, maxCount: 5 })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/config.test.js`
Expected: FAIL — `backupDefaults` and `validateBackupConfig` not exported.

- [ ] **Step 3: Add backup config support to config.js**

Add these exports at the end of `lib/config.js` (before the closing of the file):

```js
/**
 * Return default backup config values.
 */
export function backupDefaults() {
  return {
    enabled: true,
    maxCount: 10,
    localDir: '.island-bridge-backups',
    remoteDir: '~/.island-bridge-backups',
  };
}

/**
 * Validate backup config section.
 */
export function validateBackupConfig(backup) {
  if (typeof backup !== 'object' || Array.isArray(backup) || backup === null) {
    throw new Error("Config error: 'backup' must be an object");
  }
  if (backup.enabled !== undefined && typeof backup.enabled !== 'boolean') {
    throw new Error("Config error: 'backup.enabled' must be a boolean");
  }
  if (backup.maxCount !== undefined) {
    if (typeof backup.maxCount !== 'number' || backup.maxCount <= 0) {
      throw new Error("Config error: 'backup.maxCount' must be a positive number");
    }
  }
  if (backup.localDir !== undefined && typeof backup.localDir !== 'string') {
    throw new Error("Config error: 'backup.localDir' must be a string");
  }
  if (backup.remoteDir !== undefined && typeof backup.remoteDir !== 'string') {
    throw new Error("Config error: 'backup.remoteDir' must be a string");
  }
}
```

Also add to the `validate()` function in config.js (after the profiles validation block at line ~176):

```js
  // Validate backup
  if (config.backup !== undefined) {
    validateBackupConfig(config.backup);
  }
```

And in `loadConfig()`, after the normalize block (after line ~82), add:

```js
  config.backup = { ...backupDefaults(), ...(config.backup || {}) };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/config.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/config.js test/config.test.js
git commit -m "feat: add backup config section with validation and defaults"
```

---

## Task 4: Error hints in summary

**Files:**
- Modify: `lib/summary.js`

- [ ] **Step 1: Write failing test for error hints**

Add a new test file `test/summary.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/summary.test.js`
Expected: FAIL — `getErrorHint` not exported.

- [ ] **Step 3: Add getErrorHint to summary.js**

Add to `lib/summary.js`:

```js
/**
 * Get an actionable hint for a given error.
 * @param {number|string} code — rsync exit code or error key
 * @param {object} [context] — optional context (host, user, etc.)
 * @returns {string|null}
 */
export function getErrorHint(code, context = {}) {
  const hints = {
    255: () => {
      const target = context.user && context.host
        ? `${context.user}@${context.host}`
        : 'your server';
      return `Check that '${target}' is reachable: ssh ${target}`;
    },
    11: () => 'Check disk space or quota on the destination',
    12: () => 'Check network connectivity and try again',
    23: () => 'Some files could not be transferred — check file permissions',
    24: () => 'Source files changed during transfer — try syncing again',
    30: () => 'Connection timed out — check network or increase timeout',
    'config-not-found': () => "Run 'island-bridge init' to create a config file",
    'rsync-not-found': () => 'Install rsync: sudo apt install rsync (Debian/Ubuntu) or brew install rsync (macOS)',
  };

  const fn = hints[code];
  return fn ? fn() : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/summary.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/summary.js test/summary.test.js
git commit -m "feat: add getErrorHint for actionable error messages"
```

---

## Task 5: Wire Reporter into sync.js and progress.js

**Files:**
- Modify: `lib/sync.js`
- Modify: `lib/progress.js`

- [ ] **Step 1: Modify progress.js to accept reporter**

Replace `lib/progress.js`:

```js
/**
 * Parse rsync stdout output in real-time and emit events to reporter.
 * @param {object} stdout - Readable stream
 * @param {object} reporter - Reporter instance
 * @param {object} [options]
 * @param {boolean} [options.verbose] - Show extra detail
 */
export function streamProgress(stdout, reporter, options = {}) {
  let buffer = '';

  stdout.on('data', (chunk) => {
    buffer += chunk.toString();

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const parts = line.split('\r');
      const displayLine = parts[parts.length - 1];

      if (!displayLine || displayLine.trim() === '') continue;

      if (/^\s/.test(displayLine)) {
        reporter.syncProgress(displayLine.trim());
      } else {
        const trimmed = displayLine.trim();
        if (trimmed === './' || trimmed === '') continue;

        if (trimmed.startsWith('deleting ')) {
          reporter.syncFileChange('delete', trimmed.slice(9));
        } else {
          reporter.syncFileChange('add', trimmed);
        }
      }
    }
  });

  stdout.on('end', () => {
    if (buffer.trim()) {
      const parts = buffer.split('\r');
      const displayLine = parts[parts.length - 1]?.trim();
      if (displayLine && displayLine !== './') {
        reporter.syncFileChange('add', displayLine);
      }
    }
    // Clear progress line in human mode
    if (reporter.mode === 'human') {
      reporter._write('\r\x1b[K');
    }
  });
}
```

- [ ] **Step 2: Modify sync.js to accept reporter**

In `lib/sync.js`, change the imports and function signatures:

Replace line 4 (`import { streamProgress } from './progress.js';`) — keep it.
Replace line 5 (`import { rsyncExitMessage } from './summary.js';`) with:

```js
import { rsyncExitMessage, getErrorHint } from './summary.js';
```

Modify `syncAll` signature (line 85) to:

```js
export async function syncAll(config, direction, options = {}, reporter = null) {
```

Inside `syncAll`, replace the console.log for "Pulling/Pushing" (lines 114-118) with:

```js
    if (reporter) {
      reporter.syncStart(direction, folderName, remotePath, options);
    } else if (!options.quiet) {
      const label = direction === 'pull' ? 'Pulling' : 'Pushing';
      const dryLabel = options.dryRun ? ' (dry-run)' : '';
      console.log(`\n\x1b[1m${label} ${folderName}\x1b[0m (${remotePath})${dryLabel}`);
    }
```

Replace the warning for missing local folder (lines 102-104) with:

```js
      if (reporter) {
        reporter.warn(`local folder '${folderName}' does not exist, skipping push`);
      } else if (!options.quiet) {
        console.log(`\x1b[33mWarning: local folder '${folderName}' does not exist, skipping push\x1b[0m`);
      }
```

Modify `runRsync` (line 191) to accept reporter:

```js
function runRsync(args, folderName, remotePath, options = {}, reporter = null) {
```

Replace the progress streaming block (lines 198-202) with:

```js
    if (reporter) {
      streamProgress(child.stdout, reporter, options);
    } else if (!options.quiet) {
      streamProgress(child.stdout, null, options);
    } else {
      child.stdout.resume();
    }
```

After `syncEnd`, add reporter notification:

```js
    child.on('close', (code) => {
      const result = code === 0
        ? { folderName, remotePath, success: true, error: null }
        : (() => {
            const exitCode = code ?? -1;
            const message = rsyncExitMessage(exitCode);
            return {
              folderName,
              remotePath,
              success: false,
              error: `${message}${stderr.trim() ? ` (${stderr.trim()})` : ''}`,
              exitCode,
            };
          })();

      if (reporter) {
        reporter.syncEnd(folderName, result);
      }
      resolve(result);
    });
```

Pass reporter through `syncAll` to `runRsync`:

```js
    const result = await runRsync(args, folderName, remotePath, options, reporter);
```

Note: `progress.js` needs a fallback when reporter is null (for backward compatibility during the transition). Update `streamProgress` to handle null reporter by falling back to original behavior:

At the top of `streamProgress`, add:

```js
  if (!reporter) {
    // Legacy fallback: write directly to stdout (v1 behavior)
    const legacyReporter = {
      mode: 'human',
      _write: (s) => process.stdout.write(s),
      syncProgress: (data) => process.stdout.write(`\r\x1b[K  \x1b[36m${data}\x1b[0m`),
      syncFileChange: (type, filename) => {
        if (type === 'delete') {
          process.stdout.write(`\r\x1b[K  \x1b[33m- ${filename}\x1b[0m\n`);
        } else {
          process.stdout.write(`\r\x1b[K  \x1b[32m+ ${filename}\x1b[0m\n`);
        }
      },
    };
    reporter = legacyReporter;
  }
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `node --test test/sync.test.js`
Expected: All tests PASS (buildRsyncArgs is unchanged).

- [ ] **Step 4: Commit**

```bash
git add lib/sync.js lib/progress.js
git commit -m "refactor: wire Reporter into sync and progress modules"
```

---

## Task 6: Wire Reporter into hooks, interactive, watch

**Files:**
- Modify: `lib/hooks.js`
- Modify: `lib/interactive.js`
- Modify: `lib/watch.js`

- [ ] **Step 1: Update hooks.js**

Replace `lib/hooks.js`:

```js
import { execSync } from 'node:child_process';

/**
 * Execute a hook command.
 * @param {string} name - Hook name (beforeSync, afterSync)
 * @param {string} command - Shell command to execute
 * @param {boolean} quiet - Suppress output
 * @param {object} [reporter] - Reporter instance
 */
export function runHook(name, command, quiet = false, reporter = null) {
  if (!command) return;

  if (reporter) {
    reporter.info(`[hook:${name}] ${command}`);
  } else if (!quiet) {
    console.log(`\x1b[90m[hook:${name}] ${command}\x1b[0m`);
  }

  try {
    execSync(command, {
      stdio: quiet ? 'ignore' : 'inherit',
      timeout: 30000,
      shell: true,
    });
  } catch (err) {
    const msg = err.status ? `exited with code ${err.status}` : err.message;
    if (reporter) {
      reporter.warn(`hook '${name}' failed: ${msg}`);
    } else {
      console.error(`\x1b[33mWarning: hook '${name}' failed: ${msg}\x1b[0m`);
    }
  }
}
```

- [ ] **Step 2: Update interactive.js**

Replace `lib/interactive.js`:

```js
import { createInterface } from 'node:readline';
import { extractFolderName } from './config.js';

/**
 * Interactive path selection.
 * Returns filtered paths array.
 * @param {string[]} paths
 * @param {object} [reporter]
 */
export async function selectPaths(paths, reporter = null) {
  const write = reporter
    ? (s) => reporter.info(s)
    : (s) => console.log(s);

  write('\nAvailable folders:\n');

  const folders = paths.map((p, i) => {
    const name = extractFolderName(p);
    write(`  ${i + 1}) ${name} (${p})`);
    return { index: i, name, path: p };
  });

  write('  a) All\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const answer = await new Promise((resolve) => {
    rl.question('Select folders (comma-separated numbers or "a" for all): ', resolve);
  });
  rl.close();

  const input = answer.trim().toLowerCase();

  if (input === 'a' || input === 'all' || input === '') {
    return paths;
  }

  const indices = input.split(',')
    .map(s => parseInt(s.trim(), 10) - 1)
    .filter(i => i >= 0 && i < paths.length);

  if (indices.length === 0) {
    write('No valid selection, using all folders.');
    return paths;
  }

  const selected = indices.map(i => paths[i]);
  const names = indices.map(i => folders[i].name).join(', ');
  write(`\nSelected: ${names}\n`);

  return selected;
}
```

- [ ] **Step 3: Update watch.js**

Replace `lib/watch.js`:

```js
import { watch as fsWatch } from 'node:fs';
import { resolve } from 'node:path';
import { extractFolderName } from './config.js';
import { syncAll } from './sync.js';

/**
 * Watch local folders for changes and auto-push.
 * @param {object} config
 * @param {object} options
 * @param {object} [reporter]
 */
export function startWatch(config, options = {}, reporter = null) {
  const { paths } = config.remote;
  const debounceMs = 500;
  let timer = null;
  let syncing = false;

  const folders = paths.map(p => extractFolderName(p));

  const write = reporter
    ? (s) => reporter.info(s)
    : (s) => console.log(s);
  const writeErr = reporter
    ? (s) => reporter.error(s)
    : (s) => console.error(s);

  write('\x1b[1mWatching for changes...\x1b[0m');
  for (const folder of folders) {
    write(`  \x1b[36m→\x1b[0m ${folder}/`);
  }
  write('\nPress Ctrl+C to stop.\n');

  const watchers = [];

  for (const folder of folders) {
    const absPath = resolve(folder);
    try {
      const watcher = fsWatch(absPath, { recursive: true }, (eventType, filename) => {
        if (filename && (filename.startsWith('.') || filename.endsWith('~') || filename.endsWith('.swp'))) {
          return;
        }

        if (timer) clearTimeout(timer);
        timer = setTimeout(async () => {
          if (syncing) return;
          syncing = true;

          const time = new Date().toLocaleTimeString();
          write(`\x1b[90m[${time}]\x1b[0m Change detected${filename ? `: ${filename}` : ''}`);

          try {
            await syncAll(config, 'push', options, reporter);
          } catch (err) {
            writeErr(`Sync error: ${err.message}`);
          }

          syncing = false;
          write('\x1b[90mWatching for changes...\x1b[0m\n');
        }, debounceMs);
      });
      watchers.push(watcher);
    } catch (err) {
      if (reporter) {
        reporter.warn(`cannot watch '${folder}': ${err.message}`);
      } else {
        console.error(`\x1b[33mWarning: cannot watch '${folder}': ${err.message}\x1b[0m`);
      }
    }
  }

  process.on('SIGINT', () => {
    write('\n\x1b[1mStopping watch...\x1b[0m');
    for (const w of watchers) w.close();
    process.exit(0);
  });

  return watchers;
}
```

- [ ] **Step 4: Run all existing tests**

Run: `node --test test/*.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/hooks.js lib/interactive.js lib/watch.js
git commit -m "refactor: wire Reporter into hooks, interactive, and watch modules"
```

---

## Task 7: Backup module

**Files:**
- Create: `lib/backup.js`
- Create: `test/backup.test.js`

- [ ] **Step 1: Write failing tests**

```js
// test/backup.test.js
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
    // pull = local is destination, backup dir is local
    assert.ok(args.some(a => a.includes('.island-bridge-backups/2026-04-07T14-30-00/app')));
  });

  it('returns --backup and --backup-dir args for push', () => {
    const args = buildBackupArgs('push', '.island-bridge-backups', '~/.island-bridge-backups', 'app', new Date('2026-04-07T14:30:00Z'));
    assert.ok(args.includes('--backup'));
    // push = remote is destination, backup dir is remote
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/backup.test.js`
Expected: FAIL — `backup.js` does not exist.

- [ ] **Step 3: Implement backup module**

```js
// lib/backup.js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/backup.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/backup.js test/backup.test.js
git commit -m "feat: add backup module — generate, list, restore, clean backups"
```

---

## Task 8: Integrate backup into sync.js

**Files:**
- Modify: `lib/sync.js`

- [ ] **Step 1: Add backup args to buildRsyncArgs**

In `lib/sync.js`, add import at top:

```js
import { buildBackupArgs } from './backup.js';
```

In `syncAll`, after building `rsyncOptions` (around line 120-125), add:

```js
    // Build backup args
    let backupRsyncArgs = [];
    if (!options.noBackup && config.backup && config.backup.enabled) {
      const now = options._backupTimestamp || new Date();
      backupRsyncArgs = buildBackupArgs(
        direction,
        config.backup.localDir,
        config.backup.remoteDir,
        folderName,
        now
      );
    }
```

In `buildRsyncArgs`, add a new parameter for extra args, or splice backup args before the `--` separator in `syncAll`. The simplest approach: inject backup args into the args array returned by `buildRsyncArgs`:

After `const args = buildRsyncArgs(...)` in syncAll, add:

```js
    // Insert backup args before the '--' separator
    if (backupRsyncArgs.length > 0) {
      const sepIndex = args.indexOf('--');
      args.splice(sepIndex, 0, ...backupRsyncArgs);
    }
```

- [ ] **Step 2: Run existing tests**

Run: `node --test test/sync.test.js`
Expected: All tests PASS (buildRsyncArgs itself is unchanged).

- [ ] **Step 3: Commit**

```bash
git add lib/sync.js
git commit -m "feat: integrate backup args into rsync sync flow"
```

---

## Task 9: Init command

**Files:**
- Create: `lib/init.js`
- Create: `test/init.test.js`

- [ ] **Step 1: Write failing tests**

```js
// test/init.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfig } from '../lib/init.js';

describe('buildConfig', () => {
  it('builds config from flags', () => {
    const config = buildConfig({
      host: 'example.com',
      user: 'deploy',
      paths: '/var/www/app,/etc/nginx/conf.d',
    });
    assert.equal(config.remote.host, 'example.com');
    assert.equal(config.remote.user, 'deploy');
    assert.deepStrictEqual(config.remote.paths, ['/var/www/app', '/etc/nginx/conf.d']);
  });

  it('includes exclude patterns when provided', () => {
    const config = buildConfig({
      host: 'h',
      user: 'u',
      paths: '/app',
      exclude: 'node_modules,*.log',
    });
    assert.deepStrictEqual(config.exclude, ['node_modules', '*.log']);
  });

  it('omits exclude when not provided', () => {
    const config = buildConfig({ host: 'h', user: 'u', paths: '/app' });
    assert.equal(config.exclude, undefined);
  });

  it('throws if host is missing', () => {
    assert.throws(() => buildConfig({ user: 'u', paths: '/app' }), /host.*required/i);
  });

  it('throws if user is missing', () => {
    assert.throws(() => buildConfig({ host: 'h', paths: '/app' }), /user.*required/i);
  });

  it('throws if paths is missing', () => {
    assert.throws(() => buildConfig({ host: 'h', user: 'u' }), /paths.*required/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/init.test.js`
Expected: FAIL — `init.js` does not exist.

- [ ] **Step 3: Implement init module**

```js
// lib/init.js
import { createInterface } from 'node:readline';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_FILE = 'island-bridge.json';

/**
 * Build a config object from flag values.
 * @param {object} opts - { host, user, paths, exclude? }
 * @returns {object} config object ready to serialize
 */
export function buildConfig(opts) {
  if (!opts.host) throw new Error('host is required');
  if (!opts.user) throw new Error('user is required');
  if (!opts.paths) throw new Error('paths is required');

  const remotePaths = opts.paths.split(',').map(p => p.trim()).filter(Boolean);
  const config = {
    remote: {
      host: opts.host,
      user: opts.user,
      paths: remotePaths,
    },
  };

  if (opts.exclude) {
    config.exclude = opts.exclude.split(',').map(e => e.trim()).filter(Boolean);
  }

  return config;
}

/**
 * Ask a question via readline.
 */
function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

/**
 * Run the init command.
 * @param {object} args - parsed CLI args
 * @param {object} reporter - Reporter instance
 */
export async function runInit(args, reporter) {
  const configPath = join(process.cwd(), CONFIG_FILE);

  // Non-interactive mode (--json or flags provided)
  if (args.json || (args.host && args.user && args.paths)) {
    if (!args.host || !args.user || !args.paths) {
      reporter.error(
        'Non-interactive init requires --host, --user, and --paths',
        'Example: island-bridge init --host example.com --user deploy --paths "/var/www/app"'
      );
      return false;
    }

    const config = buildConfig({ host: args.host, user: args.user, paths: args.paths });

    if (existsSync(configPath) && !args.force) {
      reporter.error(
        `${CONFIG_FILE} already exists`,
        'Use --force to overwrite, or delete the file first'
      );
      return false;
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    reporter.info(`Created ${CONFIG_FILE}`);
    return true;
  }

  // Interactive mode
  if (existsSync(configPath)) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await ask(rl, `${CONFIG_FILE} already exists. Overwrite? (y/N): `);
    rl.close();
    if (answer.trim().toLowerCase() !== 'y') {
      reporter.info('Aborted.');
      return false;
    }
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const host = await ask(rl, '? Remote host: ');
  const user = await ask(rl, '? SSH user: ');
  const pathsRaw = await ask(rl, '? Remote paths (comma-separated): ');
  const excludeRaw = await ask(rl, '? Exclude patterns (comma-separated, optional): ');

  rl.close();

  if (!host.trim() || !user.trim() || !pathsRaw.trim()) {
    reporter.error('host, user, and paths are required');
    return false;
  }

  const config = buildConfig({
    host: host.trim(),
    user: user.trim(),
    paths: pathsRaw.trim(),
    exclude: excludeRaw.trim() || undefined,
  });

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  reporter.info(`\u2713 Created ${CONFIG_FILE}`);
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/init.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/init.js test/init.test.js
git commit -m "feat: add init command — interactive and flag-based config generation"
```

---

## Task 10: Status command

**Files:**
- Create: `lib/status.js`
- Create: `test/status.test.js`

- [ ] **Step 1: Write failing tests**

```js
// test/status.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkSsh, parseRsyncVersion } from '../lib/status.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/status.test.js`
Expected: FAIL — `status.js` does not exist.

- [ ] **Step 3: Implement status module**

```js
// lib/status.js
import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extractFolderName, backupDefaults } from './config.js';
import { listBackups } from './backup.js';

/**
 * Parse rsync version from --version output.
 * @param {string} output
 * @returns {string|null}
 */
export function parseRsyncVersion(output) {
  const match = output.match(/rsync\s+version\s+([\d.]+)/);
  return match ? match[1] : null;
}

/**
 * Check rsync availability and return version.
 * @returns {Promise<{available: boolean, version: string|null}>}
 */
export function checkRsyncVersion() {
  return new Promise((resolve) => {
    execFile('rsync', ['--version'], (err, stdout) => {
      if (err) {
        resolve({ available: false, version: null });
      } else {
        resolve({ available: true, version: parseRsyncVersion(stdout) });
      }
    });
  });
}

/**
 * Check SSH connectivity.
 * @param {string} user
 * @param {string} host
 * @returns {Promise<{connected: boolean, error: string|null}>}
 */
export function checkSsh(user, host) {
  return new Promise((resolve) => {
    execFile('ssh', ['-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes', `${user}@${host}`, 'echo ok'], {
      timeout: 10000,
    }, (err, stdout) => {
      if (err) {
        resolve({ connected: false, error: err.message });
      } else {
        resolve({ connected: stdout.trim() === 'ok', error: null });
      }
    });
  });
}

/**
 * Check if remote paths exist.
 * @param {string} user
 * @param {string} host
 * @param {string[]} paths
 * @returns {Promise<{path: string, folder: string, exists: boolean}[]>}
 */
export async function checkRemotePaths(user, host, paths) {
  const results = [];
  for (const p of paths) {
    const folder = extractFolderName(p);
    try {
      execFileSync('ssh', [
        '-o', 'ConnectTimeout=5',
        '-o', 'BatchMode=yes',
        `${user}@${host}`,
        `test -d "${p}"`,
      ], { timeout: 10000, stdio: 'pipe' });
      results.push({ path: p, folder, exists: true });
    } catch {
      results.push({ path: p, folder, exists: false });
    }
  }
  return results;
}

/**
 * Run the status command.
 * @param {object} config - loaded config
 * @param {object} reporter
 */
export async function runStatus(config, reporter) {
  const { host, user, paths } = config.remote;

  reporter.info(`Config:    ${config._filePath}`);
  reporter.info(`Remote:    ${user}@${host}`);

  // Check rsync
  const rsync = await checkRsyncVersion();
  if (rsync.available) {
    reporter.info(`rsync:     \u2713 available (v${rsync.version})`);
  } else {
    reporter.error('rsync:     \u2717 not found', 'Install rsync: sudo apt install rsync');
  }

  // Check SSH
  const ssh = await checkSsh(user, host);
  if (ssh.connected) {
    reporter.info('SSH:       \u2713 connected');
  } else {
    reporter.error(`SSH:       \u2717 connection failed`, `ssh ${user}@${host}`);
  }

  // Check remote paths
  if (ssh.connected) {
    const pathResults = await checkRemotePaths(user, host, paths);
    reporter.info('Paths:');
    for (const p of pathResults) {
      const status = p.exists ? '\u2713 exists' : '\u2717 not found';
      reporter.info(`  ${p.folder.padEnd(12)} ${p.path.padEnd(24)} ${status}`);
    }
  }

  // Backup info
  const backupConfig = config.backup || backupDefaults();
  if (backupConfig.enabled) {
    const backups = listBackups(backupConfig.localDir);
    reporter.info(`Backup:    enabled (${backups.length} backups)`);
  } else {
    reporter.info('Backup:    disabled');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/status.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/status.js test/status.test.js
git commit -m "feat: add status command — SSH, rsync, paths diagnostics"
```

---

## Task 11: Rewire cli.js — route all commands through Reporter

**Files:**
- Modify: `bin/cli.js`

- [ ] **Step 1: Rewrite cli.js**

Replace `bin/cli.js` entirely:

```js
#!/usr/bin/env node

import { parseArgs } from '../lib/args.js';
import { loadConfig, extractFolderName } from '../lib/config.js';
import { checkRsync, syncAll, diffPreview } from '../lib/sync.js';
import { Reporter } from '../lib/reporter.js';
import { startWatch } from '../lib/watch.js';
import { recordSync, showHistory } from '../lib/history.js';
import { runHook } from '../lib/hooks.js';
import { selectPaths } from '../lib/interactive.js';
import { runInit } from '../lib/init.js';
import { runStatus } from '../lib/status.js';
import { listBackups, restoreBackup, cleanBackups } from '../lib/backup.js';
import { getErrorHint } from '../lib/summary.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const USAGE = `
island-bridge v${pkg.version} - Sync remote folders via rsync over SSH

Usage:
  island-bridge <command> [options]

Commands:
  pull        Pull remote folders to local directory
  push        Push local folders to remote server
  watch       Watch local folders and auto-push on changes
  diff        Preview changes without syncing
  history     Show sync history
  init        Create island-bridge.json config interactively
  status      Show config, SSH, rsync, and paths status
  backup      Manage sync backups (list, restore, clean)

Options:
  -n, --dry-run        Preview sync without making changes
  -v, --verbose        Show detailed output
  -q, --quiet          Suppress output (exit code only)
  -c, --config <path>  Use specific config file
      --env <name>     Use named profile from config
      --bwlimit <KB/s> Limit transfer bandwidth
  -s, --select         Interactively select folders to sync
      --path <name>    Sync specific folder by name (repeatable)
      --json           Output in JSON format (for scripts/AI)
      --no-backup      Skip backup for this sync
  -V, --version        Show version
  -h, --help           Show this help message

Backup subcommands:
  backup list                  List available backups
  backup restore <timestamp>   Restore files from a backup
  backup clean --keep <N>      Remove old backups, keep N most recent
`.trim();

async function main() {
  let args;
  try {
    args = parseArgs();
  } catch (err) {
    console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    process.exit(1);
  }

  const reporter = new Reporter(args.json ? 'json' : 'human');

  if (args.help || (!args.command && !args.version)) {
    console.log(USAGE);
    process.exit(0);
  }

  if (args.version) {
    if (args.json) {
      reporter.setCommand('version');
      reporter.info(pkg.version);
      reporter.flush();
    } else {
      console.log(`island-bridge v${pkg.version}`);
    }
    process.exit(0);
  }

  const validCommands = ['pull', 'push', 'watch', 'diff', 'history', 'init', 'status', 'backup'];
  if (!validCommands.includes(args.command)) {
    reporter.error(
      `Unknown command: ${args.command}`,
      `Valid commands: ${validCommands.join(', ')}`
    );
    if (args.json) reporter.flush();
    process.exit(1);
  }

  reporter.setCommand(args.command);

  // === Init ===
  if (args.command === 'init') {
    const ok = await runInit(args, reporter);
    if (args.json) reporter.flush();
    process.exit(ok ? 0 : 1);
  }

  // === History (doesn't need rsync) ===
  if (args.command === 'history') {
    let config;
    try {
      config = loadConfig({ configPath: args.config, env: args.env });
    } catch {
      // Show history from cwd if no config found
    }
    if (args.json) {
      // Load history data and pass to reporter
      const { readFileSync: rfs, existsSync: efs } = await import('node:fs');
      const { dirname: dn, join: jn } = await import('node:path');
      const historyFile = config?._filePath
        ? jn(dn(config._filePath), '.island-bridge-history.json')
        : '.island-bridge-history.json';
      let entries = [];
      if (efs(historyFile)) {
        try {
          const parsed = JSON.parse(rfs(historyFile, 'utf-8'));
          entries = Array.isArray(parsed) ? parsed : [];
        } catch { /* ignore */ }
      }
      reporter.historyReport(entries);
      reporter.flush();
    } else {
      showHistory(config?._filePath);
    }
    process.exit(0);
  }

  // === Backup ===
  if (args.command === 'backup') {
    let config;
    try {
      config = loadConfig({ configPath: args.config, env: args.env });
    } catch {
      config = { backup: { enabled: true, localDir: '.island-bridge-backups', remoteDir: '~/.island-bridge-backups', maxCount: 10 } };
    }
    const backupConfig = config.backup;

    if (args.subcommand === 'list') {
      const backups = listBackups(backupConfig.localDir);
      if (args.json) {
        reporter.historyReport(backups.map(b => ({ timestamp: b.name, date: b.date.toISOString() })));
        reporter.flush();
      } else {
        if (backups.length === 0) {
          console.log('No backups found.');
        } else {
          console.log('\n--- Backups ---\n');
          for (const b of backups) {
            console.log(`  ${b.name}  (${b.date.toLocaleString()})`);
          }
          console.log(`\n${backups.length} backup(s) found.`);
        }
      }
      process.exit(0);
    }

    if (args.subcommand === 'restore') {
      if (!args.backupTimestamp) {
        reporter.error('backup restore requires a timestamp', 'Run "island-bridge backup list" to see available backups');
        if (args.json) reporter.flush();
        process.exit(1);
      }
      try {
        const results = restoreBackup(backupConfig.localDir, args.backupTimestamp);
        if (args.json) {
          for (const r of results) {
            reporter.syncEnd(r.folder, r);
          }
          reporter.flush();
        } else {
          for (const r of results) {
            if (r.success) {
              console.log(`  \x1b[32m\u2713\x1b[0m ${r.folder} restored`);
            } else {
              console.log(`  \x1b[31m\u2717\x1b[0m ${r.folder} — ${r.error}`);
            }
          }
        }
      } catch (err) {
        reporter.error(err.message, 'Run "island-bridge backup list" to see available backups');
        if (args.json) reporter.flush();
        process.exit(1);
      }
      process.exit(0);
    }

    if (args.subcommand === 'clean') {
      const keep = args.keep || backupConfig.maxCount || 10;
      const removed = cleanBackups(backupConfig.localDir, keep);
      if (args.json) {
        reporter.info(`Removed ${removed.length} backup(s), keeping ${keep}`);
        reporter.flush();
      } else {
        if (removed.length === 0) {
          console.log(`No backups to remove (keeping ${keep}).`);
        } else {
          for (const name of removed) {
            console.log(`  Removed: ${name}`);
          }
          console.log(`\nRemoved ${removed.length} backup(s), keeping ${keep}.`);
        }
      }
      process.exit(0);
    }

    reporter.error(
      'Unknown backup subcommand',
      'Usage: island-bridge backup <list|restore|clean>'
    );
    if (args.json) reporter.flush();
    process.exit(1);
  }

  // === Pre-flight: check rsync ===
  const rsyncOk = await checkRsync();
  if (!rsyncOk) {
    reporter.error(
      'rsync is required but not found in PATH',
      getErrorHint('rsync-not-found')
    );
    if (args.json) reporter.flush();
    process.exit(1);
  }

  // === Load config ===
  let config;
  try {
    config = loadConfig({ configPath: args.config, env: args.env });
  } catch (err) {
    const hint = err.message.includes('Cannot find')
      ? getErrorHint('config-not-found')
      : null;
    reporter.error(err.message, hint);
    if (args.json) reporter.flush();
    process.exit(1);
  }

  if (args.env) {
    reporter.info(`Using profile: ${args.env}`);
  }
  if (config._filePath) {
    reporter.info(`Config: ${config._filePath}`);
  }

  // === Status ===
  if (args.command === 'status') {
    await runStatus(config, reporter);
    if (args.json) reporter.flush();
    process.exit(0);
  }

  // === --path filter ===
  if (args.path.length > 0) {
    const allNames = config.remote.paths.map(p => extractFolderName(p));
    const invalid = args.path.filter(name => !allNames.includes(name));
    if (invalid.length > 0) {
      reporter.error(
        `Unknown folder name(s): ${invalid.join(', ')}`,
        `Available folders: ${allNames.join(', ')}`
      );
      if (args.json) reporter.flush();
      process.exit(1);
    }
    config.remote.paths = config.remote.paths.filter(p =>
      args.path.includes(extractFolderName(p))
    );
  }

  // === Interactive selection ===
  if (args.select && !args.json && ['pull', 'push', 'diff'].includes(args.command)) {
    config.remote.paths = await selectPaths(config.remote.paths, reporter);
  }

  // === Watch mode ===
  if (args.command === 'watch') {
    startWatch(config, {
      dryRun: args.dryRun,
      verbose: args.verbose,
      quiet: args.quiet,
      bwlimit: args.bwlimit,
      noBackup: args.noBackup,
    }, reporter);
    return;
  }

  // === Diff preview ===
  if (args.command === 'diff') {
    const diffs = await diffPreview(config, 'pull', {
      bwlimit: args.bwlimit,
      exclude: config.exclude,
    });
    reporter.diffReport(diffs);
    if (args.json) reporter.flush();
    process.exit(0);
  }

  // === Pull or Push ===
  const options = {
    dryRun: args.dryRun,
    verbose: args.verbose,
    quiet: args.quiet,
    bwlimit: args.bwlimit,
    noBackup: args.noBackup,
  };

  // Disable hooks from configs found via upward search
  if (!config._explicitConfig && config._filePath !== join(process.cwd(), 'island-bridge.json')) {
    if (config.hooks.beforeSync || config.hooks.afterSync) {
      reporter.warn(`hooks ignored from inherited config ${config._filePath}`);
      reporter.warn(`Use --config ${config._filePath} to explicitly enable hooks.`);
      config.hooks = {};
    }
  }

  // Run beforeSync hook
  if (config.hooks.beforeSync) {
    runHook('beforeSync', config.hooks.beforeSync, args.quiet, reporter);
  }

  const results = await syncAll(config, args.command, options, reporter);

  // Run afterSync hook
  if (config.hooks.afterSync) {
    runHook('afterSync', config.hooks.afterSync, args.quiet, reporter);
  }

  // Record history
  recordSync(config._filePath, args.command, results);

  // Print summary
  if (!args.quiet || args.json) {
    reporter.summary(results);
    if (!args.json && args.dryRun) {
      reporter.info('(dry-run mode \u2014 no changes were made)');
    }
  }

  if (args.json) reporter.flush();

  const hasFailed = results.some(r => !r.success);
  process.exit(hasFailed ? 1 : 0);
}

main();
```

- [ ] **Step 2: Run all tests**

Run: `node --test test/*.test.js`
Expected: All tests PASS.

- [ ] **Step 3: Manual smoke test**

Run: `node bin/cli.js --help`
Expected: Updated help text with all new commands and options.

Run: `node bin/cli.js --version --json`
Expected: JSON output with version.

- [ ] **Step 4: Commit**

```bash
git add bin/cli.js
git commit -m "feat: rewire cli.js — Reporter injection, new command routing, error hints"
```

---

## Task 12: Update package.json version and final commit

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump version to 2.0.0**

In `package.json`, change line 3:

```json
  "version": "2.0.0",
```

- [ ] **Step 2: Run full test suite**

Run: `node --test test/*.test.js`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 2.0.0"
```
