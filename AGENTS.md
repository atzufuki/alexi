# Alexi Framework Agent Guidelines

Alexi is a Django-inspired full-stack framework for Deno, written in TypeScript.

---

## Architecture Overview

| Module                 | Django Equivalent            | Description                                           |
| ---------------------- | ---------------------------- | ----------------------------------------------------- |
| `@alexi/types`         | —                            | Shared TypeScript type definitions                    |
| `@alexi/urls`          | `django.urls`                | URL routing: `path()`, `include()`                    |
| `@alexi/db`            | `django.db`                  | ORM with DenoKV, SQLite, IndexedDB, REST backends     |
| `@alexi/storage`       | `django.core.files.storage`  | File storage backends                                 |
| `@alexi/middleware`    | `django.middleware.*`        | CORS, logging, error handling                         |
| `@alexi/views`         | `django.views`               | Template engine, CBVs, `templateView()`               |
| `@alexi/restframework` | `djangorestframework`        | Serializers, ViewSets, Routers, Permissions           |
| `@alexi/auth`          | `django.contrib.auth`        | AbstractUser, JWT tokens, view decorators             |
| `@alexi/core`          | `django.core`                | Application, settings, management commands, runserver |
| `@alexi/staticfiles`   | `django.contrib.staticfiles` | Static file serving, bundling, fingerprinting         |
| `@alexi/admin`         | `django.contrib.admin`       | Auto-generated admin panel (HTMX + SSR)               |
| `@alexi/webui`         | —                            | Desktop app support via WebUI                         |
| `@alexi/capacitor`     | —                            | Mobile app support                                    |
| `@alexi/create`        | `django-admin startproject`  | Project and app scaffolding                           |

### Canonical Layer Architecture

A package may only import from the **same or lower** layer. No upward or
circular dependencies are permitted.

```
Layer 0 — Primitives
  @alexi/types   @alexi/urls

Layer 1 — Data & Transport
  @alexi/db   @alexi/storage   @alexi/middleware

Layer 2 — Application Logic
  @alexi/views   @alexi/restframework   @alexi/auth

Layer 3 — Framework Core
  @alexi/core

Layer 4 — Infrastructure
  @alexi/staticfiles   @alexi/admin

Layer 5 — Runtime Hosts
  @alexi/webui   @alexi/capacitor   @alexi/create
```

> `@alexi/core` contains the `runserver` management command and the
> `getHttpApplication()` factory — there is no separate `@alexi/web` package.
> Django has no equivalent separate package either; `runserver` lives in
> `django.core.management.commands`.

---

## Project Structure

```
alexi/
└── src/
    ├── types/           # Shared TypeScript types
    ├── urls/            # path(), include(), resolve()
    ├── db/
    │   ├── backends/
    │   │   ├── denokv/      # Server (Deno KV)
    │   │   ├── sqlite/      # Server (SQLite, --unstable-ffi)
    │   │   ├── indexeddb/   # Browser
    │   │   └── rest/        # Browser → REST API
    │   ├── fields/          # CharField, IntegerField, FileField, …
    │   ├── migrations/      # makemigrations, migrate, migration files
    │   ├── models/          # Model, Manager
    │   └── query/           # QuerySet, Q, aggregations
    ├── storage/
    │   └── backends/        # firebase.ts, memory.ts
    ├── middleware/          # BaseMiddleware, CorsMiddleware, LoggingMiddleware, …
    ├── views/               # View, TemplateView, ListView, DetailView, templateView()
    ├── restframework/
    │   ├── serializers/     # Serializer, ModelSerializer
    │   ├── viewsets/        # ViewSet, ModelViewSet
    │   ├── authentication/  # BaseAuthentication, JWTAuthentication
    │   └── router.ts        # DefaultRouter
     ├── auth/                # AbstractUser, loginRequired, createTokenPair
     │   └── commands/        # createsuperuser (contributed via AppConfig)
    ├── core/
    │   ├── management/
    │   │   └── commands/    # runserver, test, makemigrations, migrate,
    │   │                    # bundle, collectstatic, flush, startapp
    │   ├── application.ts
    │   ├── get_application.ts
    │   ├── config.ts
    │   └── management.ts
    ├── staticfiles/
    ├── admin/
    ├── webui/
    ├── capacitor/
    └── create/
```

