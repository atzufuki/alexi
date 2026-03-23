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

This creates a working blog-style application with:

- **Server app** — REST API backend + SSR views (Django-style)
- **Service Worker** — Offline-capable frontend running in the browser
- **Static assets** — TypeScript frontend bundle (esbuild)

### Quick Start

```bash
# Create project
deno run -A jsr:@alexi/create my-project

# Enter project directory
cd my-project

# Start development server
deno task dev
```

This starts the HTTP server on `http://localhost:8000`.

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
- Examples: `my-app`, `blog2024`, `awesome-project`

### Generated Project Structure

```
my-project/
├── manage.ts                              # Management CLI entry point
├── deno.jsonc                             # Workspace configuration & import map
├── .gitignore
├── README.md
│
├── project/                               # Project-level configuration
│   ├── http.ts                            # Production HTTP entry point (deno serve)
│   ├── settings.ts                        # Development settings
│   └── production.ts                      # Production settings (Deno Deploy)
│
└── src/
    └── my-project/                        # Unified full-stack app
        ├── mod.ts                         # App exports + MyProjectConfig
        ├── models.ts                      # ORM models (PostModel)
        ├── serializers.ts                 # REST serializers
        ├── viewsets.ts                    # REST viewsets
        ├── urls.ts                        # Server URL routing
        ├── views.ts                       # Server-side views
        ├── migrations/                    # Database migrations
        │   └── 0001_init.ts
        ├── tests/                         # Test suite
        │   └── post_test.ts
        ├── templates/                     # Django-style HTML templates
        │   └── my-project/
        │       ├── base.html
        │       ├── index.html
        │       ├── post_list.html
        │       ├── post_form.html
        │       └── post_detail.html
        ├── static/                        # Bundled output (generated)
        │   └── my-project/
        ├── assets/                        # Frontend TypeScript source
        │   └── my-project/
        │       └── my-project.ts          # Browser entry point
        └── workers/                       # Service Worker source
            └── my-project/
                ├── worker.ts              # SW entry point
                ├── mod.ts                 # Worker app exports
                ├── models.ts              # Client-side models (RestBackend)
                ├── endpoints.ts           # REST endpoint definitions
                ├── settings.ts            # Worker settings
                ├── urls.ts                # Client-side URL routing
                └── views.ts               # Client-side views
```

---

## App Configuration (AppConfig)

Every Alexi app exports a named `AppConfig` instance from its `mod.ts`. This
replaces the old `app.ts` file approach.

```ts
// src/my-project/mod.ts
import type { AppConfig } from "@alexi/types";

export const MyProjectConfig: AppConfig = {
  name: "my-project",
  verboseName: "MyProject",
};

export * from "./models.ts";
export * from "./views.ts";
export * from "./urls.ts";
```

Register it in `INSTALLED_APPS` using a direct named import — no factory
function needed:

```ts
// project/settings.ts
import { MyProjectConfig } from "@my-project/mod.ts";

export const INSTALLED_APPS = [
  StaticfilesConfig,
  DbConfig,
  AuthConfig,
  AdminConfig,
  MyProjectConfig,
];
```

---

## Adding Apps to Existing Projects

Use the `startapp` management command to add a new app:

```bash
deno run -A manage.ts startapp myapp --settings ./project/settings.ts
```

### Generated Files

`startapp` creates the following files inside `src/myapp/`:

| File             | Description                    |
| ---------------- | ------------------------------ |
| `mod.ts`         | Module exports + `MyappConfig` |
| `models.ts`      | ORM models                     |
| `serializers.ts` | REST serializers               |
| `viewsets.ts`    | REST viewsets                  |
| `urls.ts`        | URL routing                    |
| `views.ts`       | Views                          |
| `migrations/`    | Migration directory            |
| `tests/`         | Test directory                 |

Worker-side files are created under `src/myapp/workers/myapp/`:

| File           | Description                |
| -------------- | -------------------------- |
| `worker.ts`    | Service Worker entry point |
| `mod.ts`       | Worker module exports      |
| `models.ts`    | Client-side models         |
| `endpoints.ts` | REST endpoint definitions  |
| `settings.ts`  | Worker settings            |
| `urls.ts`      | Client URL routing         |
| `views.ts`     | Client-side views          |

### Register the New App

After running `startapp`, add the app to your settings:

