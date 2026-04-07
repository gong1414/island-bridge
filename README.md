# island-bridge

Sync remote server folders to local directory via rsync over SSH.

## Install

```bash
npm install -g island-bridge
```

Or use directly with npx:

```bash
npx island-bridge pull
npx island-bridge push
```

## Prerequisites

- Node.js >= 18
- `rsync` installed on both local and remote machines
- SSH access to remote server (uses system `~/.ssh/config`)

## Quick Start

```bash
# Create config interactively
island-bridge init

# Or create config via flags (AI/script friendly)
island-bridge init --host 192.168.1.100 --user deploy --paths "/var/www/app,/etc/nginx/conf.d"

# Check environment is ready
island-bridge status

# Pull remote folders to local
island-bridge pull

# Push local changes back
island-bridge push
```

## Usage

1. Create `island-bridge.json` in your working directory (or run `island-bridge init`):

```json
{
  "remote": {
    "host": "192.168.1.100",
    "user": "deploy",
    "paths": [
      "/var/www/app",
      "/etc/nginx/conf.d",
      "/home/deploy/scripts"
    ]
  }
}
```

2. Pull remote folders to local:

```bash
island-bridge pull
```

This creates local subdirectories matching the remote folder names:

```
./app/           <- from /var/www/app
./conf.d/        <- from /etc/nginx/conf.d
./scripts/       <- from /home/deploy/scripts
```

3. Push local changes back to remote:

```bash
island-bridge push
```

## Commands

| Command | Description |
|---------|-------------|
| `pull` | Pull remote folders to local directory |
| `push` | Push local folders to remote server |
| `watch` | Watch local folders and auto-push on changes |
| `diff` | Preview changes without syncing |
| `history` | Show sync history |
| `init` | Create config file interactively or via flags |
| `status` | Show config, SSH, rsync, and paths status |
| `backup` | Manage sync backups (list, restore, clean) |

## Options

| Option | Description |
|--------|-------------|
| `-n, --dry-run` | Preview sync without making changes |
| `-v, --verbose` | Show detailed output |
| `-q, --quiet` | Suppress output (exit code only) |
| `-c, --config <path>` | Use specific config file |
| `--env <name>` | Use named profile from config |
| `--bwlimit <KB/s>` | Limit transfer bandwidth |
| `-s, --select` | Interactively select folders to sync |
| `--path <name>` | Sync specific folder by name (repeatable) |
| `--json` | Output in JSON format (for scripts/AI) |
| `--no-backup` | Skip backup for this sync |
| `-V, --version` | Show version |
| `-h, --help` | Show help |

## Backup & Restore

Backups are **enabled by default**. Before each sync, files that will be overwritten are automatically saved to a timestamped backup directory.

```bash
# List available backups
island-bridge backup list

# Restore a specific backup
island-bridge backup restore 2026-04-07T14-30-00

# Clean old backups, keep 5 most recent
island-bridge backup clean --keep 5
```

### Backup Config

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

Use `--no-backup` to skip backup for a single sync operation.

## JSON Output (AI/Script Friendly)

Add `--json` to any command for structured JSON output — no colors, no progress bars, no interactive prompts:

```bash
# Check environment before syncing
island-bridge status --json

# Sync and parse results programmatically
island-bridge pull --json

# Create config non-interactively
island-bridge init --json --host example.com --user deploy --paths "/var/www/app"
```

Example JSON output:

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
      "changes": [
        { "type": "add", "file": "index.js" },
        { "type": "delete", "file": "old.css" }
      ]
    }
  ],
  "messages": [],
  "errors": []
}
```

## Advanced Config

```json
{
  "remote": {
    "host": "192.168.1.100",
    "user": "deploy",
    "paths": ["/var/www/app", "/etc/nginx/conf.d"]
  },
  "exclude": ["node_modules", ".DS_Store", "*.log"],
  "bwlimit": 1000,
  "backup": {
    "enabled": true,
    "maxCount": 10
  },
  "hooks": {
    "beforeSync": "echo 'Starting sync...'",
    "afterSync": "pm2 restart app"
  },
  "profiles": {
    "staging": {
      "remote": {
        "host": "staging.example.com",
        "user": "deploy",
        "paths": ["/var/www/app"]
      }
    },
    "production": {
      "remote": {
        "host": "prod.example.com",
        "user": "admin",
        "paths": ["/var/www/app"]
      }
    }
  }
}
```

### Exclude Rules

Custom exclude patterns are applied in addition to `.gitignore` rules:

```json
{
  "exclude": ["node_modules", "*.log", ".env"]
}
```

### Hooks

Run shell commands before and after sync:

```json
{
  "hooks": {
    "beforeSync": "npm run build",
    "afterSync": "ssh deploy@server 'pm2 restart app'"
  }
}
```

### Multi-Environment Profiles

Switch between environments using `--env`:

```bash
island-bridge pull --env staging
island-bridge push --env production
```

Profile settings are merged over the base config.

### Config File Search

The config file is searched starting from the current directory upward (like `.gitignore`). Use `--config` to specify an explicit path:

```bash
island-bridge pull --config /path/to/my-config.json
```

## Examples

```bash
# Create config interactively
island-bridge init

# Check everything is working
island-bridge status

# Preview what would change
island-bridge pull --dry-run

# Diff preview (itemized changes)
island-bridge diff

# Sync with bandwidth limit
island-bridge pull --bwlimit 500

# Sync only specific folder
island-bridge pull --path app

# Auto-push on file changes
island-bridge watch

# Select specific folders interactively
island-bridge pull --select

# Use staging profile
island-bridge pull --env staging

# Quiet mode for CI/scripts
island-bridge push --quiet

# JSON output for AI/scripts
island-bridge pull --json

# View sync history
island-bridge history

# List and restore backups
island-bridge backup list
island-bridge backup restore 2026-04-07T14-30-00
```

## Features

- **Bidirectional sync** — `pull` downloads, `push` uploads
- **Multi-folder** — sync multiple remote paths in one config
- **rsync over SSH** — uses system SSH config for authentication
- **Auto .gitignore** — respects `.gitignore` exclusion rules
- **Custom excludes** — additional exclude patterns in config
- **Progress display** — real-time per-file transfer with color output
- **Dry-run mode** — preview changes without syncing
- **Diff preview** — see itemized file changes before sync
- **Watch mode** — auto-push on local file changes
- **Multi-environment** — switch profiles with `--env`
- **Interactive select** — choose which folders to sync
- **Hooks** — run commands before/after sync
- **Bandwidth limit** — control transfer speed
- **Sync history** — track past sync operations
- **Verbose/Quiet** — control output detail level
- **Config search** — finds config in parent directories
- **Fault tolerant** — skips failed transfers, reports summary at end
- **Zero dependencies** — pure Node.js, no npm dependencies
- **Auto backup** — files backed up before overwrite, with restore support
- **JSON output** — structured output for AI agents and scripts
- **Init command** — interactive or flag-based config setup
- **Status check** — diagnose SSH, rsync, and path issues
- **Path filter** — sync specific folders with `--path`
- **Error hints** — actionable suggestions on every error

## License

MIT
