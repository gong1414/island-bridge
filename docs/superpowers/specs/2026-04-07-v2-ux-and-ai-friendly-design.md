# island-bridge v2.0 — UX 改进 & AI 友好设计

## 背景

island-bridge 是一个基于 rsync over SSH 的远程文件夹同步 CLI 工具。当前 v1.1.0 存在以下用户痛点：

1. **无法直接上手** — 没有 `init` 命令，新用户需要手写 `island-bridge.json`
2. **输出对 AI 不友好** — ANSI 颜色、进度条、交互式提示，机器无法解析
3. **错误信息不够 actionable** — 出错后不知道下一步该做什么
4. **缺少常用功能** — 没有状态检查、单路径同步、备份恢复等
5. **数据安全** — 同步覆盖后无法回滚

**目标用户**：个人开发者（管理 VPS/服务器）+ AI Agent（通过 shell 调用 CLI）。

## 设计方案：输出层重构 + 功能增强

先重构输出层为统一的 Reporter 抽象（human/json 双模式），再基于新架构做功能增强。

---

## 1. Reporter 输出层

### 1.1 接口设计

```js
// lib/reporter.js
class Reporter {
  constructor(mode = 'human')  // 'human' | 'json'

  // 生命周期事件
  info(message)                // 一般信息（配置路径、profile 名等）
  warn(message)                // 警告
  error(message, hint?)        // 错误 + 可选的修复建议

  // 同步事件
  syncStart(direction, folderName, remotePath, opts)
  syncProgress(data)           // 进度数据（百分比、速率等）
  syncFileChange(type, filename)  // type: 'add' | 'delete' | 'modify'
  syncEnd(folderName, result)

  // 汇总
  summary(results)
  diffReport(diffs)
  historyReport(entries)

  // JSON 模式下，最终输出完整 JSON 到 stdout
  flush()
}
```

### 1.2 行为差异

| 事件 | human 模式 | json 模式 |
|------|-----------|-----------|
| info/warn/error | 带颜色输出到 stdout/stderr | 收集到 messages 数组 |
| syncProgress | 实时覆写进度行 | 忽略（或收集最终百分比） |
| syncFileChange | 带颜色 `+ file` / `- file` | 收集到 changes 数组 |
| summary | 表格式文字 | 结构化 JSON |
| flush | no-op | `JSON.stringify` 输出到 stdout |

### 1.3 JSON 输出结构

```json
{
  "version": "2.0.0",
  "command": "pull",
  "success": true,
  "results": [
    {
      "folder": "app",
      "remotePath": "/var/www/app",
      "success": true,
      "changes": ["+ index.js", "- old.css"]
    }
  ],
  "messages": [],
  "errors": []
}
```

### 1.4 触发方式

- `--json` 全局 flag → json 模式
- `--quiet` → human 模式但只输出 summary
- 默认 → human 模式，行为与 v1 一致

---

## 2. 备份机制

### 2.1 核心行为

利用 rsync 自带的 `--backup` + `--backup-dir` 参数，在同步前自动把即将被覆盖/删除的文件备份到带时间戳的目录。

```
# pull 时，本地即将被覆盖的文件备份到：
.island-bridge-backups/2026-04-07T14-30-00/app/

# push 时，远程即将被覆盖的文件备份到远程的：
~/.island-bridge-backups/2026-04-07T14-30-00/app/
```

### 2.2 备份命令

```bash
# 查看备份列表
island-bridge backup list

# 恢复指定备份
island-bridge backup restore <timestamp>

# 清理旧备份
island-bridge backup clean --keep 5
```

### 2.3 配置

```json
{
  "backup": {
    "enabled": true,
    "maxCount": 10,
    "localDir": ".island-bridge-backups",
    "remoteDir": "~/.island-bridge-backups"
  }
}
```

默认值：`enabled: true`, `maxCount: 10`。

### 2.4 选项

- `--no-backup` flag 可跳过备份（dry-run 或确认无需备份时）
- 备份默认开启，宁可多占空间也不丢数据
- `backup list` 和 `backup restore` 支持 `--json` 输出

---

## 3. 新增命令

### 3.1 `init` 命令

交互式问答生成 `island-bridge.json`：

```
$ island-bridge init

? Remote host: 192.168.1.100
? SSH user: deploy
? Remote paths (comma-separated): /var/www/app, /etc/nginx/conf.d
? Exclude patterns (comma-separated, optional): node_modules, *.log
? Enable backup? (Y/n): Y

✓ Created island-bridge.json
```

