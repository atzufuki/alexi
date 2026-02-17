# Admin Panel

Alexi provides a Django-inspired admin interface for managing your models
through a web UI.

## Overview

The admin panel provides:

- Auto-generated CRUD interfaces for models
- List views with search, filtering, and pagination
- Detail/edit forms with validation
- Bulk actions
- Customizable display and behavior

## Quick Start

### 1. Create an Admin Site

```typescript
import { AdminSite } from "@alexi/admin";

const adminSite = new AdminSite({
  title: "My App Admin",
  urlPrefix: "/admin",
});

export { adminSite };
```

### 2. Register Models

```typescript
import { ModelAdmin, register } from "@alexi/admin";
import { adminSite } from "./admin.ts";
import { ArticleModel, UserModel } from "./models.ts";

// Basic registration
adminSite.register(ArticleModel);

// With custom ModelAdmin
class UserAdmin extends ModelAdmin {
  listDisplay = ["id", "email", "firstName", "isActive"];
  searchFields = ["email", "firstName", "lastName"];
  listFilter = ["isActive"];
}

adminSite.register(UserModel, UserAdmin);
```

### 3. Add Admin URLs

```typescript
import { include, path } from "@alexi/urls";
import { getAdminUrls } from "@alexi/admin";
import { adminSite } from "./admin.ts";

const urlpatterns = [
  path("admin/", include(getAdminUrls(adminSite))),
  // ... other routes
];
```

## AdminSite Configuration

```typescript
import { AdminSite } from "@alexi/admin";

const adminSite = new AdminSite({
  title: "My App Admin", // Site title
  urlPrefix: "/admin", // URL prefix for admin routes
  siteHeader: "My App", // Header text
  indexTitle: "Site Administration", // Index page title
});
```

### AdminSite Options

| Option       | Type     | Default                 | Description                     |
| ------------ | -------- | ----------------------- | ------------------------------- |
| `title`      | `string` | `"Admin"`               | Site title in browser tab       |
| `urlPrefix`  | `string` | `"/admin"`              | URL prefix for all admin routes |
| `siteHeader` | `string` | `"Admin"`               | Header text displayed in UI     |
| `indexTitle` | `string` | `"Site Administration"` | Index page title                |

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

| Option             | Type       | Default | Description                                |
| ------------------ | ---------- | ------- | ------------------------------------------ |
| `listDisplay`      | `string[]` | `[]`    | Columns to display (empty = all fields)    |
| `listDisplayLinks` | `string[]` | `[]`    | Columns that link to detail view           |
| `searchFields`     | `string[]` | `[]`    | Fields searchable via search box           |
| `listFilter`       | `string[]` | `[]`    | Fields for filter sidebar                  |
| `ordering`         | `string[]` | `[]`    | Default ordering (`-field` for descending) |
| `listPerPage`      | `number`   | `100`   | Items per page                             |
| `dateHierarchy`    | `string`   | `""`    | Date field for date navigation             |

#### Form Options

| Option           | Type         | Default | Description                       |
| ---------------- | ------------ | ------- | --------------------------------- |
| `fields`         | `string[]`   | `[]`    | Fields in edit form (empty = all) |
| `readonlyFields` | `string[]`   | `[]`    | Fields displayed but not editable |
| `fieldsets`      | `Fieldset[]` | `[]`    | Group fields into sections        |

#### Action Options

| Option    | Type       | Default               | Description            |
| --------- | ---------- | --------------------- | ---------------------- |
| `actions` | `string[]` | `["delete_selected"]` | Available bulk actions |

### List Display

Control which columns appear in the list view:

```typescript
class ArticleAdmin extends ModelAdmin {
  // Show specific fields
  listDisplay = ["id", "title", "author", "status", "createdAt"];
}
```

### Search Fields

Enable search functionality:

```typescript
class ArticleAdmin extends ModelAdmin {
  // Users can search by title or body content
  searchFields = ["title", "body"];

  // Custom placeholder
  searchPlaceholder = "Search articles...";
}
```

### List Filters

Add filter options in the sidebar:

```typescript
class ArticleAdmin extends ModelAdmin {
  // Filter by these fields
  listFilter = ["status", "category", "isPublished"];
}
```

Supported filter types:

- Boolean fields → checkbox
- Choice fields → dropdown
- Foreign keys → related object dropdown
- Date fields → date range picker

### Ordering

Set default ordering:

```typescript
class ArticleAdmin extends ModelAdmin {
  // Order by createdAt descending, then title ascending
  ordering = ["-createdAt", "title"];
}
```

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

Display fields that can't be edited:

```typescript
class ArticleAdmin extends ModelAdmin {
  readonlyFields = ["id", "createdAt", "updatedAt", "createdBy"];
}
```

### Custom Actions

Add bulk actions for list view:

