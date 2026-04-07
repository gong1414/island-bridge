import { execSync } from 'node:child_process';

/**
 * Execute a hook command.
 * @param name - Hook name (beforeSync, afterSync)
 * @param command - Shell command to execute
 * @param quiet - Suppress output
 * @param reporter - Reporter instance
 */
export function runHook(
  name: string,
  command: string,
  quiet: boolean = false,
  reporter: { info(msg: string): void; warn(msg: string): void } | null = null,
): void {
  if (!command) return;

  if (reporter) {
    reporter.info(`[hook:${name}] ${command}`);
  } else if (!quiet) {
    console.log(`\x1b[90m[hook:${name}] ${command}\x1b[0m`);
  }

  try {
    execSync(command, {
      stdio: quiet ? 'ignore' : 'inherit',
      timeout: 30000,
      shell: '/bin/sh',
    });
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    const msg = error.status ? `exited with code ${error.status}` : (error.message ?? String(err));
    if (reporter) {
      reporter.warn(`hook '${name}' failed: ${msg}`);
    } else {
      console.error(`\x1b[33mWarning: hook '${name}' failed: ${msg}\x1b[0m`);
    }
  }
}
