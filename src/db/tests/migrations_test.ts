/**
 * Tests for Alexi Database Migrations
 *
 * NOTE: Integration tests (MigrationExecutor, MigrationRecorder) require PostgreSQL.
 * These tests use raw SQL queries which are not supported by DenoKV.
 * Run integration tests with: deno test --filter "Integration" --allow-all
 *
 * @module
 */

import { assertEquals, assertExists, assertThrows } from "jsr:@std/assert";

import {
  DataMigration,
  Migration,
  MigrationExecutor,
  MigrationLoader,
  MigrationRecorder,
  MigrationSchemaEditor,
} from "../migrations/mod.ts";

import { AutoField, CharField, IntegerField, Manager, Model } from "../mod.ts";

// ============================================================================
// Test Models (snapshots for migrations)
// ============================================================================

class UserModel extends Model {
  static override meta = { dbTable: "users" };
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  static objects = new Manager(UserModel);
}

class UserModelV2 extends Model {
  static override meta = { dbTable: "users" };
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  email = new CharField({ maxLength: 255 });

  static objects = new Manager(UserModelV2);
}

class ArticleModel extends Model {
  static override meta = { dbTable: "articles" };
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  views = new IntegerField({ default: 0 });

  static objects = new Manager(ArticleModel);
}

// ============================================================================
// Test Migrations
// ============================================================================

class Migration0001 extends Migration {
  override name = "0001_initial";
  override dependencies = [];

  override async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.createModel(UserModel);
  }

  override async backwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.deprecateModel(UserModel);
  }
}

class Migration0002 extends Migration {
  override name = "0002_add_user_email";
  override dependencies = ["0001_initial"];

  override async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.addField(
      UserModel,
      "email",
      new CharField({ maxLength: 255 }),
    );
  }

  override async backwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.deprecateField(UserModel, "email");
  }
}

class Migration0003 extends Migration {
  override name = "0003_create_articles";
  override dependencies = ["0001_initial"];

  override async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.createModel(ArticleModel);
  }

  override async backwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.deprecateModel(ArticleModel);
  }
}

class IrreversibleMigration extends DataMigration {
  override name = "0004_data_migration";
  override dependencies = ["0002_add_user_email"];

  override async forwards(_schema: MigrationSchemaEditor): Promise<void> {
    // Data migration logic
  }

  override async backwards(_schema: MigrationSchemaEditor): Promise<void> {
    throw new Error("This migration cannot be reversed");
  }
}

// ============================================================================
// Migration Base Class Tests
// ============================================================================

Deno.test("Migration - name property", () => {
  const migration = new Migration0001();
  assertEquals(migration.name, "0001_initial");
});

Deno.test("Migration - dependencies property", () => {
  const migration = new Migration0002();
  assertEquals(migration.dependencies, ["0001_initial"]);
});

Deno.test("Migration - reversible property defaults to true", () => {
  const migration = new Migration0001();
  assertEquals(migration.reversible, true);
  assertEquals(migration.canReverse(), true);
});

Deno.test("DataMigration - reversible defaults to false", () => {
  const migration = new IrreversibleMigration();
  assertEquals(migration.reversible, false);
  assertEquals(migration.canReverse(), false);
});

Deno.test("Migration - getFullName without appLabel", () => {
  const migration = new Migration0001();
  assertEquals(migration.getFullName(), "0001_initial");
});

Deno.test("Migration - getFullName with appLabel", () => {
  const migration = new Migration0001();
  migration.appLabel = "users";
  assertEquals(migration.getFullName(), "users.0001_initial");
});

Deno.test("Migration - parseDependency with string", () => {
  const migration = new Migration0002();
  migration.appLabel = "users";
  const [app, name] = migration.parseDependency("0001_initial");
  assertEquals(app, "users");
  assertEquals(name, "0001_initial");
});

Deno.test("Migration - parseDependency with tuple", () => {
  const migration = new Migration0002();
  migration.appLabel = "posts";
  const [app, name] = migration.parseDependency(["auth", "0001_create_user"]);
  assertEquals(app, "auth");
  assertEquals(name, "0001_create_user");
});

