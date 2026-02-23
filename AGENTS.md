# Alexi Framework Agent Guidelines

Alexi is a Django-inspired full-stack framework for Deno, written in TypeScript.
It brings Django's developer-friendly patterns to the Deno ecosystem.

---

## Architecture Overview

Alexi follows Django's modular architecture. Each module provides specific
functionality:

| Module                 | Django Equivalent            | Description                                   |
| ---------------------- | ---------------------------- | --------------------------------------------- |
| `@alexi/core`          | `django.core.management`     | Management commands, Application handler      |
| `@alexi/db`            | `django.db`                  | ORM with DenoKV, IndexedDB, and REST backends |
| `@alexi/urls`          | `django.urls`                | URL routing with `path()`, `include()`        |
| `@alexi/middleware`    | `django.middleware.*`        | CORS, logging, error handling                 |
| `@alexi/views`         | `django.views`               | Template views                                |
| `@alexi/web`           | `django.core.handlers.wsgi`  | Web server (HTTP API)                         |
| `@alexi/staticfiles`   | `django.contrib.staticfiles` | Static file handling, bundling                |
| `@alexi/storage`       | `django.core.files.storage`  | File storage backends (Firebase, Memory)      |
| `@alexi/restframework` | `djangorestframework`        | REST API: Serializers, ViewSets, Routers      |
| `@alexi/auth`          | `django.contrib.auth`        | Authentication (JWT-based)                    |
| `@alexi/admin`         | `django.contrib.admin`       | Auto-generated admin panel                    |
| `@alexi/webui`         | -                            | Desktop app support via WebUI                 |
| `@alexi/capacitor`     | -                            | Mobile app support (placeholder)              |
| `@alexi/types`         | -                            | Shared TypeScript type definitions            |

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
│   │   │   └── rest/           # REST API backend (browser, extensible)
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
│   ├── storage/         # File storage backends
│   │   ├── backends/    # Storage backend implementations
│   │   │   ├── firebase.ts  # Firebase Cloud Storage
│   │   │   └── memory.ts    # In-memory (testing)
│   │   ├── storage.ts   # Abstract Storage base class
│   │   └── setup.ts     # Storage configuration
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
import { Count, Q, QuerySet, RelatedManager, Sum } from "@alexi/db";
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
import {
  AllowAny,
  And,
  BasePermission,
  DenyAll,
  IsAdminUser,
  IsAuthenticated,
  IsAuthenticatedOrReadOnly,
  Not,
  Or,
} from "@alexi/restframework";
import {
  AcceptHeaderVersioning,
  BaseVersioning,
  QueryParameterVersioning,
  URLPathVersioning,
  VersionNotAllowedError,
} from "@alexi/restframework";
import {
  AnonRateThrottle,
  BaseThrottle,
  ScopedRateThrottle,
  UserRateThrottle,
} from "@alexi/restframework";
import {
  BaseAuthentication,
  JWTAuthentication,
} from "@alexi/restframework/authentication";
import type { AuthenticatedUser } from "@alexi/restframework/authentication";

// Authentication
import { adminRequired, loginRequired, optionalLogin } from "@alexi/auth";
import { createTokenPair, verifyToken } from "@alexi/auth";

// Views
import { templateView } from "@alexi/views";

// Static Files
import { staticFilesMiddleware } from "@alexi/staticfiles";

// Storage
import { getStorage, setStorage, Storage } from "@alexi/storage";
import { FirebaseStorage } from "@alexi/storage/backends/firebase";
import { MemoryStorage } from "@alexi/storage/backends/memory";

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

// Save fetched QuerySet (bulk persistence)
const drafts = await TaskModel.objects.filter({ status: "draft" }).fetch();
for (const task of drafts.array()) {
  task.status.set("published");
}
const result = await drafts.save();
// result: { inserted: 0, updated: 5, failed: 0, total: 5, errors: [] }
```

### Eager Loading with selectRelated

Use `selectRelated()` to eagerly load ForeignKey relations, avoiding N+1 query
problems. Related objects are fetched in a single batched query.

```typescript
// Load projects with their organisation pre-loaded
const projects = await ProjectModel.objects
  .selectRelated("organisation")
  .fetch();

for (const project of projects.array()) {
  // No additional query - organisation is already loaded
  console.log(project.organisation.isLoaded()); // true
  console.log(project.organisation.get().name.get()); // Works without fetch()
}
```

#### Nested Relations

Use Django's double-underscore syntax for nested relations:

```typescript
// Load competences with projectRole and projectRole.project pre-loaded
const competences = await ProjectRoleCompetenceModel.objects
  .selectRelated("projectRole__project")
  .fetch();

for (const comp of competences.array()) {
  // All levels are pre-loaded
  const role = comp.projectRole.get(); // No fetch needed
  const project = role.project.get(); // No fetch needed
  console.log(project.name.get());
}

