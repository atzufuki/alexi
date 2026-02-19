# Database Migrations

Alexi provides a Django-inspired migration system for managing database schema
changes across PostgreSQL and DenoKV backends.

## Overview

The migration system allows you to:

- Define schema changes in version-controlled migration files
- Apply and rollback migrations safely
- Track which migrations have been applied
- Use the same migration code across different database backends

## Quick Start

### 1. Create a Migration

```bash
deno task manage makemigrations users --name create_users
```

This creates a migration file at `src/users/migrations/0001_create_users.ts`.

### 2. Edit the Migration

```typescript
import { Migration, MigrationSchemaEditor } from "@alexi/db/migrations";
import {
  AutoField,
  CharField,
  DateTimeField,
  EmailField,
  Model,
} from "@alexi/db";

// Snapshot model at this point in time
class UserModel extends Model {
  static meta = { dbTable: "users" };
  id = new AutoField({ primaryKey: true });
  email = new EmailField({ unique: true });
  name = new CharField({ maxLength: 100 });
  createdAt = new DateTimeField({ autoNowAdd: true });
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
```

### 3. Apply Migrations

```bash
deno task manage migrate
```

### 4. Check Status

```bash
deno task manage showmigrations
```

## Migration Class

Every migration extends the `Migration` base class:

```typescript
import { Migration, MigrationSchemaEditor } from "@alexi/db/migrations";

export default class Migration0002 extends Migration {
  // Required: unique name within the app
  name = "0002_add_email_verified";

  // Dependencies that must run first
  dependencies = ["0001_create_users"];

  // Optional: set to false for irreversible migrations
  reversible = true;

  // Apply the migration
  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    // Schema changes here
  }

  // Reverse the migration
  async backwards(schema: MigrationSchemaEditor): Promise<void> {
    // Undo changes here
  }
}
```

### Migration Properties

| Property       | Type                    | Description                                                 |
| -------------- | ----------------------- | ----------------------------------------------------------- |
| `name`         | `string`                | Unique migration name (e.g., `0001_initial`)                |
| `dependencies` | `MigrationDependency[]` | Migrations that must run first                              |
| `reversible`   | `boolean`               | Whether this migration can be rolled back (default: `true`) |
| `appLabel`     | `string`                | Set automatically by the loader                             |

### Dependencies

Dependencies can be:

- **Same app**: Just the migration name (`"0001_initial"`)
- **Cross-app**: Tuple with app and name (`["auth", "0001_create_users"]`)

```typescript
dependencies = [
  "0001_initial", // Same app
  ["auth", "0001_create_users"], // Different app
];
```

## Schema Editor

The `MigrationSchemaEditor` provides methods for modifying database schema:

### Creating Models

```typescript
await schema.createModel(UserModel);
```

Creates a table based on the model's fields and meta options.

### Adding Fields

```typescript
import { BooleanField } from "@alexi/db";

await schema.addField(
  UserModel,
  "emailVerified",
  new BooleanField({ default: false }),
);
```

### Removing Fields (Deprecation)

Instead of deleting data, Alexi uses a **deprecation model** that renames
columns to `_deprecated_NNNN_<name>`:

```typescript
await schema.deprecateField(UserModel, "legacyField");
// Renames column to: _deprecated_0002_legacyField
```

This allows safe rollbacks without data loss.

### Altering Fields

```typescript
await schema.alterField(
  UserModel,
  "name",
  new CharField({ maxLength: 200 }), // Increased from 100
);
```

### Renaming Fields

```typescript
await schema.renameField(UserModel, "oldName", "newName");
```

### Creating Indexes

```typescript
// Simple index
await schema.createIndex(UserModel, ["email"]);

// Unique index
await schema.createIndex(UserModel, ["email"], { unique: true });

// Composite index
await schema.createIndex(UserModel, ["lastName", "firstName"]);
```

### Dropping Indexes

```typescript
await schema.dropIndex(UserModel, "idx_users_email");
```

### Deprecating Models

```typescript
await schema.deprecateModel(UserModel);
// Renames table to: _deprecated_0002_users
```

### Raw SQL (PostgreSQL only)

```typescript
await schema.executeRaw("UPDATE users SET name = LOWER(name)");
```

## Deprecation Model

Alexi uses a **deprecation model** instead of destructive deletes:

1. **Never delete data** - Columns and tables are renamed, not dropped
2. **Safe rollbacks** - Rollback simply renames back to the original name
3. **Cleanup later** - Use `migrate --cleanup` to permanently remove old data

### Example: Removing a Field

```typescript
// forwards: deprecate the field
async forwards(schema: MigrationSchemaEditor): Promise<void> {
  await schema.deprecateField(UserModel, "phoneNumber");
}

// backwards: restore the field
async backwards(schema: MigrationSchemaEditor): Promise<void> {
  // The deprecation recorder tracks what was deprecated
  // Rollback automatically restores the original name
}
```