Deno.test("Migration - getResolvedDependencies", () => {
  const migration = new Migration0002();
  migration.appLabel = "users";
  const deps = migration.getResolvedDependencies();
  assertEquals(deps, ["users.0001_initial"]);
});

// ============================================================================
// Migration Loader Tests
// ============================================================================

Deno.test("MigrationLoader - register migration", () => {
  const loader = new MigrationLoader();
  const migration = new Migration0001();

  loader.register(migration, "users");

  assertEquals(migration.appLabel, "users");
  assertExists(loader.getMigration("users.0001_initial"));
});

Deno.test("MigrationLoader - getAppLabels", () => {
  const loader = new MigrationLoader();

  loader.register(new Migration0001(), "users");
  loader.register(new Migration0003(), "posts");

  const labels = loader.getAppLabels();
  assertEquals(labels, ["posts", "users"]); // sorted
});

Deno.test("MigrationLoader - getMigrationsForApp", () => {
  const loader = new MigrationLoader();

  loader.register(new Migration0001(), "users");
  loader.register(new Migration0002(), "users");
  loader.register(new Migration0003(), "posts");

  const userMigrations = loader.getMigrationsForApp("users");
  assertEquals(userMigrations.length, 2);
  assertEquals(userMigrations[0].name, "0001_initial");
  assertEquals(userMigrations[1].name, "0002_add_user_email");
});

Deno.test("MigrationLoader - hasMigrations", () => {
  const loader = new MigrationLoader();
  assertEquals(loader.hasMigrations(), false);

  loader.register(new Migration0001(), "users");
  assertEquals(loader.hasMigrations(), true);
});

Deno.test("MigrationLoader - topological sort simple", () => {
  const loader = new MigrationLoader();

  // Register in wrong order
  loader.register(new Migration0002(), "users");
  loader.register(new Migration0001(), "users");

  const ordered = loader.getOrderedMigrations();

  assertEquals(ordered.length, 2);
  assertEquals(ordered[0].name, "0001_initial");
  assertEquals(ordered[1].name, "0002_add_user_email");
});

Deno.test("MigrationLoader - topological sort multi-dependency", () => {
  const loader = new MigrationLoader();

  // Both 0002 and 0003 depend on 0001
  loader.register(new Migration0003(), "users");
  loader.register(new Migration0002(), "users");
  loader.register(new Migration0001(), "users");

  const ordered = loader.getOrderedMigrations();

  assertEquals(ordered.length, 3);
  assertEquals(ordered[0].name, "0001_initial");
  // Either 0002 or 0003 can come next since they both depend only on 0001
});

Deno.test("MigrationLoader - getLeafMigrations", () => {
  const loader = new MigrationLoader();

  loader.register(new Migration0001(), "users");
  loader.register(new Migration0002(), "users");

  const leaves = loader.getLeafMigrations();

  assertEquals(leaves.length, 1);
  assertEquals(leaves[0].name, "0002_add_user_email");
});

Deno.test("MigrationLoader - getDependents", () => {
  const loader = new MigrationLoader();

  loader.register(new Migration0001(), "users");
  loader.register(new Migration0002(), "users");
  loader.register(new Migration0003(), "users");

  const dependents = loader.getDependents("users.0001_initial");

  assertEquals(dependents.length, 2);
});

Deno.test("MigrationLoader - getDependencies", () => {
  const loader = new MigrationLoader();

  loader.register(new Migration0001(), "users");
  loader.register(new Migration0002(), "users");

  const deps = loader.getDependencies("users.0002_add_user_email");

  assertEquals(deps.length, 1);
  assertEquals(deps[0].name, "0001_initial");
});