---

## Naming Conventions

All TypeScript files use **lowercase snake_case**:

- `model_viewset.ts` ✅
- `ModelViewSet.ts` ❌

---

## Settings

```typescript
// project/settings.ts
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { UserModel } from "@myapp/models";
import {
  CorsMiddleware,
  ErrorHandlerMiddleware,
  LoggingMiddleware,
} from "@alexi/middleware";
import { StaticfilesConfig } from "@alexi/staticfiles";
import { DbConfig } from "@alexi/db";
import { AuthConfig } from "@alexi/auth";
import { AdminConfig } from "@alexi/admin";
import { MyAppConfig } from "@myapp/web";

export const DEBUG = Deno.env.get("DEBUG") === "true";
export const SECRET_KEY = Deno.env.get("SECRET_KEY") ?? "dev-secret";
export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

export const INSTALLED_APPS = [
  StaticfilesConfig,
  DbConfig,
  AuthConfig,
  AdminConfig,
  MyAppConfig,
];

export const ROOT_URLCONF = () => import("@myapp/web/urls");

export const DATABASES = {
  default: new DenoKVBackend({ name: "myapp", path: "./data/myapp.db" }),
};

export const TEMPLATES = [
  { APP_DIRS: true },
];

export const STATICFILES_DIRS = [
  {
    path: "./src/my-app",
    outputDir: "./src/my-app/static/my-app",
    entrypoints: ["worker.ts", "document.ts"],
  },
];

export const AUTH_USER_MODEL = UserModel;

export const MIDDLEWARE = [
  LoggingMiddleware,
  CorsMiddleware,
  ErrorHandlerMiddleware,
];
```

`ROOT_URLCONF` uses an import function so that the user project's import map
(defined in `deno.json`) is in scope when the import runs.

---

## Application Entry Points

### `http.ts` — production server

```typescript
// project/http.ts
import { getHttpApplication } from "@alexi/core";

export default await getHttpApplication();
```

```bash
deno serve -A --unstable-kv project/http.ts
```

### `getWorkerApplication()` — Service Worker

```typescript
import { getWorkerApplication } from "@alexi/core";
import * as settings from "./settings.ts";

self.addEventListener("install", (event) => {
  event.waitUntil(
    getWorkerApplication(settings).then((app) => {
      self.app = app;
      return self.skipWaiting();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/static/")) return;
  event.respondWith(self.app.handler(event.request));
});
```

### `getWebuiApplication()` — desktop

```typescript
import { getWebuiApplication } from "@alexi/webui";

const app = await getWebuiApplication({
  url: "http://localhost:8000/",
  webui: { title: "MyApp", width: 1400, height: 900 },
});
await app.launch();
```

---

## Management Commands

| Command           | Django Equivalent              | Description                                      |
| ----------------- | ------------------------------ | ------------------------------------------------ |
| `runserver`       | `django-admin runserver`       | Start HTTP development server                    |
| `makemigrations`  | `django-admin makemigrations`  | Generate migration files                         |
| `migrate`         | `django-admin migrate`         | Apply migrations                                 |
| `createsuperuser` | `django-admin createsuperuser` | Create admin user (contributed by `@alexi/auth`) |
| `collectstatic`   | `django-admin collectstatic`   | Collect static files                             |
| `bundle`          | —                              | Bundle frontend assets                           |
| `flush`           | `django-admin flush`           | Clear database                                   |
| `test`            | `django-admin test`            | Run tests                                        |
| `startapp`        | `django-admin startapp`        | Scaffold new app                                 |
| `help`            | `django-admin help`            | Show available commands                          |