```ts
// project/settings.ts
import { MyappConfig } from "@myapp/mod.ts";

export const INSTALLED_APPS = [
  StaticfilesConfig,
  DbConfig,
  AuthConfig,
  AdminConfig,
  MyappConfig, // ← add here
];
```

Add the import map entry in `deno.jsonc`:

```jsonc
{
  "imports": {
    "@myapp/": "./src/myapp/"
  }
}
```

Include the app's URLs in your root URL configuration:

```ts
// src/my-project/urls.ts
import { include, path } from "@alexi/urls";
import { urlpatterns as myappUrls } from "@myapp/urls.ts";

export const urlpatterns = [
  // ...existing routes...
  path("myapp/", include(myappUrls)),
];
```

---

## Deno Tasks

Generated projects include these tasks in `deno.jsonc`:

```jsonc
{
  "tasks": {
    "dev": "deno run -A --unstable-kv manage.ts runserver --settings ./project/settings.ts",
    "test": "deno run -A --unstable-kv manage.ts test --settings ./project/settings.ts",
    "bundle": "deno run -A --unstable-kv manage.ts bundle --settings ./project/settings.ts",
    "check": "deno check manage.ts",
    "fmt": "deno fmt",
    "lint": "deno lint"
  }
}
```

### Common Commands

```bash
# Start development server
deno task dev

# Run tests
deno task test

# Bundle frontend assets
deno task bundle

# Type check
deno task check

# Format code
deno task fmt

# Lint code
deno task lint
```

---

## Generated Code Examples

### App Config (mod.ts)

```ts
// src/myapp/mod.ts
import type { AppConfig } from "@alexi/types";

/**
 * App configuration for the Myapp app.
 *
 * Add to `INSTALLED_APPS` in your project settings.
 */
export const MyappConfig: AppConfig = {
  name: "myapp",
  verboseName: "Myapp",
};

export * from "./models.ts";
export * from "./views.ts";
export * from "./urls.ts";
export * from "./serializers.ts";
export * from "./viewsets.ts";
```

### Models

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
  isActive = new BooleanField({ default: true });
  createdAt = new DateTimeField({ autoNowAdd: true });

  static objects = new Manager(ItemModel);

  static meta = {
    dbTable: "items",
    ordering: ["-createdAt"],
  };
}
```

### ViewSets

```ts
// src/myapp/viewsets.ts
import { ModelViewSet } from "@alexi/restframework";
import { ItemModel } from "./models.ts";
import { ItemSerializer } from "./serializers.ts";

export class ItemViewSet extends ModelViewSet {
  model = ItemModel;
  serializer_class = ItemSerializer;
  filtersetFields = ["isActive"];
  searchFields = ["name"];
  orderingFields = ["name", "createdAt"];
}
```

---

## Best Practices

### 1. Use Meaningful App Names

```bash
# Good — descriptive names
deno run -A manage.ts startapp accounts --settings ./project/settings.ts
deno run -A manage.ts startapp products --settings ./project/settings.ts

# Avoid — generic names
deno run -A manage.ts startapp app1 --settings ./project/settings.ts
```

### 2. Separate Concerns

Create separate apps for different domains:

```bash
deno run -A manage.ts startapp accounts --settings ./project/settings.ts
deno run -A manage.ts startapp products --settings ./project/settings.ts
deno run -A manage.ts startapp orders --settings ./project/settings.ts
```

### 3. Follow Naming Conventions

- App names: `lowercase-with-hyphens`
- Config exports: `PascalCaseConfig` (e.g. `AccountsConfig`)
- Module imports: `@project/app-name`
- TypeScript files: `snake_case.ts`
- Classes: `PascalCase`

---

## Troubleshooting

### "Directory already exists"

```
Error: Directory "myapp" already exists.
```

Remove or rename the existing directory, or choose a different app name.

### "Invalid project name"

```
Error: Invalid project name "My-App". Use lowercase letters, numbers, and hyphens only.
```

Project names must start with a lowercase letter and contain only lowercase
letters, numbers, and hyphens.

### App not found after creation

Make sure to:

1. Add `MyappConfig` to `INSTALLED_APPS` in settings
2. Add the import mapping in `deno.jsonc`
3. Restart the development server

### Import errors

Check that your import map in `deno.jsonc` matches your app location:

```jsonc
{
  "imports": {
    "@myapp/": "./src/myapp/"
  }
}
```
