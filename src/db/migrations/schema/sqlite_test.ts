/**
 * Tests for SQLiteMigrationSchemaEditor
 *
 * These tests run in `dryRun` mode so no real database connection is required.
 * They verify the generated SQL statements — especially that identifier quoting
 * correctly escapes embedded double-quote characters.
 *
 * @module
 */

import { assertEquals } from "jsr:@std/assert@1";
import type { SQLiteDB } from "../../backends/sqlite/schema_editor.ts";
import { SQLiteMigrationSchemaEditor } from "./sqlite.ts";
import { AutoField, CharField, Manager, Model } from "../../mod.ts";

// Minimal stub — never called in dryRun mode.
const stubDb = null as unknown as SQLiteDB;

// ---------------------------------------------------------------------------
// Snapshot model used by schema operation tests
// ---------------------------------------------------------------------------

class ArticleModel extends Model {
  static override meta = { dbTable: "articles" };
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });

  static objects = new Manager(ArticleModel);
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeEditor(): SQLiteMigrationSchemaEditor {
  return new SQLiteMigrationSchemaEditor(stubDb, { dryRun: true });
}

// ============================================================================
// dropColumn — identifier quoting
// ============================================================================

Deno.test(
  "SQLiteMigrationSchemaEditor: dropColumn quotes identifier correctly",
  async () => {
    const editor = makeEditor();
    await editor.dropColumn("articles", "title");

    const [stmt] = editor.getGeneratedSQL();
    assertEquals(stmt.sql, `ALTER TABLE "articles" DROP COLUMN "title"`);
  },
);

Deno.test(
  "SQLiteMigrationSchemaEditor: dropColumn escapes embedded double-quotes in column name",
  async () => {
    const editor = makeEditor();
    // Simulates a pre-quoted column name arriving as '"title"'
    await editor.dropColumn("articles", '"title"');

    const [stmt] = editor.getGeneratedSQL();
    // The embedded " chars must be doubled; the outer quotes wrap the result.
    assertEquals(
      stmt.sql,
      `ALTER TABLE "articles" DROP COLUMN """title"""`,
    );
  },
);

// ============================================================================
// renameColumn — identifier quoting
// ============================================================================

Deno.test(
  "SQLiteMigrationSchemaEditor: renameColumn quotes identifiers correctly",
  async () => {
    const editor = makeEditor();
    await editor.renameColumn("articles", "title", "_deprecated_0004_title");

    const [stmt] = editor.getGeneratedSQL();
    assertEquals(
      stmt.sql,
      `ALTER TABLE "articles" RENAME COLUMN "title" TO "_deprecated_0004_title"`,
    );
  },
);

Deno.test(
  "SQLiteMigrationSchemaEditor: renameColumn escapes embedded double-quotes in column names",
  async () => {
    const editor = makeEditor();
    await editor.renameColumn("articles", '"title"', "_deprecated_0004_title");

    const [stmt] = editor.getGeneratedSQL();
    assertEquals(
      stmt.sql,
      `ALTER TABLE "articles" RENAME COLUMN """title""" TO "_deprecated_0004_title"`,
    );
  },
);

// ============================================================================
// dropField (via MigrationSchemaEditor) — regression for #374
// ============================================================================

Deno.test(
  "SQLiteMigrationSchemaEditor: dropColumn generates valid SQL for normal column names",
  async () => {
    const editor = makeEditor();
    await editor.dropColumn("articles", "category");

    const [stmt] = editor.getGeneratedSQL();
    // Must NOT produce ""category"" — only one layer of double-quotes.
    assertEquals(
      stmt.sql,
      `ALTER TABLE "articles" DROP COLUMN "category"`,
    );
  },
);
