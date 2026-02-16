/**
 * Argument parser for @alexi/create CLI
 *
 * @module @alexi/create/args
 */

export interface CreateArgs {
  projectName: string | null;
  help: boolean;
  version: boolean;
}

/**
 * Parse command-line arguments for the create CLI
 */
export function parseArgs(args: string[]): CreateArgs {
  const result: CreateArgs = {
    projectName: null,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Flags
    if (arg === "--help" || arg === "-h") {
      result.help = true;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      result.version = true;
      continue;
    }

    // Skip unknown flags
    if (arg.startsWith("-")) {
      console.warn(`Warning: Unknown option "${arg}"`);
      continue;
    }

    // Positional argument - project name
    if (!result.projectName) {
      result.projectName = arg;
    }
  }

  return result;
}
