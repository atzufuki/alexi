/**
 * Help text for @alexi/create CLI
 *
 * @module @alexi/create/help
 */

/**
 * Print help message
 */
export function printHelp(): void {
  console.log(`
@alexi/create - Alexi Full-Stack Project Generator

Creates a full-stack Todo application with three apps:
  • web     - REST API backend (Django-style)
  • ui      - Frontend SPA (HTML Props)
  • desktop - Desktop app (WebUI)

USAGE:
  deno run -A jsr:@alexi/create <project-name>

ARGUMENTS:
  <project-name>    Name for the new project (lowercase, hyphens allowed)

OPTIONS:
  -h, --help        Show this help message
  -v, --version     Show version number

EXAMPLES:
  deno run -A jsr:@alexi/create my-todo-app
  deno run -A jsr:@alexi/create awesome-project

AFTER CREATION:
  cd <project-name>
  deno task dev

This will start:
  • Web server (REST API) on http://localhost:8000
  • UI server (frontend) on http://localhost:5173
  • Desktop WebUI window

PROJECT STRUCTURE:
  <project-name>/
  ├── manage.ts                 # Management entry point
  ├── deno.jsonc                # Workspace config
  ├── project/
  │   ├── settings.ts           # Shared settings
  │   ├── web.settings.ts       # Web server settings
  │   ├── ui.settings.ts        # UI server settings
  │   └── desktop.settings.ts   # Desktop settings
  └── src/
      ├── <project-name>-web/   # Backend API
      ├── <project-name>-ui/    # Frontend SPA
      └── <project-name>-desktop/  # Desktop app

LEARN MORE:
  https://github.com/atzufuki/alexi
`);
}

/**
 * Print version
 */
export function printVersion(version: string): void {
  console.log(`@alexi/create v${version}`);
}
