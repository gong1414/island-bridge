export interface RemoteConfig {
  host: string;
  user: string;
  paths: string[];
}

export interface BackupConfig {
  enabled: boolean;
  maxCount: number;
  localDir: string;
  remoteDir: string;
}

export interface HooksConfig {
  beforeSync?: string;
  afterSync?: string;
}

export interface IslandBridgeConfig {
  remote: RemoteConfig;
  exclude: string[];
  hooks: HooksConfig;
  bwlimit: number | null;
  backup: BackupConfig;
  profiles?: Record<string, Partial<IslandBridgeConfig>>;
  _filePath: string;
  _explicitConfig: boolean;
}

export interface SyncResult {
  folderName: string;
  remotePath: string;
  success: boolean;
  error: string | null;
  exitCode?: number;
}

export interface SyncOptions {
  dryRun?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  bwlimit?: number | null;
  noBackup?: boolean;
  exclude?: string[];
  itemize?: boolean;
  _backupTimestamp?: Date;
}

export interface ParsedArgs {
  command: string | null;
  subcommand: string | null;
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  config: string | null;
  env: string | null;
  bwlimit: number | null;
  select: boolean;
  noBackup: boolean;
  path: string[];
  help: boolean;
  version: boolean;
  host: string | null;
  user: string | null;
  paths: string | null;
  backupTimestamp: string | null;
  keep: number | null;
  force?: boolean;
}

export interface DiffResult {
  folderName: string;
  remotePath: string;
  changes: string[];
}

export interface BackupEntry {
  name: string;
  date: Date;
}

export interface RestoreResult {
  folder: string;
  success: boolean;
  error: string | null;
}

export interface HistoryEntry {
  timestamp: string;
  direction: string;
  folders: { name: string; path: string; success: boolean; error: string | null }[];
  success: boolean;
  total: number;
  failed: number;
}
