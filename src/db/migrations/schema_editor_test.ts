/**
 * Tests for MigrationSchemaEditor operation log and auto-reversal
 *
 * Tests run in `recordOnly` mode — no database connection required.
 * They verify that:
 * 1. Each schema operation records the correct `ForwardsOp` entry
 * 2. `autoReverse()` replays the log in the correct inverse order
 *
 * @module
 */

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { IBackendSchemaEditor } from "./schema_editor.ts";
import { MigrationSchemaEditor } from "./schema_editor.ts";
import type { DatabaseBackend } from "../backends/backend.ts";
import {
  AutoField,
  CharField,
  ForeignKey,
  Manager,
  Model,
  OnDelete,
} from "../mod.ts";

// ============================================================================
// Stubs
// ============================================================================

// Minimal stub — never called in recordOnly mode.
const stubBackend = null as unknown as DatabaseBackend;
const stubBackendEditor = null as unknown as IBackendSchemaEditor;

// ---------------------------------------------------------------------------
// Snapshot models used by schema operation tests
// ---------------------------------------------------------------------------

class ArticleModel extends Model {
  static override meta = { dbTable: "articles" };
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  static objects = new Manager(ArticleModel);
}

class UserModel extends Model {
  static override meta = { dbTable: "users" };
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  static objects = new Manager(UserModel);
}

