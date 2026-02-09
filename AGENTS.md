# Alexi Framework Agent Guidelines

Alexi is a Django-inspired full-stack framework for Deno, written in TypeScript.
It brings Django's developer-friendly patterns to the Deno ecosystem.

---

## Architecture Overview

Alexi follows Django's modular architecture. Each module provides specific
functionality:

| Module                 | Django Equivalent            | Description                                         |
| ---------------------- | ---------------------------- | --------------------------------------------------- |
| `@alexi/core`          | `django.core.management`     | Management commands, Application handler            |
| `@alexi/db`            | `django.db`                  | ORM with DenoKV, IndexedDB, REST, and Sync backends |
| `@alexi/urls`          | `django.urls`                | URL routing with `path()`, `include()`              |
| `@alexi/middleware`    | `django.middleware.*`        | CORS, logging, error handling                       |
| `@alexi/views`         | `django.views`               | Template views                                      |
| `@alexi/web`           | `django.core.handlers.wsgi`  | Web server (HTTP API)                               |
| `@alexi/staticfiles`   | `django.contrib.staticfiles` | Static file handling, bundling                      |
| `@alexi/restframework` | `djangorestframework`        | REST API: Serializers, ViewSets, Routers            |
| `@alexi/auth`          | `django.contrib.auth`        | Authentication (JWT-based)                          |
| `@alexi/admin`         | `django.contrib.admin`       | Auto-generated admin panel                          |
| `@alexi/webui`         | -                            | Desktop app support via WebUI                       |
| `@alexi/capacitor`     | -                            | Mobile app support (placeholder)                    |
| `@alexi/types`         | -                            | Shared TypeScript type definitions                  |

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
│   │   │   ├── indexeddb/      # IndexedDB backend (browser)
│   │   │   ├── rest/           # REST API backend (browser, extensible)
│   │   │   └── sync/           # Sync backend (local + remote orchestration)
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
import { getBackend, isInitialized, setBackend, setup } from "@alexi/db";
import { Count, Q, QuerySet, Sum } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
import {
  clearAuthTokens,
  DetailAction,
  ListAction,
  ModelEndpoint,
  RestApiError,
  RestBackend,
  SingletonQuery,
} from "@alexi/db/backends/rest";
import type {
  RestBackendConfig,
  SpecialQueryHandler,
} from "@alexi/db/backends/rest";
import { SyncBackend } from "@alexi/db/backends/sync";

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

### REST Backend (Browser)

The REST backend maps ORM operations to HTTP requests against a REST API. It
includes built-in JWT authentication, token refresh, and is fully extensible via
subclassing.

```typescript
import { RestBackend } from "@alexi/db/backends/rest";

// Basic usage — works out of the box
const backend = new RestBackend({
  apiUrl: "https://api.example.com/api",
});
await backend.connect();

// Use with ORM
const tasks = await TaskModel.objects.using(backend).all().fetch();
const task = await TaskModel.objects.using(backend).create({ title: "New" });

// Authentication
const { user } = await backend.login({
  email: "user@example.com",
  password: "secret",
});
const me = await backend.getMe();
await backend.logout();

// Model actions (e.g., POST /projects/42/publish/)
await backend.callModelAction("projects", 42, "publish");
```

#### Subclassing RestBackend

Subclass `RestBackend` to add app-specific behavior. Key extension points:

- `getEndpointForModel()` — custom model → URL mapping
- `getSpecialQueryHandlers()` — map ORM filters to custom endpoints
- `extractData()` — customize how model data is serialized for the API
- `formatDateForApi()` — change date serialization format
- `request()` (protected) — make authenticated HTTP requests from subclass
  methods

```typescript
import { RestBackend } from "@alexi/db/backends/rest";
import type { SpecialQueryHandler } from "@alexi/db/backends/rest";

class MyAppRestBackend extends RestBackend {
  constructor(apiUrl: string) {
    super({
      apiUrl,
      tokenStorageKey: "myapp_auth_tokens",
      authEndpoints: {
        login: "/auth/login/",
        register: "/auth/register/",
      },
      endpointMap: {
        TicketMessageModel: "ticket-messages",
      },
    });
  }

  // Map specific ORM filters to custom API endpoints
  protected override getSpecialQueryHandlers(): Record<
    string,
    SpecialQueryHandler[]
  > {
    return {
      organisations: [{
        matches: (filters) =>
          filters.length === 1 &&
          filters[0].field === "current" &&
          filters[0].value === true,
        getEndpoint: () => "/organisations/current/",
        returnsSingle: true,
      }],
    };
  }

  // App-specific methods using the protected request() helper
  async publishProject(id: number) {
    return this.request(`/projects/${id}/publish/`, { method: "POST" });
  }
}

// Now in your components:
// OrganisationModel.objects.using(backend).filter({ current: true }).first()
// → GET /organisations/current/
```

