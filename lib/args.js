/**
 * Lightweight CLI argument parser for island-bridge.
 * Zero dependencies.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    command: null,
    dryRun: false,
    verbose: false,
    quiet: false,
    config: null,
    env: null,
    bwlimit: null,
    select: false,
    help: false,
    version: false,
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
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--version':
      case '-V':
        args.version = true;
        break;
      default:
        if (!arg.startsWith('-') && !args.command) {
          args.command = arg;
        }
        break;
    }
  }

  if (args.verbose && args.quiet) {
    throw new Error('Cannot use --verbose and --quiet together');
  }

  return args;
}