// 3-level nesting
const competences = await ProjectRoleCompetenceModel.objects
  .selectRelated("projectRole__project__organisation")
  .fetch();

// Multiple relations
const items = await Model.objects
  .selectRelated("author", "category__parent")
  .fetch();
```

#### How It Works

1. Initial query fetches the main objects
2. For each selectRelated field, collects all FK IDs
3. Fetches related objects in a single batched query (`WHERE id IN [...]`)
4. Sets related instances on ForeignKey fields via `setRelatedInstance()`
5. For nested relations, recursively processes each level

#### ForeignKey Methods for Eager Loading

| Method                       | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| `fk.id`                      | Get FK ID without loading (always available)           |
| `fk.isLoaded()`              | Check if related object is loaded                      |
| `fk.get()`                   | Get loaded instance (throws if not loaded)             |
| `fk.fetch()`                 | Lazy-load the related object (returns Promise)         |
| `fk.setRelatedInstance(obj)` | Set loaded instance (used internally by selectRelated) |

### Reverse Relations (RelatedManager)

ForeignKey fields can define a `relatedName` to create reverse relations on the
target model. This allows Django-style access to related objects.

```typescript
import {
  AutoField,
  CharField,
  ForeignKey,
  IntegerField,
  Manager,
  Model,
  OnDelete,
  RelatedManager,
} from "@alexi/db";

// Target model - declare reverse relation type
export class ProjectRoleModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 255 });

  // TypeScript type declaration - runtime populates this
  declare roleCompetences: RelatedManager<ProjectRoleCompetenceModel>;

  static objects = new Manager(ProjectRoleModel);
  static meta = { dbTable: "project_roles" };
}

// Source model - defines ForeignKey with relatedName
export class ProjectRoleCompetenceModel extends Model {
  id = new AutoField({ primaryKey: true });
  projectRole = new ForeignKey<ProjectRoleModel>("ProjectRoleModel", {
    onDelete: OnDelete.CASCADE,
    relatedName: "roleCompetences", // Creates reverse relation
  });
  competence = new ForeignKey<CompetenceModel>("CompetenceModel", {
    onDelete: OnDelete.CASCADE,
  });
  level = new IntegerField({ default: 1 });

  static objects = new Manager(ProjectRoleCompetenceModel);
  static meta = { dbTable: "project_role_competences" };
}

// Usage - access related objects via reverse relation
const role = await ProjectRoleModel.objects.get({ id: 1 });

// Get all related objects (returns QuerySet)
const competences = await role.roleCompetences.all().fetch();

// Filter related objects
const highLevel = await role.roleCompetences.filter({ level__gte: 3 }).fetch();

// Count related objects
const count = await role.roleCompetences.count();

// Check if related objects exist
const hasCompetences = await role.roleCompetences.exists();

// Create related object (FK set automatically)
const newComp = await role.roleCompetences.create({
  competence: someCompetence,
  level: 4,
});

// Get first/last related object
const first = await role.roleCompetences.first();
```

#### RelatedManager Methods

| Method                  | Return Type          | Description                         |
| ----------------------- | -------------------- | ----------------------------------- |
| `all()`                 | `QuerySet<T>`        | Get all related objects             |
| `filter(conditions)`    | `QuerySet<T>`        | Filter related objects              |
| `exclude(conditions)`   | `QuerySet<T>`        | Exclude related objects             |
| `first()`               | `Promise<T \| null>` | Get first related object            |
| `last()`                | `Promise<T \| null>` | Get last related object             |
| `count()`               | `Promise<number>`    | Count related objects               |
| `exists()`              | `Promise<boolean>`   | Check if any related objects exist  |
| `create(data)`          | `Promise<T>`         | Create related object (FK set auto) |
| `getOrCreate(defaults)` | `Promise<[T, bool]>` | Get or create related object        |

#### TypeScript Typing Pattern

Use `declare` to tell TypeScript about reverse relation properties:

```typescript
class Author extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  // Declare reverse relations - runtime creates RelatedManager
  declare articles: RelatedManager<Article>;
  declare books: RelatedManager<Book>;

  static objects = new Manager(Author);
}
```

The `declare` keyword informs TypeScript without generating JavaScript code. The
runtime automatically creates `RelatedManager` instances based on `relatedName`
values from ForeignKey definitions.

### QuerySet.save() - Bulk Persistence

The `save()` method persists all loaded model instances in a QuerySet. This
enables a "unit of work" pattern and cross-backend synchronization.

```typescript
import type { SaveResult } from "@alexi/db";

// Basic usage: modify and save multiple objects
const projects = await ProjectModel.objects
  .filter({ status: "draft" })
  .fetch();

for (const project of projects.array()) {
  project.status.set("published");
  project.publishedAt.set(new Date());
}

