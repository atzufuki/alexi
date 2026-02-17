# Database Backends

Alexi ORM supports multiple database backends, allowing you to use the same
model and query API across different storage engines.

## Overview

| Backend             | Use Case                 | Environment  |
| ------------------- | ------------------------ | ------------ |
| **SQLite** (DenoKV) | Server-side persistence  | Deno server  |
| **IndexedDB**       | Browser-side caching     | Browser      |
| **REST**            | Remote API communication | Browser/Deno |
| **Sync**            | Offline-first with sync  | Browser      |

## Setup

### Single Backend

```typescript
import { setup } from "@alexi/db";

await setup({
  database: {
    engine: "indexeddb",
    name: "myapp",
  },
});
```

### Multiple Backends (Recommended)

Configure multiple backends for different use cases:

```typescript
import { setup } from "@alexi/db";
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
import { RestBackend } from "@alexi/db/backends/rest";
import { DenoKVBackend } from "@alexi/db/backends/denokv";

// Create backend instances
const indexeddb = new IndexedDBBackend({ name: "myapp-cache" });
const rest = new RestBackend({ apiUrl: "http://localhost:8000/api" });

await setup({
  databases: {
    default: rest, // Default backend
    cache: indexeddb, // Local cache
    api: rest, // REST API
  },
});
```

### Server-Side Setup

```typescript
import { setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";

const sqlite = new DenoKVBackend({
  name: "myapp",
  path: "./data/myapp.db",
});

await setup({
  databases: {
    default: sqlite,
  },
});
```

### Client-Side Setup

```typescript
import { setup } from "@alexi/db";
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
import { RestBackend } from "@alexi/db/backends/rest";

const indexeddb = new IndexedDBBackend({ name: "myapp-cache" });
const rest = new RestBackend({ apiUrl: "https://api.myapp.com" });

await setup({
  databases: {
    default: indexeddb, // Fast local access
    indexeddb: indexeddb, // Explicit cache access
    api: rest, // Remote API
  },
});
```

## Using Backends

### Default Backend

Without `.using()`, queries use the default backend:

```typescript
// Uses 'default' backend
const todos = await TodoModel.objects.all().fetch();
```

### Specific Backend

Use `.using()` to target a specific backend:

```typescript
// Use local cache
const cached = await TodoModel.objects
  .using("cache")
  .all()
  .fetch();

// Use REST API
const remote = await TodoModel.objects
  .using("api")
  .filter({ completed: false })
  .fetch();

// Use by backend instance
const backend = getBackendByName("api");
const todos = await TodoModel.objects
  .using(backend)
  .all()
  .fetch();
```

### Chaining with Different Backends

```typescript
// Fetch from API, save to cache
const fresh = await TodoModel.objects
  .using("api")
  .all()
  .fetch();

// Save to local cache
await fresh.using("cache").save();
```

## IndexedDB Backend

Browser-based storage using IndexedDB.

### Configuration

```typescript
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";

const backend = new IndexedDBBackend({
  name: "myapp", // Database name
  version: 1, // Schema version (optional)
});

await backend.connect();
```

### Features

- Persistent browser storage
- Works offline
- Fast local queries
- Automatic schema management

### Use Cases

- Caching remote data
- Offline-first applications
- Local user data
- Draft storage

### Example

```typescript
// Cache articles for offline access
async function cacheArticles() {
  // Fetch from API
  const articles = await ArticleModel.objects
    .using("api")
    .all()
    .fetch();

  // Save to IndexedDB
  await articles.using("indexeddb").save();
}

// Load from cache (fast, works offline)
async function loadCachedArticles() {
  return await ArticleModel.objects
    .using("indexeddb")
    .all()
    .fetch();
}
```

## REST Backend

Communicates with a REST API server.

### Configuration

```typescript
import { RestBackend } from "@alexi/db/backends/rest";

const backend = new RestBackend({
  apiUrl: "http://localhost:8000/api",
  debug: true, // Log requests (optional)
});

await backend.connect();
```

### Configuration Options

| Option            | Type      | Description                      |
| ----------------- | --------- | -------------------------------- |
| `apiUrl`          | `string`  | Base URL for API requests        |
| `debug`           | `boolean` | Enable request logging           |
| `tokenStorageKey` | `string`  | LocalStorage key for auth tokens |
| `authEndpoints`   | `object`  | Custom auth endpoint paths       |

### Authentication