```bash
deno run -A --unstable-kv manage.ts runserver --settings ./project/settings.ts
deno run -A --unstable-kv manage.ts makemigrations myapp --settings ./project/settings.ts
deno run -A --unstable-kv manage.ts migrate --settings ./project/settings.ts
deno run -A --unstable-kv manage.ts createsuperuser --settings ./project/settings.ts
```

---

## ORM

### Models

```typescript
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  FileField,
  ForeignKey,
  ImageField,
  IntegerField,
  Manager,
  Model,
  OnDelete,
  TextField,
} from "@alexi/db";

export class ArticleModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  body = new TextField({ blank: true });
  published = new BooleanField({ default: false });
  cover = new ImageField({ uploadTo: "covers/", null: true, blank: true });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });
  author = new ForeignKey("UserModel", {
    onDelete: OnDelete.CASCADE,
    relatedName: "articles",
  });

  static objects = new Manager(ArticleModel);
  static meta = {
    dbTable: "articles",
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
| `JSONField`       | JSON value                            |
| `UUIDField`       | UUID string                           |
| `FileField`       | File upload path                      |
| `ImageField`      | Image upload path                     |
| `ForeignKey`      | Many-to-one relation                  |
| `OneToOneField`   | One-to-one relation                   |
| `ManyToManyField` | Many-to-many relation                 |

### QuerySet API

```typescript
// Retrieve
const articles = await ArticleModel.objects.all().fetch();
const article = await ArticleModel.objects.get({ id: 1 });
const first = await ArticleModel.objects.filter({ published: true }).first();
const count = await ArticleModel.objects.filter({ published: true }).count();

// Lookups
const recent = await ArticleModel.objects
  .filter({ createdAt__gte: new Date("2024-01-01") })
  .orderBy("-createdAt")
  .limit(10)
  .fetch();

// Create / update / delete
const article = await ArticleModel.objects.create({ title: "Hello" });
article.title.set("Hello World");
await article.save();
await article.save({ updateFields: ["title"] }); // PATCH in RestBackend
await article.delete();
await ArticleModel.objects.filter({ published: false }).delete();
```

Field values use `.get()` / `.set()`:

```typescript
const title = article.title.get();
article.title.set("New Title");
```

### Eager Loading

```typescript
// Single level
const articles = await ArticleModel.objects
  .selectRelated("author")
  .fetch();

// Nested (double-underscore syntax)
const articles = await ArticleModel.objects
  .selectRelated("author__organisation")
  .fetch();
```

### Reverse Relations

```typescript
// Declare on target model
class UserModel extends AbstractUser {
  declare articles: RelatedManager<ArticleModel>;
}

// ForeignKey on source model
author = new ForeignKey("UserModel", {
  onDelete: OnDelete.CASCADE,
  relatedName: "articles",
});

// Usage
const user = await UserModel.objects.get({ id: 1 });
const articles = await user.articles.all().fetch();
await user.articles.create({ title: "New" });
```

### Migrations

Alexi migrations are imperative TypeScript classes with explicit `forwards()`
and `backwards()` methods. Unlike Django's auto-generated declarative
operations, Alexi scaffolds a template and guides the developer to implement the
changes manually — ensuring every migration is fully understood and
intentionally rollbackable.

```bash
# Scaffold a new migration template (detects model changes as comments)
deno run -A --unstable-kv manage.ts makemigrations myapp --settings ./project/settings.ts

# Apply all pending migrations
deno run -A --unstable-kv manage.ts migrate --settings ./project/settings.ts

# Test reversibility: forwards → backwards → forwards
deno run -A --unstable-kv manage.ts migrate --test --settings ./project/settings.ts

# Roll back all migrations for an app
deno run -A --unstable-kv manage.ts migrate myapp zero --settings ./project/settings.ts
```

Migrations are stored in each app's `migrations/` directory. The ORM tracks
which have been applied via a `_migrations` table.

```typescript
// src/myapp/migrations/0001_create_articles.ts
import { Migration } from "@alexi/db/migrations";
import type { MigrationSchemaEditor } from "@alexi/db/migrations";
import { AutoField, BooleanField, CharField, Model } from "@alexi/db";

