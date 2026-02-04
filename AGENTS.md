# Alexi Framework Agent Guidelines

Alexi is a Django-inspired full-stack framework for Deno, written in TypeScript.
It brings Django's developer-friendly patterns to the Deno ecosystem.

---

## Architecture Overview

Alexi follows Django's modular architecture. Each module provides specific
functionality:

| Module                 | Django Equivalent            | Description                              |
| ---------------------- | ---------------------------- | ---------------------------------------- |
| `@alexi/core`          | `django.core.management`     | Management commands, Application handler |
| `@alexi/db`            | `django.db`                  | ORM with DenoKV and IndexedDB backends   |
| `@alexi/urls`          | `django.urls`                | URL routing with `path()`, `include()`   |
| `@alexi/middleware`    | `django.middleware.*`        | CORS, logging, error handling            |
| `@alexi/views`         | `django.views`               | Template views                           |
| `@alexi/web`           | `django.core.handlers.wsgi`  | Web server (HTTP API)                    |
| `@alexi/staticfiles`   | `django.contrib.staticfiles` | Static file handling, bundling           |
| `@alexi/restframework` | `djangorestframework`        | REST API: Serializers, ViewSets, Routers |
| `@alexi/auth`          | `django.contrib.auth`        | Authentication (JWT-based)               |
| `@alexi/admin`         | `django.contrib.admin`       | Auto-generated admin panel               |
| `@alexi/webui`         | -                            | Desktop app support via WebUI            |
| `@alexi/capacitor`     | -                            | Mobile app support (placeholder)         |
| `@alexi/types`         | -                            | Shared TypeScript type definitions       |

---

## Project Structure

```
alexi/
├── src/
│   ├── admin/           # Admin panel SPA and API
│   ├── auth/            # JWT authentication, decorators
│   ├── capacitor/       # Mobile app support (placeholder)
│   ├── core/            # Management commands, Application, config loader
│   │   ├── commands/    # Built-in commands (help, test, startproject, startapp)
│   │   ├── application.ts
│   │   ├── config.ts    # Settings loader
│   │   └── management.ts
│   ├── create/          # Project/app scaffolding
│   ├── db/              # ORM
│   │   ├── backends/    # Database backends
│   │   │   ├── backend.ts      # Abstract base class
│   │   │   ├── denokv/         # DenoKV backend (server)
│   │   │   └── indexeddb/      # IndexedDB backend (browser)
│   │   ├── fields/      # Field types (CharField, IntegerField, etc.)
│   │   ├── models/      # Model, Manager classes
│   │   ├── query/       # QuerySet, Q objects, aggregations
│   │   └── setup.ts     # Database initialization
│   ├── http/            # HTTP utilities (legacy, use @alexi/middleware)
│   ├── middleware/      # CORS, logging, error handling middleware
│   ├── restframework/   # REST API framework
│   │   ├── serializers/ # Serializer, ModelSerializer, fields
│   │   ├── viewsets/    # ViewSet, ModelViewSet
│   │   └── router.ts    # URL router for ViewSets
│   ├── staticfiles/     # Static file serving and bundling
│   ├── types/           # Shared TypeScript types
│   ├── urls/            # URL routing (path, include, resolve)
│   ├── views/           # Template views
│   ├── web/             # Web server commands
│   └── webui/           # Desktop app (WebUI wrapper)
├── deno.json            # Package configuration and imports
└── README.md
```

---

## Naming Conventions

**All TypeScript files must use lowercase and snake_case naming:**

- ✅ `model_viewset.ts`
- ✅ `base_command.ts`
- ✅ `user_serializer.ts`
- ❌ `ModelViewSet.ts`
- ❌ `BaseCommand.ts`

---

## Import Paths

Always use the `@alexi/` import aliases defined in `deno.json`:

