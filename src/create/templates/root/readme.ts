/**
 * README.md template generator
 *
 * @module @alexi/create/templates/root/readme
 */

/**
 * Generate README.md content for a new project
 */
export function generateReadme(name: string): string {
  const appName = toPascalCase(name);

  return `# ${appName}

A full-stack Todo application built with [Alexi](https://github.com/atzufuki/alexi) and [HTML Props](https://github.com/atzufuki/html-props).

## Features

- **REST API Backend** - Django-style REST framework with DenoKV
- **Frontend SPA** - Built with HTML Props custom elements
- **Desktop App** - Native-like window using WebUI
- **Offline-first** - SyncBackend with IndexedDB + REST API

## Quick Start

\`\`\`bash
# Start all servers (opens desktop app)
deno task dev

# Or start individual servers:
deno task dev:web      # Web server (API) on :8000
deno task dev:ui       # UI static server on :5173
deno task dev:desktop  # Desktop WebUI window
\`\`\`

## Project Structure

\`\`\`
${name}/
├── manage.ts                 # Django-style management entry point
├── deno.jsonc                # Workspace config with tasks and import maps
├── project/
│   ├── settings.ts           # Shared settings
│   ├── web.settings.ts       # Web server settings (API)
│   ├── ui.settings.ts        # UI static file server settings
│   └── desktop.settings.ts   # WebUI desktop settings
│
└── src/
    ├── ${name}-web/          # Backend API app
    │   ├── models.ts         # TodoModel
    │   ├── serializers.ts    # TodoSerializer
    │   ├── viewsets.ts       # TodoViewSet
    │   └── urls.ts           # /api/todos/ endpoints
    │
    ├── ${name}-ui/           # Frontend UI app
    │   ├── models.ts         # Frontend ORM models
    │   ├── settings.ts       # Frontend settings (backends)
    │   ├── views.ts          # View functions
    │   ├── urls.ts           # URL patterns
    │   ├── main.ts           # Entry point
    │   └── templates/        # UI components
    │
    └── ${name}-desktop/      # WebUI desktop app
        └── bindings.ts       # Native function bindings
\`\`\`

## API Endpoints

| Method | Endpoint                | Description           |
| ------ | ----------------------- | --------------------- |
| GET    | /api/todos/             | List all todos        |
| POST   | /api/todos/             | Create a new todo     |
| GET    | /api/todos/:id/         | Get a single todo     |
| PUT    | /api/todos/:id/         | Update a todo         |
| DELETE | /api/todos/:id/         | Delete a todo         |
| POST   | /api/todos/:id/toggle/  | Toggle completed      |

## Testing

\`\`\`bash
deno task test
\`\`\`

## Learn More

- [Alexi Documentation](https://github.com/atzufuki/alexi)
- [HTML Props Documentation](https://github.com/atzufuki/html-props)
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
