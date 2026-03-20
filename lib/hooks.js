import { execSync } from 'node:child_process';

/**
 * Execute a hook command.
 * @param {string} name - Hook name (beforeSync, afterSync)
 * @param {string} command - Shell command to execute
 * @param {boolean} quiet - Suppress output
 */
export function runHook(name, command, quiet = false) {
  if (!command) return;

  if (!quiet) {
    console.log(`\x1b[90m[hook:${name}] ${command}\x1b[0m`);
  }

  try {
    execSync(command, {
      stdio: quiet ? 'ignore' : 'inherit',
      timeout: 30000,
      shell: true,
    });
  } catch (err) {
    const msg = err.status ? `exited with code ${err.status}` : err.message;
    console.error(`\x1b[33mWarning: hook '${name}' failed: ${msg}\x1b[0m`);
  }
}