const result: SaveResult = await projects.save();
console.log(`Updated: ${result.updated}, Inserted: ${result.inserted}`);
```

#### Cross-Backend Sync

Combined with `using()`, this enables explicit sync between backends:

```typescript
// Fetch from REST API
const orgs = await OrganisationModel.objects
  .using("rest")
  .filter({ current: true })
  .fetch();

// Save to IndexedDB (cache remote data locally)
await orgs.using("indexeddb").save();
```

#### SaveResult Interface

```typescript
interface SaveResult {
  inserted: number; // New records created
  updated: number; // Existing records updated
  failed: number; // Records that failed to save
  total: number; // Total records processed
  errors: Array<{ instance: Model; error: Error }>; // Error details
}
```

#### Save Behavior

For each object in the QuerySet:

- If object exists in target backend (by PK) → `update()`
- If object doesn't exist → `insert()`

This is essentially `updateOrCreate()` for each object.

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
      endpoints: [
        OrganisationEndpoint,
        TicketMessageEndpoint,
      ],
    });
  }

  // App-specific methods using the protected request() helper
  async publishProject(id: number) {
    return this.request(`/projects/${id}/publish/`, { method: "POST" });
  }
}
```

#### RestBackend Configuration Reference

| Option                         | Default                    | Description                       |
| ------------------------------ | -------------------------- | --------------------------------- |
| `apiUrl`                       | (required)                 | API base URL                      |
| `debug`                        | `false`                    | Enable console logging            |
| `tokenStorageKey`              | `"alexi_auth_tokens"`      | localStorage key for JWT tokens   |
| `authEndpoints.login`          | `"/auth/login/"`           | Login endpoint                    |
| `authEndpoints.register`       | `"/auth/register/"`        | Registration endpoint             |
| `authEndpoints.refresh`        | `"/auth/refresh/"`         | Token refresh endpoint            |
| `authEndpoints.logout`         | `"/auth/logout/"`          | Logout endpoint                   |
| `authEndpoints.me`             | `"/auth/me/"`              | Current user profile endpoint     |
| `authEndpoints.changePassword` | `"/auth/change-password/"` | Password change endpoint          |
| `endpoints`                    | `[]`                       | Declarative ModelEndpoint classes |

#### Endpoint Path (Required)

ModelEndpoint requires an explicit `path` property — no auto-derivation from
model names or `dbTable`. What you write is what you get.

```typescript
class ProjectEndpoint extends ModelEndpoint {
  model = ProjectModel;
  path = "/projects/"; // Required - full path with slashes
}
```

#### Declarative Endpoints (DRF-style)

Declare endpoint configuration using field-like descriptors — mirroring Django
REST Framework's ViewSet and `@action` patterns.

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

class OrganisationEndpoint extends ModelEndpoint {
  model = OrganisationModel;
  path = "/organisations/";

  // filter({current: true}) → GET /organisations/current/
  current = new SingletonQuery();

  // POST /organisations/:id/activate/
  activate = new DetailAction();
  deactivate = new DetailAction();
}

class ConnectionEndpoint extends ModelEndpoint {
  model = ConnectionModel;
  path = "/connections/";

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
// ModelEndpoint - path is required
class MyEndpoint extends ModelEndpoint {
  model = MyModel;
  path = "/my-endpoint/"; // Full path with leading/trailing slashes
}

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
new SingletonQuery({ urlSegment: "me" }); // custom URL: /path/me/
new SingletonQuery({ matchValue: "active" }); // filter({field: "active"})
```

##### Updated Configuration Reference

| Option                         | Default                    | Description                       |
| ------------------------------ | -------------------------- | --------------------------------- |
| `apiUrl`                       | (required)                 | API base URL                      |
| `debug`                        | `false`                    | Enable console logging            |
| `tokenStorageKey`              | `"alexi_auth_tokens"`      | localStorage key for JWT tokens   |
| `endpoints`                    | `[]`                       | Declarative ModelEndpoint classes |
| `authEndpoints.login`          | `"/auth/login/"`           | Login endpoint                    |
| `authEndpoints.register`       | `"/auth/register/"`        | Registration endpoint             |
| `authEndpoints.refresh`        | `"/auth/refresh/"`         | Token refresh endpoint            |
| `authEndpoints.logout`         | `"/auth/logout/"`          | Logout endpoint                   |
| `authEndpoints.me`             | `"/auth/me/"`              | Current user profile endpoint     |
| `authEndpoints.changePassword` | `"/auth/change-password/"` | Password change endpoint          |

---

## File Storage

Alexi provides a Django-style Storage API for file uploads and management.

### Storage Setup

```typescript
import { getStorage, setStorage } from "@alexi/storage";
import { FirebaseStorage } from "@alexi/storage/backends/firebase";
import { MemoryStorage } from "@alexi/storage/backends/memory";

// Configure Firebase Storage
const storage = new FirebaseStorage({
  bucket: "my-project.appspot.com",
  basePath: "uploads/",
  getAuthToken: async () => {
    // Return Firebase auth token
    return await firebase.auth().currentUser?.getIdToken() ?? "";
  },
});
setStorage(storage);

// For testing, use MemoryStorage
const testStorage = new MemoryStorage();
setStorage(testStorage);
```

### Storage API Methods

| Method                     | Description                            |
| -------------------------- | -------------------------------------- |
| `save(name, content)`      | Save file, returns final name          |
| `open(name)`               | Open file for reading (ReadableStream) |
| `delete(name)`             | Delete file                            |
| `exists(name)`             | Check if file exists                   |
| `url(name)`                | Get public/download URL                |
| `size(name)`               | Get file size in bytes                 |
| `listdir(path)`            | List directory contents                |
| `getMetadata(name)`        | Get file metadata                      |
| `signedUrl(name, options)` | Generate temporary signed URL          |

### FileField and ImageField

```typescript
import { AutoField, CharField, FileField, ImageField, Model } from "@alexi/db";

export class DocumentModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 255 });

  // Basic file field
  file = new FileField({ uploadTo: "documents/" });

  // With validation
  attachment = new FileField({
    uploadTo: "attachments/",
    maxSize: 10 * 1024 * 1024, // 10 MB
    allowedExtensions: [".pdf", ".doc", ".docx"],
  });
}

