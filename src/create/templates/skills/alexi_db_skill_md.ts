/**
 * Template for alexi-db SKILL.md
 *
 * Generates the Agent Skills file for @alexi/db ORM.
 */

export function generateAlexiDbSkillMd(): string {
  return `---
name: alexi-db
description: Use when working with @alexi/db ORM - defining models, querying data, configuring backends (DenoKV, IndexedDB, REST, Sync), migrations, or implementing Django-style database patterns in Deno.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/db"
---

# Alexi Database ORM

## Overview

\`@alexi/db\` is a Django-inspired ORM for Deno with support for multiple database
backends. It provides Models, QuerySets, Managers, field types, and a migration
system that mirror Django's ORM patterns.

## When to Use This Skill

- Defining data models with typed fields
- Querying and filtering data using QuerySets
- Setting up database backends (DenoKV, IndexedDB, REST)
- Working with ForeignKey relationships and eager loading
- Creating and applying database migrations

## Installation

\`\`\`bash
deno add jsr:@alexi/db
\`\`\`

## Defining Models

Models inherit from \`Model\` and define fields as class properties:

\`\`\`typescript
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
\`\`\`

## Field Types

| Field             | Description                           |
| ----------------- | ------------------------------------- |
| \`AutoField\`       | Auto-incrementing integer primary key |
| \`CharField\`       | String with max length                |
| \`TextField\`       | Unlimited text                        |
| \`IntegerField\`    | Integer                               |
| \`FloatField\`      | Float                                 |
| \`DecimalField\`    | Decimal with precision                |
| \`BooleanField\`    | Boolean                               |
| \`DateField\`       | Date only                             |
| \`DateTimeField\`   | Date and time                         |
| \`JSONField\`       | JSON object                           |
| \`UUIDField\`       | UUID string                           |
| \`ForeignKey\`      | Foreign key relation                  |
| \`OneToOneField\`   | One-to-one relation                   |
| \`ManyToManyField\` | Many-to-many relation                 |

## QuerySet API

QuerySets are lazy - call \`.fetch()\`, \`.first()\`, or iterate to execute:

\`\`\`typescript
// Get all
const tasks = await TaskModel.objects.all().fetch();

// Filter with conditions
const openTasks = await TaskModel.objects.filter({ status: "open" }).fetch();

// Field lookups (Django-style double-underscore)
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

// Get single object (throws if not found)
const task = await TaskModel.objects.get({ id: 1 });

// First/Last (returns null if not found)
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

// Bulk delete
await TaskModel.objects.filter({ status: "closed" }).delete();
\`\`\`

## Field Access Pattern

Always use \`.get()\` and \`.set()\` methods for field values:

\`\`\`typescript
// Reading values
const title = task.title.get();
const id = task.id.get();

// Setting values
task.title.set("New Title");
task.status.set("completed");
await task.save();
\`\`\`

## Eager Loading with selectRelated

Avoid N+1 queries by using \`selectRelated()\` to batch-load related objects:

\`\`\`typescript
// Load projects with their organisation pre-loaded
const projects = await ProjectModel.objects
  .selectRelated("organisation")
  .fetch();

for (const project of projects.array()) {
  // No additional query - organisation is already loaded
  console.log(project.organisation.get().name.get());
}

// Nested relations with double-underscore syntax
const competences = await ProjectRoleCompetenceModel.objects
  .selectRelated("projectRole__project__organisation")
  .fetch();

// Multiple relations
const items = await Model.objects
  .selectRelated("author", "category__parent")
  .fetch();
\`\`\`

## ForeignKey and Reverse Relations

\`\`\`typescript
import {
  AutoField,
  CharField,
  ForeignKey,
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
    relatedName: "roleCompetences",
  });

  static objects = new Manager(ProjectRoleCompetenceModel);
}

// Usage
const role = await ProjectRoleModel.objects.get({ id: 1 });

// Access related objects via reverse relation
const competences = await role.roleCompetences.all().fetch();
const count = await role.roleCompetences.count();

// Create related object (FK set automatically)
const newComp = await role.roleCompetences.create({ level: 4 });
\`\`\`

## Database Migrations

### Creating a Migration

\`\`\`bash
deno task manage makemigrations users --name create_users
\`\`\`

### Writing a Migration

\`\`\`typescript
import { Migration, MigrationSchemaEditor } from "@alexi/db/migrations";
import { AutoField, CharField, EmailField, Model } from "@alexi/db";

// Snapshot model at this point in time
class UserModel extends Model {
  static meta = { dbTable: "users" };
  id = new AutoField({ primaryKey: true });
  email = new EmailField({ unique: true });
  name = new CharField({ maxLength: 100 });
}

export default class Migration0001 extends Migration {
  name = "0001_create_users";
  dependencies = [];

  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.createModel(UserModel);
  }

  async backwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.deprecateModel(UserModel);
  }
}
\`\`\`

### Applying Migrations

\`\`\`bash
# Apply all pending migrations
deno task manage migrate

# Show migration status
deno task manage showmigrations

# Rollback to a specific migration
deno task manage migrate users 0001_create_users

# Rollback all migrations for an app
deno task manage migrate users zero
\`\`\`

### Schema Editor Operations

\`\`\`typescript
// Create a model/table
await schema.createModel(UserModel);

// Add a field
await schema.addField(UserModel, "bio", new TextField({ blank: true }));

// Deprecate a field (safe removal with rollback support)
await schema.deprecateField(UserModel, "legacyField");

// Drop a field (permanent deletion - use with caution)
await schema.dropField(UserModel, "temporaryField");

// Alter a field
await schema.alterField(UserModel, "name", new CharField({ maxLength: 200 }));

// Rename a field
await schema.renameField(UserModel, "oldName", "newName");

// Create an index
await schema.createIndex(UserModel, ["email"], { unique: true });

// Deprecate a model (safe removal)
await schema.deprecateModel(UserModel);
\`\`\`

### Deprecation Model

Alexi uses deprecation instead of destructive deletes:

- **Never delete data** - Columns/tables are renamed to \`_deprecated_NNNN_*\`
- **Safe rollbacks** - Rollback simply renames back to original
- **Cleanup later** - Use \`migrate --cleanup\` after sufficient time

\`\`\`typescript
// Instead of dropping a column, deprecate it
await schema.deprecateField(UserModel, "phoneNumber");
// Column renamed to: _deprecated_0002_phoneNumber

// Clean up deprecated items older than 30 days
// deno task manage migrate --cleanup
\`\`\`

### Non-Reversible Migrations

Migrations without a \`backwards()\` method cannot be rolled back:

\`\`\`typescript
import { DataMigration, MigrationSchemaEditor } from "@alexi/db/migrations";

export default class Migration0003 extends DataMigration {
  name = "0003_normalize_emails";
  dependencies = ["0002_add_email"];

  async forwards(_schema: MigrationSchemaEditor): Promise<void> {
    // Transform data in-place
  }

  // No backwards() = migration cannot be reversed
  // - Warning shown when applying
  // - Rollback blocked with error
}
\`\`\`

## Database Setup

### DenoKV Backend (Server)

\`\`\`typescript
import { setup } from "@alexi/core";
import { DenoKVBackend } from "@alexi/db/backends/denokv";

const backend = new DenoKVBackend({
  name: "myapp",
  path: "./data/myapp.db",
});
await setup({ DATABASES: { default: backend } });
\`\`\`

### IndexedDB Backend (Browser)

\`\`\`typescript
import { setup } from "@alexi/core";
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";

const backend = new IndexedDBBackend({ name: "myapp" });
await setup({ DATABASES: { default: backend } });
\`\`\`

### REST Backend (Browser)

Maps ORM operations to HTTP requests:

\`\`\`typescript
import { RestBackend } from "@alexi/db/backends/rest";

const backend = new RestBackend({
  apiUrl: "https://api.example.com/api",
});
await backend.connect();

// Use with ORM
const tasks = await TaskModel.objects.using(backend).all().fetch();

// Authentication
await backend.login({ email: "user@example.com", password: "secret" });
\`\`\`

## QuerySet.save() - Bulk Persistence

Save all loaded instances in a QuerySet:

\`\`\`typescript
const projects = await ProjectModel.objects.filter({ status: "draft" }).fetch();

for (const project of projects.array()) {
  project.status.set("published");
}

const result = await projects.save();
// result: { inserted: 0, updated: 5, failed: 0, total: 5, errors: [] }
\`\`\`

## Common Mistakes

**Not calling .fetch() on QuerySets**

\`\`\`typescript
// ❌ Wrong - qs is a QuerySet, not data
const qs = TaskModel.objects.filter({ status: "open" });

// ✅ Correct - call .fetch() to execute
const tasks = await TaskModel.objects.filter({ status: "open" }).fetch();
\`\`\`

**Accessing field values directly**

\`\`\`typescript
// ❌ Wrong - fields are objects, not values
const title = task.title;

// ✅ Correct - use .get() to read values
const title = task.title.get();
\`\`\`

**Not using selectRelated for FK access**

\`\`\`typescript
// ❌ N+1 queries
const projects = await ProjectModel.objects.all().fetch();
for (const p of projects.array()) {
  await p.organisation.fetch(); // One query per project!
}

// ✅ Use selectRelated
const projects = await ProjectModel.objects
  .selectRelated("organisation")
  .fetch();
for (const p of projects.array()) {
  p.organisation.get(); // Already loaded
}
\`\`\`

**Forgetting to call setup() before ORM operations**

\`\`\`typescript
// ❌ Will fail - backend not initialized
const tasks = await TaskModel.objects.all().fetch();

// ✅ Setup first
await setup({ backend });
const tasks = await TaskModel.objects.all().fetch();
\`\`\`

**Using dropColumn instead of deprecateField**

\`\`\`typescript
// ❌ Bad: Data loss, can't rollback
await schema.executeRaw("ALTER TABLE users DROP COLUMN phone");

// ✅ Good: Safe removal with rollback support
await schema.deprecateField(UserModel, "phone");
\`\`\`

## Import Reference

\`\`\`typescript
// Core ORM
import { AutoField, CharField, IntegerField, Manager, Model } from "@alexi/db";
import { getBackend, isInitialized, setBackend } from "@alexi/db";
import { setup } from "@alexi/core";
import { Count, Q, QuerySet, RelatedManager, Sum } from "@alexi/db";

// Backends
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
import { RestBackend } from "@alexi/db/backends/rest";

// REST Backend extras
import {
  DetailAction,
  ListAction,
  ModelEndpoint,
  SingletonQuery,
} from "@alexi/db/backends/rest";

// Migrations
import {
  DataMigration,
  Migration,
  MigrationSchemaEditor,
} from "@alexi/db/migrations";

import {
  createDeprecationRecorder,
  createMigrationRecorder,
} from "@alexi/db/migrations";
\`\`\`
`;
}