```typescript
// Core
import { Application, BaseCommand, ManagementUtility } from "@alexi/core";
import type { CommandOptions, CommandResult } from "@alexi/core";

// Database ORM
import { AutoField, CharField, IntegerField, Manager, Model } from "@alexi/db";
import { getBackend, isInitialized, setup } from "@alexi/db";
import { Count, Q, QuerySet, Sum } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";

// URL Routing
import { include, path } from "@alexi/urls";
import type { URLPattern, View } from "@alexi/urls";

// Middleware
import {
  corsMiddleware,
  errorHandlerMiddleware,
  loggingMiddleware,
} from "@alexi/middleware";
import { HttpError, NotFoundError, UnauthorizedError } from "@alexi/middleware";
import type { Middleware, NextFunction } from "@alexi/middleware";

// REST Framework
import { ModelViewSet, Router, ViewSet } from "@alexi/restframework";
import {
  CharField,
  IntegerField,
  ModelSerializer,
  Serializer,
} from "@alexi/restframework";
import {
  PrimaryKeyRelatedField,
  SerializerMethodField,
} from "@alexi/restframework";

// Authentication
import { adminRequired, loginRequired, optionalLogin } from "@alexi/auth";
import { createTokenPair, verifyToken } from "@alexi/auth";

// Views
import { templateView } from "@alexi/views";

// Static Files
import { staticFilesMiddleware } from "@alexi/staticfiles";

// Admin
import { AdminSite, ModelAdmin } from "@alexi/admin";

// WebUI (Desktop)
import { WebUILauncher } from "@alexi/webui/launcher";
import { createDefaultBindings } from "@alexi/webui/bindings";
```

---

## ORM (Database)

### Defining Models

Models are defined similarly to Django:

```typescript
import {
  AutoField,
  CharField,
  DateTimeField,
  IntegerField,
  Manager,
  Model,
  TextField,
} from "@alexi/db";

export class TaskModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  description = new TextField({ blank: true });
  status = new CharField({ maxLength: 20, default: "open" });
  priority = new IntegerField({ default: 0 });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(TaskModel);
  static meta = {
    dbTable: "tasks",
    ordering: ["-createdAt"],
  };
}
```

### Field Types

| Field             | Description                           |
| ----------------- | ------------------------------------- |
| `AutoField`       | Auto-incrementing integer primary key |
| `CharField`       | String with max length                |
| `TextField`       | Unlimited text                        |
| `IntegerField`    | Integer                               |
| `FloatField`      | Float                                 |
| `DecimalField`    | Decimal with precision                |
| `BooleanField`    | Boolean                               |
| `DateField`       | Date only                             |
| `DateTimeField`   | Date and time                         |
| `JSONField`       | JSON object                           |
| `UUIDField`       | UUID string                           |
| `ForeignKey`      | Foreign key relation                  |
| `OneToOneField`   | One-to-one relation                   |
| `ManyToManyField` | Many-to-many relation                 |

### QuerySet API

```typescript
// Get all
const tasks = await TaskModel.objects.all().fetch();

// Filter
const openTasks = await TaskModel.objects.filter({ status: "open" }).fetch();

// Lookups
const recentTasks = await TaskModel.objects
  .filter({ createdAt__gte: new Date("2024-01-01") })
  .fetch();

// Chaining
const results = await TaskModel.objects
  .filter({ status: "open" })
  .exclude({ priority: 0 })
  .orderBy("-createdAt")
  .limit(10)
  .fetch();

// Get single object
const task = await TaskModel.objects.get({ id: 1 });

// First/Last
const firstTask = await TaskModel.objects.filter({ status: "open" }).first();

// Count
const count = await TaskModel.objects.filter({ status: "open" }).count();

// Create
const newTask = await TaskModel.objects.create({
  title: "New Task",
  status: "open",
});

// Update instance
task.title.set("Updated Title");
await task.save();

// Delete instance
await task.delete();

// Bulk operations
await TaskModel.objects.filter({ status: "closed" }).delete();
```

### Database Setup

```typescript
import { setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";

// Option 1: Auto-create backend
await setup({
  database: {
    engine: "denokv",
    name: "myapp",
    path: "./data/myapp.db",
  },
});

// Option 2: Provide backend instance
const backend = new DenoKVBackend({ name: "myapp", path: "./data/myapp.db" });
await backend.connect();
await setup({ backend });
```

