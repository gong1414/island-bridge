# TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate island-bridge from JavaScript to TypeScript while preserving all functionality and tests.

**Architecture:** Move all source files from `lib/` and `bin/` into `src/lib/` and `src/bin/` as `.ts` files with proper type annotations. Move tests to `test/*.test.ts`. Compile with `tsc` to `dist/`. Use `tsx` for running tests directly against source.

**Tech Stack:** TypeScript 5.7+, tsx 4.19+, Node.js >= 18, node:test

---

## File Map

| Source (old JS) | Target (new TS) | Action |
|-----------------|-----------------|--------|
| — | `tsconfig.json` | Create |
| — | `.gitignore` | Modify (add dist/) |
| `package.json` | `package.json` | Modify (scripts, devDeps, bin, files) |
| — | `src/lib/types.ts` | Create (shared interfaces) |
| `lib/args.js` | `src/lib/args.ts` | Migrate |
| `lib/summary.js` | `src/lib/summary.ts` | Migrate |
| `lib/config.js` | `src/lib/config.ts` | Migrate |
| `lib/reporter.js` | `src/lib/reporter.ts` | Migrate |
| `lib/hooks.js` | `src/lib/hooks.ts` | Migrate |
| `lib/history.js` | `src/lib/history.ts` | Migrate |
| `lib/backup.js` | `src/lib/backup.ts` | Migrate |
| `lib/progress.js` | `src/lib/progress.ts` | Migrate |
| `lib/interactive.js` | `src/lib/interactive.ts` | Migrate |
| `lib/init.js` | `src/lib/init.ts` | Migrate |
| `lib/sync.js` | `src/lib/sync.ts` | Migrate |
| `lib/watch.js` | `src/lib/watch.ts` | Migrate |
| `lib/status.js` | `src/lib/status.ts` | Migrate |
| `bin/cli.js` | `src/bin/cli.ts` | Migrate |
| `test/args.test.js` | `test/args.test.ts` | Migrate |
| `test/config.test.js` | `test/config.test.ts` | Migrate |
| `test/sync.test.js` | `test/sync.test.ts` | Migrate |
| `test/reporter.test.js` | `test/reporter.test.ts` | Migrate |
| `test/summary.test.js` | `test/summary.test.ts` | Migrate |
| `test/backup.test.js` | `test/backup.test.ts` | Migrate |
| `test/init.test.js` | `test/init.test.ts` | Migrate |
| `test/status.test.js` | `test/status.test.ts` | Migrate |
| `lib/` (directory) | — | Delete after migration |
| `bin/` (directory) | — | Delete after migration |
| `test/*.test.js` | — | Delete after migration |
| `.github/workflows/publish.yml` | `.github/workflows/publish.yml` | Modify |

---

## Task 1: Setup tooling

**Files:**
- Create: `tsconfig.json`
- Modify: `package.json`
- Modify: `.gitignore` (create if not exists)

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Add dist/ to .gitignore**

Create `.gitignore` (or append if exists):

```
node_modules/
dist/
.island-bridge-backups/
.island-bridge-history.json
```

- [ ] **Step 3: Update package.json**

Change these fields:

```json
{
  "version": "2.0.1",
  "bin": {
    "island-bridge": "./dist/bin/cli.js"
  },
  "files": [
    "dist/"
  ],
  "scripts": {
    "build": "tsc",
    "test": "tsx --test test/*.test.ts",
    "prepublishOnly": "npm run build"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "tsx": "^4.19"
  }
}
```

Keep all other fields (name, description, type, keywords, repository, author, license, engines).

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `typescript` and `tsx` installed in node_modules.

- [ ] **Step 5: Create src directories**

Run: `mkdir -p src/bin src/lib`

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json .gitignore package.json package-lock.json
git commit -m "chore: add TypeScript tooling — tsconfig, tsx, build scripts"
```

---

## Task 2: Create shared types and migrate leaf modules

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/args.ts` (from `lib/args.js`)
- Create: `src/lib/summary.ts` (from `lib/summary.js`)
- Create: `src/lib/hooks.ts` (from `lib/hooks.js`)

These modules have no internal imports from other `lib/` modules, so they can be migrated first.

- [ ] **Step 1: Create src/lib/types.ts**

```ts
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
```

- [ ] **Step 2: Migrate lib/args.js → src/lib/args.ts**

