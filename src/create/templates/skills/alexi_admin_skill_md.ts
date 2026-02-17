/**
 * Template for alexi-admin SKILL.md
 *
 * Generates the Agent Skills file for @alexi/admin admin panel.
 */

export function generateAlexiAdminSkillMd(): string {
  return `---
name: alexi-admin
description: Use when working with @alexi/admin - creating admin panels, registering models, customizing admin views, and implementing Django-style admin interfaces in Deno.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/admin"
---

# Alexi Admin

## Overview

\`@alexi/admin\` provides an auto-generated admin panel for Alexi applications,
similar to Django's admin interface. It allows you to manage your models through
a web-based UI.

## When to Use This Skill

- Creating admin interfaces for model management
- Registering models with the admin site
- Customizing admin list displays and forms
- Setting up admin authentication
- Creating admin actions for bulk operations

## Installation

\`\`\`bash
deno add jsr:@alexi/admin
\`\`\`

## Basic Setup

### Register Admin in Settings

\`\`\`typescript
// project/web.settings.ts
export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@alexi/web"),
  () => import("@alexi/db"),
  () => import("@alexi/auth"),
  () => import("@alexi/admin"),  // Add admin app
  () => import("@myapp-web"),
];
\`\`\`

### Include Admin URLs

\`\`\`typescript
// src/myapp-web/urls.ts
import { include, path } from "@alexi/urls";
import { adminSite } from "@alexi/admin";

export const urlpatterns = [
  path("admin/", include(adminSite.urls)),
  path("api/", include(router.urls)),
];
\`\`\`

## Registering Models

### Basic Registration

\`\`\`typescript
// src/myapp-web/admin.ts
import { adminSite, ModelAdmin } from "@alexi/admin";
import { TaskModel, UserModel } from "./models.ts";

// Simple registration
adminSite.register(TaskModel);
adminSite.register(UserModel);
\`\`\`

### Custom ModelAdmin

\`\`\`typescript
import { adminSite, ModelAdmin } from "@alexi/admin";
import { TaskModel } from "./models.ts";

class TaskAdmin extends ModelAdmin {
  // Fields to display in list view
  listDisplay = ["id", "title", "status", "priority", "createdAt"];
  
  // Fields that are clickable links to detail view
  listDisplayLinks = ["id", "title"];
  
  // Fields to filter by in sidebar
  listFilter = ["status", "priority"];
  
  // Fields to search
  searchFields = ["title", "description"];
  
  // Default ordering
  ordering = ["-createdAt"];
  
  // Fields shown in detail/edit form
  fields = ["title", "description", "status", "priority"];
  
  // Read-only fields
  readonlyFields = ["createdAt", "updatedAt"];
  
  // Number of items per page
  listPerPage = 25;
}

adminSite.register(TaskModel, TaskAdmin);
\`\`\`

### Fieldsets

Group fields into sections:

\`\`\`typescript
class TaskAdmin extends ModelAdmin {
  fieldsets = [
    {
      name: "Basic Info",
      fields: ["title", "description"],
    },
    {
      name: "Status",
      fields: ["status", "priority"],
      classes: ["collapse"],  // Collapsible section
    },
    {
      name: "Metadata",
      fields: ["createdAt", "updatedAt"],
      description: "Automatically managed fields",
    },
  ];
}
\`\`\`

## Admin Actions

Add bulk actions to the list view:

\`\`\`typescript
import { adminSite, ModelAdmin } from "@alexi/admin";
import type { AdminAction } from "@alexi/admin";

class TaskAdmin extends ModelAdmin {
  listDisplay = ["id", "title", "status"];
  
  actions: AdminAction[] = [
    {
      name: "mark_completed",
      description: "Mark selected tasks as completed",
      handler: async (modelAdmin, request, queryset) => {
        const tasks = await queryset.fetch();
        for (const task of tasks.array()) {
          task.status.set("completed");
          await task.save();
        }
        return { message: \`Marked \${tasks.length} tasks as completed\` };
      },
    },
    {
      name: "mark_pending",
      description: "Mark selected tasks as pending",
      handler: async (modelAdmin, request, queryset) => {
        const tasks = await queryset.fetch();
        for (const task of tasks.array()) {
          task.status.set("pending");
          await task.save();
        }
        return { message: \`Marked \${tasks.length} tasks as pending\` };
      },
    },
  ];
}

adminSite.register(TaskModel, TaskAdmin);
\`\`\`

## Custom Admin Site

Create a custom admin site with different configuration:

\`\`\`typescript
import { AdminSite } from "@alexi/admin";

const myAdminSite = new AdminSite({
  name: "myadmin",
  siteTitle: "My App Admin",
  siteHeader: "My Application Administration",
  indexTitle: "Dashboard",
});

// Register models with custom site
myAdminSite.register(TaskModel, TaskAdmin);
myAdminSite.register(UserModel, UserAdmin);

// Use in URLs
export const urlpatterns = [
  path("myadmin/", include(myAdminSite.urls)),
];
\`\`\`

## Admin Authentication

Admin requires authentication. Use \`@alexi/auth\` decorators:

\`\`\`typescript
// Admin URLs are automatically protected
// Users must be authenticated and have is_staff=true

// Create a superuser via management command
// deno run -A --unstable-kv manage.ts createsuperuser
\`\`\`

## Customizing Admin Templates

Override default templates:

\`\`\`typescript
class TaskAdmin extends ModelAdmin {
  // Custom templates
  changeListTemplate = "admin/task/change_list.html";
  changeFormTemplate = "admin/task/change_form.html";
  
  // Custom list view context
  async getChangelistContext(request: Request) {
    const context = await super.getChangelistContext(request);
    context.stats = await this.getStats();
    return context;
  }
  
  private async getStats() {
    return {
      total: await TaskModel.objects.count(),
      completed: await TaskModel.objects.filter({ status: "completed" }).count(),
    };
  }
}
\`\`\`

## Inline Models

Show related models inline in the parent's edit form:

\`\`\`typescript
import { adminSite, InlineModelAdmin, ModelAdmin } from "@alexi/admin";
import { ProjectModel, TaskModel } from "./models.ts";

class TaskInline extends InlineModelAdmin {
  model = TaskModel;
  fkName = "project";  // ForeignKey field name
  extra = 1;  // Number of empty forms to show
  fields = ["title", "status", "priority"];
}

class ProjectAdmin extends ModelAdmin {
  listDisplay = ["id", "name", "createdAt"];
  inlines = [TaskInline];
}

adminSite.register(ProjectModel, ProjectAdmin);
\`\`\`

## Common Mistakes

**Forgetting to import admin module**

\`\`\`typescript
// ❌ Wrong - admin registrations not loaded
// (admin.ts exists but never imported)

// ✅ Correct - import in app.ts or mod.ts
// src/myapp-web/mod.ts
import "./admin.ts";  // Ensures registrations run
export { default } from "./app.ts";
\`\`\`

**Not including admin URLs**

\`\`\`typescript
// ❌ Wrong - admin not accessible
export const urlpatterns = [
  path("api/", include(router.urls)),
];

// ✅ Correct - include admin URLs
import { adminSite } from "@alexi/admin";

export const urlpatterns = [
  path("admin/", include(adminSite.urls)),
  path("api/", include(router.urls)),
];
\`\`\`

**Registering same model twice**

\`\`\`typescript
// ❌ Wrong - will throw error
adminSite.register(TaskModel);
adminSite.register(TaskModel, TaskAdmin);

// ✅ Correct - register once
adminSite.register(TaskModel, TaskAdmin);

// Or unregister first
adminSite.unregister(TaskModel);
adminSite.register(TaskModel, TaskAdmin);
\`\`\`

## Import Reference

\`\`\`typescript
// Core admin
import { adminSite, AdminSite, ModelAdmin } from "@alexi/admin";

// Inline admin
import { InlineModelAdmin, StackedInline, TabularInline } from "@alexi/admin";

// Types
import type { AdminAction, AdminContext } from "@alexi/admin";
\`\`\`
`;
}
