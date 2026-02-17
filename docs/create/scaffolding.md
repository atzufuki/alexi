# Project Scaffolding

Alexi provides two scaffolding tools for creating new projects and apps:

1. **`@alexi/create`** — Creates a complete full-stack project from scratch
2. **`startapp`** command — Adds a new app to an existing project

---

## Creating a New Project

Use `@alexi/create` to scaffold a complete full-stack Alexi project:

```bash
deno run -A jsr:@alexi/create my-project
```

This creates a working Todo application with:

- **Web app** — REST API backend (Django-style)
- **UI app** — Frontend SPA (HTML Props)
- **Desktop app** — Desktop wrapper (WebUI)

### Quick Start

```bash
# Create project
deno run -A jsr:@alexi/create my-project

# Enter project directory
cd my-project

# Start development servers
deno task dev
```

This starts:

- Web server (REST API) on `http://localhost:8000`
- UI server (frontend) on `http://localhost:5173`
- Desktop WebUI window

### Options

```bash
deno run -A jsr:@alexi/create [options] <project-name>
```

| Option          | Description         |
| --------------- | ------------------- |
| `-h, --help`    | Show help message   |
| `-v, --version` | Show version number |

### Project Name Requirements

- Must start with a lowercase letter
- Can contain lowercase letters, numbers, and hyphens
- Examples: `my-app`, `todo2024`, `awesome-project`

### Generated Project Structure

```
my-project/
├── manage.ts                     # Management CLI entry point
├── deno.jsonc                    # Workspace configuration
├── .gitignore                    # Git ignore rules
├── README.md                     # Project readme
│
├── project/                      # Project-level settings
│   ├── settings.ts               # Shared settings (SECRET_KEY, etc.)
│   ├── web.settings.ts           # Web server settings
│   ├── ui.settings.ts            # UI server settings
│   └── desktop.settings.ts       # Desktop app settings
│
└── src/
    ├── my-project-web/           # Backend API app
    │   ├── app.ts                # AppConfig
    │   ├── mod.ts                # Module exports
    │   ├── models.ts             # ORM models (TodoModel)
    │   ├── serializers.ts        # REST serializers
    │   ├── viewsets.ts           # REST viewsets
    │   ├── urls.ts               # URL routing
    │   └── tests/                # Tests
    │
    ├── my-project-ui/            # Frontend SPA app
    │   ├── app.ts                # AppConfig
    │   ├── mod.ts                # Module exports
    │   ├── main.ts               # Entry point
    │   ├── models.ts             # Client-side models
    │   ├── endpoints.ts          # REST backend config
    │   ├── settings.ts           # UI settings
    │   ├── utils.ts              # Utilities
    │   ├── views.ts              # View components
    │   ├── urls.ts               # Client routing
    │   ├── templates/            # Page templates
    │   ├── components/           # UI components
    │   ├── styles/               # CSS styles
    │   └── static/               # Static files
    │
    └── my-project-desktop/       # Desktop app
        ├── app.ts                # AppConfig
        ├── mod.ts                # Module exports
        └── bindings.ts           # WebUI bindings
```

---

## Adding Apps to Existing Projects

Use the `startapp` management command to add new apps to an existing project:

```bash
deno run -A manage.ts startapp myapp
```

### Interactive Mode

By default, `startapp` prompts for the app type:

```bash
$ deno run -A manage.ts startapp myapp

Select app type:
  1. web      - Backend server app
  2. ui       - Browser SPA
  3. desktop  - Desktop app (WebUI)
  4. mobile   - Mobile app (Capacitor)
  5. cli      - Command-line tool
  6. combined - Full-stack (web + ui)

Enter number or type name:
```

### Non-Interactive Mode

Specify the app type directly:

```bash
# Backend web app
deno run -A manage.ts startapp myapp --type web

# Frontend UI app
deno run -A manage.ts startapp myapp --type ui

# Skip all prompts
deno run -A manage.ts startapp myapp --type web --no-input
```

### Options

| Option       | Type      | Description                                       |
| ------------ | --------- | ------------------------------------------------- |
| `--type, -t` | `string`  | App type: web, ui, desktop, mobile, cli, combined |
| `--no-input` | `boolean` | Skip interactive prompts                          |

---

## App Types

### web

Backend server application with REST API support.

**Generated files:**

- `app.ts` — AppConfig
- `mod.ts` — Module exports
- `models.ts` — ORM models
- `serializers.ts` — REST serializers
- `viewsets.ts` — REST viewsets
- `urls.ts` — URL routing
- `views.ts` — View functions
- `<name>.settings.ts` — Settings file
- `tests/` — Test directory

**Use for:** REST APIs, server-side rendering, background tasks.

### ui

Browser-based single-page application.

**Generated files:**

- `app.ts` — AppConfig
- `mod.ts` — Module exports
- `main.ts` — Entry point
- `models.ts` — Client-side models
- `views.ts` — View components
- `urls.ts` — Client-side routing
- `templates/` — Page templates
- `components/` — UI components
- `<name>.settings.ts` — Settings file

**Use for:** Frontend SPAs, interactive web apps.

### desktop

Desktop application using WebUI.

**Generated files:**

- `app.ts` — AppConfig
- `mod.ts` — Module exports
- `bindings.ts` — WebUI JavaScript bindings
- `urls.ts` — URL routing
- `<name>.settings.ts` — Settings file

**Use for:** Cross-platform desktop apps.

### mobile

Mobile application using Capacitor.

**Generated files:**

- `app.ts` — AppConfig
- `mod.ts` — Module exports
- `urls.ts` — URL routing
- `capacitor.config.ts` — Capacitor configuration
- `<name>.settings.ts` — Settings file