```typescript
const backend = new RestBackend({
  apiUrl: "http://localhost:8000/api",
  tokenStorageKey: "myapp_auth_tokens",
  authEndpoints: {
    login: "/auth/login/",
    logout: "/auth/logout/",
    refresh: "/auth/refresh/",
    me: "/auth/me/",
  },
});

// Login
await backend.login({ username: "user", password: "pass" });

// Check authentication
if (backend.isAuthenticated()) {
  const user = await backend.getMe();
}

// Logout
await backend.logout();
```

### Request Mapping

| ORM Operation             | HTTP Method | Endpoint       |
| ------------------------- | ----------- | -------------- |
| `all().fetch()`           | GET         | `/todos/`      |
| `filter({id: 1}).fetch()` | GET         | `/todos/?id=1` |
| `get({id: 1})`            | GET         | `/todos/1/`    |
| `create({...})`           | POST        | `/todos/`      |
| `save()` (existing)       | PUT         | `/todos/1/`    |
| `delete()`                | DELETE      | `/todos/1/`    |

### ModelEndpoint (Declarative Endpoints)

ModelEndpoint provides a declarative, DRF-style way to configure REST endpoints
with custom actions and special queries.

#### Basic Setup

```typescript
import {
  DetailAction,
  ListAction,
  ModelEndpoint,
  RestBackend,
  SingletonQuery,
} from "@alexi/db/backends/rest";
import { OrganisationModel, ProjectModel } from "./models.ts";

// Define endpoint for ProjectModel
class ProjectEndpoint extends ModelEndpoint {
  model = ProjectModel;
  path = "/projects/"; // Required - explicit full path

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

// Define endpoint for OrganisationModel
class OrganisationEndpoint extends ModelEndpoint {
  model = OrganisationModel;
  path = "/organisations/";

  // filter({current: true}) → GET /organisations/current/
  current = new SingletonQuery();

  // POST /organisations/:id/activate/
  activate = new DetailAction();
  deactivate = new DetailAction();
}

// Register endpoints with RestBackend
const backend = new RestBackend({
  apiUrl: "https://api.example.com/api",
  endpoints: [ProjectEndpoint, OrganisationEndpoint],
});
```

#### Descriptor Types

| Descriptor       | DRF Equivalent          | Generates                                        |
| ---------------- | ----------------------- | ------------------------------------------------ |
| `DetailAction`   | `@action(detail=True)`  | `POST /endpoint/:id/action_name/`                |
| `ListAction`     | `@action(detail=False)` | `GET\|POST /endpoint/action_name/`               |
| `SingletonQuery` | Custom queryset / mixin | `filter({field: true})` → `GET /endpoint/field/` |

#### Descriptor Options

```typescript
// DetailAction options
new DetailAction(); // POST (default)
new DetailAction({ method: "DELETE" }); // DELETE
new DetailAction({ method: "PUT" }); // PUT
new DetailAction({ urlSegment: "do-something" }); // Custom URL segment

// ListAction options
new ListAction(); // POST (default)
new ListAction({ method: "GET" }); // GET
new ListAction({ method: "GET", single: true }); // GET, returns single object

// SingletonQuery options
new SingletonQuery(); // filter({field: true})
new SingletonQuery({ urlSegment: "me" }); // Custom URL: /path/me/
new SingletonQuery({ matchValue: "active" }); // filter({field: "active"})
```

#### Naming Conventions

camelCase property names are automatically converted to kebab-case URL segments:

| Property Name    | URL Segment       | Full URL                                 |
| ---------------- | ----------------- | ---------------------------------------- |
| `publish`        | `publish`         | `POST /projects/:id/publish/`            |
| `shareProject`   | `share-project`   | `POST /connections/:id/share-project/`   |
| `shareEmployees` | `share-employees` | `POST /connections/:id/share-employees/` |

#### Using Endpoints

```typescript
// ORM with SingletonQuery (automatic)
const org = await OrganisationModel.objects
  .using(backend)
  .filter({ current: true })
  .first();
// → GET /organisations/current/

// Type-safe action calls
await backend.action(ProjectEndpoint, "publish", 42);
// → POST /projects/42/publish/

await backend.action(ProjectEndpoint, "publish", 42, { notify: true });
// → POST /projects/42/publish/ with body

// List actions
const published = await backend.action(ProjectEndpoint, "published");
// → GET /projects/published/

// Old callModelAction still works (backwards compatible)
await backend.callModelAction("projects", 42, "publish");
```

### Custom Actions (Legacy)

```typescript
// Call custom ViewSet action
const result = await backend.action(
  TodoModel,
  "toggle",
  { id: 1 },
  "POST",
);
```

## DenoKV Backend (SQLite)

