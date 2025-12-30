# 🌉 Island Bridge

[![CI](https://github.com/gong1414/island-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/gong1414/island-bridge/actions/workflows/ci.yml)
[![Code Quality](https://github.com/gong1414/island-bridge/actions/workflows/code-quality.yml/badge.svg)](https://github.com/gong1414/island-bridge/actions/workflows/code-quality.yml)
[![Go Version](https://img.shields.io/badge/Go-1.24+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/gong1414/island-bridge)](https://goreportcard.com/report/github.com/gong1414/island-bridge)
[![Release](https://img.shields.io/github/v/release/gong1414/island-bridge)](https://github.com/gong1414/island-bridge/releases)

> Connect your development islands 🌉 连接你的开发岛屿

**[English](#english) | [中文](#中文)**

---

## English

Island Bridge is a cross-platform remote development workflow tool that bridges your local and remote development environments.

### ✨ Features

- **File Synchronization** - Sync files between local and remote environments
- **Real-time Watch** - Watch file changes and sync automatically
- **Remote Git Operations** - Execute Git commands on remote server via SSH
- **Multi-environment** - Support multiple servers and projects
- **Cross-platform** - Windows, macOS, Linux support

### 📦 Installation

#### Quick Install (Recommended)

```bash
curl -sSL https://raw.githubusercontent.com/gong1414/island-bridge/main/install.sh | bash
```

#### Download from Releases

Download the binary for your platform from [Releases](https://github.com/gong1414/island-bridge/releases).

#### Using Go (requires Go 1.24+)

```bash
go install github.com/gong1414/island-bridge/cmd/ibridge@latest
```

#### Build from Source

```bash
git clone https://github.com/gong1414/island-bridge.git
cd island-bridge
go build -o ibridge ./cmd/ibridge
```

### 🚀 Quick Start

#### 1. Initialize Configuration

```bash
ibridge init
```

Follow the wizard to enter your remote server information. This creates a `.island-bridge.json` config file.

#### 2. Sync Files

```bash
# Full sync
ibridge sync

# Watch and auto-sync
ibridge watch
```

#### 3. Remote Git Operations

```bash
ibridge git status
ibridge git add .
ibridge git commit -m "your message"
ibridge git push
```

### 📋 Commands

| Command | Description |
|---------|-------------|
| `ibridge init` | Initialize project configuration |
| `ibridge config` | Manage configuration |
| `ibridge sync` | Full file synchronization |
| `ibridge watch` | Watch and auto-sync |
| `ibridge git <cmd>` | Remote Git operations |
| `ibridge status` | Show project status |
| `ibridge version` | Show version |

---

## 中文

Island Bridge 是一个跨平台的远程开发工作流管理工具，在本地和远程开发环境之间架起桥梁。

### ✨ 功能特性

- **文件同步** - 本地与远程环境之间的文件同步
- **实时监听** - 监听文件变化，自动同步
- **远程 Git 操作** - 通过 SSH 执行远程 Git 命令
- **多环境管理** - 支持多服务器、多项目配置
- **跨平台支持** - 支持 Windows、macOS、Linux

### 📦 安装

#### 一键安装（推荐）

```bash
curl -sSL https://raw.githubusercontent.com/gong1414/island-bridge/main/install.sh | bash
```

#### 从 Releases 下载

访问 [Releases 页面](https://github.com/gong1414/island-bridge/releases) 下载适合你平台的二进制文件。

#### 使用 Go 安装（需要 Go 1.24+）

```bash
go install github.com/gong1414/island-bridge/cmd/ibridge@latest
```

#### 从源码构建

```bash
git clone https://github.com/gong1414/island-bridge.git
cd island-bridge
go build -o ibridge ./cmd/ibridge
```

### 🚀 快速开始

#### 1. 初始化配置

```bash
ibridge init
```

按照向导输入远程服务器信息，会生成 `.island-bridge.json` 配置文件。

#### 2. 同步文件

```bash
# 完整同步
ibridge sync

# 监听变化自动同步
ibridge watch
```

#### 3. 远程 Git 操作

```bash
ibridge git status
ibridge git add .
ibridge git commit -m "your message"
ibridge git push
```

### 📋 命令列表

| 命令 | 描述 |
|------|------|
| `ibridge init` | 初始化项目配置 |
| `ibridge config` | 管理配置 |
| `ibridge sync` | 完整文件同步 |
| `ibridge watch` | 监听并自动同步 |
| `ibridge git <cmd>` | 远程 Git 操作 |
| `ibridge status` | 显示项目状态 |
| `ibridge version` | 显示版本 |

---

## ⚙️ Configuration / 配置文件

`.island-bridge.json` example / 示例：

```json
{
  "version": "1",
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
      "localPath": "./",
      "remotePath": "/home/developer/projects/my-project",
      "mode": "one-way-local",
      "watch": true,
      "ignore": [".git", "node_modules", ".island-bridge.json"]
    }
  ]
}
```

## 🔧 Sync Modes / 同步模式

| Mode | Description | 描述 |
|------|-------------|------|
| `one-way-local` | Local → Remote (default) | 本地 → 远程（默认） |
| `one-way-remote` | Remote → Local | 远程 → 本地 |
| `two-way` | Bidirectional sync | 双向同步 |

## 📄 License

MIT License