import { createInterface } from 'node:readline';
import { extractFolderName } from './config.js';

/**
 * Interactive path selection.
 * Returns filtered paths array.
 */
export async function selectPaths(paths) {
  console.log('\nAvailable folders:\n');

  const folders = paths.map((p, i) => {
    const name = extractFolderName(p);
    console.log(`  ${i + 1}) ${name} (${p})`);
    return { index: i, name, path: p };
  });

  console.log(`  a) All\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const answer = await new Promise((resolve) => {
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
    console.log('No valid selection, using all folders.');
    return paths;
  }

  const selected = indices.map(i => paths[i]);
  const names = indices.map(i => folders[i].name).join(', ');
  console.log(`\nSelected: ${names}\n`);

  return selected;
}
