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
  categorizeChanges,
  createMigrationRecorder,
  DataMigration,
  formatChange,
  Migration,
  MigrationExecutor,
  MigrationLoader,
  MigrationNamer,
  MigrationSchemaEditor,
  ModelState,
  ProjectState,
  StateComparator,
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
    // Data migration logic - no backwards() method means it cannot be reversed
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

Deno.test("Migration - canReverse() returns true when backwards() is implemented", () => {
  const migration = new Migration0001();
  assertEquals(migration.canReverse(), true);
});

Deno.test("DataMigration - canReverse() returns false when backwards() is not implemented", () => {
  const migration = new IrreversibleMigration();
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

Deno.test("MigrationRecorder - constructor with factory", () => {
  const mockBackend = {
    tableExists: async () => false,
    executeRaw: async () => [],
  } as unknown as import("../backends/backend.ts").DatabaseBackend;

  const recorder = createMigrationRecorder(mockBackend);
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

// ============================================================================
// ProjectState and ModelState Tests
// ============================================================================

Deno.test("ModelState - fromModel creates correct state", () => {
  const state = ModelState.fromModel(UserModel, "myapp");

  assertEquals(state.name, "UserModel");
  assertEquals(state.appLabel, "myapp");
  assertEquals(state.dbTable, "users");
  assertEquals(state.getFullName(), "myapp.UserModel");

  // Check fields exist
  const fieldNames = state.getFieldNames();
  assertEquals(fieldNames.includes("id"), true);
  assertEquals(fieldNames.includes("name"), true);
});

Deno.test("ModelState - field type is correctly captured", () => {
  const state = ModelState.fromModel(UserModel, "myapp");

  const idField = state.getField("id");
  assertExists(idField);
  assertEquals(idField.type, "AutoField");

  const nameField = state.getField("name");
  assertExists(nameField);
  assertEquals(nameField.type, "CharField");
  assertEquals(nameField.options.maxLength, 100);
});

Deno.test("ModelState - withAddedField returns new state", () => {
  const state = ModelState.fromModel(UserModel, "myapp");
  const newState = state.withAddedField("email", {
    type: "CharField",
    options: { maxLength: 255 },
    columnName: "email",
  });

  // Original unchanged
  assertEquals(state.hasField("email"), false);

  // New state has field
  assertEquals(newState.hasField("email"), true);
  assertEquals(newState.getField("email")?.type, "CharField");
});

Deno.test("ModelState - withRemovedField returns new state", () => {
  const state = ModelState.fromModel(UserModel, "myapp");
  const newState = state.withRemovedField("name");

  // Original unchanged
  assertEquals(state.hasField("name"), true);

  // New state doesn't have field
  assertEquals(newState.hasField("name"), false);
});

Deno.test("ProjectState - fromModels creates correct state", () => {
  const models = new Map<string, Array<new () => Model>>([
    ["myapp", [UserModel, ArticleModel]],
  ]);

  const state = ProjectState.fromModels(models);

  assertEquals(state.hasModel("myapp.UserModel"), true);
  assertEquals(state.hasModel("myapp.ArticleModel"), true);
  assertEquals(state.hasModel("myapp.NonExistent"), false);
});

Deno.test("ProjectState - getAppLabels returns sorted labels", () => {
  const models = new Map<string, Array<new () => Model>>([
    ["zapp", [UserModel]],
    ["aapp", [ArticleModel]],
  ]);

  const state = ProjectState.fromModels(models);
  const labels = state.getAppLabels();

  assertEquals(labels, ["aapp", "zapp"]);
});

Deno.test("ProjectState - withAddedModel returns new state", () => {
  const state = ProjectState.empty();
  const modelState = ModelState.fromModel(UserModel, "myapp");
  const newState = state.withAddedModel(modelState);

  assertEquals(state.hasModel("myapp.UserModel"), false);
  assertEquals(newState.hasModel("myapp.UserModel"), true);
});

Deno.test("ProjectState - withRemovedModel returns new state", () => {
  const models = new Map<string, Array<new () => Model>>([
    ["myapp", [UserModel]],
  ]);
  const state = ProjectState.fromModels(models);
  const newState = state.withRemovedModel("myapp.UserModel");

  assertEquals(state.hasModel("myapp.UserModel"), true);
  assertEquals(newState.hasModel("myapp.UserModel"), false);
});

Deno.test("ProjectState - JSON serialization roundtrip", () => {
  const models = new Map<string, Array<new () => Model>>([
    ["myapp", [UserModel, ArticleModel]],
  ]);
  const state = ProjectState.fromModels(models);

  const json = state.toJSON();
  const restored = ProjectState.fromJSON(json);

  assertEquals(restored.hasModel("myapp.UserModel"), true);
  assertEquals(restored.hasModel("myapp.ArticleModel"), true);

  const userModel = restored.getModel("myapp.UserModel");
  assertExists(userModel);
  assertEquals(userModel.dbTable, "users");
});

// ============================================================================
// StateComparator Tests
// ============================================================================

Deno.test("StateComparator - detect create_model", () => {
  const fromState = ProjectState.empty();
  const toState = ProjectState.empty().withAddedModel(
    ModelState.fromModel(UserModel, "myapp"),
  );

  const comparator = new StateComparator();
  const changes = comparator.compare(fromState, toState);

  assertEquals(changes.length, 1);
  assertEquals(changes[0].type, "create_model");
  assertEquals((changes[0] as { modelName: string }).modelName, "UserModel");
});

Deno.test("StateComparator - detect delete_model", () => {
  const fromState = ProjectState.empty().withAddedModel(
    ModelState.fromModel(UserModel, "myapp"),
  );
  const toState = ProjectState.empty();

  const comparator = new StateComparator();
  const changes = comparator.compare(fromState, toState);

  assertEquals(changes.length, 1);
  assertEquals(changes[0].type, "delete_model");
  assertEquals((changes[0] as { modelName: string }).modelName, "UserModel");
});

Deno.test("StateComparator - detect add_field", () => {
  // Create state manually to ensure same model name
  const userState = ModelState.fromModel(UserModel, "myapp");
  const userStateWithEmail = userState.withAddedField("email", {
    type: "CharField",
    options: { maxLength: 255 },
    columnName: "email",
  });

  const fromState = ProjectState.empty().withAddedModel(userState);
  const toState = ProjectState.empty().withAddedModel(userStateWithEmail);

  const comparator = new StateComparator({ detectRenames: false });
  const changes = comparator.compare(fromState, toState);

  // Should detect the added "email" field
  const addFieldChanges = changes.filter((c) => c.type === "add_field");
  assertEquals(addFieldChanges.length, 1);
  assertEquals(
    (addFieldChanges[0] as { fieldName: string }).fieldName,
    "email",
  );
});

Deno.test("StateComparator - detect remove_field", () => {
  // Create state with email field, then remove it
  const userState = ModelState.fromModel(UserModel, "myapp");
  const userStateWithEmail = userState.withAddedField("email", {
    type: "CharField",
    options: { maxLength: 255 },
    columnName: "email",
  });

  const fromState = ProjectState.empty().withAddedModel(userStateWithEmail);
  const toState = ProjectState.empty().withAddedModel(userState);

  const comparator = new StateComparator({ detectRenames: false });
  const changes = comparator.compare(fromState, toState);

  // Should detect the removed "email" field
  const removeFieldChanges = changes.filter((c) => c.type === "remove_field");
  assertEquals(removeFieldChanges.length, 1);
  assertEquals(
    (removeFieldChanges[0] as { fieldName: string }).fieldName,
    "email",
  );
});

Deno.test("StateComparator - detect alter_field", () => {
  const userV1 = ModelState.fromModel(UserModel, "myapp");

  // Copy all options from original field and only change maxLength
  const originalNameField = userV1.getField("name")!;
  const userV2 = userV1.withAlteredField("name", {
    type: "CharField",
    options: { ...originalNameField.options, maxLength: 200 }, // Changed from 100 to 200
    columnName: "name",
  });

  const fromState = ProjectState.empty().withAddedModel(userV1);
  const toState = ProjectState.empty().withAddedModel(userV2);

  const comparator = new StateComparator();
  const changes = comparator.compare(fromState, toState);

  assertEquals(changes.length, 1);
  assertEquals(changes[0].type, "alter_field");
  assertEquals((changes[0] as { fieldName: string }).fieldName, "name");
  assertEquals((changes[0] as { changes: string[] }).changes, ["maxLength"]);
});

Deno.test("StateComparator - no changes for identical states", () => {
  const state = ProjectState.empty().withAddedModel(
    ModelState.fromModel(UserModel, "myapp"),
  );

  const comparator = new StateComparator();
  const changes = comparator.compare(state, state.clone());

  assertEquals(changes.length, 0);
});

Deno.test("formatChange - formats create_model correctly", () => {
  const change = {
    type: "create_model" as const,
    appLabel: "myapp",
    modelName: "User",
    model: {} as ModelState,
  };

  assertEquals(formatChange(change), "+ myapp.User");
});

Deno.test("formatChange - formats add_field correctly", () => {
  const change = {
    type: "add_field" as const,
    appLabel: "myapp",
    modelName: "User",
    fieldName: "email",
    field: { type: "CharField", options: {}, columnName: "email" },
  };

  assertEquals(formatChange(change), "+ myapp.User.email: CharField");
});

Deno.test("categorizeChanges - init prefix for single create_model", () => {
  const changes = [
    {
      type: "create_model" as const,
      appLabel: "myapp",
      modelName: "User",
      model: {} as ModelState,
    },
  ];

  const result = categorizeChanges(changes);
  assertEquals(result.prefix, "init");
  assertEquals(result.description, "user");
});

Deno.test("categorizeChanges - feat prefix for add operations", () => {
  const changes = [
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "email",
      field: { type: "CharField", options: {}, columnName: "email" },
    },
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "phone",
      field: { type: "CharField", options: {}, columnName: "phone" },
    },
  ];

  const result = categorizeChanges(changes);
  assertEquals(result.prefix, "feat");
  assertEquals(result.description, "user"); // Same model
});

Deno.test("categorizeChanges - soft_delete pattern detection", () => {
  const changes = [
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "deletedAt",
      field: { type: "DateTimeField", options: {}, columnName: "deleted_at" },
    },
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "Article",
      fieldName: "deletedAt",
      field: { type: "DateTimeField", options: {}, columnName: "deleted_at" },
    },
  ];

  const result = categorizeChanges(changes);
  assertEquals(result.prefix, "feat");
  assertEquals(result.description, "soft_delete");
});

