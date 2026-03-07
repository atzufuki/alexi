---
name: alexi-implement
description: Implement features and fixes for the Alexi framework itself. Use when
  developing new framework functionality, fixing bugs, or improving Alexi's codebase.
---

# Alexi Implementation Skill

Develop the Alexi framework following proper git flow, coding conventions, and
testing.

## When to Use

- User asks to implement a framework feature (usually referencing an issue)
- User asks to fix a bug in Alexi
- User asks to add a new backend, field type, serializer, or other framework
  component

## Workflow Overview

1. Create feature branch from `main`
2. Implement changes following Alexi conventions
3. Write JSDoc documentation for all exported symbols
4. Update prose documentation (AGENTS.md, docs/, etc.)
5. Write tests for new functionality
6. Run checks (fmt, lint, check, test, deno doc --lint)
7. Commit with conventional commits
8. Create PR linked to issue

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
│   │   ├── backends/    # Database backends (denokv, indexeddb, rest)
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

Each package is in `src/<name>/` with its own `deno.jsonc`. Packages can depend
on each other via `@alexi/*` imports.

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
import { Manager, Model } from "@alexi/db";
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
import { BaseCommand, failure, success } from "../base_command.ts";
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

## Step 4: Write JSDoc Documentation

All exported symbols **must** have JSDoc documentation. JSR generates the
package docs page directly from JSDoc comments — no separate documentation site
is needed.

Run `deno doc --lint src/<package>/mod.ts` to find missing documentation.

### Module Documentation

Every `mod.ts` must have a `@module` comment at the top. This becomes the
"Overview" tab on the JSR package page and takes precedence over README.

````typescript
/**
 * REST framework for Alexi — ViewSets, Serializers, Routers,
 * Permissions, Throttling, and Pagination.
 *
 * Mirrors Django REST Framework's API for the Deno ecosystem.
 *
 * @example
 * ```ts
 * import { ModelViewSet, DefaultRouter } from "@alexi/restframework";
 *
 * class TaskViewSet extends ModelViewSet {
 *   model = TaskModel;
 * }
 *
 * const router = new DefaultRouter();
 * router.register("tasks", TaskViewSet);
 * export const urlpatterns = router.urls;
 * ```
 *
 * @module
 */
````

### Function Documentation

Document every parameter, return value, and thrown error:

````typescript
/**
 * Resolves a URL pattern to the matching view function.
 *
 * @param urlpatterns The list of URL patterns to search.
 * @param path The URL path to resolve (without query string).
 * @returns The matched view and extracted params, or `null` if no match.
 * @throws {NotFoundError} When no pattern matches the given path.
 *
 * @example
 * ```ts
 * const result = resolve(urlpatterns, "/users/42/");
 * // result.params === { id: "42" }
 * ```
 */
export function resolve(
  urlpatterns: URLPattern[],
  path: string,
): ResolvedView | null { ... }
````

### Class Documentation

Document the class itself, every public property, and every public method:

````typescript
/**
 * Full CRUD ViewSet backed by an ORM model.
 *
 * Provides `list`, `retrieve`, `create`, `update`, `partialUpdate`,
 * and `destroy` actions automatically. Override {@link getQueryset}
 * to customise which objects are returned.
 *
 * @example
 * ```ts
 * class ArticleViewSet extends ModelViewSet {
 *   model = ArticleModel;
 *   serializer_class = ArticleSerializer;
 *   permission_classes = [IsAuthenticated];
 * }
 * ```
 */
export class ModelViewSet extends ViewSet {
  /** The ORM model class this ViewSet operates on. */
  model!: typeof Model;

  /** Serializer class used to serialize/deserialize model instances. */
  serializer_class?: typeof Serializer;

  /**
   * Returns the base queryset for list/detail actions.
   *
   * Override to apply default filters, annotations, or ordering.
   * The returned queryset is further filtered by URL params for detail actions.
   *
   * @param context The current request context.
   */
  getQueryset(context: ViewSetContext): QuerySet<Model> { ... }
}
````

### Interface Documentation

Document every property:

```typescript
/**
 * Configuration options for {@link RestBackend}.
 */
export interface RestBackendConfig {
  /** Base URL for the API, e.g. `"https://api.example.com/api"`. */
  apiUrl: string;

  /** Enable verbose console logging for all requests. Defaults to `false`. */
  debug?: boolean;

  /**
   * Declarative endpoint class definitions. See {@link ModelEndpoint}.
   * Enables type-safe {@link RestBackend.action} calls.
   */
  endpoints?: Array<typeof ModelEndpoint>;
}
```

### Supported JSDoc Tags

