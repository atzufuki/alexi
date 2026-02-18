---
name: alexi-implement
description: Implement features and fixes for the Alexi framework itself. Use when 
  developing new framework functionality, fixing bugs, or improving Alexi's codebase.
---

# Alexi Implementation Skill

Develop the Alexi framework following proper git flow, coding conventions, and testing.

## When to Use

- User asks to implement a framework feature (usually referencing an issue)
- User asks to fix a bug in Alexi
- User asks to add a new backend, field type, serializer, or other framework component

## Workflow Overview

1. Create feature branch from `main`
2. Implement changes following Alexi conventions
3. Write tests for new functionality
4. Run checks (fmt, lint, check, test)
5. Commit with conventional commits
6. Create PR linked to issue

## Step 1: Create Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/short-description
```

Branch naming:
- `feature/` - New framework functionality
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring

## Step 2: Understand the Codebase

### Project Structure

```
alexi/
├── src/
│   ├── admin/           # @alexi/admin - Admin panel
│   ├── auth/            # @alexi/auth - JWT authentication
│   ├── core/            # @alexi/core - Management commands
│   │   └── commands/    # Built-in commands
│   ├── db/              # @alexi/db - ORM
│   │   ├── backends/    # Database backends (denokv, indexeddb, rest, sync)
│   │   ├── fields/      # Field types
│   │   ├── models/      # Model, Manager classes
│   │   └── query/       # QuerySet, Q objects
│   ├── middleware/      # @alexi/middleware
│   ├── restframework/   # @alexi/restframework
│   │   ├── serializers/ # Serializer classes
│   │   └── viewsets/    # ViewSet classes
│   ├── urls/            # @alexi/urls
│   └── ...
├── docs/                # Documentation
├── scripts/             # Build/release scripts
└── deno.json            # Workspace configuration
```

### Package Dependencies

Each package is in `src/<name>/` with its own `deno.jsonc`. Packages can depend on each other via `@alexi/*` imports.

## Step 3: Implement Changes

### File Naming Convention

**All TypeScript files MUST use lowercase snake_case:**

```
src/db/backends/postgres/
├── mod.ts
├── backend.ts
├── query_builder.ts
└── types.ts
```

### Import Conventions

Within Alexi source, use `@alexi/*` aliases:

```typescript
// In src/restframework/viewsets/model_viewset.ts
import { Model, Manager } from "@alexi/db";
import type { Request } from "@alexi/types";
```

### Adding a New Database Backend

1. Create directory: `src/db/backends/<name>/`
2. Implement `DatabaseBackend` abstract class:

```typescript
// src/db/backends/postgres/backend.ts
import { DatabaseBackend } from "../backend.ts";
import type { QueryState, Transaction } from "../types.ts";

export class PostgresBackend extends DatabaseBackend {
  // Required methods
  async connect(): Promise<void> { ... }
  async disconnect(): Promise<void> { ... }
  
  async insert<T extends Model>(instance: T): Promise<Record<string, unknown>> { ... }
  async update<T extends Model>(instance: T): Promise<void> { ... }
  async delete<T extends Model>(instance: T): Promise<void> { ... }
  async deleteById(tableName: string, id: unknown): Promise<void> { ... }
  
  async getById<T extends Model>(model: ModelClass<T>, id: unknown): Promise<Record<string, unknown> | null> { ... }
  async existsById<T extends Model>(model: ModelClass<T>, id: unknown): Promise<boolean> { ... }
  
  async execute<T extends Model>(state: QueryState<T>): Promise<Record<string, unknown>[]> { ... }
  async count<T extends Model>(state: QueryState<T>): Promise<number> { ... }
  
  async bulkInsert<T extends Model>(instances: T[]): Promise<Record<string, unknown>[]> { ... }
  async bulkUpdate<T extends Model>(instances: T[], fields: string[]): Promise<number> { ... }
  async deleteMany<T extends Model>(state: QueryState<T>): Promise<number> { ... }
  
  async beginTransaction(): Promise<Transaction> { ... }
}
```

3. Export from `mod.ts`:

```typescript
// src/db/backends/postgres/mod.ts
export { PostgresBackend } from "./backend.ts";
export type { PostgresConfig } from "./types.ts";
```

4. Add to package exports in `src/db/deno.jsonc`

### Adding a New Field Type

```typescript
// src/db/fields/json_field.ts
import { Field } from "./field.ts";

export class JSONField<T = unknown> extends Field<T> {
  constructor(options: FieldOptions = {}) {
    super(options);
  }

  override toDatabase(value: T): string {
    return JSON.stringify(value);
  }

  override fromDatabase(value: unknown): T {
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value as T;
  }
}
```

### Adding a New Serializer Field

```typescript
// src/restframework/serializers/fields/slug_field.ts
import { CharField } from "./char_field.ts";

export class SlugField extends CharField {
  override async validate(value: unknown): Promise<string> {
    const str = await super.validate(value);
    if (!/^[a-z0-9-]+$/.test(str)) {
      throw new ValidationError("Invalid slug format");
    }
    return str;
  }
}
```

### Adding a Management Command

```typescript
// src/core/commands/my_command.ts
import { BaseCommand, success, failure } from "../base_command.ts";
import type { CommandOptions, CommandResult } from "../types.ts";

export class MyCommand extends BaseCommand {
  readonly name = "mycommand";
  readonly help = "Description of command";

  override defineOptions(parser: ArgumentParser): void {
    parser.add_argument("--flag", { type: "str", help: "Flag description" });
  }

  async handle(options: CommandOptions): Promise<CommandResult> {
    try {
      // Implementation
      this.success("Done!");
      return success();
    } catch (error) {
      this.error(`Failed: ${error.message}`);
      return failure(error.message);
    }
  }
}
```

## Step 4: Write Tests

### Test Location

Place tests next to the code with `_test.ts` suffix:

```
src/db/backends/postgres/
├── backend.ts
├── backend_test.ts      # Tests for backend
├── query_builder.ts
└── query_builder_test.ts
```

### Test Structure

```typescript
// src/db/backends/postgres/backend_test.ts
import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert@1";
import { PostgresBackend } from "./backend.ts";
import { setup, reset } from "../../setup.ts";
import { Model, CharField, AutoField, Manager } from "../../models/mod.ts";

// Test model (defined in test file)
class TestModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  
  static objects = new Manager(TestModel);
  static meta = { dbTable: "test_table" };
}

Deno.test({
  name: "PostgresBackend: connect and disconnect",
  async fn() {
    const backend = new PostgresBackend({
      url: Deno.env.get("TEST_DATABASE_URL") ?? "postgresql://localhost/test",
    });
    
    await backend.connect();
    // Assert connection is working
    await backend.disconnect();
  },
});

Deno.test({
  name: "PostgresBackend: CRUD operations",
  async fn() {
    const backend = new PostgresBackend({ url: "..." });
    await backend.connect();
    await setup({ backend });

    try {
      // Create
      const instance = await TestModel.objects.create({ name: "Test" });
      assertExists(instance.id.get());
      
      // Read
      const retrieved = await TestModel.objects.get({ id: instance.id.get() });
      assertEquals(retrieved.name.get(), "Test");
      
      // Update
      retrieved.name.set("Updated");
      await retrieved.save();
      
      // Delete
      await retrieved.delete();
      
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend: QuerySet filtering",
  async fn() {
    // Test filter(), exclude(), orderBy(), etc.
  },
});
```

### Running Tests

```bash
# All tests
deno task test

# Specific module
deno test -A --unstable-kv src/db/backends/postgres/

# Specific test file
deno test -A --unstable-kv src/db/backends/postgres/backend_test.ts

# Filter by name
deno test -A --unstable-kv --filter "PostgresBackend"
```

## Step 5: Run All Checks

Before committing:

```bash
deno task fmt      # Format code
deno task lint     # Lint code  
deno task check    # Type check
deno task test     # Run tests
```

All checks must pass.

## Step 6: Commit Changes

Use conventional commits:

```bash
git add -A
git commit -m "feat(db): add PostgreSQL backend"
```

Format: `<type>(<scope>): <description>`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Refactoring
- `test` - Tests only
- `chore` - Maintenance

Scopes: `db`, `restframework`, `auth`, `core`, `urls`, `middleware`, `admin`, etc.

## Step 7: Create Pull Request

```bash
git push -u origin feature/postgres-backend

gh pr create --title "feat(db): add PostgreSQL backend" --body "$(cat <<'EOF'
## Summary

- Implements PostgreSQL database backend extending DatabaseBackend
- Adds SQL query builder for QuerySet translation
- Supports connection pooling and Deno Deploy compatibility
- Includes comprehensive test suite

Closes #67
EOF
)"
```

### PR Body Format

```markdown
## Summary

- Change 1
- Change 2
- Change 3

Closes #<issue-number>
```

## Guidelines

- **Read AGENTS.md** for complete framework documentation
- **Follow existing patterns** - Look at similar code (e.g., DenoKVBackend for new backends)
- **snake_case files** - All `.ts` files must be lowercase snake_case
- **Tests required** - All new functionality needs tests
- **All checks must pass** - fmt, lint, check, test
- **One feature per PR** - Keep PRs focused
- **Link to issue** - Use `Closes #N` in PR body