Read `lib/args.js` and create `src/lib/args.ts`. The conversion is:
- Add `import type { ParsedArgs } from './types.js';`
- Change function signature to `export function parseArgs(argv: string[] = process.argv.slice(2)): ParsedArgs`
- The `args` object needs proper initial typing. Since the object starts with `null` values for strings and grows, use an intermediate type and cast at the end, OR type it as `ParsedArgs` directly with correct initial values.
- For the `bwlimit` and `keep` parsing where a string is temporarily assigned before `Number()`, use a temp variable: `const raw = argv[++i]; ... args.bwlimit = Number(raw);`

- [ ] **Step 3: Migrate lib/summary.js → src/lib/summary.ts**

Read `lib/summary.js` and create `src/lib/summary.ts`. The conversion is:
- `rsyncExitMessage(code: number): string` — the messages map needs `Record<number, string>` type
- `printSummary(results: SyncResult[]): void`
- `getErrorHint(code: number | string, context: { host?: string; user?: string } = {}): string | null` — the hints map needs explicit typing as `Record<number | string, () => string>`

- [ ] **Step 4: Migrate lib/hooks.js → src/lib/hooks.ts**

Read `lib/hooks.js` and create `src/lib/hooks.ts`. The conversion is:
- `import type { Reporter } from './reporter.js';` (forward reference — Reporter not yet migrated, add when available)
- For now, use `reporter: any` parameter since Reporter isn't migrated yet. We'll fix this after Reporter is migrated.
- Actually, better approach: use `reporter: { info: (msg: string) => void; warn: (msg: string) => void } | null` as an inline interface.
- `export function runHook(name: string, command: string, quiet: boolean = false, reporter: { info(msg: string): void; warn(msg: string): void } | null = null): void`
- The `catch (err)` needs `(err: any)` or type narrowing.

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors (only files in `src/` are checked).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/args.ts src/lib/summary.ts src/lib/hooks.ts
git commit -m "feat: migrate args, summary, hooks to TypeScript with shared types"
```

---

## Task 3: Migrate config, reporter, history, backup

**Files:**
- Create: `src/lib/config.ts` (from `lib/config.js`)
- Create: `src/lib/reporter.ts` (from `lib/reporter.js`)
- Create: `src/lib/history.ts` (from `lib/history.js`)
- Create: `src/lib/backup.ts` (from `lib/backup.js`)

- [ ] **Step 1: Migrate lib/config.js → src/lib/config.ts**

Key type changes:
- `import type { IslandBridgeConfig, BackupConfig } from './types.js';`
- `findConfigFile(startDir: string = process.cwd()): string | null`
- `loadConfig(options?: { configPath?: string; env?: string }): IslandBridgeConfig`
- `validate(config: any): void` — keeps `any` since it validates unknown input
- `backupDefaults(): BackupConfig`
- `validateBackupConfig(backup: any): void`
- `extractFolderName(remotePath: string): string`
- Internal: the `config` variable in `loadConfig` starts as `any` from JSON.parse, then gets validated and augmented.

- [ ] **Step 2: Migrate lib/reporter.js → src/lib/reporter.ts**

Key type changes:
- Define internal interfaces for the accumulator data:
  ```ts
  interface JsonMessage { level: 'info' | 'warn'; text: string }
  interface JsonError { message: string; hint: string | null }
  interface JsonResult { folder: string; remotePath: string; direction?: string; changes: any[]; success: boolean | null; error: string | null }
  interface FlushOutput { version: string; command: string | null; success: boolean; results: any[]; messages: JsonMessage[]; errors: JsonError[] }
  ```
- Constructor: `constructor(mode: 'human' | 'json' = 'human', io: { write?: (s: string) => void; writeErr?: (s: string) => void } = {})`
- All method signatures get proper types
- `flush(): FlushOutput | null`
- Private fields use TypeScript private/underscore convention

- [ ] **Step 3: Migrate lib/history.js → src/lib/history.ts**

Key type changes:
- `import type { SyncResult, HistoryEntry } from './types.js';`
- `recordSync(configPath: string | undefined, direction: string, results: SyncResult[]): void`
- `showHistory(configPath?: string): void`

- [ ] **Step 4: Migrate lib/backup.js → src/lib/backup.ts**

Key type changes:
- `import type { BackupEntry, RestoreResult } from './types.js';`
- `generateBackupDir(baseDir: string, folderName: string, date: Date = new Date()): string`
- `buildBackupArgs(direction: string, localDir: string | null, remoteDir: string | null, folderName: string, date: Date = new Date()): string[]`
- `parseBackupDirs(dirs: string[]): BackupEntry[]`
- `listBackups(baseDir: string): BackupEntry[]`
- `restoreBackup(baseDir: string, timestamp: string, targetDir: string = '.'): RestoreResult[]`
- `cleanBackups(baseDir: string, keep: number): string[]`

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/config.ts src/lib/reporter.ts src/lib/history.ts src/lib/backup.ts
git commit -m "feat: migrate config, reporter, history, backup to TypeScript"
```