- 如果已存在配置文件，提示是否覆盖
- `--json` 模式下不走交互，要求所有参数通过 flag 传入：

```bash
island-bridge init --host 192.168.1.100 --user deploy --paths "/var/www/app,/etc/nginx/conf.d"
```

### 3.2 `status` 命令

快速诊断当前环境：

```
$ island-bridge status

Config:    ./island-bridge.json
Remote:    deploy@192.168.1.100
SSH:       ✓ connected (key auth)
rsync:     ✓ available (v3.2.7)
Paths:
  app       /var/www/app        ✓ exists
  conf.d    /etc/nginx/conf.d   ✓ exists
Backup:    enabled (3 backups, 12MB)
```

- 检测 SSH 连通性、rsync 版本、远程路径是否存在
- `--json` 模式输出结构化结果
- AI 调用前可以先 `status --json` 确认环境就绪

---

## 4. 新增选项

### 4.1 `--json`

全局 flag，所有命令的输出切换为 JSON 格式。无颜色、无进度条、无交互式提示。

### 4.2 `--path <name>`

按 folder name 指定同步路径，替代 `--select` 的非交互方案：

```bash
island-bridge pull --path app
island-bridge push --path conf.d
island-bridge pull --path app --path conf.d
```

- 按 folder name 匹配（即远程路径的最后一级目录名）
- 可多次使用
- 如果指定的 name 不匹配任何配置路径，报错并列出可用的 folder names
- 对 AI 友好 — 无需交互式选择

### 4.3 `--no-backup`

跳过备份，适用于 dry-run 或明确不需要备份的场景。

---

## 5. 错误信息增强

每个错误附带 hint，引导用户下一步操作：

```
Error: SSH connection failed (exit code 255)
  hint: Check that 'deploy@192.168.1.100' is reachable:
        ssh deploy@192.168.1.100

Error: Cannot find island-bridge.json in current or parent directories
  hint: Run 'island-bridge init' to create a config file

Error: rsync is required but not found in PATH
  hint: Install rsync: sudo apt install rsync (Debian/Ubuntu)
        or: brew install rsync (macOS)
```

JSON 模式下 hint 作为字段输出：

```json
{
  "error": "SSH connection failed",
  "exitCode": 255,
  "hint": "Check that 'deploy@192.168.1.100' is reachable: ssh deploy@192.168.1.100"
}
```

---

## 6. 架构与文件结构

### 6.1 重构后的文件结构

```
lib/
  reporter.js      # 新增 — Reporter 类（human/json 双模式）
  args.js          # 改 — 新增 --json, --path, --no-backup 解析；init/status/backup 命令
  config.js        # 改 — 新增 backup 配置段解析与默认值
  sync.js          # 改 — 接收 reporter 实例替代直接 console.log
  backup.js        # 新增 — 备份逻辑（rsync --backup-dir）、list/restore/clean
  init.js          # 新增 — init 命令交互式 + flag 模式
  status.js        # 新增 — status 命令（SSH/rsync/paths 检测）
  progress.js      # 改 — 通过 reporter 输出，不再直接 process.stdout.write
  summary.js       # 改 — 错误信息增加 hint 映射
  hooks.js         # 改 — 通过 reporter 输出
  interactive.js   # 小改 — 通过 reporter 输出
  watch.js         # 改 — 通过 reporter 输出
  history.js       # 不变
bin/
  cli.js           # 改 — 创建 Reporter 实例注入各模块，新增命令路由
```

### 6.2 改动原则

1. **Reporter 先行** — 先建 reporter.js，再逐个模块替换 console.log
2. **新功能独立文件** — init.js / status.js / backup.js 各自独立
3. **所有模块接收 reporter** — 作为参数传入，不做全局单例
4. **向后兼容** — 不加 `--json` 时行为和现在完全一致

---

## 7. 测试计划

```
test/
  args.test.js       # 扩展 — 新 flag 和命令的解析
  config.test.js     # 扩展 — backup 配置验证
  sync.test.js       # 不变
  reporter.test.js   # 新增 — human/json 两种模式输出验证
  backup.test.js     # 新增 — 备份路径生成、list/restore 逻辑
  status.test.js     # 新增 — 状态检测逻辑
  init.test.js       # 新增 — 配置生成逻辑
```

---

## 8. 版本

此次改动发布为 **v2.0.0**，因为：
- 输出层重构属于内部 breaking change（虽然外部行为兼容）
- 新增多个命令和选项，功能范围显著扩展
- 备份机制改变了默认的 rsync 参数行为