---

## REST Framework

### Serializers

```typescript
import {
  CharField,
  IntegerField,
  ModelSerializer,
  Serializer,
  SerializerMethodField,
} from "@alexi/restframework";
import { TaskModel } from "./models.ts";

// Simple Serializer
export class TaskSerializer extends Serializer {
  id = new IntegerField({ readOnly: true });
  title = new CharField({ maxLength: 200 });
  status = new CharField({ maxLength: 20 });
  createdAt = new DateTimeField({ readOnly: true });
}

// ModelSerializer (auto-generates fields from model)
export class TaskModelSerializer extends ModelSerializer {
  static override Meta = {
    model: TaskModel,
    fields: ["id", "title", "description", "status", "priority", "createdAt"],
    readOnlyFields: ["id", "createdAt"],
  };
}

// With SerializerMethodField
export class TaskDetailSerializer extends Serializer {
  id = new IntegerField({ readOnly: true });
  title = new CharField();
  assigneeName = new SerializerMethodField();

  async getAssigneeName(task: unknown): Promise<string | null> {
    const record = task as Record<string, unknown>;
    const assigneeId = record.assigneeId;
    if (!assigneeId) return null;
    const user = await UserModel.objects.filter({ id: assigneeId }).first();
    return user ? `${user.firstName.get()} ${user.lastName.get()}` : null;
  }
}
```

### ViewSets

```typescript
import { ModelViewSet, ViewSet } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";
import { TaskModel } from "./models.ts";
import { TaskSerializer } from "./serializers.ts";

// Full CRUD ViewSet
export class TaskViewSet extends ModelViewSet {
  model = TaskModel;
  serializer_class = TaskSerializer;

  // Optional: customize queryset
  override getQueryset(context: ViewSetContext) {
    const qs = super.getQueryset(context);
    const url = new URL(context.request.url);
    const status = url.searchParams.get("status");
    if (status) {
      return qs.filter({ status });
    }
    return qs;
  }

  // Custom action
  @action({ detail: true, methods: ["POST"] })
  async complete(context: ViewSetContext): Promise<Response> {
    const task = await this.getObject(context);
    task.status.set("completed");
    await task.save();
    return Response.json({ status: "completed" });
  }
}

// Simple ViewSet (no model)
export class HealthViewSet extends ViewSet {
  async list(context: ViewSetContext): Promise<Response> {
    return Response.json({ status: "ok" });
  }
}
```

### Router

```typescript
import { Router } from "@alexi/restframework";
import { HealthViewSet, TaskViewSet } from "./viewsets.ts";

const router = new Router();
router.register("tasks", TaskViewSet);
router.register("health", HealthViewSet, { basename: "health" });

export const urlpatterns = router.urls;
```

---

## URL Routing

```typescript
import { include, path } from "@alexi/urls";
import { Router } from "@alexi/restframework";

// Simple view function
const healthView = async (request: Request, params: Record<string, string>) => {
  return Response.json({ status: "ok" });
};

// URL patterns
export const urlpatterns = [
  // Simple view
  path("health/", healthView, { name: "health" }),

  // Include router URLs
  path("api/", include(router.urls)),

  // With URL parameters
  path("users/:id/", userDetailView, { name: "user-detail" }),

  // Nested includes
  path(
    "api/v1/",
    include([
      path("tasks/", include(taskRouter.urls)),
      path("users/", include(userRouter.urls)),
    ]),
  ),
];
```

---

## Middleware

```typescript
import type { Middleware, NextFunction } from "@alexi/middleware";
import {
  corsMiddleware,
  errorHandlerMiddleware,
  loggingMiddleware,
} from "@alexi/middleware";

// Using built-in middleware
const middleware: Middleware[] = [
  corsMiddleware({ allowedOrigins: ["http://localhost:3000"] }),
  loggingMiddleware(),
  errorHandlerMiddleware(),
];

// Custom middleware
const authMiddleware: Middleware = async (
  request: Request,
  next: NextFunction,
): Promise<Response> => {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Verify token and continue
  return next(request);
};
```

