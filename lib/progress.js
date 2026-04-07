/**
 * Parse rsync stdout output in real-time and emit events to reporter.
 * @param {object} stdout - Readable stream
 * @param {object} reporter - Reporter instance (or null for legacy fallback)
 * @param {object} [options]
 * @param {boolean} [options.verbose] - Show extra detail
 */
export function streamProgress(stdout, reporter, options = {}) {
  if (!reporter) {
    // Legacy fallback: write directly to stdout (v1 behavior)
    reporter = {
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
  }

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