Server-side storage using Deno KV (backed by SQLite).

### Configuration

```typescript
import { DenoKVBackend } from "@alexi/db/backends/denokv";

const backend = new DenoKVBackend({
  name: "myapp",
  path: "./data/myapp.db", // Optional: file path
});

await backend.connect();
```

### Features

- Persistent server-side storage
- ACID transactions
- Fast key-value access
- Automatic schema management

### Requirements

Run with `--unstable-kv` flag:

```bash
deno run --unstable-kv --allow-read --allow-write app.ts
```

## Sync Backend

Combines local and remote backends for offline-first applications.

### Configuration

```typescript
import { SyncBackend } from "@alexi/db/backends/sync";
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
import { RestBackend } from "@alexi/db/backends/rest";

const local = new IndexedDBBackend({ name: "myapp-cache" });
const remote = new RestBackend({ apiUrl: "http://localhost:8000/api" });

const sync = new SyncBackend(local, remote, {
  syncOnConnect: true, // Sync when coming online
  conflictResolution: "remote-wins", // Conflict strategy
});

await sync.connect();
```

### Sync Strategies

| Strategy      | Description                  |
| ------------- | ---------------------------- |
| `remote-wins` | Remote data overwrites local |
| `local-wins`  | Local data overwrites remote |
| `newest-wins` | Most recently modified wins  |

### Manual Sync

```typescript
// Sync all data
await sync.syncAll();

// Sync specific model
await sync.syncModel(TodoModel);

// Check sync status
const status = sync.getSyncStatus();
console.log(status.pendingChanges);
```

## Switching Backends

### In Views

```typescript
export async function todoList(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { TodoListPage } = await import("./templates/todo_list.ts");

  // Load from cache first (fast)
  const cached = await TodoModel.objects
    .using("cache")
    .all()
    .fetch();

  // Refresh callback fetches from API
  const refresh = async () => {
    const fresh = await TodoModel.objects
      .using("api")
      .all()
      .fetch();

    // Update cache
    await fresh.using("cache").save();

    return fresh;
  };

  return new TodoListPage({ todos: cached, onRefresh: refresh });
}
```

### In ViewSets

```typescript
class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializerClass = TodoSerializer;

  // Use specific backend
  backend = getBackendByName("default");

  // Or override getQueryset
  override async getQueryset(context: ViewSetContext) {
    return TodoModel.objects.using("default").all();
  }
}
```

## Backend API

All backends implement the `DatabaseBackend` interface:

```typescript
interface DatabaseBackend {
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected: boolean;

  // CRUD operations
  execute<T extends Model>(
    state: QueryState<T>,
  ): Promise<Record<string, unknown>[]>;
  insert<T extends Model>(instance: T): Promise<Record<string, unknown>>;
  update<T extends Model>(instance: T): Promise<Record<string, unknown>>;
  delete<T extends Model>(instance: T): Promise<void>;

  // Querying
  getById<T extends Model>(
    model: typeof Model,
    id: unknown,
  ): Promise<Record<string, unknown> | null>;
  existsById<T extends Model>(
    model: typeof Model,
    id: unknown,
  ): Promise<boolean>;
  count<T extends Model>(state: QueryState<T>): Promise<number>;

  // Bulk operations
  bulkInsert<T extends Model>(
    instances: T[],
  ): Promise<Record<string, unknown>[]>;
  bulkUpdate<T extends Model>(instances: T[]): Promise<void>;
  deleteMany<T extends Model>(state: QueryState<T>): Promise<number>;

  // Transactions (if supported)
  beginTransaction(): Promise<Transaction>;
}
```

## Best Practices

1. **Use named backends** — Configure multiple backends in `setup()` with
   meaningful names

2. **Cache aggressively** — Use IndexedDB to cache remote data for offline
   access

3. **Sync on visibility** — Refresh data when the app becomes visible:
   ```typescript
   document.addEventListener("visibilitychange", () => {
     if (document.visibilityState === "visible") {
       refresh();
     }
   });
   ```

4. **Handle offline gracefully** — Catch network errors and fall back to cache:
   ```typescript
   try {
     const fresh = await TodoModel.objects.using("api").all().fetch();
     await fresh.using("cache").save();
     return fresh;
   } catch (error) {
     console.warn("Offline, using cache:", error);
     return await TodoModel.objects.using("cache").all().fetch();
   }
   ```

5. **Use REST backend with ViewSets** — Ensure your server uses `ModelViewSet`
   for consistent API

6. **Debug with logging** — Enable `debug: true` on backends during development
