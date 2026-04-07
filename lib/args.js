/**
 * Lightweight CLI argument parser for island-bridge.
 * Zero dependencies.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    command: null,
    subcommand: null,
    dryRun: false,
    verbose: false,
    quiet: false,
    json: false,
    config: null,
    env: null,
    bwlimit: null,
    select: false,
    noBackup: false,
    path: [],
    help: false,
    version: false,
    // init-specific
    host: null,
    user: null,
    paths: null,
    // backup-specific
    backupTimestamp: null,
    keep: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--dry-run':
      case '-n':
        args.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        args.verbose = true;
        break;
      case '--quiet':
      case '-q':
        args.quiet = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--config':
      case '-c':
        args.config = argv[++i];
        if (!args.config || args.config.startsWith('-')) throw new Error('--config requires a file path');
        break;
      case '--env':
        args.env = argv[++i];
        if (!args.env || args.env.startsWith('-')) throw new Error('--env requires a profile name');
        break;
      case '--bwlimit':
        args.bwlimit = argv[++i];
        if (!args.bwlimit || isNaN(Number(args.bwlimit))) {
          throw new Error('--bwlimit requires a numeric value (KB/s)');
        }
        args.bwlimit = Number(args.bwlimit);
        break;
      case '--select':
      case '-s':
        args.select = true;
        break;
      case '--no-backup':
        args.noBackup = true;
        break;
      case '--path':
        {
          const val = argv[++i];
          if (!val || val.startsWith('-')) throw new Error('--path requires a folder name');
          args.path.push(val);
        }
        break;
      case '--host':
        args.host = argv[++i];
        if (!args.host) throw new Error('--host requires a value');
        break;
      case '--user':
        args.user = argv[++i];
        if (!args.user) throw new Error('--user requires a value');
        break;
      case '--paths':
        args.paths = argv[++i];
        if (!args.paths) throw new Error('--paths requires a value');
        break;
      case '--keep':
        args.keep = argv[++i];
        if (!args.keep || isNaN(Number(args.keep))) {
          throw new Error('--keep requires a numeric value');
        }
        args.keep = Number(args.keep);
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--version':
      case '-V':
        args.version = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          if (!args.command) {
            args.command = arg;
          } else if (args.command === 'backup' && !args.subcommand) {
            args.subcommand = arg;
          } else if (args.command === 'backup' && args.subcommand === 'restore' && !args.backupTimestamp) {
            args.backupTimestamp = arg;
          }
        }
        break;
    }
  }

  if (args.verbose && args.quiet) {
    throw new Error('Cannot use --verbose and --quiet together');
  }

  return args;
}
