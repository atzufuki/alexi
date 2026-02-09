/**
 * Help output for @alexi/create CLI
 *
 * @module @alexi/create/help
 */

/**
 * Print help message
 */
export function printHelp(): void {
  const help = `
┌─────────────────────────────────────────────┐
│           @alexi/create                     │
│   Project scaffolding for Alexi framework   │
└─────────────────────────────────────────────┘

Usage:
  deno run -A jsr:@alexi/create <project-name> [options]

Arguments:
  <project-name>    Name of the project to create

Options:
  -h, --help        Show this help message
  -v, --version     Show version number
  --no-input        Run without interactive prompts

Features (enabled by default):
  --with-rest       Include REST framework (default: true)
  --no-rest         Exclude REST framework
  --with-admin      Include admin panel (default: true)
  --no-admin        Exclude admin panel
  --with-auth       Include authentication (default: true)
  --no-auth         Exclude authentication

Database:
  -d, --database <backend>
                    Database backend: denokv, indexeddb, none
                    (default: denokv)

Examples:
  # Create a new project with defaults
  deno run -A jsr:@alexi/create myproject

  # Create a minimal project
  deno run -A jsr:@alexi/create myproject --no-admin --no-auth

  # Create project with specific database
  deno run -A jsr:@alexi/create myproject --database indexeddb

  # Non-interactive mode (for CI/scripts)
  deno run -A jsr:@alexi/create myproject --no-input

After creating a project:
  cd <project-name>
  deno task dev        # Start development server
  deno task test       # Run tests
`;

  console.log(help);
}

/**
 * Print version
 */
export function printVersion(version: string): void {
  console.log(`@alexi/create v${version}`);
}