#### RestBackend Configuration Reference

| Option                         | Default                    | Description                            |
| ------------------------------ | -------------------------- | -------------------------------------- |
| `apiUrl`                       | (required)                 | API base URL                           |
| `debug`                        | `false`                    | Enable console logging                 |
| `tokenStorageKey`              | `"alexi_auth_tokens"`      | localStorage key for JWT tokens        |
| `authEndpoints.login`          | `"/auth/login/"`           | Login endpoint                         |
| `authEndpoints.register`       | `"/auth/register/"`        | Registration endpoint                  |
| `authEndpoints.refresh`        | `"/auth/refresh/"`         | Token refresh endpoint                 |
| `authEndpoints.logout`         | `"/auth/logout/"`          | Logout endpoint                        |
| `authEndpoints.me`             | `"/auth/me/"`              | Current user profile endpoint          |
| `authEndpoints.changePassword` | `"/auth/change-password/"` | Password change endpoint               |
| `endpointMap`                  | `{}`                       | Fallback model name → endpoint mapping |

#### Endpoint Resolution Order

1. `Model.meta.dbTable` (recommended — set this on your models)
2. `config.endpointMap[ModelConstructorName]`
3. Auto-derived: strip `"Model"` suffix, lowercase (e.g., `TaskModel` → `tasks`)

#### Declarative Endpoints (DRF-style)

Instead of imperative `endpointMap` and `getSpecialQueryHandlers()` overrides,
you can declare endpoint configuration using field-like descriptors — mirroring
Django REST Framework's ViewSet and `@action` patterns.

```typescript
import {
  DetailAction,
  ListAction,
  ModelEndpoint,
  RestBackend,
  SingletonQuery,
} from "@alexi/db/backends/rest";
```

##### Descriptor Types

| Descriptor       | DRF Equivalent          | Generates                                        |
| ---------------- | ----------------------- | ------------------------------------------------ |
| `DetailAction`   | `@action(detail=True)`  | `POST /endpoint/:id/action_name/`                |
| `ListAction`     | `@action(detail=False)` | `GET\|POST /endpoint/action_name/`               |
| `SingletonQuery` | Custom queryset / mixin | `filter({field: true})` → `GET /endpoint/field/` |

##### Defining Endpoints

```typescript
class ProjectEndpoint extends ModelEndpoint {
  model = ProjectModel;
  // endpoint auto-derived from ProjectModel.meta.dbTable = "projects"

  // POST /projects/:id/publish/
  publish = new DetailAction();
  unpublish = new DetailAction();

  // DELETE /projects/:id/archive/
  archive = new DetailAction({ method: "DELETE" });

  // GET /projects/published/ → returns array
  published = new ListAction({ method: "GET" });

  // GET /projects/statistics/ → returns single object
  statistics = new ListAction({ method: "GET", single: true });
}

class OrganisationEndpoint extends ModelEndpoint {
  model = OrganisationModel;

  // filter({current: true}) → GET /organisations/current/
  current = new SingletonQuery();

  // POST /organisations/:id/activate/
  activate = new DetailAction();
  deactivate = new DetailAction();
}

class ConnectionEndpoint extends ModelEndpoint {
  model = ConnectionModel;

  accept = new DetailAction();
  decline = new DetailAction();
  // camelCase → kebab-case: POST /connections/:id/share-project/
  shareProject = new DetailAction();
  shareEmployees = new DetailAction();
}
```

##### Registering Endpoints

Pass endpoint classes to RestBackend via the `endpoints` config option:

```typescript
const backend = new RestBackend({
  apiUrl: "https://api.example.com/api",
  tokenStorageKey: "myapp_auth_tokens",
  endpoints: [
    ProjectEndpoint,
    OrganisationEndpoint,
    ConnectionEndpoint,
  ],
  // endpointMap still works as fallback for models without ModelEndpoint
  endpointMap: {
    TicketMessageModel: "ticket-messages",
  },
});
```

