# 🌉 Island Bridge

[![CI](https://github.com/gong1414/island-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/gong1414/island-bridge/actions/workflows/ci.yml)
[![Code Quality](https://github.com/gong1414/island-bridge/actions/workflows/code-quality.yml/badge.svg)](https://github.com/gong1414/island-bridge/actions/workflows/code-quality.yml)
[![Go Version](https://img.shields.io/badge/Go-1.24+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/gong1414/island-bridge)](https://goreportcard.com/report/github.com/gong1414/island-bridge)
[![Release](https://img.shields.io/github/v/release/gong1414/island-bridge)](https://github.com/gong1414/island-bridge/releases)

> Connect your development islands

**[中文文档](README_zh.md)**

Island Bridge is a cross-platform remote development workflow tool that bridges your local and remote development environments.

## ✨ Features

- **File Synchronization** - Sync files between local and remote environments
- **Real-time Watch** - Watch file changes and sync automatically
- **Remote Git Operations** - Execute Git commands on remote server via SSH
- **Multi-environment** - Support multiple servers and projects
- **Cross-platform** - Windows, macOS, Linux support

## 📦 Installation

### Linux / macOS

```bash
curl -sSL https://raw.githubusercontent.com/gong1414/island-bridge/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/gong1414/island-bridge/main/install.ps1 | iex
```

### Download from Releases

Download the binary for your platform from [Releases](https://github.com/gong1414/island-bridge/releases).

| Platform | Architecture | Download |
|----------|-------------|----------|
| Linux | amd64 | [ibridge-linux-amd64](https://github.com/gong1414/island-bridge/releases/latest) |
| Linux | arm64 | [ibridge-linux-arm64](https://github.com/gong1414/island-bridge/releases/latest) |
| macOS | amd64 (Intel) | [ibridge-darwin-amd64](https://github.com/gong1414/island-bridge/releases/latest) |
| macOS | arm64 (Apple Silicon) | [ibridge-darwin-arm64](https://github.com/gong1414/island-bridge/releases/latest) |
| Windows | amd64 | [ibridge-windows-amd64.exe](https://github.com/gong1414/island-bridge/releases/latest) |

### Using Go (requires Go 1.24+)

```bash
go install github.com/gong1414/island-bridge/cmd/ibridge@latest
```

### Build from Source

```bash
git clone https://github.com/gong1414/island-bridge.git
cd island-bridge
go build -o ibridge ./cmd/ibridge
```

## 🚀 Quick Start

### 1. Initialize Configuration

```bash
cd /path/to/your/project
ibridge init
```

The wizard will prompt you for:
- **Remote host**: Server IP or hostname (e.g., `192.168.1.100`)
- **SSH port**: Usually `22`
- **Username**: Your SSH username
- **Remote path**: Where to sync files on the server (e.g., `/home/user/projects/myapp`)

This creates a `.island-bridge.json` config file in your project directory.

### 2. Sync Files

```bash
# Full sync - upload all files to remote server
ibridge sync

# Sync a specific project (if you have multiple)
ibridge sync -p my-project
```

### 3. Watch Mode (Auto-sync)

```bash
# Watch for changes and sync automatically
ibridge watch

# Skip initial full sync (faster startup)
ibridge watch --no-initial-sync
```

Press `Ctrl+C` to stop watching.

### 4. Remote Git Operations

Execute Git commands on the remote server without SSH-ing manually:

```bash
# Check remote repository status
ibridge git status

# View changes
ibridge git diff

# Stage files
ibridge git add .
ibridge git add src/main.go

# Commit changes
ibridge git commit -m "feat: add new feature"

# Push to remote repository
ibridge git push

# Pull latest changes
ibridge git pull
```

### 5. Check Status

```bash
# Show current configuration and connection status
ibridge status
```

## 📋 Commands Reference

| Command | Description |
|---------|-------------|
| `ibridge init` | Initialize project configuration interactively |
| `ibridge sync` | Full file synchronization (local → remote) |
| `ibridge watch` | Watch for changes and sync automatically |
| `ibridge git status` | Show git status on remote |
| `ibridge git diff` | Show git diff on remote |
| `ibridge git add <files>` | Stage files on remote |
| `ibridge git commit -m "msg"` | Commit changes on remote |
| `ibridge git push` | Push commits to remote repository |
| `ibridge git pull` | Pull from remote repository |
| `ibridge status` | Show project status |
| `ibridge config list` | List all profiles and projects |
| `ibridge config validate` | Validate configuration file |
| `ibridge version` | Show version information |

### Global Flags

| Flag | Description |
|------|-------------|
| `-p, --project <name>` | Specify project name (when multiple projects configured) |
| `-P, --profile <name>` | Specify profile name (when multiple servers configured) |
| `--insecure` | Skip SSH host key verification (NOT RECOMMENDED) |

## ⚙️ Configuration

Configuration file `.island-bridge.json` is created in your project root.

### Full Example

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

### Configuration Fields

#### Profile Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Unique profile name |
| `host` | string | ✅ | Server hostname or IP |
| `port` | number | ✅ | SSH port (usually 22) |
| `user` | string | ✅ | SSH username |

#### Project Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Unique project name |
| `profile` | string | ✅ | Profile name to use |
| `localPath` | string | ✅ | Local directory path |
| `remotePath` | string | ✅ | Remote directory path |
| `mode` | string | ❌ | Sync mode (default: `one-way-local`) |
| `watch` | boolean | ❌ | Enable watch mode (default: `true`) |
| `ignore` | array | ❌ | Files/directories to ignore |

## 🔧 Sync Modes

| Mode | Direction | Description |
|------|-----------|-------------|
| `one-way-local` | Local → Remote | Upload local changes to remote (default) |
| `one-way-remote` | Remote → Local | Download remote changes to local |
| `two-way` | Both ways | Bidirectional synchronization |

## 🔑 SSH Authentication

Island Bridge uses your system's SSH configuration. Ensure you have:

1. **SSH key configured**: `~/.ssh/id_rsa` or `~/.ssh/id_ed25519`
2. **Key added to remote server**: `ssh-copy-id user@server`
3. **SSH agent running** (optional): `eval $(ssh-agent) && ssh-add`

Test your connection:
```bash
ssh user@server "echo Connected!"
```

## 💡 Usage Examples

### Example 1: Web Development

```bash
# In your project directory
cd ~/projects/my-webapp
ibridge init
# Enter: host=dev.example.com, user=webdev, remote=/var/www/my-webapp

# Start developing with auto-sync
ibridge watch
```

### Example 2: Multiple Environments

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
# Sync to dev server
ibridge sync -P dev

# Sync to staging server
ibridge sync -P staging
```

### Example 3: Commit and Deploy Workflow

```bash
# Make changes locally, then:
ibridge sync                           # Upload changes
ibridge git add .                      # Stage on remote
ibridge git commit -m "fix: bug fix"   # Commit on remote
ibridge git push                       # Push to repository
```

## 📄 License

MIT License