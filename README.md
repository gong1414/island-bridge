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

## Features

- **Bidirectional sync** — `pull` downloads, `push` uploads
- **Multi-folder** — sync multiple remote paths in one config
- **rsync over SSH** — uses system SSH config for authentication
- **Auto .gitignore** — respects `.gitignore` exclusion rules
- **Progress display** — real-time per-file transfer with color output
- **Fault tolerant** — skips failed transfers, reports summary at end
- **Zero dependencies** — pure Node.js, no npm dependencies

## License

MIT