```typescript
class ArticleAdmin extends ModelAdmin {
  actions = ["delete_selected", "publish_selected", "archive_selected"];

  async publishSelected(
    request: unknown,
    queryset: unknown,
  ): Promise<ActionResult> {
    // Publish all selected articles
    const count = await queryset.update({ status: "published" });
    return {
      count,
      message: `Successfully published ${count} articles.`,
    };
  }

  async archiveSelected(
    request: unknown,
    queryset: unknown,
  ): Promise<ActionResult> {
    const count = await queryset.update({ status: "archived" });
    return {
      count,
      message: `Successfully archived ${count} articles.`,
    };
  }
}
```

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

### Simple Registration

Register with default ModelAdmin:

```typescript
adminSite.register(ArticleModel);
```

## Permissions

Override permission methods for access control:

```typescript
class ArticleAdmin extends ModelAdmin {
  // Only staff can view
  hasViewPermission(request?: unknown, obj?: Model): boolean {
    const user = getUserFromRequest(request);
    return user?.isStaff ?? false;
  }

  // Only superusers can add
  hasAddPermission(request?: unknown): boolean {
    const user = getUserFromRequest(request);
    return user?.isSuperuser ?? false;
  }

  // Authors can edit their own articles
  hasChangePermission(request?: unknown, obj?: Model): boolean {
    const user = getUserFromRequest(request);
    if (user?.isSuperuser) return true;
    if (obj) {
      return obj.authorId.get() === user?.id;
    }
    return user?.isStaff ?? false;
  }

  // Only superusers can delete
  hasDeletePermission(request?: unknown, obj?: Model): boolean {
    const user = getUserFromRequest(request);
    return user?.isSuperuser ?? false;
  }
}
```

## Custom Querysets

Override `getQueryset()` to filter what objects are shown:

```typescript
class ArticleAdmin extends ModelAdmin {
  getQueryset() {
    // Only show non-deleted articles
    return ArticleModel.objects.filter({ isDeleted: false });
  }
}
```

## Form Validation

Add custom validation:

```typescript
class ArticleAdmin extends ModelAdmin {
  validateForm(
    data: Record<string, any>,
  ): { valid: boolean; errors: Record<string, string[]> } {
    const errors: Record<string, string[]> = {};

    if (data.status === "published" && !data.publishedAt) {
      errors.publishedAt = ["Published articles must have a publish date"];
    }

    if (data.title && data.title.length < 10) {
      errors.title = ["Title must be at least 10 characters"];
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
```

## Full Example

```typescript
import { AdminSite, ModelAdmin, register } from "@alexi/admin";
import { ArticleModel, CategoryModel, UserModel } from "./models.ts";

// Create admin site
const adminSite = new AdminSite({
  title: "Blog Admin",
  urlPrefix: "/admin",
  siteHeader: "Blog Administration",
});

// Category admin - simple
adminSite.register(CategoryModel);

// User admin
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
  listFilter = ["isActive", "isStaff", "isSuperuser"];
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
      fields: ["isStaff", "isSuperuser"],
      collapsed: true,
    },
  ];
}

adminSite.register(UserModel, UserAdmin);

// Article admin
@register(ArticleModel, adminSite)
class ArticleAdmin extends ModelAdmin {
  listDisplay = ["id", "title", "author", "status", "publishedAt", "createdAt"];
  listDisplayLinks = ["title"];
  searchFields = ["title", "body", "excerpt"];
  listFilter = ["status", "category", "author"];
  ordering = ["-createdAt"];
  listPerPage = 20;
  dateHierarchy = "createdAt";

  fieldsets = [
    {
      name: null, // No title
      fields: ["title", "slug"],
    },
    {
      name: "Content",
      fields: ["body", "excerpt"],
      classes: ["wide"],
    },
    {
      name: "Categorization",
      fields: ["category", "tags"],
    },
    {
      name: "Publishing",
      fields: ["status", "publishedAt", "author"],
    },
  ];

  readonlyFields = ["slug", "createdAt", "updatedAt"];

  actions = ["delete_selected", "publish_selected", "unpublish_selected"];

  async publishSelected(request: unknown, queryset: unknown) {
    const count = await queryset.update({
      status: "published",
      publishedAt: new Date(),
    });
    return { count, message: `Published ${count} articles` };
  }

  async unpublishSelected(request: unknown, queryset: unknown) {
    const count = await queryset.update({ status: "draft" });
    return { count, message: `Unpublished ${count} articles` };
  }
}

export { adminSite };
```

## Best Practices

1. **Use listDisplay** — Always specify `listDisplay` for better UX; default
   shows all fields which can be overwhelming

2. **Add search** — Enable `searchFields` for models with many records

3. **Group with fieldsets** — Use fieldsets to organize complex forms

4. **Limit listPerPage** — Keep `listPerPage` reasonable (20-50) for performance

5. **Use ordering** — Set sensible default ordering (usually `-createdAt`)

6. **Secure with permissions** — Override permission methods for production use

7. **Validate forms** — Add custom validation for business rules