##### Using Endpoints

```typescript
// ORM with auto-generated singleton query handler (unchanged)
const org = await OrganisationModel.objects
  .using(backend)
  .filter({ current: true })
  .first();
// → GET /organisations/current/

// Type-safe action calls (new)
await backend.action(ProjectEndpoint, "publish", 42);
// → POST /projects/42/publish/

await backend.action(ConnectionEndpoint, "accept", 5, { note: "OK" });
// → POST /connections/5/accept/

// List actions
const published = await backend.action(ProjectEndpoint, "published");
// → GET /projects/published/

// Old callModelAction still works (backwards compatible)
await backend.callModelAction("projects", 42, "publish");
```

##### Naming Conventions

camelCase property names are automatically converted to kebab-case URL segments:

| Property Name    | URL Segment       | Full URL                                 |
| ---------------- | ----------------- | ---------------------------------------- |
| `publish`        | `publish`         | `POST /projects/:id/publish/`            |
| `shareProject`   | `share-project`   | `POST /connections/:id/share-project/`   |
| `shareEmployees` | `share-employees` | `POST /connections/:id/share-employees/` |

##### Descriptor Options

```typescript
// DetailAction options
new DetailAction(); // POST (default)
new DetailAction({ method: "DELETE" }); // DELETE
new DetailAction({ method: "PUT" }); // PUT
new DetailAction({ urlSegment: "do-something" }); // custom URL segment

// ListAction options
new ListAction(); // POST (default)
new ListAction({ method: "GET" }); // GET
new ListAction({ method: "GET", single: true }); // GET, returns single object
new ListAction({ urlSegment: "my-list" }); // custom URL segment

// SingletonQuery options
new SingletonQuery(); // filter({field: true})
new SingletonQuery({ urlSegment: "me" }); // custom URL: /endpoint/me/
new SingletonQuery({ matchValue: "active" }); // filter({field: "active"})
```

##### Updated Configuration Reference

| Option                         | Default                    | Description                            |
| ------------------------------ | -------------------------- | -------------------------------------- |
| `apiUrl`                       | (required)                 | API base URL                           |
| `debug`                        | `false`                    | Enable console logging                 |
| `tokenStorageKey`              | `"alexi_auth_tokens"`      | localStorage key for JWT tokens        |
| `endpoints`                    | `[]`                       | Declarative ModelEndpoint classes      |
| `endpointMap`                  | `{}`                       | Fallback model name → endpoint mapping |
| `authEndpoints.login`          | `"/auth/login/"`           | Login endpoint                         |
| `authEndpoints.register`       | `"/auth/register/"`        | Registration endpoint                  |
| `authEndpoints.refresh`        | `"/auth/refresh/"`         | Token refresh endpoint                 |
| `authEndpoints.logout`         | `"/auth/logout/"`          | Logout endpoint                        |
| `authEndpoints.me`             | `"/auth/me/"`              | Current user profile endpoint          |
| `authEndpoints.changePassword` | `"/auth/change-password/"` | Password change endpoint               |

### Sync Backend (Browser)

The Sync backend orchestrates a local backend (typically IndexedDB) and a remote
backend (typically RestBackend) for offline-first operation:

- **Reads**: Try remote first, fall back to local
- **Writes**: Write to local first, then sync to remote
- **Reconciliation**: Server-generated IDs and timestamps are synced back to
  local

```typescript
import { getBackend, setBackend, setup } from "@alexi/db";
import { RestBackend } from "@alexi/db/backends/rest";
import { SyncBackend } from "@alexi/db/backends/sync";

// 1. Setup local backend (IndexedDB)
await setup({
  database: { engine: "indexeddb", name: "myapp" },
});
const localBackend = getBackend();

// 2. Create REST backend
const restBackend = new RestBackend({
  apiUrl: "https://api.example.com/api",
  tokenStorageKey: "myapp_auth_tokens",
});
await restBackend.connect();

// 3. Create Sync backend and replace global
const syncBackend = new SyncBackend(localBackend, restBackend, {
  debug: false,
  failSilently: true, // Swallow network errors (offline-friendly)
});
await syncBackend.connect();
setBackend(syncBackend);

// Now all ORM operations sync automatically
const task = await TaskModel.objects.create({ title: "Works offline too" });

// Auth operations go through RestBackend
await restBackend.login({ email: "user@example.com", password: "secret" });
```

