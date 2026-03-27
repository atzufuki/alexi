/**
 * Tests for PostgresMigrationSchemaEditor
 *
 * Runs in `dryRun` mode — no real database connection required.
 * Verifies that `FileField` and `ImageField` produce `VARCHAR(500)` columns
 * in the generated `CREATE TABLE` SQL (regression test for #435).
 *
 * @module
 */

import { assertMatch, assertStringIncludes } from "jsr:@std/assert@1";
import type { Pool } from "npm:pg@8";
import { PostgresMigrationSchemaEditor } from "./postgres.ts";
import { AutoField, FileField, ImageField, Manager, Model } from "../../mod.ts";

// Minimal stub — never called in dryRun mode.
const stubPool = null as unknown as Pool;

function makeEditor(): PostgresMigrationSchemaEditor {
  return new PostgresMigrationSchemaEditor(stubPool, { dryRun: true });
}

// ---------------------------------------------------------------------------
// Snapshot model with FileField and ImageField
// ---------------------------------------------------------------------------

class DocumentModel extends Model {
  static override meta = { dbTable: "documents" };
  id = new AutoField({ primaryKey: true });
  attachment = new FileField({ uploadTo: "attachments/" });
  thumbnail = new ImageField({ uploadTo: "thumbnails/" });

  static objects = new Manager(DocumentModel);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test(
  "PostgresMigrationSchemaEditor: FileField maps to VARCHAR(500)",
  async () => {
    const editor = makeEditor();
    await editor.createTable(DocumentModel);

    const [stmt] = editor.getGeneratedSQL();
    assertStringIncludes(
      stmt.sql,
      `"attachment" VARCHAR(500)`,
      "FileField column should be VARCHAR(500)",
    );
  },
);

Deno.test(
  "PostgresMigrationSchemaEditor: ImageField maps to VARCHAR(500)",
  async () => {
    const editor = makeEditor();
    await editor.createTable(DocumentModel);

    const [stmt] = editor.getGeneratedSQL();
    assertStringIncludes(
      stmt.sql,
      `"thumbnail" VARCHAR(500)`,
      "ImageField column should be VARCHAR(500)",
    );
  },
);

Deno.test(
  "PostgresMigrationSchemaEditor: CREATE TABLE includes both file columns",
  async () => {
    const editor = makeEditor();
    await editor.createTable(DocumentModel);

    const [stmt] = editor.getGeneratedSQL();
    // Both columns must appear in the same CREATE TABLE statement
    assertMatch(
      stmt.sql,
      /CREATE TABLE IF NOT EXISTS "public"\."documents"/,
    );
    assertStringIncludes(stmt.sql, `"attachment" VARCHAR(500)`);
    assertStringIncludes(stmt.sql, `"thumbnail" VARCHAR(500)`);
  },
);
