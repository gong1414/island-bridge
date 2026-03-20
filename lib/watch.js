import { watch as fsWatch } from 'node:fs';
import { resolve } from 'node:path';
import { extractFolderName } from './config.js';
import { syncAll } from './sync.js';

/**
 * Watch local folders for changes and auto-push.
 */
export function startWatch(config, options = {}) {
  const { paths } = config.remote;
  const debounceMs = 500;
  let timer = null;
  let syncing = false;

  const folders = paths.map(p => extractFolderName(p));

  console.log('\x1b[1mWatching for changes...\x1b[0m');
  for (const folder of folders) {
    console.log(`  \x1b[36m→\x1b[0m ${folder}/`);
  }
  console.log('\nPress Ctrl+C to stop.\n');

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
          console.log(`\x1b[90m[${time}]\x1b[0m Change detected${filename ? `: ${filename}` : ''}`);

          try {
            await syncAll(config, 'push', options);
          } catch (err) {
            console.error(`\x1b[31mSync error: ${err.message}\x1b[0m`);
          }

          syncing = false;
          console.log('\x1b[90mWatching for changes...\x1b[0m\n');
        }, debounceMs);
      });
      watchers.push(watcher);
    } catch (err) {
      console.error(`\x1b[33mWarning: cannot watch '${folder}': ${err.message}\x1b[0m`);
    }
  }

  process.on('SIGINT', () => {
    console.log('\n\x1b[1mStopping watch...\x1b[0m');
    for (const w of watchers) w.close();
    process.exit(0);
  });

  return watchers;
}
