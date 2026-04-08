import { createInterface } from 'node:readline';
import * as readline from 'node:readline';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedArgs } from './types.js';

const CONFIG_FILE = 'island-bridge.json';

/**
 * Build a config object from flag values.
 * @param opts - { host, user, paths, exclude? }
 * @returns config object ready to serialize
 */
export function buildConfig(opts: {
  host?: string;
  user?: string;
  paths?: string;
  exclude?: string;
}): { remote: { host: string; user: string; paths: string[] }; exclude?: string[] } {
  if (!opts.host) throw new Error('host is required');
  if (!opts.user) throw new Error('user is required');
  if (!opts.paths) throw new Error('paths is required');

  const remotePaths = opts.paths.split(',').map(p => p.trim()).filter(Boolean);
  const config: { remote: { host: string; user: string; paths: string[] }; exclude?: string[] } = {
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
function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

/**
 * Run the init command.
 * @param args - parsed CLI args
 * @param reporter - Reporter instance
 */
export async function runInit(
  args: ParsedArgs,
  reporter: { info(msg: string): void; error(msg: string, hint?: string | null): void }
): Promise<boolean> {
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
  reporter.info(`✓ Created ${CONFIG_FILE}`);
  return true;
}