// Snapshot model — frozen at this migration's point in time
class ArticleModel extends Model {
  static meta = { dbTable: "articles" };
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  published = new BooleanField({ default: false });
}

export default class Migration0001 extends Migration {
  name = "0001_create_articles";
  dependencies = [];

  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.createModel(ArticleModel);
  }

  async backwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.deprecateModel(ArticleModel);
  }
}
```

Key design principles:

- **`backwards()` is required** (or the migration is explicitly non-reversible).
  Omit it only for data migrations that truly cannot be undone.
- **Snapshot models**: define a frozen copy of the model inside the migration
  file, not a reference to the live model class.
- **`deprecateModel`/`deprecateField`** instead of dropping: preserves data for
  potential recovery.
- **`--test` flag**: runs forwards → backwards → forwards to verify
  reversibility in CI.

### Database Backends

| Backend            | Import                         | Environment | Notes                          |
| ------------------ | ------------------------------ | ----------- | ------------------------------ |
| `DenoKVBackend`    | `@alexi/db/backends/denokv`    | Server      | Deno KV store                  |
| `SQLiteBackend`    | `@alexi/db/backends/sqlite`    | Server      | Requires `--unstable-ffi`      |
| `PostgresBackend`  | `@alexi/db/backends/postgres`  | Server      | PostgreSQL via connection pool |
| `IndexedDBBackend` | `@alexi/db/backends/indexeddb` | Browser     | Local browser storage          |
| `RestBackend`      | `@alexi/db/backends/rest`      | Browser     | Maps ORM calls to REST API     |

---

## REST Framework

### Serializers

```typescript
import {
  CharField,
  DateTimeField,
  IntegerField,
  ModelSerializer,
  PrimaryKeyRelatedField,
  Serializer,
  SerializerMethodField,
} from "@alexi/restframework";

export class ArticleSerializer extends ModelSerializer {
  static override Meta = {
    model: ArticleModel,
    fields: ["id", "title", "body", "published", "createdAt", "authorId"],
    readOnlyFields: ["id", "createdAt"],
  };
}

// With computed field
export class ArticleDetailSerializer extends ModelSerializer {
  authorName = new SerializerMethodField();

  static override Meta = {
    model: ArticleModel,
    fields: ["id", "title", "authorName"],
    readOnlyFields: ["id"],
  };

  async getAuthorName(instance: unknown): Promise<string | null> {
    const record = instance as Record<string, unknown>;
    const user = await UserModel.objects.filter({ id: record.authorId })
      .first();
    return user ? `${user.firstName.get()} ${user.lastName.get()}` : null;
  }
}
```

### ViewSets

```typescript
import { action, ModelViewSet, ViewSet } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";
import { JWTAuthentication } from "@alexi/restframework/authentication";
import {
  IsAuthenticated,
  IsAuthenticatedOrReadOnly,
} from "@alexi/restframework";

export class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;
  authentication_classes = [JWTAuthentication];
  permission_classes = [IsAuthenticatedOrReadOnly];

  override getQueryset(context: ViewSetContext) {
    return ArticleModel.objects.filter({ published: true });
  }

  @action({ detail: true, methods: ["POST"] })
  async publish(context: ViewSetContext): Promise<Response> {
    const article = await this.getObject(context);
    article.published.set(true);
    await article.save({ updateFields: ["published"] });
    return Response.json({ status: "published" });
  }
}
```

### Router

```typescript
import { DefaultRouter } from "@alexi/restframework";

const router = new DefaultRouter();
router.register("articles", ArticleViewSet);

export const urlpatterns = router.urls;
```

### Permissions

```typescript
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
import type { ViewSetContext } from "@alexi/restframework";

class IsOwnerOrReadOnly extends BasePermission {
  override message = "You must be the owner to modify this object.";

  hasPermission(context: ViewSetContext): boolean {
    if (["GET", "HEAD", "OPTIONS"].includes(context.request.method)) {
      return true;
    }
    return context.user != null;
  }

