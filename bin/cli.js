#!/usr/bin/env node

import { loadConfig } from '../lib/config.js';
import { checkRsync, syncAll } from '../lib/sync.js';
import { printSummary } from '../lib/summary.js';

const USAGE = `
island-bridge - Sync remote folders to local directory via rsync

Usage:
  island-bridge pull    Pull remote folders to local directory
  island-bridge push    Push local folders to remote server
  island-bridge --help  Show this help message

Config:
  Place an island-bridge.json in the working directory:
  {
    "remote": {
      "host": "192.168.1.100",
      "user": "deploy",
      "paths": ["/var/www/app", "/etc/nginx/conf.d"]
    }
  }
`.trim();

async function main() {
  const command = process.argv[2];

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    process.exit(0);
  }

  if (command !== 'pull' && command !== 'push') {
    console.error(`Unknown command: ${command}`);
    console.error('Use "island-bridge pull" or "island-bridge push"');
    process.exit(1);
  }

  // Pre-flight: check rsync
  const rsyncOk = await checkRsync();
  if (!rsyncOk) {
    console.error('\x1b[31mError: rsync is required but not found in PATH. Install rsync and try again.\x1b[0m');
    process.exit(1);
  }

  // Load config
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    process.exit(1);
  }

  // Execute sync
  const results = await syncAll(config, command);

  // Print summary
  printSummary(results);

  // Exit with non-zero code if any transfers failed
  const hasFailed = results.some(r => !r.success);
  process.exit(hasFailed ? 1 : 0);
}

main();
