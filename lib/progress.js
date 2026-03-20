/**
 * Parse rsync stdout output in real-time.
 * - Lines NOT starting with whitespace = filenames (from -v verbose)
 * - Lines starting with whitespace = progress updates from --info=progress2
 * @param {object} stdout - Readable stream
 * @param {object} [options]
 * @param {boolean} [options.verbose] - Show extra detail
 */
export function streamProgress(stdout, options = {}) {
  let buffer = '';

  stdout.on('data', (chunk) => {
    buffer += chunk.toString();

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      // Handle \r-delimited progress updates
      const parts = line.split('\r');
      const displayLine = parts[parts.length - 1];

      if (!displayLine || displayLine.trim() === '') continue;

      if (/^\s/.test(displayLine)) {
        // Progress line from --info=progress2
        process.stdout.write(`\r\x1b[K  \x1b[36m${displayLine.trim()}\x1b[0m`);
      } else {
        const trimmed = displayLine.trim();
        if (trimmed === './' || trimmed === '') continue;

        if (trimmed.startsWith('deleting ')) {
          // Deletion highlighted in yellow
          process.stdout.write(`\r\x1b[K  \x1b[33m- ${trimmed.slice(9)}\x1b[0m\n`);
        } else {
          // New/updated file in green
          process.stdout.write(`\r\x1b[K  \x1b[32m+ ${trimmed}\x1b[0m\n`);
        }
      }
    }
  });

  stdout.on('end', () => {
    // Process remaining buffer
    if (buffer.trim()) {
      const parts = buffer.split('\r');
      const displayLine = parts[parts.length - 1]?.trim();
      if (displayLine && displayLine !== './') {
        process.stdout.write(`\r\x1b[K  \x1b[32m+ ${displayLine}\x1b[0m\n`);
      }
    }
    // Clear progress line
    process.stdout.write('\r\x1b[K');
  });
}
