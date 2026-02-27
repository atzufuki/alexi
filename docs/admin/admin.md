# Admin Panel

Alexi provides a Django-inspired admin interface for managing your models
through a web UI.

## Overview

The admin panel is a server-side rendered **Multi-Page Application (MPA)** that
uses [HTMX](https://htmx.org) for smooth navigation without a full page reload.
Authentication uses JWT tokens stored in `localStorage`.

Features:

- Auto-generated CRUD interfaces for all registered models
- List views with search, filtering, sorting, and pagination
- Add and edit forms with server-side validation
- Delete confirmation pages
- Bulk actions (delete selected, custom actions)
- JWT-based login/logout
- Django Admin-style look and feel

## Architecture

```
Browser                    Server
──────                    ──────
<body hx-boost="true">  ←→  AdminRouter.handle(request)
admin.js injects JWT        views/ SSR HTML responses
localStorage token          JWT verified on every request
```

All links inside the admin are automatically turned into HTMX requests by
`hx-boost`. The small `admin.js` script (~30 lines) intercepts every outgoing
HTMX request and injects the `Authorization: Bearer <token>` header from
`localStorage`.

### URL Routes

| URL                           | Method | Description                           |
| ----------------------------- | ------ | ------------------------------------- |
| `/admin/`                     | GET    | Dashboard — list of registered models |
| `/admin/login/`               | GET    | Login page                            |
| `/admin/login/`               | POST   | Authenticate and receive JWT          |
| `/admin/logout/`              | GET    | Clear token and redirect to login     |
| `/admin/:model/`              | GET    | Change list (object list)             |
| `/admin/:model/`              | POST   | Bulk action (e.g. delete selected)    |
| `/admin/:model/add/`          | GET    | Add object form                       |
| `/admin/:model/add/`          | POST   | Create new object                     |
| `/admin/:model/:id/`          | GET    | Edit object form                      |
| `/admin/:model/:id/`          | POST   | Save changes to object                |
| `/admin/:model/:id/delete/`   | GET    | Delete confirmation                   |
| `/admin/:model/:id/delete/`   | POST   | Confirm and delete object             |
| `/admin/static/css/admin.css` | GET    | Admin stylesheet                      |
| `/admin/static/js/admin.js`   | GET    | HTMX auth header injection            |

## Quick Start

### 1. Create an Admin Site

```typescript
// admin.ts
import { AdminSite } from "@alexi/admin";

const adminSite = new AdminSite({
  title: "My App Admin",
  header: "My App Administration",
});

export { adminSite };
```

### 2. Register Models

```typescript
// admin.ts
import { AdminSite, ModelAdmin } from "@alexi/admin";
import { ArticleModel, UserModel } from "./models.ts";

const adminSite = new AdminSite({ title: "My App Admin" });

// Simple registration with defaults
adminSite.register(ArticleModel);

// Custom ModelAdmin
class UserAdmin extends ModelAdmin {
  listDisplay = ["id", "email", "firstName", "isActive"];
  searchFields = ["email", "firstName", "lastName"];
  listFilter = ["isActive"];
  ordering = ["-dateJoined"];
}

adminSite.register(UserModel, UserAdmin);

export { adminSite };
```

### 3. Wire into Your Application

Use `AdminRouter` to handle all admin requests. Pass your database backend and
settings so the views can authenticate users and query models:

```typescript
// urls.ts
import { path } from "@alexi/urls";
import { AdminRouter } from "@alexi/admin";
import { adminSite } from "./admin.ts";
import { backend } from "./db.ts";
import * as settings from "./settings.ts";

const adminRouter = new AdminRouter(adminSite, backend, settings);

export const urlpatterns = [
  path("admin/*", (request) => adminRouter.handle(request)),
  // ... other routes
];
```

Alternatively, use `getAdminUrls()` to get the raw URL patterns and integrate
them into an existing routing setup:

```typescript
import { getAdminUrls } from "@alexi/admin";

const adminUrls = getAdminUrls(adminSite, backend, settings);
// adminUrls is AdminUrlPattern[] — each has .match(), .extractParams(), .handler
```

### 4. Settings Requirements

The admin reads the following from your settings object:

| Setting      | Description                                                                            |
| ------------ | -------------------------------------------------------------------------------------- |
| `SECRET_KEY` | Used to verify JWT tokens (HS256). If absent, unsigned tokens are accepted (dev only). |

## AdminSite Configuration

```typescript
import { AdminSite } from "@alexi/admin";

const adminSite = new AdminSite({
  title: "My App Admin", // Browser tab title
  header: "My App", // Header text shown in UI
  urlPrefix: "/admin", // URL prefix for all admin routes
});
```

### AdminSite Options

| Option        | Type       | Default            | Description                         |
| ------------- | ---------- | ------------------ | ----------------------------------- |
| `title`       | `string`   | `"Admin"`          | Site title in browser tab           |
| `header`      | `string`   | `"Administration"` | Header text displayed in the UI     |
| `urlPrefix`   | `string`   | `"/admin"`         | URL prefix for all admin routes     |
| `siteClasses` | `string[]` | `[]`               | Additional CSS classes for the site |

### AdminSite Methods

| Method                         | Description                                             |
| ------------------------------ | ------------------------------------------------------- |
| `register(model, adminClass?)` | Register a model with an optional ModelAdmin class      |
| `unregister(model)`            | Remove a model from the registry                        |
| `isRegistered(model)`          | Check if a model is registered                          |
| `getModelAdmin(model)`         | Get the ModelAdmin instance for a model                 |
| `getModelAdminByName(name)`    | Get ModelAdmin by lowercase model name string           |
| `getRegisteredModels()`        | Get all registered model classes                        |
| `getModelAdmins()`             | Get all ModelAdmin instances                            |
| `reverse(name, params?)`       | Resolve a named URL (e.g. `"admin:article_changelist"`) |
| `getAppList()`                 | Get models grouped for the dashboard                    |

## ModelAdmin

`ModelAdmin` controls how a model appears in the admin interface.

### Basic Configuration

```typescript
import { ModelAdmin } from "@alexi/admin";

class ArticleAdmin extends ModelAdmin {
  // Columns in list view
  listDisplay = ["id", "title", "status", "createdAt"];

  // Searchable fields
  searchFields = ["title", "body"];

  // Filter sidebar
  listFilter = ["status", "category"];

  // Default ordering
  ordering = ["-createdAt"];

  // Items per page
  listPerPage = 25;
}
```

### ModelAdmin Options

#### List View Options

| Option              | Type       | Default       | Description                                |
| ------------------- | ---------- | ------------- | ------------------------------------------ |
| `listDisplay`       | `string[]` | `[]`          | Columns to display (empty = all fields)    |
| `listDisplayLinks`  | `string[]` | `[]`          | Columns that link to the detail view       |
| `searchFields`      | `string[]` | `[]`          | Fields searchable via the search box       |
| `searchPlaceholder` | `string`   | `"Search..."` | Placeholder text for the search input      |
| `listFilter`        | `string[]` | `[]`          | Fields for the filter sidebar              |
| `ordering`          | `string[]` | `[]`          | Default ordering (`-field` for descending) |
| `listPerPage`       | `number`   | `100`         | Items per page                             |
| `listMaxShowAll`    | `number`   | `200`         | Max items when showing all                 |
| `dateHierarchy`     | `string`   | `""`          | Date field for date navigation             |
| `emptyValueDisplay` | `string`   | `"-"`         | Displayed for empty/null values            |

#### Form Options

| Option           | Type         | Default | Description                                       |
| ---------------- | ------------ | ------- | ------------------------------------------------- |
| `fields`         | `string[]`   | `[]`    | Fields in edit form (empty = all editable fields) |
| `readonlyFields` | `string[]`   | `[]`    | Fields displayed but not editable                 |
| `fieldsets`      | `Fieldset[]` | `[]`    | Group fields into sections                        |
| `saveAsNew`      | `boolean`    | `false` | Show "save as new" button                         |
| `saveContinue`   | `boolean`    | `true`  | Show "save and continue editing" button           |

#### Action Options

| Option    | Type       | Default               | Description            |
| --------- | ---------- | --------------------- | ---------------------- |
| `actions` | `string[]` | `["delete_selected"]` | Available bulk actions |

### List Display

Control which columns appear in the list view:

```typescript
class ArticleAdmin extends ModelAdmin {
  listDisplay = ["id", "title", "author", "status", "createdAt"];
  listDisplayLinks = ["title"]; // "title" column links to the edit page
}
```

### Search Fields

Enable search functionality:

```typescript
class ArticleAdmin extends ModelAdmin {
  searchFields = ["title", "body"];
  searchPlaceholder = "Search articles...";
}
```

Search uses `icontains` OR logic across all `searchFields`.

### List Filters

Add filter options in the sidebar:

```typescript
class ArticleAdmin extends ModelAdmin {
  listFilter = ["status", "category", "isPublished"];
}
```

Supported filter types:

- `BooleanField` → coerced to `true`/`false`
- `DateTimeField` / `DateField` → `__gte` / `__lte` range lookups
- Other fields → exact match

### Ordering

Set default ordering:

```typescript
class ArticleAdmin extends ModelAdmin {
  ordering = ["-createdAt", "title"];
}
```

Users can also click column headers to sort interactively.

### Fieldsets

Group fields into sections on the edit form:

```typescript
class ArticleAdmin extends ModelAdmin {
  fieldsets = [
    {
      name: "Basic Information",
      fields: ["title", "slug", "category"],
    },
    {
      name: "Content",
      fields: ["body", "excerpt"],
      classes: ["wide"],
    },
    {
      name: "Publishing",
      fields: ["status", "publishedAt", "author"],
      collapsed: true, // Collapsed by default
    },
  ];
}
```

### Read-Only Fields

Display fields that cannot be edited:

```typescript
class ArticleAdmin extends ModelAdmin {
  readonlyFields = ["id", "createdAt", "updatedAt"];
}
```

### Custom Actions

Add bulk actions for the list view:

```typescript
class ArticleAdmin extends ModelAdmin {
  actions = ["delete_selected", "publish_selected", "archive_selected"];

  async publishSelected(
    ids: unknown[],
    backend: DatabaseBackend,
  ): Promise<number> {
    // Return the number of affected objects
    const qs = ArticleModel.objects.using(backend).filter({ id__in: ids });
    const articles = await qs.fetch();
    for (const a of articles.array() as ArticleModel[]) {
      a.status.set("published");
      await a.save();
    }
    return articles.array().length;
  }
}
```

The built-in `delete_selected` action is always available.

## Registration Methods

### Direct Registration

```typescript
adminSite.register(ArticleModel, ArticleAdmin);
```

### Decorator Registration

```typescript
import { register } from "@alexi/admin";

@register(ArticleModel, adminSite)
class ArticleAdmin extends ModelAdmin {
  listDisplay = ["title", "status"];
}
```

### Simple Registration (default ModelAdmin)

```typescript
adminSite.register(ArticleModel);
```

## AdminRouter

`AdminRouter` is the HTTP request handler for the admin. It matches incoming
requests against registered URL patterns and dispatches to the correct view.

```typescript
import { AdminRouter } from "@alexi/admin";

const router = new AdminRouter(adminSite, backend, settings);

// Handle a request (returns Promise<Response>)
const response = await router.handle(request);

// Resolve a named URL
const url = router.reverse("admin:article_changelist");
// → "/admin/article/"

const editUrl = router.reverse("admin:article_change", { id: "42" });
// → "/admin/article/42/"

// Get all registered URL patterns
const patterns = router.getPatterns();
```

### AdminRouter Constructor

```typescript
new AdminRouter(
  site: AdminSite,
  backend?: DatabaseBackend,  // Required for real SSR views
  settings?: Record<string, unknown>,  // Needed for SECRET_KEY
)
```

When `backend` is omitted, all routes return placeholder JSON responses (useful
for testing URL generation without a database).

## ModelAdmin Methods

These methods are called internally by the views but can be overridden for
custom behaviour.

### Queryset Methods

```typescript
class ArticleAdmin extends ModelAdmin {
  // Override base queryset — only show non-deleted articles
  override getQueryset() {
    return ArticleModel.objects.filter({ isDeleted: false });
  }
}
```

| Method                             | Description                                                            |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `getQueryset()`                    | Base queryset for the list view. Override to restrict visible objects. |
| `getSearchResults(qs, query)`      | Apply `icontains` OR search across `searchFields`.                     |
| `getFilteredQueryset(qs, params)`  | Apply sidebar filter params from URL search params.                    |
| `getOrderedQueryset(qs, ordering)` | Apply ordering (from URL param or `this.ordering`).                    |
| `paginate(qs, page, pageSize?)`    | Paginate queryset; returns `PaginationResult`.                         |

### PaginationResult

```typescript
interface PaginationResult<T extends Model> {
  objects: T[]; // Current page objects
  totalCount: number; // Total matching objects
  currentPage: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}
```

### Form Validation

```typescript
class ArticleAdmin extends ModelAdmin {
  override validateForm(
    data: Record<string, unknown>,
  ): { valid: boolean; errors: Record<string, string[]> } {
    // Call base validation first (required fields, maxLength, type checks)
    const result = super.validateForm(data);

    // Add custom rules
    if (data.status === "published" && !data.publishedAt) {
      result.errors.publishedAt = [
        "Published articles must have a publish date.",
      ];
      result.valid = false;
    }

    return result;
  }
}
```

Built-in validation checks:

- Required fields (not blank, no default)
- `CharField`: `maxLength`
- `IntegerField`: must be a whole number
- `FloatField` / `DecimalField`: must be a number
- `DateField` / `DateTimeField`: must be a valid date

### Permission Methods

Override to restrict access per-model or per-object:

```typescript
class ArticleAdmin extends ModelAdmin {
  override hasViewPermission(_request?: unknown, _obj?: Model): boolean {
    return true; // Default: allow all authenticated admins
  }

  override hasAddPermission(_request?: unknown): boolean {
    return true;
  }

  override hasChangePermission(_request?: unknown, _obj?: Model): boolean {
    return true;
  }

  override hasDeletePermission(_request?: unknown, _obj?: Model): boolean {
    return true;
  }
}
```

> **Note:** All admin views require a valid admin JWT (`isAdmin: true`). The
> permission methods above provide additional object-level control on top of
> authentication.

## Authentication

The admin uses JWT tokens. The login flow:

1. User submits the login form (`POST /admin/login/`)
2. Server validates credentials against the `AUTH_USER_MODEL` (or the built-in
   `@alexi/auth` user model)
3. On success, returns an HTML page that stores the JWT in `localStorage` and
   redirects to `/admin/`
4. `admin.js` intercepts every subsequent HTMX request and adds
   `Authorization: Bearer <token>`
5. Every view calls `verifyAdminToken(request, settings)` to authenticate

The JWT payload must contain `{ userId, email, isAdmin: true }`. Tokens are
verified with `SECRET_KEY` (HS256) when set, or accepted unsigned in development
when `SECRET_KEY` is absent.

## Permissions

The admin requires `isAdmin: true` in the JWT for all routes. You cannot access
any admin page without a valid admin token.

Model-level and object-level permissions are controlled by overriding
`hasViewPermission`, `hasAddPermission`, `hasChangePermission`, and
`hasDeletePermission` on `ModelAdmin`.

## URL Reversal

Use `adminSite.reverse()` or `adminRouter.reverse()` to generate admin URLs:

```typescript
// Dashboard
adminSite.reverse("admin:index");
// → "/admin/"

// Change list
adminSite.reverse("admin:article_changelist");
// → "/admin/article/"

// Add form
adminSite.reverse("admin:article_add");
// → "/admin/article/add/"

// Edit form
adminSite.reverse("admin:article_change", { id: "42" });
// → "/admin/article/42/"

// Delete confirmation
adminSite.reverse("admin:article_delete", { id: "42" });
// → "/admin/article/42/delete/"
```

URL name format: `"admin:<modelname>_<action>"` where `<modelname>` is the
lowercase model class name.

## Full Example

```typescript
// admin.ts
import { AdminSite, ModelAdmin, register } from "@alexi/admin";
import { ArticleModel, CategoryModel, UserModel } from "./models.ts";

const adminSite = new AdminSite({
  title: "Blog Admin",
  header: "Blog Administration",
});

// Simple registration
adminSite.register(CategoryModel);

// Detailed registration
class UserAdmin extends ModelAdmin {
  listDisplay = [
    "id",
    "email",
    "firstName",
    "lastName",
    "isActive",
    "dateJoined",
  ];
  searchFields = ["email", "firstName", "lastName"];
  listFilter = ["isActive", "isStaff"];
  ordering = ["-dateJoined"];
  readonlyFields = ["id", "dateJoined", "lastLogin"];

  fieldsets = [
    {
      name: "Account",
      fields: ["email", "isActive"],
    },
    {
      name: "Personal Info",
      fields: ["firstName", "lastName"],
    },
    {
      name: "Permissions",
      fields: ["isStaff", "isAdmin"],
      collapsed: true,
    },
  ];
}

adminSite.register(UserModel, UserAdmin);

@register(ArticleModel, adminSite)
class ArticleAdmin extends ModelAdmin {
  listDisplay = ["id", "title", "author", "status", "publishedAt", "createdAt"];
  listDisplayLinks = ["title"];
  searchFields = ["title", "body", "excerpt"];
  listFilter = ["status", "category"];
  ordering = ["-createdAt"];
  listPerPage = 20;

  fieldsets = [
    {
      name: null,
      fields: ["title", "slug"],
    },
    {
      name: "Content",
      fields: ["body", "excerpt"],
      classes: ["wide"],
    },
    {
      name: "Publishing",
      fields: ["status", "publishedAt", "author"],
    },
  ];

  readonlyFields = ["slug", "createdAt", "updatedAt"];
  actions = ["delete_selected", "publish_selected"];

  async publishSelected(
    ids: unknown[],
    backend: DatabaseBackend,
  ): Promise<number> {
    const articles = await ArticleModel.objects
      .using(backend)
      .filter({ id__in: ids })
      .fetch();
    for (const a of articles.array() as ArticleModel[]) {
      a.status.set("published");
      await a.save();
    }
    return articles.array().length;
  }
}

export { adminSite };
```

```typescript
// urls.ts
import { path } from "@alexi/urls";
import { AdminRouter } from "@alexi/admin";
import { adminSite } from "./admin.ts";
import { backend } from "./db.ts";
import * as settings from "./settings.ts";

const adminRouter = new AdminRouter(adminSite, backend, settings);

export const urlpatterns = [
  path("admin/*", (request) => adminRouter.handle(request)),
];
```

## Best Practices

1. **Use `listDisplay`** — Always specify columns explicitly; the default shows
   all fields which can be overwhelming for wide models.

2. **Add `searchFields`** — Enable search for models with many records.

3. **Set `ordering`** — Use sensible defaults (usually `["-createdAt"]`).

4. **Group with `fieldsets`** — Organize complex forms into logical sections.

5. **Keep `listPerPage` reasonable** — 20–50 is a good range for performance.

6. **Use `readonlyFields`** — Protect auto-generated values like `id`,
   `createdAt`, `updatedAt`.

7. **Override `validateForm`** — Call `super.validateForm(data)` first, then add
   your business rules.

8. **Set `SECRET_KEY`** — Always set `SECRET_KEY` in production so JWT tokens
   are cryptographically signed (HS256).
