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