export class ProfileModel extends Model {
  id = new AutoField({ primaryKey: true });

  // Image field with defaults for common image types
  avatar = new ImageField({
    uploadTo: "avatars/",
    maxSize: 5 * 1024 * 1024, // 5 MB
  });
}
```

### File Upload in ViewSet

```typescript
import { action, ModelViewSet } from "@alexi/restframework";
import { getStorage } from "@alexi/storage";
import { DocumentModel } from "./models.ts";

export class DocumentViewSet extends ModelViewSet {
  model = DocumentModel;

  @action({ detail: false, methods: ["POST"] })
  async upload(context: ViewSetContext): Promise<Response> {
    const formData = await context.request.formData();
    const file = formData.get("file") as File;

    // Validate file
    const field = new DocumentModel().file;
    const validation = field.validateFile(file);
    if (!validation.valid) {
      return Response.json({ errors: validation.errors }, { status: 400 });
    }

    // Save to storage
    const storage = getStorage();
    const uploadPath = field.getUploadPath(file.name);
    const savedName = await storage.save(uploadPath, file);
    const fileUrl = await storage.url(savedName);

    // Save metadata to database
    const document = await DocumentModel.objects.create({
      name: file.name,
      file: savedName,
    });

    return Response.json({
      id: document.id.get(),
      name: document.name.get(),
      fileUrl: fileUrl,
    });
  }
}
```

### Available Backends

| Backend           | Import                             | Description                 |
| ----------------- | ---------------------------------- | --------------------------- |
| `FirebaseStorage` | `@alexi/storage/backends/firebase` | Firebase Cloud Storage      |
| `MemoryStorage`   | `@alexi/storage/backends/memory`   | In-memory storage (testing) |

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

### Permissions

ViewSet-level permission classes control access to API endpoints. Permissions
are checked before each action and can also check object-level access.

```typescript
import {
  AllowAny,
  BasePermission,
  IsAdminUser,
  IsAuthenticated,
  IsAuthenticatedOrReadOnly,
  ModelViewSet,
} from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";

// ViewSet with permission classes
export class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;
  permission_classes = [IsAuthenticatedOrReadOnly];
}

// Admin-only ViewSet
export class AdminViewSet extends ModelViewSet {
  model = UserModel;
  serializer_class = UserSerializer;
  permission_classes = [IsAdminUser];
}

// Per-action permissions
export class CommentViewSet extends ModelViewSet {
  model = CommentModel;
  serializer_class = CommentSerializer;

  override getPermissions(): BasePermission[] {
    if (this.action === "destroy") {
      return [new IsAdminUser()];
    }
    return [new IsAuthenticatedOrReadOnly()];
  }
}

// Custom permission with object-level check
class IsOwnerOrReadOnly extends BasePermission {
  override message = "You must be the owner to modify this object.";

  hasPermission(context: ViewSetContext): boolean {
    // Allow read operations for anyone
    if (["GET", "HEAD", "OPTIONS"].includes(context.request.method)) {
      return true;
    }
    // Write operations require authentication
    return context.user != null;
  }

  override hasObjectPermission(
    context: ViewSetContext,
    obj: unknown,
  ): boolean {
    // Allow read operations for anyone
    if (["GET", "HEAD", "OPTIONS"].includes(context.request.method)) {
      return true;
    }
    // Write operations require ownership
    const record = obj as { ownerId?: number };
    return record.ownerId === context.user?.id;
  }
}
```

#### Built-in Permission Classes

| Permission Class            | Description                                |
| --------------------------- | ------------------------------------------ |
| `AllowAny`                  | Allow all access (no restrictions)         |
| `DenyAll`                   | Deny all access                            |
| `IsAuthenticated`           | Require authenticated user                 |
| `IsAdminUser`               | Require admin user (`isAdmin: true`)       |
| `IsAuthenticatedOrReadOnly` | Allow read for anyone, write requires auth |

#### Permission Operators

Combine permissions with logical operators:

```typescript
import {
  And,
  IsAdminUser,
  IsAuthenticated,
  Not,
  Or,
} from "@alexi/restframework";

