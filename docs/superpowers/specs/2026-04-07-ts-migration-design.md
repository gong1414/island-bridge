# island-bridge TypeScript 迁移设计

## 背景

将 island-bridge v2.0.0 从 JavaScript 迁移到 TypeScript。保持零运行时依赖，添加构建步骤，确保 npm 发布正常。

## 目录结构

```
src/
  bin/
    cli.ts
  lib/
    reporter.ts
    args.ts
    config.ts
    sync.ts
    progress.ts
    summary.ts
    hooks.ts
    interactive.ts
    watch.ts
    history.ts
    init.ts
    status.ts
    backup.ts
dist/                 ← tsc 编译产物（gitignore）
  bin/
    cli.js
  lib/
    *.js
test/
  *.test.ts           ← 测试用 TS 重写，tsx 运行
```

## 构建配置

### tsconfig.json

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
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### package.json 变更

```json
{
  "version": "2.0.1",
  "type": "module",
  "bin": { "island-bridge": "./dist/bin/cli.js" },
  "files": ["dist/"],
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

### .gitignore 变更

添加 `dist/` 到 `.gitignore`。

### CI 变更 (.github/workflows/publish.yml)

- test job: `npm ci` → `npm run build` → `npm test`
- publish job: `npm ci` → `npm run build` → `npm publish`

## 迁移原则

1. **纯重命名 + 加类型** — `.js` → `.ts`，加 interface/type 定义，不改业务逻辑
2. **`strict: true`** — 从一开始就用严格模式
3. **`declaration: true`** — 生成 `.d.ts`，方便未来被其他 TS 项目引用
4. **测试导入 `../src/`** — 测试直接导入 TS 源码，tsx 运行时即时编译
5. **`dist/` 加入 `.gitignore`** — 不提交编译产物
6. **import 路径带 `.js` 后缀** — TypeScript Node16 模块要求 import 路径使用 `.js` 后缀（编译后对应实际的 .js 文件）

## 类型定义

为核心数据结构定义 interface：

```ts
// src/lib/types.ts（如果需要共享类型可抽出，否则各模块自定义）

interface RemoteConfig {
  host: string;
  user: string;
  paths: string[];
}

interface BackupConfig {
  enabled: boolean;
  maxCount: number;
  localDir: string;
  remoteDir: string;
}

interface IslandBridgeConfig {
  remote: RemoteConfig;
  exclude: string[];
  hooks: { beforeSync?: string; afterSync?: string };
  bwlimit: number | null;
  backup: BackupConfig;
  profiles?: Record<string, Partial<IslandBridgeConfig>>;
  _filePath: string;
  _explicitConfig: boolean;
}

interface SyncResult {
  folderName: string;
  remotePath: string;
  success: boolean;
  error: string | null;
  exitCode?: number;
}

interface ParsedArgs {
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
```

## 版本

`2.0.1` — 无功能变更，纯内部重构。
