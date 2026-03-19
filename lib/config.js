import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const CONFIG_FILE = 'island-bridge.json';

/**
 * Load and validate config from island-bridge.json in cwd.
 */
export function loadConfig() {
  let raw;
  try {
    raw = readFileSync(CONFIG_FILE, 'utf-8');
  } catch {
    throw new Error(`Failed to read ${CONFIG_FILE} from current directory`);
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse ${CONFIG_FILE}: invalid JSON`);
  }

  validate(config);
  return config;
}

/**
 * Validate config structure and values.
 */
function validate(config) {
  if (!config.remote) {
    throw new Error("Config error: missing 'remote' section");
  }

  const { host, user, paths } = config.remote;

  if (!host || typeof host !== 'string' || host.trim() === '') {
    throw new Error("Config error: 'host' must be a non-empty string");
  }
  if (host.startsWith('-') || /\s/.test(host)) {
    throw new Error("Config error: 'host' must not start with '-' or contain whitespace");
  }

  if (!user || typeof user !== 'string' || user.trim() === '') {
    throw new Error("Config error: 'user' must be a non-empty string");
  }
  if (user.startsWith('-') || /\s/.test(user)) {
    throw new Error("Config error: 'user' must not start with '-' or contain whitespace");
  }

  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("Config error: 'paths' must be a non-empty array of remote paths");
  }

  const seen = new Set();
  for (const p of paths) {
    if (typeof p !== 'string' || p.trim() === '') {
      throw new Error(`Config error: each path must be a non-empty string`);
    }
    if (p.startsWith('-')) {
      throw new Error(`Config error: remote path '${p}' must not start with '-'`);
    }
    const name = extractFolderName(p);
    if (seen.has(name)) {
      throw new Error(`Config error: folder name collision — multiple remote paths resolve to '${name}'`);
    }
    seen.add(name);
  }
}

/**
 * Extract folder name (last path component) from a remote path.
 * Strips trailing slashes. Rejects root "/" and empty strings.
 */
export function extractFolderName(remotePath) {
  const trimmed = remotePath.replace(/\/+$/, '');
  if (trimmed === '' || trimmed === '/') {
    throw new Error(`Config error: remote path '${remotePath}' resolves to root or is empty`);
  }
  const name = basename(trimmed);
  if (!name) {
    throw new Error(`Config error: cannot extract folder name from '${remotePath}'`);
  }
  return name;
}
