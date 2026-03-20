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

## Usage

1. Create `island-bridge.json` in your working directory:

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
| `-V, --version` | Show version |
| `-h, --help` | Show help |

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
# Preview what would change
island-bridge pull --dry-run

# Diff preview (itemized changes)
island-bridge diff

# Sync with bandwidth limit
island-bridge pull --bwlimit 500

# Auto-push on file changes
island-bridge watch

# Select specific folders interactively
island-bridge pull --select

# Use staging profile
island-bridge pull --env staging

# Quiet mode for CI/scripts
island-bridge push --quiet

# View sync history
island-bridge history
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

## License

MIT