---

## Task 4: Migrate remaining lib modules

**Files:**
- Create: `src/lib/progress.ts` (from `lib/progress.js`)
- Create: `src/lib/interactive.ts` (from `lib/interactive.js`)
- Create: `src/lib/init.ts` (from `lib/init.js`)
- Create: `src/lib/sync.ts` (from `lib/sync.js`)
- Create: `src/lib/watch.ts` (from `lib/watch.js`)
- Create: `src/lib/status.ts` (from `lib/status.js`)

- [ ] **Step 1: Migrate lib/progress.js → src/lib/progress.ts**

Key type changes:
- `import type { Readable } from 'node:stream';`
- The `reporter` parameter in `streamProgress` needs an inline interface or import from Reporter:
  ```ts
  interface ProgressReporter {
    mode: string;
    _write: (s: string) => void;
    syncProgress: (data: string) => void;
    syncFileChange: (type: string, filename: string) => void;
  }
  ```
- `export function streamProgress(stdout: Readable, reporter: ProgressReporter | null, options: { verbose?: boolean } = {}): void`
- The legacy fallback object needs to satisfy the interface.

- [ ] **Step 2: Migrate lib/interactive.js → src/lib/interactive.ts**

Key type changes:
- `export async function selectPaths(paths: string[], reporter: { info(msg: string): void } | null = null): Promise<string[]>`

- [ ] **Step 3: Migrate lib/init.js → src/lib/init.ts**

Key type changes:
- `import type { ParsedArgs } from './types.js';`
- `import type { Reporter } from './reporter.js';`
- `buildConfig(opts: { host?: string; user?: string; paths?: string; exclude?: string }): { remote: { host: string; user: string; paths: string[] }; exclude?: string[] }`
- `runInit(args: ParsedArgs, reporter: Reporter): Promise<boolean>`

- [ ] **Step 4: Migrate lib/sync.js → src/lib/sync.ts**

Key type changes:
- `import type { IslandBridgeConfig, SyncResult, SyncOptions, DiffResult } from './types.js';`
- `import type { Reporter } from './reporter.js';`
- `checkRsync(): Promise<boolean>`
- `buildRsyncArgs(user: string, host: string, remotePath: string, localPath: string, direction: string, options?: SyncOptions): string[]`
- `syncAll(config: IslandBridgeConfig, direction: string, options?: SyncOptions, reporter?: Reporter | null): Promise<SyncResult[]>`
- `diffPreview(config: IslandBridgeConfig, direction: string, options?: SyncOptions): Promise<DiffResult[]>`
- Private functions `runRsync` and `runRsyncCapture` get typed as well.

- [ ] **Step 5: Migrate lib/watch.js → src/lib/watch.ts**

Key type changes:
- `import type { FSWatcher } from 'node:fs';`
- `import type { IslandBridgeConfig, SyncOptions } from './types.js';`
- `import type { Reporter } from './reporter.js';`
- `export function startWatch(config: IslandBridgeConfig, options: SyncOptions = {}, reporter: Reporter | null = null): FSWatcher[]`

- [ ] **Step 6: Migrate lib/status.js → src/lib/status.ts**