#### SyncBackend Error Handling

| Error Type                     | `failSilently: true` (default)         | `failSilently: false`                 |
| ------------------------------ | -------------------------------------- | ------------------------------------- |
| Auth errors (401/403)          | **Always thrown** — user must re-login | **Always thrown**                     |
| Network/server errors on write | Local write succeeds, remote deferred  | Local write rolled back, error thrown |
| Network/server errors on read  | Falls back to local backend            | Error thrown                          |

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

Each app has its own settings file. Alexi uses Django-style `INSTALLED_APPS`
with import specifiers:

```typescript
// project/web.settings.ts

export const DEBUG = Deno.env.get("DEBUG") === "true";
export const SECRET_KEY = Deno.env.get("SECRET_KEY") ?? "dev-secret";

export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

// Django-style INSTALLED_APPS with import specifiers
// - Use "@alexi/..." for Alexi packages from JSR
// - Use "./src/myapp" for local apps (relative paths)
export const INSTALLED_APPS = [
  "@alexi/staticfiles", // JSR package
  "@alexi/web", // JSR package
  "@alexi/db", // JSR package
  "@alexi/auth", // JSR package
  "@alexi/admin", // JSR package
  "./src/myapp-web", // Local app (relative path)
];

// ROOT_URLCONF can be an import specifier or local app path
export const ROOT_URLCONF = "./src/myapp-web";

export const DATABASE = {
  engine: "denokv" as const,
  name: "myapp",
  path: "./data/myapp.db",
};
```

### INSTALLED_APPS Format

Apps can be specified in two ways:

| Format           | Example         | Description      |
| ---------------- | --------------- | ---------------- |
| Import specifier | `"@alexi/web"`  | JSR/npm packages |
| Relative path    | `"./src/myapp"` | Local apps       |

The framework automatically detects the format:

- Starts with `@`, `jsr:`, `npm:` → Import specifier
- Starts with `./` or `../` → Relative path

### Legacy APP_PATHS (Deprecated)

The `APP_PATHS` configuration is deprecated. If you're upgrading from an older
version, migrate to import specifiers:

```typescript
// ❌ Old approach (deprecated)
export const INSTALLED_APPS = ["alexi_web", "myapp"];
export const APP_PATHS = {
  "alexi_web": "../alexi/src/web",
  "myapp": "./src/myapp",
};

// ✅ New approach (recommended)
export const INSTALLED_APPS = [
  "@alexi/web", // JSR package
  "./src/myapp", // Local app
];
// No APP_PATHS needed!
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

### Available Backends

| Backend            | Import                         | Environment   | Use Case                                       |
| ------------------ | ------------------------------ | ------------- | ---------------------------------------------- |
| `DenoKVBackend`    | `@alexi/db/backends/denokv`    | Server (Deno) | Server-side apps with Deno's built-in KV store |
| `IndexedDBBackend` | `@alexi/db/backends/indexeddb` | Browser       | Browser-only local storage                     |
| `RestBackend`      | `@alexi/db/backends/rest`      | Browser       | Maps ORM operations to REST API calls          |
| `SyncBackend`      | `@alexi/db/backends/sync`      | Browser       | Orchestrates local + remote for offline-first  |

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

8. **RestBackend uses `meta.dbTable` for endpoints**: Set
   `static meta = {
   dbTable: "tasks" }` on your models so RestBackend knows
   which API endpoint to call. If not set, it falls back to `config.endpointMap`
   or auto-derives from the class name.

9. **SyncBackend propagates auth errors**: Even in `failSilently` mode, 401/403
   errors are always thrown so the UI can redirect to login.

10. **RestBackend `request()` is protected**: Subclasses can use
    `this.request<T>(path, options)` to make authenticated HTTP calls for
    app-specific endpoints without reimplementing token management.

---

## Contributing

1. Follow the existing code style (snake_case files, 2-space indent)
2. Add tests for new functionality
3. Run `deno task check` before committing
4. Run `deno task fmt` to format code
5. Run `deno task lint` to check for issues