  override hasObjectPermission(context: ViewSetContext, obj: unknown): boolean {
    if (["GET", "HEAD", "OPTIONS"].includes(context.request.method)) {
      return true;
    }
    const record = obj as { authorId?: number };
    return record.authorId === context.user?.id;
  }
}

// Composed permissions
permission_classes = [And.of(IsAuthenticated, IsAdminUser)];
permission_classes = [Or.of(IsAdminUser, IsOwnerOrReadOnly)];
permission_classes = [Not.of(IsAdminUser)];
```

#### Built-in Permission Classes

| Class                       | Description                          |
| --------------------------- | ------------------------------------ |
| `AllowAny`                  | Allow all access                     |
| `DenyAll`                   | Deny all access                      |
| `IsAuthenticated`           | Require authenticated user           |
| `IsAdminUser`               | Require `isAdmin: true`              |
| `IsAuthenticatedOrReadOnly` | Read for anyone, write requires auth |

### Authentication

`authentication_classes` populates `context.user` before permission checks.
Authenticators are tried in order; the first non-null result wins.

```typescript
import {
  BaseAuthentication,
  JWTAuthentication,
} from "@alexi/restframework/authentication";
import type { AuthenticatedUser } from "@alexi/restframework/authentication";

// Custom authenticator
class ApiKeyAuthentication extends BaseAuthentication {
  async authenticate(
    context: ViewSetContext,
  ): Promise<AuthenticatedUser | null> {
    const key = context.request.headers.get("X-Api-Key");
    if (!key) return null;
    const user = await UserModel.objects.filter({ apiKey: key }).first();
    if (!user) return null;
    return {
      id: user.id.get(),
      email: user.email.get(),
      isAdmin: user.isAdmin.get(),
    };
  }
}
```

`AuthenticatedUser` type:

```typescript
type AuthenticatedUser = {
  id: number | string;
  email?: string;
  isAdmin?: boolean;
};
```

`JWTAuthentication` reads `Authorization: Bearer <token>`. Supports HS256
(secret from `SECRET_KEY`) and unsigned tokens (when `SECRET_KEY` is not set).

### Pagination

```typescript
import {
  LimitOffsetPagination,
  PageNumberPagination,
} from "@alexi/restframework";

class StandardPagination extends PageNumberPagination {
  pageSize = 25;
  maxPageSize = 100;
}

class ArticleViewSet extends ModelViewSet {
  pagination_class = StandardPagination;
}
```

Response format:

```json
{ "count": 100, "next": "...?page=2", "previous": null, "results": [] }
```

| Class                   | Query Params        |
| ----------------------- | ------------------- |
| `PageNumberPagination`  | `?page=N`           |
| `LimitOffsetPagination` | `?limit=N&offset=M` |
| `CursorPagination`      | `?cursor=<token>`   |

### Content Negotiation

```typescript
import {
  BrowsableAPIRenderer,
  JSONRenderer,
  XMLRenderer,
} from "@alexi/restframework";

class ArticleViewSet extends ModelViewSet {
  renderer_classes = [JSONRenderer, BrowsableAPIRenderer];
}
```

`BrowsableAPIRenderer` serves an interactive HTML API browser when the request
`Accept` header is `text/html`.

### Versioning

```typescript
import { URLPathVersioning } from "@alexi/restframework";

class ArticleViewSet extends ModelViewSet {
  versioning_class = URLPathVersioning;
  versioning_config = { defaultVersion: "v1", allowedVersions: ["v1", "v2"] };
}
// URL: path("api/:version/", include(router.urls))
```

| Class                      | Source                  |
| -------------------------- | ----------------------- |
| `URLPathVersioning`        | `:version` URL param    |
| `QueryParameterVersioning` | `?version=` query param |
| `AcceptHeaderVersioning`   | `Accept: ...; version=` |

### Throttling

```typescript
import { AnonRateThrottle, UserRateThrottle } from "@alexi/restframework";