Key type changes:
- `import type { IslandBridgeConfig } from './types.js';`
- `import type { Reporter } from './reporter.js';`
- `parseRsyncVersion(output: string): string | null`
- `checkRsyncVersion(): Promise<{ available: boolean; version: string | null }>`
- `checkSsh(user: string, host: string): Promise<{ connected: boolean; error: string | null }>`
- `checkRemotePaths(user: string, host: string, paths: string[]): Promise<{ path: string; folder: string; exists: boolean }[]>`
- `runStatus(config: IslandBridgeConfig, reporter: Reporter): Promise<void>`

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/progress.ts src/lib/interactive.ts src/lib/init.ts src/lib/sync.ts src/lib/watch.ts src/lib/status.ts
git commit -m "feat: migrate progress, interactive, init, sync, watch, status to TypeScript"
```

---

## Task 5: Migrate CLI entrypoint

**Files:**
- Create: `src/bin/cli.ts` (from `bin/cli.js`)

- [ ] **Step 1: Migrate bin/cli.js → src/bin/cli.ts**

Key changes:
- Add `#!/usr/bin/env node` at top
- All imports change from `'../lib/xxx.js'` to `'../lib/xxx.js'` (same pattern, TS Node16 requires .js extensions)
- The `pkg` reading needs path adjustment: `join(__dirname, '..', '..', 'package.json')` since compiled output is at `dist/bin/cli.js` and package.json is at project root
- All `catch (err)` blocks need `(err: any)` or type narrowing
- The `args` variable from `parseArgs()` is already typed as `ParsedArgs`
- The `config` variable from `loadConfig()` is already typed as `IslandBridgeConfig`
- Dynamic imports in the history section: type the destructured values

- [ ] **Step 2: Verify full compilation**

Run: `npx tsc`
Expected: Compiles to `dist/` with no errors. Check `dist/bin/cli.js` exists.

- [ ] **Step 3: Smoke test compiled output**

Run: `node dist/bin/cli.js --help`
Expected: Shows help text with version 2.0.1.

Run: `node dist/bin/cli.js --version`
Expected: `island-bridge v2.0.1`

- [ ] **Step 4: Commit**

```bash
git add src/bin/cli.ts
git commit -m "feat: migrate CLI entrypoint to TypeScript"
```

---

## Task 6: Migrate all tests

**Files:**
- Create: `test/args.test.ts` (from `test/args.test.js`)
- Create: `test/config.test.ts` (from `test/config.test.js`)
- Create: `test/sync.test.ts` (from `test/sync.test.js`)
- Create: `test/reporter.test.ts` (from `test/reporter.test.js`)
- Create: `test/summary.test.ts` (from `test/summary.test.js`)
- Create: `test/backup.test.ts` (from `test/backup.test.js`)
- Create: `test/init.test.ts` (from `test/init.test.js`)
- Create: `test/status.test.ts` (from `test/status.test.js`)

- [ ] **Step 1: Convert all test files**

For each test file:
- Change imports from `'../lib/xxx.js'` to `'../src/lib/xxx.js'` (tests import source, not compiled output)
- Add types to imports where needed (e.g., `import { Reporter } from '../src/lib/reporter.js';`)
- The test code itself is mostly unchanged — `assert` calls don't need type changes
- For `config.test.ts`: change `await import('../lib/config.js')` to `await import('../src/lib/config.js')`

- [ ] **Step 2: Run tests with tsx**

Run: `npx tsx --test test/*.test.ts`
Expected: All 82 tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/*.test.ts
git commit -m "feat: migrate all tests to TypeScript"
```

---

## Task 7: Cleanup and CI update

**Files:**
- Delete: `lib/` directory (all .js files)
- Delete: `bin/` directory
- Delete: `test/*.test.js` (old JS tests)
- Modify: `.github/workflows/publish.yml`

- [ ] **Step 1: Delete old JS source files**

```bash
rm -rf lib/ bin/ test/*.test.js
```

- [ ] **Step 2: Verify tests still pass**

Run: `npx tsx --test test/*.test.ts`
Expected: All 82 tests pass.

- [ ] **Step 3: Verify build works**

Run: `npm run build`
Expected: `dist/` directory created with compiled JS.

Run: `node dist/bin/cli.js --version`
Expected: `island-bridge v2.0.1`

- [ ] **Step 4: Update CI workflow**

Replace `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm test

  publish:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: |
          PUBLISHED=$(npm view island-bridge version 2>/dev/null || echo "0.0.0")
          CURRENT=$(node -p "require('./package.json').version")
          if [ "$PUBLISHED" != "$CURRENT" ]; then
            npm publish --access public
            echo "Published v${CURRENT}"
          else
            echo "v${CURRENT} already published, skipping"
          fi
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 5: Final full verification**

Run: `npm run build && npm test`
Expected: Build succeeds, all 82 tests pass.

Run: `node dist/bin/cli.js --help`
Expected: Full help output.

Run: `node dist/bin/cli.js --version --json`
Expected: JSON output with version 2.0.1.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove old JS files, update CI for TypeScript build"
```