Deno.test("MigrationLoader - circular dependency detection", () => {
  // Create migrations with circular dependencies
  class CircularA extends Migration {
    override name = "circular_a";
    override dependencies = ["circular_b"]; // depends on B

    override async forwards(_schema: MigrationSchemaEditor): Promise<void> {}
    override async backwards(_schema: MigrationSchemaEditor): Promise<void> {}
  }

  class CircularB extends Migration {
    override name = "circular_b";
    override dependencies = ["circular_a"]; // depends on A

    override async forwards(_schema: MigrationSchemaEditor): Promise<void> {}
    override async backwards(_schema: MigrationSchemaEditor): Promise<void> {}
  }

  const loader = new MigrationLoader();
  loader.register(new CircularA(), "app");
  loader.register(new CircularB(), "app");

  assertThrows(
    () => loader.getOrderedMigrations(),
    Error,
    "Circular dependency",
  );
});

Deno.test("MigrationLoader - missing dependency detection", () => {
  class MissingDep extends Migration {
    override name = "missing_dep";
    override dependencies = ["nonexistent"];

    override async forwards(_schema: MigrationSchemaEditor): Promise<void> {}
    override async backwards(_schema: MigrationSchemaEditor): Promise<void> {}
  }

  const loader = new MigrationLoader();
  loader.register(new MissingDep(), "app");

  assertThrows(
    () => loader.getOrderedMigrations(),
    Error,
    "not found",
  );
});

// ============================================================================
// MigrationExecutor Unit Tests (no database required)
// ============================================================================

Deno.test("MigrationExecutor - constructor", () => {
  // Mock backend for unit testing
  const mockBackend = {
    tableExists: async () => false,
    executeRaw: async () => [],
    getSchemaEditor: () => ({}),
  } as unknown as import("../backends/backend.ts").DatabaseBackend;

  const loader = new MigrationLoader();
  const executor = new MigrationExecutor(mockBackend, loader);

  assertExists(executor);
  assertExists(executor.getRecorder());
  assertExists(executor.getDeprecationRecorder());
});

Deno.test("MigrationRecorder - constructor", () => {
  const mockBackend = {
    tableExists: async () => false,
    executeRaw: async () => [],
  } as unknown as import("../backends/backend.ts").DatabaseBackend;

  const recorder = new MigrationRecorder(mockBackend);
  assertExists(recorder);
});

// ============================================================================
// Integration Tests (require PostgreSQL)
// ============================================================================

// NOTE: The following tests require a PostgreSQL database and are marked as ignored.
// To run these tests, set up a PostgreSQL database and update the connection details.
//
// Run with: deno test --filter "Integration" --allow-all
//
// Example PostgreSQL setup:
//   await setup({
//     database: {
//       engine: "postgres",
//       name: "test_migrations",
//       host: "localhost",
//       port: 5432,
//       user: "postgres",
//       password: "postgres",
//     },
//   });

Deno.test({
  name: "Integration - apply and rollback migration (requires PostgreSQL)",
  ignore: true, // Requires PostgreSQL
  fn: async () => {
    // This test would:
    // 1. Set up PostgreSQL connection
    // 2. Apply migration
    // 3. Verify it was recorded
    // 4. Roll back
    // 5. Verify it was removed
  },
});

Deno.test({
  name: "Integration - dry run does not modify database (requires PostgreSQL)",
  ignore: true, // Requires PostgreSQL
  fn: async () => {
    // This test would verify dry run mode
  },
});

Deno.test({
  name:
    "Integration - migrate multiple migrations in order (requires PostgreSQL)",
  ignore: true, // Requires PostgreSQL
  fn: async () => {
    // This test would verify migration ordering
  },
});

Deno.test({
  name: "Integration - filter by app label (requires PostgreSQL)",
  ignore: true, // Requires PostgreSQL
  fn: async () => {
    // This test would verify app label filtering
  },
});

Deno.test({
  name: "Integration - MigrationRecorder operations (requires PostgreSQL)",
  ignore: true, // Requires PostgreSQL
  fn: async () => {
    // This test would verify recorder operations
  },
});

Deno.test({
  name:
    "Integration - test mode forward-backward-forward (requires PostgreSQL)",
  ignore: true, // Requires PostgreSQL
  fn: async () => {
    // This test would verify --test mode
  },
});
