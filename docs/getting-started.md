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

This creates a full-stack application with a REST API backend, server-side
rendered templates, a Service Worker for offline support, and a bundled frontend
asset.

### Start Development

```bash
cd my-project
deno task dev
```

Open `http://localhost:8000` in your browser.

## Project Structure

```
my-project/
├── manage.ts                    # Management CLI entry point
├── deno.jsonc                   # Workspace configuration & import map
├── project/
│   ├── http.ts                  # Production entry point (deno serve)
│   ├── settings.ts              # Development settings
│   └── production.ts            # Production settings (Deno Deploy)
└── src/
    └── my-project/              # Unified app
        ├── mod.ts               # Exports + MyProjectConfig
        ├── models.ts            # Database models
        ├── serializers.ts       # REST serializers
        ├── viewsets.ts          # REST viewsets
        ├── urls.ts              # Server URL routing
        ├── views.ts             # Server-side views
        ├── migrations/          # Database migrations
        ├── tests/               # Tests
        ├── templates/           # HTML templates
        ├── assets/              # Frontend TypeScript source
        └── workers/             # Service Worker source
```

## Core Concepts

Alexi follows Django's MVT (Model-View-Template) pattern adapted for TypeScript.

### App Configuration

Every Alexi app exports a named `AppConfig` from its `mod.ts`. Register it
directly in `INSTALLED_APPS` — no factory functions needed:

```typescript
// project/settings.ts
import { DbConfig } from "@alexi/db";
import { AuthConfig } from "@alexi/auth";
import { MyProjectConfig } from "@my-project/mod.ts";

export const INSTALLED_APPS = [
  DbConfig,
  AuthConfig,
  MyProjectConfig,
];
```

### Models

Models define your data structure and provide an ORM for database operations:

```typescript
import { AutoField, BooleanField, CharField, Manager, Model } from "@alexi/db";

export class PostModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  published = new BooleanField({ default: false });

  static objects = new Manager(PostModel);

  static meta = {
    dbTable: "posts",
  };
}
```

### Serializers

Serializers handle conversion between model instances and JSON:

```typescript
import { ModelSerializer } from "@alexi/restframework";
import { PostModel } from "./models.ts";

export class PostSerializer extends ModelSerializer {
  static override Meta = {
    model: PostModel,
    fields: ["id", "title", "published"],
    readOnlyFields: ["id"],
  };
}
```

### ViewSets

ViewSets provide CRUD operations for your API:

```typescript
import { ModelViewSet } from "@alexi/restframework";
import { PostModel } from "./models.ts";
import { PostSerializer } from "./serializers.ts";

export class PostViewSet extends ModelViewSet {
  model = PostModel;
  serializer_class = PostSerializer;
}
```

### Routers

Routers automatically generate URL patterns for ViewSets:

```typescript
import { DefaultRouter } from "@alexi/restframework";
import { PostViewSet } from "./viewsets.ts";

const router = new DefaultRouter();
router.register("posts", PostViewSet);

export const urlpatterns = router.urls;
```

## Database Backends

Alexi supports multiple database backends:

| Backend   | Use Case                          |
| --------- | --------------------------------- |
| DenoKV    | Server-side persistence (default) |
| SQLite    | Server-side relational storage    |
| IndexedDB | Browser-side caching              |
| REST      | Browser → REST API proxy          |

### Configuration

```typescript
// project/settings.ts
import { DenoKVBackend } from "@alexi/db/backends/denokv";

export const DATABASES = {
  default: new DenoKVBackend({ name: "myapp", path: "./data/myapp.db" }),
};
```

## Management Commands

Alexi provides Django-style management commands via `manage.ts`:

```bash
# Run development server
deno task dev

# Run with custom settings
deno run -A --unstable-kv manage.ts runserver --settings ./project/settings.ts

# Create superuser (requires @alexi/auth)
deno run -A --unstable-kv manage.ts createsuperuser --settings ./project/settings.ts

# Run migrations
deno run -A --unstable-kv manage.ts migrate --settings ./project/settings.ts
```

## Next Steps

- [Models and ORM](./db/models.md) — Learn about model fields, queries, and
  relationships
- [REST Framework](./restframework/viewsets.md) — Build powerful APIs
- [Filtering](./restframework/filtering.md) — Add query parameter filtering
- [Scaffolding](./create/scaffolding.md) — Create new projects and apps

## Common Tasks

### Add a New Model

1. Define the model in `models.ts`:

```typescript
export class CategoryModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  static objects = new Manager(CategoryModel);
  static meta = { dbTable: "categories" };
}
```

2. Create a serializer in `serializers.ts`:

```typescript
export class CategorySerializer extends ModelSerializer {
  static override Meta = {
    model: CategoryModel,
    fields: ["id", "name"],
  };
}
```

3. Create a ViewSet in `viewsets.ts`:

```typescript
export class CategoryViewSet extends ModelViewSet {
  model = CategoryModel;
  serializer_class = CategorySerializer;
}
```

4. Register in `urls.ts`:

```typescript
router.register("categories", CategoryViewSet);
```

### Add Filtering to an Endpoint

```typescript
import {
  ModelViewSet,
  OrderingFilter,
  QueryParamFilterBackend,
} from "@alexi/restframework";

export class PostViewSet extends ModelViewSet {
  model = PostModel;
  serializer_class = PostSerializer;

  filterBackends = [new QueryParamFilterBackend(), new OrderingFilter()];
  filtersetFields = ["published"];
  orderingFields = ["title", "createdAt"];
}
```

Now you can filter:

```
GET /api/posts/?published=true
GET /api/posts/?ordering=-createdAt
```

### Add a Custom Action

```typescript
import { action, ModelViewSet } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";

export class PostViewSet extends ModelViewSet {
  // ... standard config ...

  @action({ detail: true, methods: ["POST"] })
  async publish(context: ViewSetContext): Promise<Response> {
    const post = await this.getObject(context);
    post.published.set(true);
    await post.save({ updateFields: ["published"] });
    return Response.json({ status: "published" });
  }
}
```

This creates: `POST /api/posts/:id/publish/`