**Use for:** iOS and Android mobile apps.

### cli

Command-line tool.

**Generated files:**

- `app.ts` — AppConfig
- `mod.ts` — Module exports
- `main.ts` — CLI entry point
- `commands/mod.ts` — Custom commands
- `<name>.settings.ts` — Settings file

**Use for:** CLI utilities, automation scripts.

### combined

Full-stack application (web backend + ui frontend).

**Generated files:**

- All files from `web` type
- All files from `ui` type

**Use for:** Complete full-stack features.

---

## Configuring Generated Apps

### Register in Settings

After creating an app, register it in your settings file:

```ts
// project/web.settings.ts
export const INSTALLED_APPS = [
  () => import("@alexi/web"),
  () => import("@alexi/db"),
  () => import("@alexi/auth"),
  () => import("@myproject/web"),
  () => import("@myproject/myapp"), // Add new app
];
```

### Add to Import Map

Add the new app to your `deno.jsonc` imports:

```jsonc
{
  "imports": {
    "@myproject/myapp": "./src/myapp/mod.ts"
  }
}
```

### Include URLs

Include the app's URLs in your main URL configuration:

```ts
// src/myproject-web/urls.ts
import { include, path } from "@alexi/urls";
import { router as myappRouter } from "@myproject/myapp/urls.ts";

export const urlpatterns = [
  // Existing URLs...
  path("api/myapp/", include(myappRouter.urls)),
];
```

---

## Generated Code Examples

### Models (Web App)

```ts
// src/myapp/models.ts
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  Manager,
  Model,
} from "@alexi/db";

export class ItemModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 255 });
  description = new CharField({ maxLength: 1000, blank: true });
  isActive = new BooleanField({ default: true });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(ItemModel);

  static meta = {
    dbTable: "items",
    ordering: ["-createdAt"],
  };
}
```

### ViewSets (Web App)

```ts
// src/myapp/viewsets.ts
import { ModelViewSet } from "@alexi/restframework";
import { ItemModel } from "./models.ts";
import { ItemSerializer } from "./serializers.ts";

export class ItemViewSet extends ModelViewSet {
  model = ItemModel;
  serializer_class = ItemSerializer;
  filtersetFields = ["isActive"];
  searchFields = ["name", "description"];
  orderingFields = ["name", "createdAt"];
}
```

### Views (UI App)

```ts
// src/myapp-ui/views.ts
import { Column, Container, Typography } from "@aspect-ui/core";

export class HomeView {
  render() {
    return new Container({
      padding: "24px",
      content: [
        new Column({
          gap: "16px",
          content: [
            new Typography({
              variant: "h1",
              content: ["Welcome to My App"],
            }),
          ],
        }),
      ],
    });
  }
}
```

---

## Deno Tasks

Generated projects include these common tasks in `deno.jsonc`:

```jsonc
{
  "tasks": {
    "dev": "deno task web & deno task ui & deno task desktop",
    "web": "deno run -A --unstable-kv manage.ts runserver --settings web",
    "ui": "deno run -A --unstable-kv manage.ts runserver --settings ui --port 5173",
    "desktop": "deno run -A --unstable-kv --unstable-ffi manage.ts runserver --settings desktop",
    "test": "deno run -A --unstable-kv manage.ts test",
    "check": "deno check manage.ts",
    "fmt": "deno fmt",
    "lint": "deno lint"
  }
}
```

### Common Commands

```bash
# Start all servers (development)
deno task dev

# Start web server only
deno task web

# Start UI server only
deno task ui

# Run tests
deno task test

# Type check
deno task check

# Format code
deno task fmt

# Lint code
deno task lint
```

---

## Best Practices

### 1. Use Meaningful App Names

```bash
# ✅ Good - descriptive names
deno run -A manage.ts startapp accounts --type web
deno run -A manage.ts startapp dashboard --type ui
deno run -A manage.ts startapp reports --type combined

# ❌ Avoid - generic names
deno run -A manage.ts startapp app1 --type web
deno run -A manage.ts startapp frontend --type ui
```

### 2. Separate Concerns

Create separate apps for different domains:

```bash
# User management
deno run -A manage.ts startapp accounts --type web

# Product catalog
deno run -A manage.ts startapp products --type web

# Shopping cart
deno run -A manage.ts startapp cart --type combined

# Admin dashboard
deno run -A manage.ts startapp admin-ui --type ui
```

### 3. Follow Naming Conventions

- App names: `lowercase-with-hyphens`
- Module imports: `@project/app-name`
- TypeScript files: `snake_case.ts`
- Classes: `PascalCase`

### 4. Keep Apps Focused

Each app should have a single responsibility:

```
src/
├── users-web/        # User authentication & profiles
├── users-ui/         # User-facing frontend
├── products-web/     # Product catalog API
├── products-ui/      # Product browsing UI
├── orders-web/       # Order processing
├── orders-ui/        # Order management UI
└── admin-ui/         # Internal admin dashboard
```

---

## Troubleshooting

### "Directory already exists"

```bash
Error: Directory "myapp" already exists.
```

Remove or rename the existing directory, or choose a different app name.

### "Invalid project name"

```bash
Error: Invalid project name "My-App". Use lowercase letters, numbers, and hyphens only.
```

Project names must:

- Start with a lowercase letter
- Contain only lowercase letters, numbers, and hyphens

### App not found after creation

Make sure to:

1. Add the app to `INSTALLED_APPS` in settings
2. Add the import mapping in `deno.jsonc`
3. Restart the development server

### Import errors

Check that your import map in `deno.jsonc` matches your app location:

```jsonc
{
  "imports": {
    "@myproject/myapp": "./src/myapp/mod.ts"
  }
}
```