// ============================================================================
// MigrationNamer Tests
// ============================================================================

Deno.test("MigrationNamer - suggestName returns 0001 for first migration", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "create_model" as const,
      appLabel: "myapp",
      modelName: "User",
      model: {} as ModelState,
    },
  ];

  const suggestion = namer.suggestName(changes, []);

  assertEquals(suggestion.fullName.startsWith("0001_"), true);
  assertEquals(suggestion.prefix, "init");
  assertEquals(suggestion.description, "user");
  assertEquals(suggestion.confidence >= 0.9, true);
});

Deno.test("MigrationNamer - increments migration number correctly", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "email",
      field: { type: "CharField", options: {}, columnName: "email" },
    },
  ];

  const suggestion = namer.suggestName(changes, [
    "0001_init_user",
    "0002_feat_profile",
  ]);

  assertEquals(suggestion.fullName.startsWith("0003_"), true);
});

Deno.test("MigrationNamer - handles non-sequential migration numbers", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "email",
      field: { type: "CharField", options: {}, columnName: "email" },
    },
  ];

  // Migrations out of order
  const suggestion = namer.suggestName(changes, [
    "0001_init_user",
    "0010_feat_something",
    "0005_feat_other",
  ]);

  assertEquals(suggestion.fullName.startsWith("0011_"), true);
});

