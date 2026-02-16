# Getting Started with Alexi

This guide will help you create your first Alexi project and understand the core
concepts.

## Prerequisites

- [Deno 2.0+](https://deno.land/) installed
- Basic knowledge of TypeScript

## Create a New Project

The fastest way to get started is using `@alexi/create`:

```bash
deno run -A jsr:@alexi/create my-project
```

This creates a full-stack Todo application with:

- **Web** — REST API backend
- **UI** — Frontend SPA with HTML Props
- **Desktop** — Native desktop app via WebUI

### Start Development

```bash
cd my-project
deno task dev
```

This starts three servers:

| App     | URL                   | Description           |
| ------- | --------------------- | --------------------- |
| Web     | http://localhost:8000 | REST API backend      |
| UI      | http://localhost:5173 | Frontend application  |
| Desktop | (window)              | Native desktop window |

## Project Structure

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
    │   ├── app.ts               # Application entry
    │   ├── models.ts            # Database models
    │   ├── serializers.ts       # API serializers
    │   ├── viewsets.ts          # API viewsets
    │   └── urls.ts              # URL routing
    ├── my-project-ui/           # Frontend SPA
    │   ├── main.ts              # Entry point
    │   ├── models.ts            # Client-side models
    │   ├── views.ts             # View functions
    │   ├── templates/           # Page templates
    │   └── components/          # UI components
    └── my-project-desktop/      # Desktop app
        └── app.ts               # Desktop entry
```

## Core Concepts

Alexi follows Django's MVT (Model-View-Template) pattern adapted for TypeScript:

### Models

Models define your data structure and provide an ORM for database operations:

```typescript
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

### Serializers

Serializers handle conversion between model instances and JSON:

```typescript
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

### ViewSets

ViewSets provide CRUD operations for your API:

```typescript
import { ModelViewSet } from "@alexi/restframework";
import { TodoModel } from "./models.ts";
import { TodoSerializer } from "./serializers.ts";

export class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializerClass = TodoSerializer;
}
```

### Routers

Routers automatically generate URL patterns for ViewSets:

```typescript
import { DefaultRouter } from "@alexi/restframework";
import { TodoViewSet } from "./viewsets.ts";

const router = new DefaultRouter();
router.register("todos", TodoViewSet);

export const urlpatterns = router.urls;
```

## Database Backends

Alexi supports multiple database backends:

| Backend   | Use Case                 | Engine      |
| --------- | ------------------------ | ----------- |
| SQLite    | Server-side persistence  | `sqlite`    |
| IndexedDB | Browser-side caching     | `indexeddb` |
| REST      | Remote API communication | `rest`      |

### Configuration

```typescript
import { setup } from "@alexi/db";

setup({
  databases: {
    default: { engine: "sqlite", name: "db.sqlite" },
    cache: { engine: "indexeddb", name: "app-cache" },
    api: { engine: "rest", name: "https://api.example.com" },
  },
});
```

### Using Different Backends

```typescript
// Use default backend
const todos = await TodoModel.objects.all().fetch();

// Use specific backend
const cached = await TodoModel.objects.using("cache").all().fetch();
const remote = await TodoModel.objects.using("api").all().fetch();
```

## Management Commands

Alexi provides Django-style management commands via `manage.ts`:

```bash
# Run development server
deno task dev

# Run specific app
deno run -A manage.ts runserver web
deno run -A manage.ts runserver ui

# Create superuser (if auth is configured)
deno run -A manage.ts createsuperuser
```

## Next Steps

- [Models and ORM](./db/models.md) — Learn about model fields, queries, and
  relationships
- [REST Framework](./restframework/viewsets.md) — Build powerful APIs
- [Filtering](./restframework/filtering.md) — Add query parameter filtering to
  your API

## Common Tasks

### Add a New Model

1. Define the model in `models.ts`:

```typescript
export class ProjectModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  description = new TextField({ blank: true });

  static objects = new Manager(ProjectModel);
  static meta = { dbTable: "projects" };
}
```

2. Create a serializer in `serializers.ts`:

```typescript
export class ProjectSerializer extends ModelSerializer {
  static Meta = {
    model: ProjectModel,
    fields: ["id", "name", "description"],
  };
}
```

3. Create a ViewSet in `viewsets.ts`:

```typescript
export class ProjectViewSet extends ModelViewSet {
  model = ProjectModel;
  serializerClass = ProjectSerializer;
}
```

4. Register in `urls.ts`:

```typescript
router.register("projects", ProjectViewSet);
```

### Add Filtering to an Endpoint

```typescript
import { OrderingFilter, QueryParamFilterBackend } from "@alexi/restframework";

export class ProjectViewSet extends ModelViewSet {
  model = ProjectModel;
  serializerClass = ProjectSerializer;

  filterBackends = [new QueryParamFilterBackend(), new OrderingFilter()];
  filtersetFields = ["id", "name"];
  orderingFields = ["name", "createdAt"];
}
```

Now you can filter:

```
GET /api/projects/?name__contains=alexi
GET /api/projects/?ordering=-createdAt
```

### Add a Custom Action

```typescript
import { action } from "@alexi/restframework";

export class TodoViewSet extends ModelViewSet {
  // ... standard config ...

  @action({ detail: true, methods: ["POST"] })
  async toggle(context: ViewSetContext): Promise<Response> {
    const todo = await this.getObject(context);
    todo.completed.set(!todo.completed.get());
    await todo.save();
    return Response.json({ success: true });
  }
}
```

This creates: `POST /api/todos/:id/toggle/`
