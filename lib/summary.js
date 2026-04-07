/**
 * Map rsync exit codes to human-readable messages.
 */
export function rsyncExitMessage(code) {
  const messages = {
    0: 'success',
    11: 'disk full or quota exceeded',
    12: 'rsync protocol error: possible network issue',
    23: 'partial transfer: some files could not be synced',
    24: 'vanished source files: some files disappeared during transfer',
    30: 'timeout waiting for response',
    35: 'timeout waiting for daemon connection',
    255: 'SSH connection failed: check your SSH config and connectivity',
  };
  return messages[code] || `rsync failed with exit code ${code}`;
}

/**
 * Print a summary of sync results.
 */
export function printSummary(results) {
  console.log('\n--- Sync Summary ---');

  for (const r of results) {
    if (r.success) {
      console.log(`  \x1b[32m✓\x1b[0m ${r.folderName} — synced successfully`);
    } else {
      console.log(`  \x1b[31m✗\x1b[0m ${r.folderName} — ${r.error}`);
    }
  }

  const failed = results.filter(r => !r.success).length;
  const total = results.length;
  console.log(`\n${total - failed}/${total} folders synced successfully.`);
}

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