Deno.test("MigrationNamer - uses init prefix for single model creation", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "create_model" as const,
      appLabel: "myapp",
      modelName: "ArticleModel",
      model: {} as ModelState,
    },
  ];

  const suggestion = namer.suggestName(changes, []);

  assertEquals(suggestion.prefix, "init");
  assertEquals(suggestion.description, "article");
  assertEquals(suggestion.reason.includes("Initial migration"), true);
});

Deno.test("MigrationNamer - uses feat prefix for add_field", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "email",
      field: { type: "CharField", options: {}, columnName: "email" },
    },
  ];

  const suggestion = namer.suggestName(changes, ["0001_init_user"]);

  assertEquals(suggestion.prefix, "feat");
  assertEquals(suggestion.fullName, "0002_feat_user");
});

Deno.test("MigrationNamer - uses fix prefix for alter_field", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "alter_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "name",
      changes: ["maxLength"],
      oldField: {
        type: "CharField",
        options: { maxLength: 100 },
        columnName: "name",
      },
      newField: {
        type: "CharField",
        options: { maxLength: 200 },
        columnName: "name",
      },
    },
  ];

  const suggestion = namer.suggestName(changes, ["0001_init_user"]);

  assertEquals(suggestion.prefix, "fix");
});

Deno.test("MigrationNamer - uses remove prefix for delete operations", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "remove_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "legacyField",
      field: { type: "CharField", options: {}, columnName: "legacy_field" },
    },
  ];

  const suggestion = namer.suggestName(changes, ["0001_init_user"]);

  assertEquals(suggestion.prefix, "remove");
});

