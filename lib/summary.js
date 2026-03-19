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