### Cleanup

After sufficient time (default 30 days), permanently remove deprecated items:

```bash
# Show what would be cleaned up
deno task manage migrate --cleanup --plan

# Actually clean up (destructive!)
deno task manage migrate --cleanup
```

## Data Migrations

For data-only changes (no schema changes), use `DataMigration`.

### Non-Reversible Data Migration

Data migrations that modify data in-place without preserving the original:

```typescript
import { DataMigration, MigrationSchemaEditor } from "@alexi/db/migrations";
import { UserModel } from "../models.ts";

export default class Migration0003 extends DataMigration {
  name = "0003_normalize_emails";
  dependencies = ["0002_add_email_verified"];

  async forwards(_schema: MigrationSchemaEditor): Promise<void> {
    const users = await UserModel.objects.all().fetch();
    for (const user of users.array()) {
      user.email.set(user.email.get().toLowerCase());
      await user.save();
    }
  }

  async backwards(_schema: MigrationSchemaEditor): Promise<void> {
    throw new Error("Cannot reverse - original data not preserved");
  }
}
```

> **Note:** `DataMigration` sets `reversible = false` by default. This is used
> as a hint to show warnings during rollback, but does not prevent rollback.

### Reversible Data Migration

> **Coming soon:** Fully reversible data migrations require `dropField()` which
> is not yet implemented. See
> [#97](https://github.com/atzufuki/alexi/issues/97).

For now, you can make data migrations reversible by preserving original data in
deprecated fields:

```typescript
import { DataMigration, MigrationSchemaEditor } from "@alexi/db/migrations";
import { EmailField } from "@alexi/db";
import { UserModel } from "../models.ts";

export default class Migration0003 extends DataMigration {
  name = "0003_normalize_emails";
  dependencies = ["0002_add_email_verified"];

  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    // 1. Deprecate the original field (preserves data as _deprecated_0003_email)
    await schema.deprecateField(UserModel, "email");

    // 2. Add new field for normalized data
    await schema.addField(
      UserModel,
      "email",
      new EmailField({ maxLength: 255 }),
    );

    // 3. Copy and transform data from deprecated field to new field
    await schema.executeSQL(`
      UPDATE users SET email = LOWER(_deprecated_0003_email)
    `);
  }

  async backwards(schema: MigrationSchemaEditor): Promise<void> {
    // 1. Deprecate the new field (we can't drop it yet)
    await schema.deprecateField(UserModel, "email");

    // 2. Restore the original field from its deprecation
    await schema.restoreField(UserModel, "email", "0003");
    // Original (non-lowercase) data is preserved
  }
}
```

With this approach:

- **Original data preserved** - The deprecated field retains the original values
- **Safe rollback** - `restoreField()` renames `_deprecated_0003_email` back to
  `email`
- **Cleanup later** - Use `migrate --cleanup` to remove deprecated fields after
  verification
- **Caveat** - Rolling back leaves an extra deprecated field from step 1

## Management Commands

### makemigrations

Generate a new migration file:

```bash
# Create migration for an app
deno task manage makemigrations users

# With custom name
deno task manage makemigrations users --name add_profile_fields

# Create empty migration
deno task manage makemigrations users --empty

# Check for unmigrated changes (CI)
deno task manage makemigrations --check

# Dry run - show what would be generated
deno task manage makemigrations users --dry-run
```

### migrate

Apply or rollback migrations:

```bash
# Apply all pending migrations
deno task manage migrate

# Apply migrations for specific app
deno task manage migrate users

# Migrate to specific migration
deno task manage migrate users 0002_add_email

# Rollback all migrations for an app
deno task manage migrate users zero

# Show what would be done (dry run)
deno task manage migrate --plan

# Test reversibility (apply → rollback → apply)
deno task manage migrate --test

# Clean up deprecated items older than 30 days
deno task manage migrate --cleanup

# Clean up items older than 7 days
deno task manage migrate --cleanup --cleanup-days 7
```

### showmigrations

Display migration status:

```bash
# Show all migrations
deno task manage showmigrations

# Show migrations for specific app
deno task manage showmigrations users

# Include deprecation information
deno task manage showmigrations --deprecations

# Simple list format
deno task manage showmigrations --list
```

Output example:

```
users
─────
  [X] 0001_create_users (applied: 2024-01-15 10:30:00)
  [X] 0002_add_email_verified (applied: 2024-01-16 14:22:00)
  [ ] 0003_add_profile

Total: 3 migration(s)
  Applied: 2
  Pending: 1
```

## Backend Support

### PostgreSQL

Uses SQL tables for migration tracking:

- `_alexi_migrations` - Applied migrations
- `_alexi_deprecations` - Deprecated items pending cleanup

```typescript
import { setup } from "@alexi/db";
import { PostgresBackend } from "@alexi/db/backends/postgres";

const backend = new PostgresBackend({
  host: "localhost",
  database: "myapp",
  user: "postgres",
  password: "secret",
});

await setup({ backend });
```

### DenoKV

Uses KV keys for migration tracking:

- `["_alexi", "migrations", "<name>"]` - Applied migrations
- `["_alexi", "deprecations", "<name>"]` - Deprecated items

```typescript
import { setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";

const backend = new DenoKVBackend({
  path: "./data/myapp.db",
});

await backend.connect();
await setup({ backend });
```

### Recorder Factory

The migration system automatically selects the correct recorder based on your
backend:

```typescript
import { createMigrationRecorder } from "@alexi/db/migrations";

// Automatically returns PostgresMigrationRecorder or DenoKVMigrationRecorder
const recorder = createMigrationRecorder(backend);

// Check if migration was applied
const isApplied = await recorder.isApplied("users.0001_create_users");

// Get all applied migrations
const applied = await recorder.getAppliedMigrations();
```

## Best Practices

### 1. Keep Migrations Small

Each migration should do one thing:

```typescript
// ✅ Good: Single purpose
class Migration0002 extends Migration {
  name = "0002_add_email_verified";
  // Only adds one field
}

// ❌ Bad: Multiple unrelated changes
class Migration0002 extends Migration {
  name = "0002_various_changes";
  // Adds fields, removes fields, creates indexes...
}
```

### 2. Include Model Snapshots

Always include the model definition as it was at migration time:

```typescript
// ✅ Good: Snapshot of model at this point
class UserModel extends Model {
  static meta = { dbTable: "users" };
  id = new AutoField({ primaryKey: true });
  email = new EmailField(); // Only fields that existed at this point
}

export default class Migration0001 extends Migration {
  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.createModel(UserModel);
  }
}
```

### 3. Always Implement backwards()

Unless truly irreversible, always implement rollback:

```typescript
async forwards(schema: MigrationSchemaEditor): Promise<void> {
  await schema.addField(UserModel, "bio", new TextField({ blank: true }));
}

async backwards(schema: MigrationSchemaEditor): Promise<void> {
  await schema.deprecateField(UserModel, "bio");
}
```

### 4. Use Deprecation for Removals

Never use `dropColumn` or `dropTable` directly:

```typescript
// ✅ Good: Use deprecation
await schema.deprecateField(UserModel, "legacyField");

// ❌ Bad: Direct deletion (data loss, can't rollback)
await schema.executeRaw("ALTER TABLE users DROP COLUMN legacy_field");
```

### 5. Test Migrations

Run migrations in test mode to verify reversibility:

```bash
deno task manage migrate --test
```

This applies migrations, rolls them back, and re-applies them to catch issues.

## Troubleshooting

### Migration Not Found

```
Error: Migration 'users.0002_add_email' not found
```

Check that:

1. The file exists in `src/users/migrations/`
2. The file has a default export extending `Migration`
3. The `name` property matches the expected name

### Circular Dependencies

```
Error: Circular dependency detected: users.0001 → auth.0001 → users.0001
```

Refactor to break the cycle, possibly using a third migration.

### Cannot Rollback Irreversible Migration

```
Warning: Migration users.0003_data_cleanup is marked as irreversible
```

If `reversible = false`, the migration cannot be rolled back. You may need to
create a new "undo" migration instead.

### Deprecated Item Not Found During Rollback

If a deprecated column was manually deleted, rollback will fail. Restore from
backup or recreate the column manually.

## Import Reference

```typescript
// Migration classes
import {
  DataMigration,
  Migration,
  MigrationSchemaEditor,
} from "@alexi/db/migrations";

// Migration types
import type {
  DeprecationInfo,
  MigrationDependency,
  MigrationOptions,
} from "@alexi/db/migrations";

// Recorder factory (for custom tooling)
import {
  createDeprecationRecorder,
  createMigrationRecorder,
} from "@alexi/db/migrations";

// Recorder interfaces
import type {
  IDeprecationRecorder,
  IMigrationRecorder,
} from "@alexi/db/migrations";

// Specific recorders (rarely needed directly)
import {
  DenoKVDeprecationRecorder,
  DenoKVMigrationRecorder,
  PostgresDeprecationRecorder,
  PostgresMigrationRecorder,
} from "@alexi/db/migrations";

// State comparison (for makemigrations)
import {
  ModelState,
  ProjectState,
  StateComparator,
} from "@alexi/db/migrations";

// Executor (for custom tooling)
import { MigrationExecutor, MigrationLoader } from "@alexi/db/migrations";
```