// User must be authenticated AND admin
class StrictAdminViewSet extends ModelViewSet {
  permission_classes = [And.of(IsAuthenticated, IsAdminUser)];
}

// User can be admin OR owner
class FlexibleViewSet extends ModelViewSet {
  permission_classes = [Or.of(IsAdminUser, IsOwner)];
}

// Only non-admin users (e.g., self-service)
class UserOnlyViewSet extends ModelViewSet {
  permission_classes = [Not.of(IsAdminUser)];
}
```

### Authentication

`authentication_classes` on a ViewSet controls how `context.user` is populated
before permission checks run. Authenticators are tried in order; the first
non-null result wins. If all return `null`, `context.user` remains `undefined`
(anonymous request).

```typescript
import { ModelViewSet } from "@alexi/restframework";
import {
  BaseAuthentication,
  JWTAuthentication,
} from "@alexi/restframework/authentication";
import type { AuthenticatedUser } from "@alexi/restframework/authentication";
import type { ViewSetContext } from "@alexi/restframework";

// Use built-in JWT bearer authentication
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;
  authentication_classes = [JWTAuthentication];
  permission_classes = [IsAuthenticated]; // context.user now populated
}

// Custom authenticator
class ApiKeyAuthentication extends BaseAuthentication {
  async authenticate(
    context: ViewSetContext,
  ): Promise<AuthenticatedUser | null> {
    const key = context.request.headers.get("X-Api-Key");
    if (!key) return null;
    const user = await ApiKeyModel.objects.filter({ key }).first();
    if (!user) return null;
    return { userId: user.id.get(), email: user.email.get(), isAdmin: false };
  }
}

class ProtectedViewSet extends ModelViewSet {
  authentication_classes = [JWTAuthentication, ApiKeyAuthentication];
  permission_classes = [IsAuthenticated];
}
```

#### JWTAuthentication

Reads `Authorization: Bearer <token>` from the request header.

- Supports **HS256** signed tokens (secret from `Deno.env.get("SECRET_KEY")`)
- Supports **unsigned** tokens (`alg: none`) only when no `SECRET_KEY` is set
- Checks `exp` claim; expired tokens return `null` (anonymous)
- Payload fields: `userId` (or `sub` as fallback), `email`, `isAdmin`

#### Built-in Authentication Classes

| Class                | Import                                | Description                                |
| -------------------- | ------------------------------------- | ------------------------------------------ |
| `BaseAuthentication` | `@alexi/restframework/authentication` | Abstract base — implement `authenticate()` |
| `JWTAuthentication`  | `@alexi/restframework/authentication` | Bearer JWT (HS256 or unsigned)             |

#### AuthenticatedUser Type

```typescript
type AuthenticatedUser = {
  userId: number;
  email: string;
  isAdmin: boolean;
};
```

---

### Pagination

Pagination classes provide DRF-style pagination for list endpoints.

```typescript
import {
  CursorPagination,
  LimitOffsetPagination,
  ModelViewSet,
  PageNumberPagination,
} from "@alexi/restframework";

// Page number pagination (DRF default style)
class StandardPagination extends PageNumberPagination {
  pageSize = 25;
  pageSizeQueryParam = "page_size"; // Allow client to override
  maxPageSize = 100;
}

// Limit/offset pagination (flexible)
class FlexiblePagination extends LimitOffsetPagination {
  defaultLimit = 20;
  maxLimit = 100;
}

// Cursor pagination (for infinite scroll / real-time data)
class InfiniteScrollPagination extends CursorPagination {
  pageSize = 20;
  ordering = "-createdAt"; // Required for cursor pagination
}

// Use in ViewSet
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;
  pagination_class = StandardPagination;
}
```

#### Pagination Response Format

All pagination classes return responses in this format:

```json
{
  "count": 100,
  "next": "http://api.example.com/articles/?page=2",
  "previous": null,
  "results": [...]
}
```

Note: `CursorPagination` returns `count: -1` since calculating total count is
expensive for cursor-based pagination.

#### Pagination Classes Reference

| Class                   | Query Parameters    | Use Case                          |
| ----------------------- | ------------------- | --------------------------------- |
| `PageNumberPagination`  | `?page=N`           | Traditional page-based navigation |
| `LimitOffsetPagination` | `?limit=N&offset=M` | Flexible offset-based access      |
| `CursorPagination`      | `?cursor=<token>`   | Infinite scroll, real-time feeds  |

### Content Negotiation

Renderer classes control the output format of API responses. Content negotiation
selects the appropriate renderer based on the request's `Accept` header or
`?format=` query parameter.

```typescript
import {
  CSVRenderer,
  JSONRenderer,
  ModelViewSet,
  XMLRenderer,
} from "@alexi/restframework";