class CategoryModel extends Model {
  static override meta = { dbTable: "categories" };
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  static objects = new Manager(CategoryModel);
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeEditor(migrationName = "0001_initial"): MigrationSchemaEditor {
  return new MigrationSchemaEditor(
    stubBackend,
    stubBackendEditor,
    migrationName,
    { recordOnly: true, verbosity: 0 },
  );
}

// ============================================================================
// Operation log recording
// ============================================================================

Deno.test("MigrationSchemaEditor: records createModel op", async () => {
  const editor = makeEditor();
  await editor.createModel(ArticleModel);

  const log = editor.getOperationLog();
  assertEquals(log.length, 1);
  assertEquals(log[0].type, "createModel");
  if (log[0].type === "createModel") {
    assertEquals(log[0].model, ArticleModel);
  }
});

Deno.test("MigrationSchemaEditor: records deprecateModel op", async () => {
  const editor = makeEditor();
  await editor.deprecateModel(ArticleModel);

  const log = editor.getOperationLog();
  assertEquals(log.length, 1);
  assertEquals(log[0].type, "deprecateModel");
  if (log[0].type === "deprecateModel") {
    assertEquals(log[0].tableName, "articles");
  }
});

Deno.test("MigrationSchemaEditor: records addField op", async () => {
  const editor = makeEditor();
  const field = new CharField({ maxLength: 50 });
  await editor.addField(ArticleModel, "slug", field);

  const log = editor.getOperationLog();
  assertEquals(log.length, 1);
  assertEquals(log[0].type, "addField");
  if (log[0].type === "addField") {
    assertEquals(log[0].fieldName, "slug");
    assertEquals(log[0].field, field);
  }
});

Deno.test("MigrationSchemaEditor: records deprecateField op", async () => {
  const editor = makeEditor();
  await editor.deprecateField(ArticleModel, "title");

  const log = editor.getOperationLog();
  assertEquals(log.length, 1);
  assertEquals(log[0].type, "deprecateField");
  if (log[0].type === "deprecateField") {
    assertEquals(log[0].fieldName, "title");
  }
});

Deno.test("MigrationSchemaEditor: records alterField op", async () => {
  const editor = makeEditor();
  const newField = new CharField({ maxLength: 500 });
  await editor.alterField(ArticleModel, "title", newField);

  const log = editor.getOperationLog();
  assertEquals(log.length, 1);
  assertEquals(log[0].type, "alterField");
  if (log[0].type === "alterField") {
    assertEquals(log[0].fieldName, "title");
    assertEquals(log[0].newField, newField);
  }
});

Deno.test("MigrationSchemaEditor: records createIndex op with resolved name", async () => {
  const editor = makeEditor();
  await editor.createIndex(ArticleModel, ["title", "id"]);

  const log = editor.getOperationLog();
  assertEquals(log.length, 1);
  assertEquals(log[0].type, "createIndex");
  if (log[0].type === "createIndex") {
    assertEquals(log[0].fields, ["title", "id"]);
    assertEquals(log[0].resolvedIndexName, "idx_articles_title_id");
  }
});

Deno.test("MigrationSchemaEditor: records createIndex op with custom name", async () => {
  const editor = makeEditor();
  await editor.createIndex(ArticleModel, ["title"], { name: "my_custom_idx" });

  const log = editor.getOperationLog();
  assertEquals(log.length, 1);
  if (log[0].type === "createIndex") {
    assertEquals(log[0].resolvedIndexName, "my_custom_idx");
  }
});

Deno.test("MigrationSchemaEditor: records executeSQL op", async () => {
  const editor = makeEditor();
  // executeSQL in recordOnly mode does nothing but records the op
  await editor.executeSQL("SELECT 1");

  const log = editor.getOperationLog();
  assertEquals(log.length, 1);
  assertEquals(log[0].type, "executeSQL");
});

Deno.test("MigrationSchemaEditor: hasRawSQL returns false when no executeSQL", async () => {
  const editor = makeEditor();
  await editor.createModel(ArticleModel);
  assertEquals(editor.hasRawSQL(), false);
});

Deno.test("MigrationSchemaEditor: hasRawSQL returns true when executeSQL present", async () => {
  const editor = makeEditor();
  await editor.createModel(ArticleModel);
  await editor.executeSQL("CREATE INDEX ...");
  assertEquals(editor.hasRawSQL(), true);
});

Deno.test("MigrationSchemaEditor: records multiple ops in order", async () => {
  const editor = makeEditor();
  await editor.createModel(ArticleModel);
  await editor.addField(ArticleModel, "slug", new CharField({ maxLength: 50 }));
  await editor.createIndex(ArticleModel, ["slug"]);

  const log = editor.getOperationLog();
  assertEquals(log.length, 3);
  assertEquals(log[0].type, "createModel");
  assertEquals(log[1].type, "addField");
  assertEquals(log[2].type, "createIndex");
});

// ============================================================================
// autoReverse()
// ============================================================================

Deno.test(
  "MigrationSchemaEditor.autoReverse: reverses createModel → deprecateModel",
  async () => {
    // Record forwards ops
    const fwdEditor = makeEditor("0001_initial");
    await fwdEditor.createModel(ArticleModel);
    const log = fwdEditor.getOperationLog();

    // Apply auto-reverse (in recordOnly mode so no DB needed)
    const bwdEditor = makeEditor("0001_initial");
    await bwdEditor.autoReverse(log);

    const bwdLog = bwdEditor.getOperationLog();
    assertEquals(bwdLog.length, 1);
    assertEquals(bwdLog[0].type, "deprecateModel");
  },
);

Deno.test(
  "MigrationSchemaEditor.autoReverse: reverses deprecateModel → restoreModel",
  async () => {
    const fwdEditor = makeEditor("0001_initial");
    await fwdEditor.deprecateModel(ArticleModel);
    const log = fwdEditor.getOperationLog();

    // autoReverse calls restoreModel which is not a logged op (it's a restore,
    // not a schema change) — so we just check it doesn't throw in recordOnly
    const bwdEditor = makeEditor("0001_initial");
    await bwdEditor.autoReverse(log);
    // No error = success
  },
);

Deno.test(
  "MigrationSchemaEditor.autoReverse: reverses addField → deprecateField",
  async () => {
    const fwdEditor = makeEditor("0002_add_slug");
    const field = new CharField({ maxLength: 50 });
    await fwdEditor.addField(ArticleModel, "slug", field);
    const log = fwdEditor.getOperationLog();

    const bwdEditor = makeEditor("0002_add_slug");
    await bwdEditor.autoReverse(log);

    const bwdLog = bwdEditor.getOperationLog();
    assertEquals(bwdLog.length, 1);
    assertEquals(bwdLog[0].type, "deprecateField");
    if (bwdLog[0].type === "deprecateField") {
      assertEquals(bwdLog[0].fieldName, "slug");
    }
  },
);

Deno.test(
  "MigrationSchemaEditor.autoReverse: reverses deprecateField → restoreField",
  async () => {
    const fwdEditor = makeEditor("0003_remove_title");
    await fwdEditor.deprecateField(ArticleModel, "title");
    const log = fwdEditor.getOperationLog();

    // restoreField in recordOnly mode should not throw
    const bwdEditor = makeEditor("0003_remove_title");
    await bwdEditor.autoReverse(log);
    // No error = success
  },
);

Deno.test(
  "MigrationSchemaEditor.autoReverse: reverses multi-step migration in correct order",
  async () => {
    // forwards: createModel, addField(slug), createIndex(slug)
    // backwards should be: dropIndex(slug), deprecateField(slug), deprecateModel
    const fwdEditor = makeEditor("0001_initial");
    await fwdEditor.createModel(ArticleModel);
    await fwdEditor.addField(
      ArticleModel,
      "slug",
      new CharField({ maxLength: 50 }),
    );
    await fwdEditor.createIndex(ArticleModel, ["slug"]);
    const log = fwdEditor.getOperationLog();

    const bwdEditor = makeEditor("0001_initial");
    await bwdEditor.autoReverse(log);

    const bwdLog = bwdEditor.getOperationLog();
    // createIndex → dropIndex (recorded)
    // addField    → deprecateField (recorded)
    // createModel → deprecateModel (recorded)
    assertEquals(bwdLog.length, 3);
    assertEquals(bwdLog[0].type, "dropIndex");
    assertEquals(bwdLog[1].type, "deprecateField");
    assertEquals(bwdLog[2].type, "deprecateModel");
  },
);

Deno.test(
  "MigrationSchemaEditor.autoReverse: throws when log contains executeSQL",
  async () => {
    const fwdEditor = makeEditor("0001_initial");
    await fwdEditor.createModel(ArticleModel);
    await fwdEditor.executeSQL("CREATE UNIQUE INDEX ...");
    const log = fwdEditor.getOperationLog();

    const bwdEditor = makeEditor("0001_initial");
    await assertRejects(
      () => bwdEditor.autoReverse(log),
      Error,
      "Cannot auto-reverse",
    );
  },
);

Deno.test(
  "MigrationSchemaEditor.autoReverse: reverses two models independently",
  async () => {
    const fwdEditor = makeEditor("0001_initial");
    await fwdEditor.createModel(UserModel);
    await fwdEditor.createModel(ArticleModel);
    const log = fwdEditor.getOperationLog();

    const bwdEditor = makeEditor("0001_initial");
    await bwdEditor.autoReverse(log);

    const bwdLog = bwdEditor.getOperationLog();
    assertEquals(bwdLog.length, 2);
    // Order reversed
    assertEquals(bwdLog[0].type, "deprecateModel");
    if (bwdLog[0].type === "deprecateModel") {
      assertEquals(bwdLog[0].tableName, "articles"); // ArticleModel first in backwards
    }
    assertEquals(bwdLog[1].type, "deprecateModel");
    if (bwdLog[1].type === "deprecateModel") {
      assertEquals(bwdLog[1].tableName, "users");
    }
  },
);

// ============================================================================
// fix #455 — deprecateField resolves FK column name (_id suffix)
// ============================================================================

Deno.test(
  "MigrationSchemaEditor: deprecateField without field arg uses fieldName as-is",
  async () => {
    const editor = makeEditor();
    await editor.deprecateField(ArticleModel, "title");

    const log = editor.getOperationLog();
    assertEquals(log.length, 1);
    assertEquals(log[0].type, "deprecateField");
    if (log[0].type === "deprecateField") {
      assertEquals(log[0].fieldName, "title");
      // No field provided → columnName equals fieldName
      assertEquals(log[0].columnName, "title");
    }
  },
);

Deno.test(
  "MigrationSchemaEditor: deprecateField with ForeignKey field resolves _id suffix",
  async () => {
    const editor = makeEditor();
    const fkField = new ForeignKey<CategoryModel>("CategoryModel", {
      onDelete: OnDelete.CASCADE,
    });
    await editor.deprecateField(ArticleModel, "category", fkField);

    const log = editor.getOperationLog();
    assertEquals(log.length, 1);
    assertEquals(log[0].type, "deprecateField");
    if (log[0].type === "deprecateField") {
      assertEquals(log[0].fieldName, "category");
      // ForeignKey → column name must be category_id
      assertEquals(log[0].columnName, "category_id");
    }
  },
);

Deno.test(
  "MigrationSchemaEditor: deprecateField with CharField field keeps fieldName",
  async () => {
    const editor = makeEditor();
    const field = new CharField({ maxLength: 50 });
    await editor.deprecateField(ArticleModel, "slug", field);

    const log = editor.getOperationLog();
    assertEquals(log.length, 1);
    if (log[0].type === "deprecateField") {
      assertEquals(log[0].columnName, "slug");
    }
  },
);

Deno.test(
  "MigrationSchemaEditor.autoReverse: reverses deprecateField FK → restoreField uses columnName",
  async () => {
    // If a FK field was deprecated in forwards(), autoReverse must
    // restore using the DB column name (category_id), not the JS field
    // name (category).
    const fwdEditor = makeEditor("0003_remove_fk");
    const fkField = new ForeignKey<CategoryModel>("CategoryModel", {
      onDelete: OnDelete.CASCADE,
    });
    await fwdEditor.deprecateField(ArticleModel, "category", fkField);
    const log = fwdEditor.getOperationLog();

    // Verify the recorded columnName is category_id
    if (log[0].type === "deprecateField") {
      assertEquals(log[0].columnName, "category_id");
    }

    // autoReverse should call restoreField without error (recordOnly)
    const bwdEditor = makeEditor("0003_remove_fk");
    await bwdEditor.autoReverse(log); // must not throw
  },
);

// ============================================================================
// fix #456 — dropModel method
// ============================================================================

Deno.test("MigrationSchemaEditor: records dropModel op", async () => {
  const editor = makeEditor();
  await editor.dropModel(ArticleModel);

  const log = editor.getOperationLog();
  assertEquals(log.length, 1);
  assertEquals(log[0].type, "dropModel");
  if (log[0].type === "dropModel") {
    assertEquals(log[0].tableName, "articles");
  }
});

Deno.test(
  "MigrationSchemaEditor.autoReverse: skips dropModel (cannot recreate permanently dropped table)",
  async () => {
    // If a migration calls dropModel() in forwards(), autoReverse() must
    // not attempt to recreate the table — it just skips silently.
    const fwdEditor = makeEditor("0004_drop_articles");
    await fwdEditor.dropModel(ArticleModel);
    const log = fwdEditor.getOperationLog();

    const bwdEditor = makeEditor("0004_drop_articles");
    await bwdEditor.autoReverse(log); // must not throw

    // The bwdLog should be empty — nothing can be done to reverse a permanent drop
    const bwdLog = bwdEditor.getOperationLog();
    assertEquals(bwdLog.length, 0);
  },
);
