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

A full-stack Posts application built with [Alexi](https://github.com/atzufuki/alexi).

## Features

- **REST API Backend** - Django-style REST framework with DenoKV
- **Service Worker Frontend** - HTMX-powered offline-capable UI
- **Unified Architecture** - Single app with server and worker code

## Quick Start

\`\`\`bash
# Start the web server
deno task dev
\`\`\`

The web server runs on http://localhost:8000

## Project Structure

\`\`\`
${name}/
├── manage.ts                 # Django-style management entry point
├── deno.jsonc                # Workspace config with tasks and import maps
├── project/
│   ├── settings.ts           # Shared settings
│   └── web.settings.ts       # Web server settings
│
└── src/
    └── ${name}/              # Unified app
        ├── app.ts            # Server-side app config
        ├── mod.ts            # Module exports
        ├── models.ts         # PostModel
        ├── serializers.ts    # PostSerializer
        ├── viewsets.ts       # PostViewSet
        ├── urls.ts           # /api/posts/ endpoints
        ├── views.ts          # Server-side views
        ├── tests/            # Tests
        ├── migrations/       # Database migrations
        ├── static/           # Built static output
        ├── assets/           # Frontend TypeScript
        └── workers/          # Service Worker app
\`\`\`

## API Endpoints

| Method | Endpoint                 | Description           |
| ------ | ------------------------ | --------------------- |
| GET    | /api/posts/              | List all posts        |
| POST   | /api/posts/              | Create a new post     |
| GET    | /api/posts/:id/          | Get a single post     |
| PUT    | /api/posts/:id/          | Update a post         |
| DELETE | /api/posts/:id/          | Delete a post         |
| POST   | /api/posts/:id/publish/  | Publish a post        |

## Testing

\`\`\`bash
deno task test
\`\`\`

## Learn More

- [Alexi Documentation](https://github.com/atzufuki/alexi)
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
