# 🌉 Island Bridge

[![CI](https://github.com/gong1414/island-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/gong1414/island-bridge/actions/workflows/ci.yml)
[![Code Quality](https://github.com/gong1414/island-bridge/actions/workflows/code-quality.yml/badge.svg)](https://github.com/gong1414/island-bridge/actions/workflows/code-quality.yml)
[![codecov](https://codecov.io/gh/gong1414/island-bridge/branch/main/graph/badge.svg)](https://codecov.io/gh/gong1414/island-bridge)
[![Go Version](https://img.shields.io/badge/Go-1.24+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/gong1414/island-bridge)](https://goreportcard.com/report/github.com/gong1414/island-bridge)

> Connect your development islands - 连接你的开发岛屿

Island Bridge 是一个跨平台的远程开发工作流管理工具，在本地和远程开发环境之间架起桥梁。

## ✨ 功能特性

- **双向文件同步** - 本地与远程环境之间的文件同步
- **实时监听** - 监听文件变化，自动同步
- **远程 Git 操作** - 通过 SSH 执行远程 Git 命令（status/diff/add/commit/push/pull）
- **多环境管理** - 支持多服务器、多项目配置
- **跨平台支持** - 支持 Windows、macOS、Linux

## 📦 安装

### 一键安装（推荐）

```bash
curl -sSL https://raw.githubusercontent.com/gong1414/island-bridge/main/install.sh | bash
```

### 使用 Go 安装

```bash
go install github.com/gong1414/island-bridge/cmd/ibridge@latest
```

### 从 Releases 下载

访问 [Releases 页面](https://github.com/gong1414/island-bridge/releases) 下载适合你平台的二进制文件。

### 从源码构建

```bash
git clone https://github.com/gong1414/island-bridge.git
cd island-bridge
go build -o ibridge ./cmd/ibridge
```

## 🚀 快速开始

### 1. 初始化配置

```bash
ibridge init
```

按照向导输入远程服务器信息，会生成 `.island-bridge.json` 配置文件。

### 2. 同步文件

```bash
# 完整同步
ibridge sync

# 监听变化自动同步
ibridge watch
```

### 3. 远程 Git 操作

```bash
# 查看远程仓库状态
ibridge git status

# 提交更改
ibridge git add .
ibridge git commit -m "your message"
ibridge git push
```

## 📋 命令列表

| 命令 | 描述 |
|------|------|
| `ibridge init` | 初始化项目配置 |
| `ibridge config` | 管理配置 |
| `ibridge sync` | 完整文件同步 |
| `ibridge watch` | 监听并自动同步 |
| `ibridge git <cmd>` | 远程 Git 操作 |
| `ibridge status` | 显示项目状态 |

## ⚙️ 配置文件

配置文件 `.island-bridge.json` 示例：

```json
{
  "profiles": [
    {
      "name": "dev-server",
      "host": "192.168.1.100",
      "port": 22,
      "user": "developer"
    }
  ],
  "projects": [
    {
      "name": "my-project",
      "profile": "dev-server",
      "local_path": "./",
      "remote_path": "/home/developer/projects/my-project",
      "mode": "one-way-local",
      "watch": true,
      "ignore": [".git", "node_modules", ".island-bridge.json"]
    }
  ]
}
```

## 🔧 同步模式

- `one-way-local` - 本地 → 远程（默认）
- `one-way-remote` - 远程 → 本地
- `two-way` - 双向同步

## 📄 License

MIT License