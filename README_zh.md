# 🌉 Island Bridge

[![CI](https://github.com/gong1414/island-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/gong1414/island-bridge/actions/workflows/ci.yml)
[![Code Quality](https://github.com/gong1414/island-bridge/actions/workflows/code-quality.yml/badge.svg)](https://github.com/gong1414/island-bridge/actions/workflows/code-quality.yml)
[![Go Version](https://img.shields.io/badge/Go-1.24+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/gong1414/island-bridge)](https://goreportcard.com/report/github.com/gong1414/island-bridge)
[![Release](https://img.shields.io/github/v/release/gong1414/island-bridge)](https://github.com/gong1414/island-bridge/releases)

> 连接你的开发岛屿

**[English](README.md)**

Island Bridge 是一个跨平台的远程开发工作流管理工具，在本地和远程开发环境之间架起桥梁。

## ✨ 功能特性

- **文件同步** - 本地与远程环境之间的文件同步
- **实时监听** - 监听文件变化，自动同步
- **远程 Git 操作** - 通过 SSH 执行远程 Git 命令
- **多环境管理** - 支持多服务器、多项目配置
- **跨平台支持** - 支持 Windows、macOS、Linux

## 📦 安装

### Linux / macOS

```bash
curl -sSL https://raw.githubusercontent.com/gong1414/island-bridge/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/gong1414/island-bridge/main/install.ps1 | iex
```

### 从 Releases 下载

访问 [Releases 页面](https://github.com/gong1414/island-bridge/releases) 下载适合你平台的二进制文件。

| 平台 | 架构 | 下载 |
|------|-----|------|
| Linux | amd64 | [ibridge-linux-amd64](https://github.com/gong1414/island-bridge/releases/latest) |
| Linux | arm64 | [ibridge-linux-arm64](https://github.com/gong1414/island-bridge/releases/latest) |
| macOS | amd64 (Intel) | [ibridge-darwin-amd64](https://github.com/gong1414/island-bridge/releases/latest) |
| macOS | arm64 (Apple Silicon) | [ibridge-darwin-arm64](https://github.com/gong1414/island-bridge/releases/latest) |
| Windows | amd64 | [ibridge-windows-amd64.exe](https://github.com/gong1414/island-bridge/releases/latest) |

### 使用 Go 安装（需要 Go 1.24+）

```bash
go install github.com/gong1414/island-bridge/cmd/ibridge@latest
```

### 从源码构建

```bash
git clone https://github.com/gong1414/island-bridge.git
cd island-bridge
go build -o ibridge ./cmd/ibridge
```

## 🚀 快速开始

### 1. 初始化配置

```bash
cd /path/to/your/project
ibridge init
```

向导会提示你输入：
- **远程主机**：服务器 IP 或主机名（如 `192.168.1.100`）
- **SSH 端口**：通常是 `22`
- **用户名**：SSH 用户名
- **远程路径**：服务器上的同步目录（如 `/home/user/projects/myapp`）

这会在项目目录下创建 `.island-bridge.json` 配置文件。

### 2. 同步文件

```bash
# 完整同步 - 上传所有文件到远程服务器
ibridge sync

# 从远程下载文件到本地
ibridge sync -d download

# 双向同步
ibridge sync -d both

# 同步指定项目（如果配置了多个项目）
ibridge sync -p my-project
```

### 3. 监听模式（自动同步）

```bash
# 监听文件变化并自动同步
ibridge watch

# 跳过初始完整同步（启动更快）
ibridge watch --no-initial-sync
```

按 `Ctrl+C` 停止监听。

### 4. 远程 Git 操作

无需手动 SSH 登录，直接在远程服务器执行 Git 命令：

```bash
# 查看远程仓库状态
ibridge git status

# 查看改动
ibridge git diff

# 暂存文件
ibridge git add .
ibridge git add src/main.go

# 提交改动
ibridge git commit -m "feat: 添加新功能"

# 推送到远程仓库
ibridge git push

# 拉取最新改动
ibridge git pull
```

### 5. 查看状态

```bash
# 显示当前配置和连接状态
ibridge status
```

## 📋 命令参考

| 命令 | 描述 |
|------|------|
| `ibridge init` | 交互式初始化项目配置 |
| `ibridge sync` | 完整文件同步（使用配置的模式） |
| `ibridge sync -d upload` | 上传本地文件到远程 |
| `ibridge sync -d download` | 从远程下载文件到本地 |
| `ibridge sync -d both` | 双向同步 |
| `ibridge watch` | 监听变化并自动同步 |
| `ibridge git status` | 显示远程 git 状态 |
| `ibridge git diff` | 显示远程 git 差异 |
| `ibridge git add <files>` | 在远程暂存文件 |
| `ibridge git commit -m "msg"` | 在远程提交改动 |
| `ibridge git push` | 推送提交到远程仓库 |
| `ibridge git pull` | 从远程仓库拉取 |
| `ibridge status` | 显示项目状态 |
| `ibridge config list` | 列出所有配置 |
| `ibridge config validate` | 验证配置文件 |
| `ibridge version` | 显示版本信息 |

### 全局参数

| 参数 | 描述 |
|------|------|
| `-p, --project <name>` | 指定项目名称（配置多个项目时使用） |
| `-P, --profile <name>` | 指定配置名称（配置多个服务器时使用） |
| `-d, --direction <dir>` | 同步方向：`upload`、`download` 或 `both` |
| `--insecure` | 跳过 SSH 主机密钥验证（不推荐） |

## ⚙️ 配置文件

配置文件 `.island-bridge.json` 在项目根目录创建。

### 完整示例

```json
{
  "version": "1",
  "profiles": [
    {
      "name": "dev-server",
      "host": "192.168.1.100",
      "port": 22,
      "user": "developer"
    },
    {
      "name": "prod-server",
      "host": "prod.example.com",
      "port": 22,
      "user": "deploy"
    }
  ],
  "projects": [
    {
      "name": "backend",
      "profile": "dev-server",
      "localPath": "./",
      "remotePath": "/home/developer/projects/backend",
      "mode": "one-way-local",
      "watch": true,
      "ignore": [".git", "node_modules", ".island-bridge.json", "*.log", "tmp/"]
    }
  ]
}
```

### 配置字段说明

#### Profile 字段

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | string | ✅ | 唯一配置名称 |
| `host` | string | ✅ | 服务器主机名或 IP |
| `port` | number | ✅ | SSH 端口（通常是 22） |
| `user` | string | ✅ | SSH 用户名 |

#### Project 字段

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | string | ✅ | 唯一项目名称 |
| `profile` | string | ✅ | 使用的 profile 名称 |
| `localPath` | string | ✅ | 本地目录路径 |
| `remotePath` | string | ✅ | 远程目录路径 |
| `mode` | string | ❌ | 同步模式（默认：`one-way-local`） |
| `watch` | boolean | ❌ | 启用监听模式（默认：`true`） |
| `ignore` | array | ❌ | 忽略的文件/目录列表 |

## 🔧 同步模式

| 模式 | 方向 | 描述 |
|------|------|------|
| `one-way-local` | 本地 → 远程 | 上传本地改动到远程（默认） |
| `one-way-remote` | 远程 → 本地 | 下载远程改动到本地 |
| `two-way` | 双向 | 双向同步 |

## 🔑 SSH 认证

Island Bridge 使用系统的 SSH 配置。请确保：

1. **配置 SSH 密钥**：`~/.ssh/id_rsa` 或 `~/.ssh/id_ed25519`
2. **密钥已添加到服务器**：`ssh-copy-id user@server`
3. **SSH agent 运行中**（可选）：`eval $(ssh-agent) && ssh-add`

测试连接：
```bash
ssh user@server "echo 连接成功!"
```

## 💡 使用示例

### 示例 1：Web 开发

```bash
# 进入项目目录
cd ~/projects/my-webapp
ibridge init
# 输入：host=dev.example.com, user=webdev, remote=/var/www/my-webapp

# 开始开发，自动同步
ibridge watch
```

### 示例 2：多环境配置

```json
{
  "version": "1",
  "profiles": [
    { "name": "dev", "host": "dev.example.com", "port": 22, "user": "dev" },
    { "name": "staging", "host": "staging.example.com", "port": 22, "user": "deploy" }
  ],
  "projects": [
    { "name": "api", "profile": "dev", "localPath": "./", "remotePath": "/app" }
  ]
}
```

```bash
# 同步到开发服务器
ibridge sync -P dev

# 同步到预发布服务器
ibridge sync -P staging
```

### 示例 3：提交和部署工作流

```bash
# 本地修改后：
ibridge sync                           # 上传改动
ibridge git add .                      # 远程暂存
ibridge git commit -m "fix: 修复 bug"  # 远程提交
ibridge git push                       # 推送到仓库
```

## 📄 许可证

MIT License

