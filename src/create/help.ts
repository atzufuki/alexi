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

Creates a full-stack Posts application with a unified app structure:
  • Server-side code (models, views, viewsets, URLs)
  • Frontend assets (bundled into static files)
  • Service Worker (offline-capable HTMX frontend)

USAGE:
  deno run -A jsr:@alexi/create <project-name>

ARGUMENTS:
  <project-name>    Name for the new project (lowercase, hyphens allowed)

OPTIONS:
  -h, --help        Show this help message
  -v, --version     Show version number
  --skills-only     Install Agent Skills to current directory (no project creation)

EXAMPLES:
  deno run -A jsr:@alexi/create my-todo-app
  deno run -A jsr:@alexi/create awesome-project
  deno run -A jsr:@alexi/create --skills-only   # Add skills to existing project

AFTER CREATION:
  cd <project-name>
  deno task dev

This will start:
  • Web server on http://localhost:8000

PROJECT STRUCTURE:
  <project-name>/
  ├── manage.ts                 # Management entry point
  ├── deno.jsonc                # Workspace config
  ├── project/
  │   ├── settings.ts           # Shared settings
  │   └── web.settings.ts       # Web server settings
  └── src/
      └── <project-name>/      # Unified app
          ├── app.ts            # Server-side app config
          ├── mod.ts            # Module exports
          ├── models.ts         # ORM models
          ├── serializers.ts    # REST serializers
          ├── viewsets.ts       # REST viewsets
          ├── urls.ts           # URL routing
          ├── views.ts          # Server-side views
          ├── tests/            # Tests
          ├── migrations/       # Database migrations
          ├── static/           # Built static output
          ├── assets/           # Frontend TypeScript
          └── workers/          # Service Worker app

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