| Tag                   | When to Use                                   |
| --------------------- | --------------------------------------------- |
| `@module`             | Top of every `mod.ts` — module overview       |
| `@param name`         | Every function/method parameter               |
| `@returns`            | Non-void return values                        |
| `@throws {ErrorType}` | Errors the function can throw                 |
| `@example`            | Code examples (use triple-backtick blocks)    |
| `@deprecated`         | Removed in a future version                   |
| `@experimental`       | API may change                                |
| `@since`              | Version when symbol was added                 |
| `@see`                | Related symbols or external links             |
| `@category`           | Group symbols in JSR sidebar                  |
| `{@link Symbol}`      | Inline links to other symbols                 |
| `@internal`           | Exclude from JSR listing (but keep in source) |
| `@typeParam T`        | Generic type parameters                       |
| `@default`            | Default value for optional params/properties  |

### @category for Grouping

Use `@category` to group related symbols together in the JSR docs sidebar:

```typescript
/**
 * Limits the rate of incoming requests.
 * @category Throttling
 */
export class AnonRateThrottle extends BaseThrottle { ... }

/**
 * Controls access to ViewSet endpoints.
 * @category Permissions
 */
export class IsAuthenticated extends BasePermission { ... }
```

Suggested categories per package:

- `@alexi/restframework`: `"ViewSets"`, `"Serializers"`, `"Permissions"`,
  `"Authentication"`, `"Throttling"`, `"Pagination"`, `"Versioning"`,
  `"Renderers"`, `"Routing"`
- `@alexi/db`: `"Models"`, `"Fields"`, `"QuerySet"`, `"Backends"`,
  `"Aggregations"`
- `@alexi/core`: `"Application"`, `"Management"`, `"Configuration"`

### deno doc --lint

Before committing, run the linter to catch missing docs:

```bash
deno doc --lint src/restframework/mod.ts
deno doc --lint src/db/mod.ts
```

Lint catches three issues:

1. Exported symbol references a non-exported type → export the type or add
   `@internal`
2. Missing return type or property type on public symbol
3. Missing JSDoc comment on public symbol → add comment or `@ignore`

## Step 5: Update Prose Documentation

When implementing new features, update relevant documentation:

### Files to Update

| Feature Type          | Documentation to Update                    |
| --------------------- | ------------------------------------------ |
| New backend           | `AGENTS.md`, `docs/django-comparison.md`   |
| New field type        | `AGENTS.md` field tables                   |
| New serializer        | `AGENTS.md` REST Framework section         |
| API changes           | `AGENTS.md` relevant section               |
| New command           | `AGENTS.md` Management Commands table      |
| Django parity         | `docs/django-comparison.md` feature tables |
| Scaffolding templates | `AGENTS.md` Settings Configuration section |

### AGENTS.md Updates

`AGENTS.md` is the primary developer reference. Update it when:

- Adding new exports or public APIs
- Adding new field types, backends, or commands
- Changing method signatures or behavior
- Adding new configuration options

### Django Comparison Updates

`docs/django-comparison.md` tracks feature parity with Django. Update when:

- Implementing a Django feature (change ❌ to ✅)
- Adding Alexi-specific features
- Changing backend support

## Step 6: Write Tests

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
import { reset, setup } from "../../setup.ts";
import { AutoField, CharField, Manager, Model } from "../../models/mod.ts";

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

## Step 7: Run All Checks

Before committing:

```bash
deno task fmt      # Format ENTIRE codebase (required)
deno task lint     # Lint code  
deno task check    # Type check
deno task test     # Run tests
deno doc --lint src/<package>/mod.ts  # Check JSDoc coverage
```

**IMPORTANT:** Always run `deno task fmt` from the project root. This formats
the entire codebase, not just your changed files. CI runs
`deno task fmt --check` and will fail if ANY file in the project needs
formatting. Do NOT run `deno fmt` only on your changed directory - it must be
run on the entire project.

All checks must pass.

## Step 8: Commit Changes

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

Scopes: `db`, `restframework`, `auth`, `core`, `urls`, `middleware`, `admin`,
etc.

## Step 9: Create Pull Request

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
- **Follow existing patterns** - Look at similar code (e.g., DenoKVBackend for
  new backends)
- **snake_case files** - All `.ts` files must be lowercase snake_case
- **JSDoc required** - All exported symbols need JSDoc; run `deno doc --lint`
- **Tests required** - All new functionality needs tests
- **Documentation required** - Update AGENTS.md and docs/ when adding features
- **All checks must pass** - fmt, lint, check, test, deno doc --lint
- **One feature per PR** - Keep PRs focused
- **Link to issue** - Use `Closes #N` in PR body
