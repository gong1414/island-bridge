import { createInterface } from 'node:readline';
import { extractFolderName } from './config.js';

/**
 * Interactive path selection.
 * Returns filtered paths array.
 * @param paths
 * @param reporter
 */
export async function selectPaths(
  paths: string[],
  reporter: { info(msg: string): void } | null = null
): Promise<string[]> {
  const write: (s: string) => void = reporter
    ? (s) => reporter.info(s)
    : (s) => console.log(s);

  write('\nAvailable folders:\n');

  const folders = paths.map((p, i) => {
    const name = extractFolderName(p);
    write(`  ${i + 1}) ${name} (${p})`);
    return { index: i, name, path: p };
  });

  write('  a) All\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const answer = await new Promise<string>((resolve) => {
    rl.question('Select folders (comma-separated numbers or "a" for all): ', resolve);
  });
  rl.close();

  const input = answer.trim().toLowerCase();

  if (input === 'a' || input === 'all' || input === '') {
    return paths;
  }

  const indices = input.split(',')
    .map(s => parseInt(s.trim(), 10) - 1)
    .filter(i => i >= 0 && i < paths.length);

  if (indices.length === 0) {
    write('No valid selection, using all folders.');
    return paths;
  }

  const selected = indices.map(i => paths[i]);
  const names = indices.map(i => folders[i].name).join(', ');
  write(`\nSelected: ${names}\n`);

  return selected;
}
