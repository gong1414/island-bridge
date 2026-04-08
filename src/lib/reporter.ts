import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// In compiled output this file lives at dist/lib/reporter.js, so go up two levels to reach project root
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')) as { version: string };

interface JsonMessage {
  level: 'info' | 'warn';
  text: string;
}

interface JsonError {
  message: string;
  hint: string | null;
}

interface JsonResult {
  folder: string;
  remotePath: string;
  direction?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changes: { type: string; file: string }[] | any[];
  success: boolean | null;
  error: string | null;
}

export interface FlushOutput {
  version: string;
  command: string | null;
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any[];
  messages: JsonMessage[];
  errors: JsonError[];
}

export class Reporter {
  mode: 'human' | 'json';
  _write: (s: string) => void;
  _writeErr: (s: string) => void;
  _command: string | null;
  _messages: JsonMessage[];
  _errors: JsonError[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _results: any[];
  _currentResult: JsonResult | null;

  constructor(mode: 'human' | 'json' = 'human', io: { write?: (s: string) => void; writeErr?: (s: string) => void } = {}) {
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

  setCommand(command: string): void {
    this._command = command;
  }

  info(message: string): void {
    if (this.mode === 'json') {
      this._messages.push({ level: 'info', text: message });
    } else {
      this._write(`\x1b[90m${message}\x1b[0m\n`);
    }
  }

  warn(message: string): void {
    if (this.mode === 'json') {
      this._messages.push({ level: 'warn', text: message });
    } else {
      this._write(`\x1b[33mWarning: ${message}\x1b[0m\n`);
    }
  }

  error(message: string, hint: string | null = null): void {
    if (this.mode === 'json') {
      this._errors.push({ message, hint });
    } else {
      this._writeErr(`\x1b[31mError: ${message}\x1b[0m\n`);
      if (hint) {
        this._writeErr(`  \x1b[90mhint: ${hint}\x1b[0m\n`);
      }
    }
  }

  syncStart(direction: string, folderName: string, remotePath: string, opts: { dryRun?: boolean } = {}): void {
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

  syncProgress(data: string): void {
    if (this.mode === 'human') {
      this._write(`\r\x1b[K  \x1b[36m${data}\x1b[0m`);
    }
  }

  syncFileChange(type: string, filename: string): void {
    if (this._currentResult) {
      this._currentResult.changes.push({ type, file: filename });
    }
    if (this.mode === 'human') {
      const colors: Record<string, string> = { add: '32', delete: '33', modify: '36' };
      const symbols: Record<string, string> = { add: '+', delete: '-', modify: '~' };
      const c = colors[type] || '0';
      const s = symbols[type] || '?';
      this._write(`\r\x1b[K  \x1b[${c}m${s} ${filename}\x1b[0m\n`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  syncEnd(folderName: string, result: { success: boolean; error?: string | null }): void {
    if (this._currentResult) {
      this._currentResult.success = result.success;
      this._currentResult.error = result.error || null;
      this._results.push(this._currentResult);
      this._currentResult = null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  summary(results: any[]): void {
    if (this.mode === 'human') {
      this._write('\n--- Sync Summary ---\n');
      for (const r of results) {
        if (r.success) {
          this._write(`  \x1b[32m✓\x1b[0m ${r.folderName || r.folder} — synced successfully\n`);
        } else {
          this._write(`  \x1b[31m✗\x1b[0m ${r.folderName || r.folder} — ${r.error}\n`);
        }
      }
      const failed = results.filter(r => !r.success).length;
      const total = results.length;
      this._write(`\n${total - failed}/${total} folders synced successfully.\n`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diffReport(diffs: any[]): void {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  historyReport(entries: any[]): void {
    if (this.mode === 'human') {
      if (entries.length === 0) {
        this._write('No sync history found.\n');
        return;
      }
      this._write('\n--- Sync History ---\n\n');
      const recent = entries.slice(-20);
      for (const entry of recent) {
        const date = new Date(entry.timestamp).toLocaleString();
        const status = entry.success ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
        const dir = entry.direction === 'pull' ? '↓ pull' : '↑ push';
        const folders = entry.folders.map((f: { name: string }) => f.name).join(', ');
        const stats = `${entry.total - entry.failed}/${entry.total} ok`;
        this._write(`  ${status} ${date}  ${dir}  [${folders}]  ${stats}\n`);
      }
      this._write(`\nShowing last ${recent.length} of ${entries.length} entries.\n`);
    } else {
      this._results = entries;
    }
  }

  flush(): FlushOutput | null {
    if (this.mode === 'json') {
      const output: FlushOutput = {
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