// ViewSet with multiple renderers
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;
  renderer_classes = [JSONRenderer, XMLRenderer, CSVRenderer];
}
```

#### Renderer Selection

1. `?format=json` query param takes precedence over `Accept` header
2. `Accept` header is parsed with quality values (e.g. `application/json;q=0.9`)
3. `Accept: */*` matches the first renderer in `renderer_classes`
4. No match → `406 Not Acceptable`

#### Built-in Renderer Classes

| Renderer       | Media Type         | Format | Description               |
| -------------- | ------------------ | ------ | ------------------------- |
| `JSONRenderer` | `application/json` | `json` | JSON output (default)     |
| `XMLRenderer`  | `application/xml`  | `xml`  | Simple XML output         |
| `CSVRenderer`  | `text/csv`         | `csv`  | CSV for arrays of objects |

#### Custom Renderer

```typescript
import { BaseRenderer } from "@alexi/restframework";

class PlainTextRenderer extends BaseRenderer {
  mediaType = "text/plain";
  format = "txt";

  render(data: unknown): string {
    return String(data);
  }
}
```

#### Imports

```typescript
import {
  BaseRenderer,
  CSVRenderer,
  JSONRenderer,
  parseAcceptHeader,
  renderResponse,
  selectRenderer,
  XMLRenderer,
} from "@alexi/restframework";
```

### Browsable API

`BrowsableAPIRenderer` produces an interactive HTML interface for the API when
requests are made with `Accept: text/html` (e.g., from a browser). It is similar
to Django REST Framework's browsable API.

Features:

- Syntax-highlighted JSON response display
- Auto-generated JSON request forms for POST/PUT/PATCH
- Breadcrumb navigation and HTTP method badge
- Pagination controls (next/previous links)
- Login/logout with JWT token management
- Copy-to-clipboard for response data
- Mobile-responsive design

```typescript
import {
  BrowsableAPIRenderer,
  JSONRenderer,
  ModelViewSet,
} from "@alexi/restframework";

// ViewSet that renders HTML in browsers, JSON for API clients
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;
  renderer_classes = [JSONRenderer, BrowsableAPIRenderer];
}
// Browser (Accept: text/html) → Interactive HTML page
// API client (Accept: application/json) → JSON response
```

#### Customization

```typescript
import { BrowsableAPIRenderer } from "@alexi/restframework";

class MyBrowsableRenderer extends BrowsableAPIRenderer {
  override title = "My Project API";
  override tokenStorageKey = "my_project_tokens";
  override loginUrl = "/api/v2/auth/login/";
  override logoutUrl = "/api/v2/auth/logout/";
  override meUrl = "/api/v2/auth/me/";
}

class ArticleViewSet extends ModelViewSet {
  renderer_classes = [JSONRenderer, MyBrowsableRenderer];
}
```

Or pass options to the constructor (e.g., for factory patterns):

```typescript
const renderer = new BrowsableAPIRenderer({
  title: "My API",
  tokenStorageKey: "my_tokens",
  loginUrl: "/api/auth/login/",
});
```

#### RenderContext

The viewset automatically passes a `RenderContext` to renderers with:

| Field            | Type       | Description                      |
| ---------------- | ---------- | -------------------------------- |
| `request`        | `Request`  | The original HTTP request        |
| `method`         | `string`   | HTTP method (GET, POST, etc.)    |
| `allowedMethods` | `string[]` | Methods allowed on this endpoint |
| `statusCode`     | `number`   | Response status code             |
| `action`         | `string`   | The ViewSet action name          |
| `params`         | `object`   | URL path parameters              |

Custom renderers can use `RenderContext` by accepting it in their `render()`:

```typescript
import { BaseRenderer, type RenderContext } from "@alexi/restframework";

class MyRenderer extends BaseRenderer {
  readonly mediaType = "text/plain";
  readonly format = "txt";

  override render(data: unknown, context?: RenderContext): string {
    const method = context?.method ?? "GET";
    return `${method} ${JSON.stringify(data)}`;
  }
}
```

---

### Throttling

Throttling limits the rate of requests to API endpoints, returning
`429 Too Many Requests` when exceeded.

```typescript
import {
  AnonRateThrottle,
  ScopedRateThrottle,
  UserRateThrottle,
} from "@alexi/restframework";

// ViewSet with throttle classes
class MyViewSet extends ModelViewSet {
  model = MyModel;
  throttle_classes = [AnonRateThrottle, UserRateThrottle];
  throttle_rates = {
    anon: "100/day", // 100 requests/day for unauthenticated users (by IP)
    user: "1000/day", // 1000 requests/day for authenticated users (by ID)
  };
}

// Scoped throttling - different limits for different endpoints
class BurstThrottle extends ScopedRateThrottle {
  override scope = "burst";
}
class SustainedThrottle extends ScopedRateThrottle {
  override scope = "sustained";
}

class SensitiveViewSet extends ModelViewSet {
  throttle_classes = [BurstThrottle, SustainedThrottle];
  throttle_rates = {
    burst: "60/minute",
    sustained: "1000/day",
  };
}
```

#### Rate Format

Rates use the format `"N/period"` where period is `second`, `minute`, `hour`, or
`day`:

```typescript
"5/second"; // 5 requests per second
"60/minute"; // 60 requests per minute
"1000/hour"; // 1000 requests per hour
"10000/day"; // 10000 requests per day
```

#### Built-in Throttle Classes

| Class                | Scope    | Keyed By  | Description                                   |
| -------------------- | -------- | --------- | --------------------------------------------- |
| `AnonRateThrottle`   | `"anon"` | Client IP | Rate limits unauthenticated requests by IP    |
| `UserRateThrottle`   | `"user"` | User ID   | Rate limits authenticated requests by user ID |
| `ScopedRateThrottle` | (custom) | User/IP   | Rate limits by custom scope name              |

#### Response

When throttled, the API returns:

- **Status**: `429 Too Many Requests`
- **Header**: `Retry-After: <seconds>` - seconds until the next request is
  allowed
- **Body**:
  `{ "error": "Request was throttled. Expected available in N seconds." }`

#### Custom Throttle

```typescript
import { BaseThrottle } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";

class OrganisationThrottle extends BaseThrottle {
  getRate(): string | null {
    return "500/hour";
  }

  getCacheKey(context: ViewSetContext): string | null {
    // Throttle by organisation ID
    const orgId = context.user?.organisationId;
    if (!orgId) return null;
    return `throttle_org_${orgId}`;
  }
}
```

#### Per-Action Throttling

Override `getThrottles()` for per-action control:

```typescript
class MyViewSet extends ModelViewSet {
  override getThrottles() {
    if (this.action === "create") {
      // Stricter limit for POST
      const t = new AnonRateThrottle();
      t.setRate("10/hour");
      return [t];
    }
    return [];
  }
}
```

---

### API Versioning

Versioning allows multiple API versions to coexist. The detected version is
available as `context.version` in ViewSet actions.

```typescript
import {
  AcceptHeaderVersioning,
  QueryParameterVersioning,
  URLPathVersioning,
} from "@alexi/restframework";

// URL path versioning: /api/v1/users/, /api/v2/users/
class UserViewSet extends ModelViewSet {
  versioning_class = URLPathVersioning;
  versioning_config = {
    defaultVersion: "v1",
    allowedVersions: ["v1", "v2"],
  };

  override async list(context: ViewSetContext): Promise<Response> {
    if (context.version === "v2") {
      // return v2 format
    }
    return super.list(context);
  }
}

// URL setup for URLPathVersioning
// path("api/:version/", include(router.urls))

// Query parameter versioning: /api/users/?version=v2
class ArticleViewSet extends ModelViewSet {
  versioning_class = QueryParameterVersioning;
  versioning_config = { defaultVersion: "v1", allowedVersions: ["v1", "v2"] };
}

// Accept header versioning: Accept: application/json; version=2.0
class ProductViewSet extends ModelViewSet {
  versioning_class = AcceptHeaderVersioning;
  versioning_config = {
    defaultVersion: "1.0",
    allowedVersions: ["1.0", "2.0"],
  };
}
```

#### Built-in Versioning Classes

| Class                      | Source                         | Description                      |
| -------------------------- | ------------------------------ | -------------------------------- |
| `URLPathVersioning`        | `:version` URL param           | Version embedded in the URL path |
| `QueryParameterVersioning` | `?version=` query param        | Version in query string          |
| `AcceptHeaderVersioning`   | `Accept: ...; version=` header | Version in the Accept header     |

#### Response

When the requested version is not in `allowedVersions`:

- **Status**: `400 Bad Request`
- **Body**: `{ "error": "...", "allowedVersions": ["v1", "v2"] }`

#### Custom Versioning

```typescript
import { BaseVersioning } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";

class HeaderVersioning extends BaseVersioning {
  determineVersion(
    request: Request,
    _params: Record<string, string>,
  ): string | null {
    return request.headers.get("X-API-Version");
  }
}
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

Each app has its own settings file. Alexi uses **import functions** in
`INSTALLED_APPS` and `ROOT_URLCONF` to ensure imports happen in the correct
context (so import maps work correctly):

```typescript
// project/web.settings.ts

export const DEBUG = Deno.env.get("DEBUG") === "true";
export const SECRET_KEY = Deno.env.get("SECRET_KEY") ?? "dev-secret";

export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

// INSTALLED_APPS contains import functions for each app.
// Using import functions ensures the import happens in this module's context,
// so import maps defined in deno.json work correctly.
export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@alexi/web"),
  () => import("@alexi/db"),
  () => import("@alexi/auth"),
  () => import("@alexi/admin"),
  () => import("@myapp/web"), // Local app (defined in deno.json import map)
];

// ROOT_URLCONF is an import function that returns the URL patterns module.
export const ROOT_URLCONF = () => import("@myapp/web/urls");

export const DATABASE = {
  engine: "denokv" as const,
  name: "myapp",
  path: "./data/myapp.db",
};
```

### Why Import Functions?

When Alexi (a JSR package) tries to `import("@myapp/web")`, it fails because the
import map is defined in the user's project, not in Alexi's package.

By using **import functions**, the import happens in the **user's settings
module context**, where the import map is available. Alexi just calls the
function:

```typescript
// Alexi calls the user's function - correct import context
for (const importApp of settings.INSTALLED_APPS) {
  const module = await importApp();
  const config = module.default; // AppConfig
}
```

### Import Map Setup

Define local apps in your `deno.json` import map:

```json
{
  "imports": {
    "@alexi/web": "jsr:@alexi/web@^0.8",
    "@alexi/db": "jsr:@alexi/db@^0.8",
    "@myapp/web": "./src/myapp-web/mod.ts",
    "@myapp/ui": "./src/myapp-ui/mod.ts"
  }
}
```

### Migration from APP_PATHS (Deprecated)

The `APP_PATHS` configuration is removed. Migrate to import functions:

```typescript
// ❌ Old approach (removed)
export const INSTALLED_APPS = ["alexi_web", "myapp"];
export const APP_PATHS = {
  "alexi_web": "../alexi/src/web",
  "myapp": "./src/myapp",
};
export const ROOT_URLCONF = "myapp";

// ✅ New approach (required)
export const INSTALLED_APPS = [
  () => import("@alexi/web"),
  () => import("@myapp/web"),
];
export const ROOT_URLCONF = () => import("@myapp/web/urls");
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

8. **RestBackend requires explicit ModelEndpoint path**: Define a ModelEndpoint
   class with `model` and `path` fields. The `path` is required and must be the
   full API path with leading/trailing slashes (e.g., `/projects/`). No
   auto-derivation from model name or `dbTable`.

9. **RestBackend `request()` is protected**: Subclasses can use
   `this.request<T>(path, options)` to make authenticated HTTP calls for
   app-specific endpoints without reimplementing token management.

10. **Use selectRelated for ForeignKey eager loading**: Avoid N+1 queries by
    using `selectRelated()` to batch-load related objects:
    ```typescript
    // Without selectRelated - N+1 queries
    const projects = await ProjectModel.objects.all().fetch();
    for (const p of projects.array()) {
      await p.organisation.fetch(); // One query per project!
    }

    // With selectRelated - 2 queries total
    const projects = await ProjectModel.objects
      .selectRelated("organisation")
      .fetch();
    for (const p of projects.array()) {
      p.organisation.get(); // Already loaded, no query
    }

    // Nested relations with double-underscore syntax
    .selectRelated("projectRole__project__organisation")
    ```

11. **ForeignKey.get() throws if not loaded**: Always check `isLoaded()` or use
    `selectRelated()` / `fetch()` before calling `get()` on ForeignKey fields.

---

## E2E Testing

E2E tests create a scaffolded project and run it against the local Alexi source.
The test utility patches the generated project's `deno.jsonc` to use local
`file://` imports instead of JSR imports.

### Updating E2E Test Imports

When adding new subpath exports to Alexi packages (e.g.,
`@alexi/db/migrations`), you must also update the E2E test patching logic in
`src/create/tests/e2e_utils.ts`.

The `patchProjectForLocalAlexi()` function maps JSR imports to local file paths:

```typescript
// In src/create/tests/e2e_utils.ts
const localImports: Record<string, string> = {
  "@alexi/core": `${alexiRoot}src/core/mod.ts`,
  "@alexi/db": `${alexiRoot}src/db/mod.ts`,
  "@alexi/db/migrations": `${alexiRoot}src/db/migrations/mod.ts`, // Add new subpaths here
  "@alexi/db/migrations/schema": `${alexiRoot}src/db/migrations/schema/mod.ts`,
  // ... other imports
};
```

**When to update:**

- Adding a new package export in any `deno.jsonc` (e.g., `"./migrations": ...`)
- Adding a new subpath that other packages depend on
- Renaming or moving existing exports

**How to verify:**

```bash
deno task test:e2e
```

If E2E tests fail with "Import X not a dependency and not in import map", add
the missing import to `localImports` in `e2e_utils.ts`.

---

## Contributing

1. Follow the existing code style (snake_case files, 2-space indent)
2. Add tests for new functionality
3. Run `deno task check` before committing
4. Run `deno task fmt` to format code
5. Run `deno task lint` to check for issues