class ArticleViewSet extends ModelViewSet {
  throttle_classes = [AnonRateThrottle, UserRateThrottle];
  throttle_rates = { anon: "100/day", user: "1000/day" };
}
```

Rate format: `"N/second"`, `"N/minute"`, `"N/hour"`, `"N/day"`.

---

## Views & Templates

### Class-Based Views

```typescript
import {
  DetailView,
  ListView,
  RedirectView,
  TemplateView,
  View,
} from "@alexi/views";

// Function-based equivalent
export const homeView = templateView({
  templateName: "myapp/home.html",
  context: async (request, params) => ({ title: "Home" }),
});

// Class-based
class ArticleListView extends ListView<typeof ArticleModel.prototype> {
  model = ArticleModel;
  templateName = "myapp/article_list.html";
  paginateBy = 20;
}

class ArticleDetailView extends DetailView<typeof ArticleModel.prototype> {
  model = ArticleModel;
  templateName = "myapp/article_detail.html";
}

// urls.ts
path("articles/", ArticleListView.as_view());
path("articles/:id/", ArticleDetailView.as_view());
```

### Template Engine

| Syntax                                                 | Description          |
| ------------------------------------------------------ | -------------------- |
| `{{ variable }}` / `{{ obj.field }}`                   | Output variable      |
| `{% extends "base.html" %}`                            | Template inheritance |
| `{% block name %}…{% endblock %}`                      | Block definition     |
| `{% for item in items %}…{% empty %}…{% endfor %}`     | Iteration            |
| `{% if cond %}…{% elif cond %}…{% else %}…{% endif %}` | Conditional          |
| `{% include "partial.html" %}`                         | Include sub-template |
| `{# comment #}`                                        | Comment              |

Templates are discovered from each app's `<appPath>/templates/` directory.

---

## URL Routing

```typescript
import { include, path } from "@alexi/urls";

export const urlpatterns = [
  path("health/", healthView, { name: "health" }),
  path("articles/:id/", articleDetailView, { name: "article-detail" }),
  path("api/v1/", include(router.urls)),
];
```

---

## Middleware

All middleware are classes extending `BaseMiddleware`. Django convention:
outermost middleware runs first.

```typescript
import {
  AllowAllOriginsCorsMiddleware,
  BaseMiddleware,
  CorsMiddleware,
  ErrorHandlerMiddleware,
  LoggingMiddleware,
} from "@alexi/middleware";

// Custom middleware
class MaintenanceModeMiddleware extends BaseMiddleware {
  async call(request: Request): Promise<Response> {
    if (Deno.env.get("MAINTENANCE") === "true") {
      return new Response("Down for maintenance", { status: 503 });
    }
    return this.getResponse(request);
  }
}
```

`CorsMiddleware` is a class. Configure it via settings:

```typescript
export const CORS_ALLOWED_ORIGINS = ["https://app.example.com"];
```

---

## Authentication (`@alexi/auth`)

### AbstractUser

```typescript
import { AbstractUser } from "@alexi/auth";
import { Manager } from "@alexi/db";

export class UserModel extends AbstractUser {
  // Inherited: id, email, password (PBKDF2), firstName, lastName,
  //            isAdmin, isActive, dateJoined, lastLogin
  declare articles: RelatedManager<ArticleModel>;

  static objects = new Manager(UserModel);
  static meta = { dbTable: "users" };
}

// Password hashing
const hash = await UserModel.hashPassword("secret");
const valid = await user.verifyPassword("secret"); // true | false
```

### View Decorators

```typescript
import { getRequestUser, loginRequired, permissionRequired } from "@alexi/auth";

path("profile/", loginRequired(profileView));
path("dashboard/", permissionRequired("admin", adminView));

// Access user inside a decorated view
const profileView = loginRequired(async (request, params) => {
  const user = getRequestUser(request);
  return Response.json({ id: user.id, email: user.email });
});
```

### JWT Tokens

```typescript
import { createTokenPair, verifyToken } from "@alexi/auth";

const tokens = await createTokenPair(userId, email, isAdmin);
// → { accessToken, refreshToken, expiresAt }

const payload = await verifyToken(accessToken);
// → { id, email, isAdmin, exp, iat }
```

---

## Admin Panel

```typescript
import { AdminRouter, AdminSite, ModelAdmin, register } from "@alexi/admin";

const adminSite = new AdminSite({ title: "My App", urlPrefix: "/admin" });

@register(ArticleModel, adminSite)
class ArticleAdmin extends ModelAdmin {
  listDisplay = ["id", "title", "published", "createdAt"];
  searchFields = ["title"];
  listFilter = ["published"];
  ordering = ["-createdAt"];
}

// Mount in your URL conf
const adminRouter = new AdminRouter(adminSite, backend);
path("admin/", (req, params) => adminRouter.handle(req));
```

Admin requires a JWT with `isAdmin: true`.

---

## File Storage

```typescript
import { getStorage, setStorage } from "@alexi/storage";
import { FirebaseStorage } from "@alexi/storage/backends/firebase";
import { MemoryStorage } from "@alexi/storage/backends/memory";

setStorage(
  new FirebaseStorage({
    bucket: "my-project.appspot.com",
    basePath: "uploads/",
    getAuthToken: async () =>
      await firebase.auth().currentUser?.getIdToken() ?? "",
  }),
);

const storage = getStorage();
const name = await storage.save("avatars/photo.jpg", file);
const url = await storage.url(name);
```

| Method                     | Description                   |
| -------------------------- | ----------------------------- |
| `save(name, content)`      | Save file, returns final name |
| `open(name)`               | ReadableStream                |
| `delete(name)`             | Delete file                   |
| `exists(name)`             | Boolean                       |
| `url(name)`                | Public URL                    |
| `signedUrl(name, options)` | Temporary signed URL          |

---

## Static Files & Bundling

```typescript
// settings.ts
export const STATICFILES_DIRS = [
  {
    path: "./src/my-app",
    outputDir: "./src/my-app/static/my-app",
    entrypoints: ["worker.ts", "document.ts"],
    // Content-hash fingerprinting for non-SW entries:
    options: { entryNames: "[name]-[hash]" },
  },
];
```

`collectstatic` copies files to `STATIC_ROOT`. `bundle` compiles TypeScript
entry points via esbuild. Service Worker filenames (`*worker*.js`, `sw.js`)
never receive a hash so their registration URL stays stable.

A `staticfiles.json` manifest is written to each `outputDir` mapping logical
names to hashed filenames.

---

## Testing

```typescript
import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { reset, setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";

Deno.test("ArticleModel: create and retrieve", async () => {
  const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
  await backend.connect();
  await setup({ backend });

  try {
    const article = await ArticleModel.objects.create({ title: "Test" });
    assertExists(article.id.get());
    assertEquals(article.title.get(), "Test");
  } finally {
    await reset();
    await backend.disconnect();
  }
});
```

```bash
deno task test
deno test -A --unstable-kv src/db/models/model_test.ts
```

---

## Key Rules

1. **File naming**: lowercase snake_case everywhere (`model_viewset.ts`).
2. **Field access**: always use `.get()` / `.set()` on model field instances.
3. **QuerySet is lazy**: call `.fetch()`, `.first()`, or `.count()` to execute.
4. **Migrations required**: run `makemigrations` + `migrate` after model changes
   (SQL backends). DenoKV and IndexedDB are schemaless.
5. **No `@alexi/web`**: `runserver` lives in `@alexi/core/management`. Entry
   point is `http.ts` using `getHttpApplication()`.
6. **Import function in settings**: `ROOT_URLCONF` uses `() => import(...)` so
   the project's import map is in scope. `INSTALLED_APPS` uses direct class
   references imported at the top of `settings.ts`.
7. **Layer discipline**: never import upward in the layer hierarchy.
8. **`context.user.id`**: the `AuthenticatedUser` type exposes `id`, `email`,
   and `isAdmin` — no other fields unless you extend it.
