/**
 * Argument parser for @alexi/create CLI
 *
 * @module @alexi/create/args
 */

export type DatabaseBackend = "denokv" | "indexeddb" | "none";

export interface CreateArgs {
  projectName: string | null;
  withRest: boolean;
  withAdmin: boolean;
  withAuth: boolean;
  database: DatabaseBackend;
  noInput: boolean;
  help: boolean;
  version: boolean;
}

/**
 * Parse command-line arguments for the create CLI
 */
export function parseArgs(args: string[]): CreateArgs {
  const result: CreateArgs = {
    projectName: null,
    withRest: true,
    withAdmin: true,
    withAuth: true,
    database: "denokv",
    noInput: false,
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

    if (arg === "--no-input") {
      result.noInput = true;
      continue;
    }

    // Feature flags
    if (arg === "--with-rest") {
      result.withRest = true;
      continue;
    }

    if (arg === "--no-rest") {
      result.withRest = false;
      continue;
    }

    if (arg === "--with-admin") {
      result.withAdmin = true;
      continue;
    }

    if (arg === "--no-admin") {
      result.withAdmin = false;
      continue;
    }

    if (arg === "--with-auth") {
      result.withAuth = true;
      continue;
    }

    if (arg === "--no-auth") {
      result.withAuth = false;
      continue;
    }

    // Database option
    if (arg === "--database" || arg === "-d") {
      const value = args[i + 1];
      if (value === "denokv" || value === "indexeddb" || value === "none") {
        result.database = value;
        i++;
      } else {
        console.warn(`Warning: Invalid database "${value}", using "denokv"`);
      }
      continue;
    }

    if (arg.startsWith("--database=")) {
      const value = arg.slice("--database=".length);
      if (value === "denokv" || value === "indexeddb" || value === "none") {
        result.database = value;
      } else {
        console.warn(`Warning: Invalid database "${value}", using "denokv"`);
      }
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