---

## Authentication

### View-level Authentication (Django-style decorators)

```typescript
import { adminRequired, loginRequired, optionalLogin } from "@alexi/auth";
import { path } from "@alexi/urls";

// Protected routes
export const urlpatterns = [
  // Requires valid JWT
  path("api/profile/", loginRequired(profileView)),

  // Requires admin privileges
  path("api/admin/users/", adminRequired(adminUsersView)),

  // Optional auth (works with or without token)
  path("api/feed/", optionalLogin(feedView)),
];

// Accessing user in views
const profileView = loginRequired(async (request, params) => {
  const user = getRequestUser(request);
  return Response.json({ userId: user?.userId, email: user?.email });
});
```

### JWT Token Creation

```typescript
import { createTokenPair, verifyToken } from "@alexi/auth";

// Create tokens
const tokens = await createTokenPair(userId, email, isAdmin);
// Returns: { accessToken, refreshToken, expiresAt }

// Verify token
const payload = await verifyToken(accessToken);
// Returns: { userId, email, isAdmin, exp, iat }
```

---

## Management Commands

### Built-in Commands

| Command           | Description             |
| ----------------- | ----------------------- |
| `help`            | Show available commands |
| `test`            | Run tests               |
| `runserver`       | Start HTTP server       |
| `createsuperuser` | Create admin user       |
| `bundle`          | Bundle frontend apps    |
| `collectstatic`   | Collect static files    |
| `flush`           | Clear database          |
| `startproject`    | Create new project      |
| `startapp`        | Create new app          |

### Running Commands

```bash
# With deno task (recommended)
deno task dev

# Manual with required flags
deno run -A --unstable-kv manage.ts runserver --settings web
deno run -A --unstable-kv manage.ts createsuperuser
deno run -A --unstable-kv manage.ts test
```

### Creating Custom Commands

```typescript
import { BaseCommand, failure, success } from "@alexi/core";
import type { CommandOptions, CommandResult } from "@alexi/core";

export class MyCommand extends BaseCommand {
  readonly name = "mycommand";
  readonly help = "Description of my command";

  override defineOptions(parser: ArgumentParser): void {
    parser.add_argument("--name", { type: "str", help: "Name argument" });
    parser.add_argument("--count", { type: "int", default: 1 });
  }

  async handle(options: CommandOptions): Promise<CommandResult> {
    const name = options.name as string;
    const count = options.count as number;

    this.info(`Running with name=${name}, count=${count}`);

    try {
      // Do work...
      this.success("Command completed!");
      return success();
    } catch (error) {
      this.error(`Failed: ${error.message}`);
      return failure(error.message);
    }
  }
}
```

---

## Settings Configuration

Each app has its own settings file:

```typescript
// project/web.settings.ts

export const DEBUG = Deno.env.get("DEBUG") === "true";
export const SECRET_KEY = Deno.env.get("SECRET_KEY") ?? "dev-secret";

export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

export const INSTALLED_APPS = [
  "alexi_staticfiles",
  "alexi_web",
  "alexi_db",
  "alexi_auth",
  "alexi_admin",
  "myapp-web",
];

export const APP_PATHS: Record<string, string> = {
  "alexi_staticfiles": "./src/alexi_staticfiles",
  "alexi_web": "./src/alexi_web",
  "alexi_db": "./src/alexi_db",
  "alexi_auth": "./src/alexi_auth",
  "alexi_admin": "./src/alexi_admin",
  "myapp-web": "./src/myapp-web",
};

export const ROOT_URLCONF = "myapp-web";

export const DATABASE = {
  engine: "denokv" as const,
  name: "myapp",
  path: "./data/myapp.db",
};
```

---

## Testing

### Running Tests

```bash
# All tests
deno task test

# Specific file
deno test -A --unstable-kv src/db/models/model_test.ts

# With filter
deno test -A --unstable-kv --filter "QuerySet"
```

