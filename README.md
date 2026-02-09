# Alexi

A Django-inspired full-stack framework for Deno, written in TypeScript.

Alexi brings Django's developer-friendly patterns to the Deno ecosystem:
management commands, ORM, REST framework, admin panel, desktop apps, and more.

## Features

- **Management Commands** - Django-style CLI with `manage.ts`
- **ORM** - Model definitions, QuerySets, Managers (DenoKV & IndexedDB backends)
- **REST Framework** - Serializers, ViewSets, Routers
- **Admin Panel** - Auto-generated admin interface
- **URL Routing** - `path()`, `include()`, URL patterns
- **Middleware** - CORS, logging, error handling
- **Static Files** - Collection, serving, bundling
- **Authentication** - JWT-based auth with decorators
- **Desktop Apps** - WebUI integration for native-like apps

## Installation

```bash
# Import from JSR (coming soon)
deno add @alexi/core @alexi/db @alexi/restframework
```

## Quick Start

```typescript
// manage.ts
import { ManagementUtility } from "@alexi/core";

const management = new ManagementUtility();
await management.execute();
```

```typescript
// models.ts
import { AutoField, CharField, Manager, Model } from "@alexi/db";

class Task extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });

  static objects = new Manager(Task);
  static meta = { dbTable: "tasks" };
}
```

```typescript
// viewsets.ts
import { ModelViewSet } from "@alexi/restframework";
import { Task } from "./models.ts";

class TaskViewSet extends ModelViewSet {
  model = Task;
}
```

```typescript
// urls.ts
import { Router } from "@alexi/restframework";
import { TaskViewSet } from "./viewsets.ts";

const router = new Router();
router.register("tasks", TaskViewSet);

export const urlpatterns = router.urls;
```

## Modules

| Module                 | Description                              |
| ---------------------- | ---------------------------------------- |
| `@alexi/core`          | Management commands, Application handler |
| `@alexi/db`            | ORM with DenoKV and IndexedDB backends   |
| `@alexi/urls`          | URL routing                              |
| `@alexi/http`          | HTTP utilities                           |
| `@alexi/middleware`    | CORS, logging, error handling            |
| `@alexi/views`         | Template views                           |
| `@alexi/web`           | Web server (HTTP API)                    |
| `@alexi/staticfiles`   | Static file handling and bundling        |
| `@alexi/restframework` | REST API framework                       |
| `@alexi/auth`          | Authentication                           |
| `@alexi/admin`         | Admin panel                              |
| `@alexi/webui`         | Desktop app support via WebUI            |
| `@alexi/capacitor`     | Mobile app support via Capacitor         |
| `@alexi/types`         | Shared type definitions                  |

## Documentation

See the [documentation](./doc/) for detailed guides.

## Requirements

- Deno 2.0+
- `--unstable-kv` flag for DenoKV backend

## License

MIT License - see [LICENSE](./LICENSE) for details.
