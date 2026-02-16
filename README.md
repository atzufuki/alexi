# Alexi

A Django-inspired full-stack framework for Deno, written in TypeScript.

Alexi brings Django's developer-friendly patterns to the Deno ecosystem: ORM
with multiple backends, REST framework, admin panel, and project scaffolding—all
with first-class TypeScript support.

## Quick Start

Create a new full-stack project in seconds:

```bash
deno run -A jsr:@alexi/create my-project
cd my-project
deno task dev
```

This scaffolds a complete Todo application with:

- **Web** — REST API backend on `http://localhost:8000`
- **UI** — Frontend SPA on `http://localhost:5173`
- **Desktop** — Native desktop app via WebUI

## Features

| Feature                 | Description                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------- |
| **ORM**                 | Django-style models, QuerySets, and Managers with SQLite, IndexedDB, and REST backends |
| **REST Framework**      | Serializers, ViewSets, Routers, and filter backends                                    |
| **Admin Panel**         | Auto-generated admin interface for your models                                         |
| **Project Scaffolding** | `@alexi/create` generates full-stack projects instantly                                |
| **URL Routing**         | Django-style `path()`, `include()`, and URL patterns                                   |
| **Authentication**      | JWT-based auth with decorators                                                         |
| **Desktop Apps**        | WebUI integration for native-like desktop applications                                 |
| **Mobile Apps**         | Capacitor integration for iOS/Android                                                  |

## Installation

### Create a New Project (Recommended)

```bash
deno run -A jsr:@alexi/create my-project
```

### Add to Existing Project

```bash
deno add jsr:@alexi/db jsr:@alexi/restframework jsr:@alexi/http
```

Or import directly:

```typescript
import { CharField, Manager, Model } from "jsr:@alexi/db";
import { ModelSerializer, ModelViewSet } from "jsr:@alexi/restframework";
```

## Example

### Define a Model

```typescript
// models.ts
import { AutoField, BooleanField, CharField, Manager, Model } from "@alexi/db";

export class TodoModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  completed = new BooleanField({ default: false });

  static objects = new Manager(TodoModel);

  static meta = {
    dbTable: "todos",
  };
}
```

### Create a Serializer

```typescript
// serializers.ts
import { ModelSerializer } from "@alexi/restframework";
import { TodoModel } from "./models.ts";

export class TodoSerializer extends ModelSerializer {
  static Meta = {
    model: TodoModel,
    fields: ["id", "title", "completed"],
    readOnlyFields: ["id"],
  };
}
```

### Create a ViewSet

```typescript
// viewsets.ts
import { ModelViewSet, QueryParamFilterBackend } from "@alexi/restframework";
import { TodoModel } from "./models.ts";
import { TodoSerializer } from "./serializers.ts";

export class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializerClass = TodoSerializer;

  // Enable query parameter filtering
  filterBackends = [new QueryParamFilterBackend()];
  filtersetFields = ["id", "completed"];
}
```

### Register Routes

```typescript
// urls.ts
import { DefaultRouter } from "@alexi/restframework";
import { TodoViewSet } from "./viewsets.ts";

const router = new DefaultRouter();
router.register("todos", TodoViewSet);

export const urlpatterns = router.urls;
```

### Start the Server

```typescript
// app.ts
import { Application } from "@alexi/http";
import { urlpatterns } from "./urls.ts";

const app = new Application({
  urls: urlpatterns,
});

Deno.serve({ port: 8000 }, app.handler);
```

Now you have a full REST API:

```
GET    /api/todos/           # List all todos
POST   /api/todos/           # Create a todo
GET    /api/todos/:id/       # Get a todo
PUT    /api/todos/:id/       # Update a todo
DELETE /api/todos/:id/       # Delete a todo
GET    /api/todos/?completed=true  # Filter by completed
```

## Modules

| Module                 | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `@alexi/create`        | Project scaffolding CLI                                      |
| `@alexi/db`            | ORM with SQLite, IndexedDB, and REST backends                |
| `@alexi/restframework` | REST API framework (Serializers, ViewSets, Routers, Filters) |
| `@alexi/http`          | HTTP application and middleware                              |
| `@alexi/admin`         | Auto-generated admin panel                                   |
| `@alexi/auth`          | JWT authentication                                           |
| `@alexi/core`          | Management commands and utilities                            |
| `@alexi/urls`          | URL routing utilities                                        |
| `@alexi/staticfiles`   | Static file handling and bundling                            |
| `@alexi/webui`         | Desktop app support via WebUI                                |
| `@alexi/capacitor`     | Mobile app support via Capacitor                             |

