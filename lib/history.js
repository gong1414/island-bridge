import { readFileSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';

const HISTORY_FILE = '.island-bridge-history.json';

/**
 * Record a sync operation to history.
 */
export function recordSync(configPath, direction, results) {
  const historyPath = configPath ? join(dirname(configPath), HISTORY_FILE) : HISTORY_FILE;

  let history = [];
  if (existsSync(historyPath)) {
    try {
      const parsed = JSON.parse(readFileSync(historyPath, 'utf-8'));
      history = Array.isArray(parsed) ? parsed : [];
    } catch {
      history = [];
    }
  }

  const entry = {
    timestamp: new Date().toISOString(),
    direction,
    folders: results.map(r => ({
      name: r.folderName,
      path: r.remotePath,
      success: r.success,
      error: r.error || null,
    })),
    success: results.every(r => r.success),
    total: results.length,
    failed: results.filter(r => !r.success).length,
  };

  history.push(entry);

  // Keep last 100 entries
  if (history.length > 100) {
    history = history.slice(-100);
  }

  // Refuse to write through symlinks
  if (existsSync(historyPath) && lstatSync(historyPath).isSymbolicLink()) {
    return;
  }

  try {
    writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');
  } catch {
    // Silently ignore write errors for history
  }
}

/**
 * Display sync history.
 */
export function showHistory(configPath) {
  const historyPath = configPath ? join(dirname(configPath), HISTORY_FILE) : HISTORY_FILE;

  if (!existsSync(historyPath)) {
    console.log('No sync history found.');
    return;
  }

  let history;
  try {
    const parsed = JSON.parse(readFileSync(historyPath, 'utf-8'));
    history = Array.isArray(parsed) ? parsed : [];
  } catch {
    console.log('Failed to read history file.');
    return;
  }

  if (history.length === 0) {
    console.log('No sync history found.');
    return;
  }

  console.log('\n--- Sync History ---\n');

  const recent = history.slice(-20);
  for (const entry of recent) {
    const date = new Date(entry.timestamp).toLocaleString();
    const status = entry.success ? '\x1b[32m\u2713\x1b[0m' : '\x1b[31m\u2717\x1b[0m';
    const dir = entry.direction === 'pull' ? '\u2193 pull' : '\u2191 push';
    const folders = entry.folders.map(f => f.name).join(', ');
    const stats = `${entry.total - entry.failed}/${entry.total} ok`;

    console.log(`  ${status} ${date}  ${dir}  [${folders}]  ${stats}`);
  }

  console.log(`\nShowing last ${recent.length} of ${history.length} entries.`);
}