### Writing Tests

```typescript
import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { reset, setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { TaskModel } from "./models.ts";

Deno.test({
  name: "TaskModel: create and retrieve",
  async fn() {
    // Setup test database
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      // Create
      const task = await TaskModel.objects.create({
        title: "Test Task",
        status: "open",
      });

      assertExists(task.id.get());
      assertEquals(task.title.get(), "Test Task");

      // Retrieve
      const retrieved = await TaskModel.objects.get({ id: task.id.get() });
      assertEquals(retrieved.title.get(), "Test Task");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});
```

---

## Backend Implementations

### DenoKV Backend (Server)

Used for server-side applications with Deno's built-in KV store.

```typescript
import { DenoKVBackend } from "@alexi/db/backends/denokv";

const backend = new DenoKVBackend({
  name: "myapp",
  path: "./data/myapp.db", // Optional, uses default if not specified
});
await backend.connect();
```

### IndexedDB Backend (Browser)

Used for browser-based applications.

```typescript
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";

const backend = new IndexedDBBackend({
  name: "myapp",
});
await backend.connect();
```

### Backend API

All backends implement the `DatabaseBackend` abstract class:

```typescript
abstract class DatabaseBackend {
  // Connection
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  // CRUD
  abstract insert<T extends Model>(
    instance: T,
  ): Promise<Record<string, unknown>>;
  abstract update<T extends Model>(instance: T): Promise<void>;
  abstract delete<T extends Model>(instance: T): Promise<void>;
  abstract deleteById(tableName: string, id: unknown): Promise<void>;
  abstract getById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<Record<string, unknown> | null>;
  abstract existsById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<boolean>;

  // Query
  abstract execute<T extends Model>(
    state: QueryState<T>,
  ): Promise<Record<string, unknown>[]>;
  abstract count<T extends Model>(state: QueryState<T>): Promise<number>;

  // Bulk operations
  abstract bulkInsert<T extends Model>(
    instances: T[],
  ): Promise<Record<string, unknown>[]>;
  abstract bulkUpdate<T extends Model>(
    instances: T[],
    fields: string[],
  ): Promise<number>;
  abstract deleteMany<T extends Model>(state: QueryState<T>): Promise<number>;

  // Transactions
  abstract beginTransaction(): Promise<Transaction>;
  async atomic<R>(fn: () => Promise<R>): Promise<R>;
}
```

---

## Required Deno Flags

```bash
# Required for DenoKV
--unstable-kv

# Required for desktop apps (WebUI)
--unstable-ffi

# Common development command
deno run -A --unstable-kv --unstable-ffi manage.ts runserver
```

---

## Important Notes

1. **File naming**: Always use lowercase snake_case for TypeScript files

2. **Model field access**: Use `.get()` and `.set()` methods:
   ```typescript
   const title = task.title.get();
   task.title.set("New Title");
   ```

3. **Async serializers**: Use `await serializer.toRepresentation(instance)` for
   async fields like `SerializerMethodField`

4. **QuerySet is lazy**: Call `.fetch()`, `.first()`, or iterate to execute:
   ```typescript
   const qs = TaskModel.objects.filter({ status: "open" }); // Not executed yet
   const tasks = await qs.fetch(); // Executes query
   ```

5. **Backend must be connected**: Always call `await backend.connect()` before
   use

6. **Setup before ORM operations**: Call `setup()` before any model operations:
   ```typescript
   await setup({ backend });
   // Now models work
   const tasks = await TaskModel.objects.all().fetch();
   ```

7. **IndexedDB requires DOM types**: The IndexedDB backend needs browser
   environment types. When running `deno check` on server code, you may see type
   errors for IndexedDB - these can be ignored if you're only using DenoKV.

---

## Contributing

1. Follow the existing code style (snake_case files, 2-space indent)
2. Add tests for new functionality
3. Run `deno task check` before committing
4. Run `deno task fmt` to format code
5. Run `deno task lint` to check for issues
