import { readFileSync, existsSync } from 'node:fs';
import { basename, resolve, dirname, join } from 'node:path';
import type { IslandBridgeConfig, BackupConfig } from './types.js';

const CONFIG_FILE = 'island-bridge.json';

/**
 * Search for config file starting from startDir, walking up to root.
 */
export function findConfigFile(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir);

  while (true) {
    const candidate = join(dir, CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Load and validate config.
 */
export function loadConfig(options: { configPath?: string; env?: string } = {}): IslandBridgeConfig {
  const { configPath, env } = options;
  let filePath: string;

  if (configPath) {
    filePath = resolve(configPath);
    if (!existsSync(filePath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
  } else {
    const found = findConfigFile();
    if (!found) {
      throw new Error(`Cannot find ${CONFIG_FILE} in current or parent directories`);
    }
    filePath = found;
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    throw new Error(`Failed to read config: ${filePath}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let config: any;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse ${filePath}: invalid JSON`);
  }

  // Merge profile if specified
  if (env) {
    if (env === '__proto__' || env === 'constructor' || env === 'prototype') {
      throw new Error(`Config error: profile name '${env}' is not allowed`);
    }
    if (!config.profiles || !config.profiles[env]) {
      const available = config.profiles ? Object.keys(config.profiles).join(', ') : 'none';
      throw new Error(`Profile '${env}' not found. Available: ${available}`);
    }
    const profile = config.profiles[env];
    config = {
      ...config,
      ...profile,
      remote: { ...config.remote, ...profile.remote },
      hooks: { ...config.hooks, ...profile.hooks },
    };
  }

  validate(config);

  // Normalize optional fields
  config.exclude = config.exclude || [];
  config.hooks = config.hooks || {};
  config.bwlimit = config.bwlimit || null;
  config.backup = { ...backupDefaults(), ...(config.backup || {}) };
  config._filePath = filePath;
  config._explicitConfig = !!configPath;

  return config as IslandBridgeConfig;
}

/**
 * Validate config structure and values.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validate(config: any): void {
  if (!config.remote) {
    throw new Error("Config error: missing 'remote' section");
  }

  const { host, user, paths } = config.remote;

  if (!host || typeof host !== 'string' || host.trim() === '') {
    throw new Error("Config error: 'host' must be a non-empty string");
  }
  if (!/^[a-zA-Z0-9._:-]+$/.test(host)) {
    throw new Error("Config error: 'host' contains invalid characters. Use hostname, IPv4, or IPv6 only");
  }

  if (!user || typeof user !== 'string' || user.trim() === '') {
    throw new Error("Config error: 'user' must be a non-empty string");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(user)) {
    throw new Error("Config error: 'user' contains invalid characters");
  }

  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("Config error: 'paths' must be a non-empty array of remote paths");
  }

  const seen = new Set<string>();
  for (const p of paths) {
    if (typeof p !== 'string' || p.trim() === '') {
      throw new Error(`Config error: each path must be a non-empty string`);
    }
    if (p.startsWith('-')) {
      throw new Error(`Config error: remote path '${p}' must not start with '-'`);
    }
    if (/[`$;|&><(){}]/.test(p)) {
      throw new Error(`Config error: remote path '${p}' contains disallowed characters`);
    }
    const name = extractFolderName(p);
    if (seen.has(name)) {
      throw new Error(`Config error: folder name collision — multiple remote paths resolve to '${name}'`);
    }
    seen.add(name);
  }

  // Validate exclude
  if (config.exclude !== undefined) {
    if (!Array.isArray(config.exclude)) {
      throw new Error("Config error: 'exclude' must be an array of strings");
    }
    for (const e of config.exclude) {
      if (typeof e !== 'string') {
        throw new Error("Config error: each exclude pattern must be a string");
      }
      if (e.startsWith('-')) {
        throw new Error(`Config error: exclude pattern '${e}' must not start with '-'`);
      }
    }
  }

  // Validate hooks
  if (config.hooks !== undefined) {
    if (typeof config.hooks !== 'object' || Array.isArray(config.hooks)) {
      throw new Error("Config error: 'hooks' must be an object");
    }
    for (const key of Object.keys(config.hooks)) {
      if (key !== 'beforeSync' && key !== 'afterSync') {
        throw new Error(`Config error: unknown hook '${key}'. Supported: beforeSync, afterSync`);
      }
      if (typeof config.hooks[key] !== 'string') {
        throw new Error(`Config error: hook '${key}' must be a string`);
      }
    }
  }

  // Validate bwlimit
  if (config.bwlimit !== undefined && config.bwlimit !== null) {
    if (typeof config.bwlimit !== 'number' || config.bwlimit <= 0) {
      throw new Error("Config error: 'bwlimit' must be a positive number (KB/s)");
    }
  }

  // Validate profiles
  if (config.profiles !== undefined) {
    if (typeof config.profiles !== 'object' || Array.isArray(config.profiles)) {
      throw new Error("Config error: 'profiles' must be an object");
    }
  }

  // Validate backup
  if (config.backup !== undefined) {
    validateBackupConfig(config.backup);
  }
}

/**
 * Return default backup config values.
 */
export function backupDefaults(): BackupConfig {
  return {
    enabled: true,
    maxCount: 10,
    localDir: '.island-bridge-backups',
    remoteDir: '~/.island-bridge-backups',
  };
}

/**
 * Validate backup config section.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateBackupConfig(backup: any): void {
  if (typeof backup !== 'object' || Array.isArray(backup) || backup === null) {
    throw new Error("Config error: 'backup' must be an object");
  }
  if (backup.enabled !== undefined && typeof backup.enabled !== 'boolean') {
    throw new Error("Config error: 'backup.enabled' must be a boolean");
  }
  if (backup.maxCount !== undefined) {
    if (typeof backup.maxCount !== 'number' || backup.maxCount <= 0) {
      throw new Error("Config error: 'backup.maxCount' must be a positive number");
    }
  }
  if (backup.localDir !== undefined && typeof backup.localDir !== 'string') {
    throw new Error("Config error: 'backup.localDir' must be a string");
  }
  if (backup.remoteDir !== undefined && typeof backup.remoteDir !== 'string') {
    throw new Error("Config error: 'backup.remoteDir' must be a string");
  }
}

/**
 * Extract folder name (last path component) from a remote path.
 * Strips trailing slashes. Rejects root "/" and empty strings.
 */
export function extractFolderName(remotePath: string): string {
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