Deno.test("MigrationNamer - uses refactor prefix for mixed operations", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "newField",
      field: { type: "CharField", options: {}, columnName: "new_field" },
    },
    {
      type: "remove_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "oldField",
      field: { type: "CharField", options: {}, columnName: "old_field" },
    },
  ];

  const suggestion = namer.suggestName(changes, ["0001_init_user"]);

  assertEquals(suggestion.prefix, "refactor");
});

Deno.test("MigrationNamer - detects soft_delete semantic pattern", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "deletedAt",
      field: { type: "DateTimeField", options: {}, columnName: "deleted_at" },
    },
  ];

  const suggestion = namer.suggestName(changes, ["0001_init_user"]);

  assertEquals(suggestion.prefix, "feat");
  assertEquals(suggestion.description, "soft_delete");
  assertEquals(suggestion.confidence >= 0.85, true);
});

Deno.test("MigrationNamer - detects timestamps semantic pattern", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "createdAt",
      field: { type: "DateTimeField", options: {}, columnName: "created_at" },
    },
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "updatedAt",
      field: { type: "DateTimeField", options: {}, columnName: "updated_at" },
    },
  ];

  const suggestion = namer.suggestName(changes, ["0001_init_user"]);

  assertEquals(suggestion.prefix, "feat");
  assertEquals(suggestion.description, "timestamps");
});

Deno.test("MigrationNamer - converts CamelCase model names to snake_case", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "create_model" as const,
      appLabel: "myapp",
      modelName: "UserProfile",
      model: {} as ModelState,
    },
  ];

  const suggestion = namer.suggestName(changes, []);

  assertEquals(suggestion.description, "user_profile");
});

Deno.test("MigrationNamer - strips Model suffix from name", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "create_model" as const,
      appLabel: "myapp",
      modelName: "ArticleModel",
      model: {} as ModelState,
    },
  ];

  const suggestion = namer.suggestName(changes, []);

  assertEquals(suggestion.description, "article");
});

Deno.test("MigrationNamer - handles empty changes", () => {
  const namer = new MigrationNamer();
  const suggestion = namer.suggestName([], []);

  assertEquals(suggestion.fullName, "0001_feat_changes");
  assertEquals(suggestion.confidence <= 0.2, true);
});

Deno.test("MigrationNamer - suggestNames returns multiple alternatives", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "email",
      field: { type: "CharField", options: {}, columnName: "email" },
    },
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "Profile",
      fieldName: "bio",
      field: { type: "TextField", options: {}, columnName: "bio" },
    },
  ];

  const suggestions = namer.suggestNames(changes, []);

  // Should have at least primary suggestion and model names alternative
  assertEquals(suggestions.length >= 2, true);

  // Check that alternative with model names exists
  const modelNamesAlt = suggestions.find(
    (s) => s.description.includes("user") && s.description.includes("profile"),
  );
  assertExists(modelNamesAlt);
});

Deno.test("MigrationNamer - field-based description for single field add", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "avatarUrl",
      field: { type: "URLField", options: {}, columnName: "avatar_url" },
    },
  ];

  // When adding a single non-semantic field, should use model name
  const suggestion = namer.suggestName(changes, []);

  assertEquals(suggestion.prefix, "feat");
  assertEquals(suggestion.description, "user");
});

Deno.test("MigrationNamer - creates reason message", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "add_field" as const,
      appLabel: "myapp",
      modelName: "User",
      fieldName: "email",
      field: { type: "CharField", options: {}, columnName: "email" },
    },
  ];

  const suggestion = namer.suggestName(changes, []);

  assertEquals(typeof suggestion.reason, "string");
  assertEquals(suggestion.reason.length > 0, true);
  assertEquals(suggestion.reason.toLowerCase().includes("user"), true);
});

Deno.test("MigrationNamer - multiple create_model creates combined name", () => {
  const namer = new MigrationNamer();
  const changes = [
    {
      type: "create_model" as const,
      appLabel: "myapp",
      modelName: "User",
      model: {} as ModelState,
    },
    {
      type: "create_model" as const,
      appLabel: "myapp",
      modelName: "Profile",
      model: {} as ModelState,
    },
  ];

  const suggestion = namer.suggestName(changes, []);

  // With multiple models, uses feat prefix (not init)
  assertEquals(suggestion.prefix, "feat");
  // Description should contain both model names
  assertEquals(suggestion.description.includes("user"), true);
  assertEquals(suggestion.description.includes("profile"), true);
});