## ORM

### Querying

```typescript
// Get all todos
const todos = await TodoModel.objects.all().fetch();

// Filter
const completed = await TodoModel.objects
  .filter({ completed: true })
  .fetch();

// Chained filters with lookups
const recent = await TodoModel.objects
  .filter({ title__contains: "important" })
  .orderBy("-createdAt")
  .limit(10)
  .fetch();

// Get single object
const todo = await TodoModel.objects.get({ id: 1 });

// Create
const newTodo = await TodoModel.objects.create({
  title: "Learn Alexi",
  completed: false,
});

// Update
todo.completed.set(true);
await todo.save();

// Delete
await todo.delete();
```

### Multiple Backends

```typescript
import { setup } from "@alexi/db";

// Configure backends
setup({
  databases: {
    default: { engine: "sqlite", name: "db.sqlite" },
    cache: { engine: "indexeddb", name: "app-cache" },
    api: { engine: "rest", name: "https://api.example.com" },
  },
});

// Use specific backend
const cached = await TodoModel.objects.using("cache").all().fetch();
const remote = await TodoModel.objects.using("api").all().fetch();
```

## REST Framework

### Filter Backends

```typescript
import {
  ModelViewSet,
  OrderingFilter,
  QueryParamFilterBackend,
  SearchFilter,
} from "@alexi/restframework";

class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializerClass = ArticleSerializer;

  filterBackends = [
    new QueryParamFilterBackend(),
    new OrderingFilter(),
    new SearchFilter(),
  ];

  filtersetFields = ["id", "status", "author"];
  orderingFields = ["createdAt", "title"];
  searchFields = ["title", "body"];
  ordering = ["-createdAt"]; // default ordering
}

// Supports:
// GET /api/articles/?status=published
// GET /api/articles/?ordering=-createdAt
// GET /api/articles/?search=typescript
// GET /api/articles/?title__contains=guide
```

### Custom Actions

```typescript
import { action, ModelViewSet } from "@alexi/restframework";

class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializerClass = TodoSerializer;

  @action({ detail: true, methods: ["POST"] })
  async toggle(context: ViewSetContext): Promise<Response> {
    const todo = await this.getObject(context);
    todo.completed.set(!todo.completed.get());
    await todo.save();
    return Response.json(await new TodoSerializer({ instance: todo }).data);
  }
}

// POST /api/todos/:id/toggle/
```

## Project Structure

When you run `deno run -A jsr:@alexi/create my-project`, you get:

```
my-project/
├── manage.ts                    # Management CLI entry point
├── deno.jsonc                   # Workspace configuration
├── project/
│   ├── settings.ts              # Shared settings
│   ├── web.settings.ts          # Web server settings
│   ├── ui.settings.ts           # UI settings
│   └── desktop.settings.ts      # Desktop settings
└── src/
    ├── my-project-web/          # Backend REST API
    │   ├── app.ts
    │   ├── models.ts
    │   ├── serializers.ts
    │   ├── viewsets.ts
    │   └── urls.ts
    ├── my-project-ui/           # Frontend SPA
    │   ├── main.ts
    │   ├── models.ts
    │   ├── views.ts
    │   ├── templates/
    │   └── components/
    └── my-project-desktop/      # Desktop app
        └── app.ts
```

## Requirements

- Deno 2.0+
- `--unstable-kv` flag for DenoKV backend (SQLite)

## Documentation

See the [docs/](./docs/) directory for detailed guides:

- [Getting Started](./docs/getting-started.md)
- [URL Routing](./docs/urls.md)
- [Views](./docs/views.md)
- [ORM Guide](./docs/db/models.md)
- [REST Framework ViewSets](./docs/restframework/viewsets.md)
- [Filtering](./docs/restframework/filtering.md)

## Contributing

Contributions are welcome! Please read our contributing guidelines before
submitting PRs.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Links

- [GitHub Repository](https://github.com/atzufuki/alexi)
- [JSR Package](https://jsr.io/@alexi)
- [Issue Tracker](https://github.com/atzufuki/alexi/issues)
