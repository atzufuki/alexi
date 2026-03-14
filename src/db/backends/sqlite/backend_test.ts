/**
 * SQLite Backend Tests
 *
 * Tests for the SQLite database backend. These tests use an in-memory SQLite
 * database so no external setup is required. They do require `--unstable-ffi`
 * at runtime (the `deno task test` configuration already passes this flag).
 *
 * All tests are nested as sub-steps of a single outer test so that the FFI
 * dynamic library loaded by `@db/sqlite` (a module-level side effect) is not
 * incorrectly blamed on any individual inner test by Deno's resource sanitizer.
 *
 * @module
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
  assertRejects,
} from "jsr:@std/assert@1";
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  IntegerField,
  Manager,
  Model,
  TextField,
} from "../../mod.ts";
import { registerBackend, reset } from "../../setup.ts";
import { SQLiteBackend } from "./backend.ts";
import { SQLiteSchemaEditor } from "./schema_editor.ts";
import {
  fromSQLiteValue,
  SQLiteQueryBuilder,
  toSQLiteValue,
} from "./query_builder.ts";

// ============================================================================
// Test Models
// ============================================================================

class SqliteTestArticle extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  content = new TextField({ blank: true });
  views = new IntegerField({ default: 0 });
  published = new BooleanField({ default: false });
  createdAt = new DateTimeField({ autoNowAdd: true });

  static objects = new Manager(SqliteTestArticle);
  static override meta = {
    dbTable: "sqlite_test_articles",
  };
}

// ============================================================================
// Test Setup Helpers
// ============================================================================

async function createBackend(): Promise<SQLiteBackend> {
  const backend = new SQLiteBackend({ path: ":memory:" });
  await backend.connect();
  await backend.executeRaw(`
    CREATE TABLE IF NOT EXISTS "sqlite_test_articles" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "title" TEXT NOT NULL,
      "content" TEXT,
      "views" INTEGER DEFAULT 0,
      "published" INTEGER DEFAULT 0,
      "createdAt" TEXT
    )
  `);
  registerBackend("default", backend);
  return backend;
}

async function teardownBackend(backend: SQLiteBackend): Promise<void> {
  try {
    await backend.executeRaw(`DROP TABLE IF EXISTS "sqlite_test_articles"`);
  } catch {
    // ignore
  }
  await reset();
  await backend.disconnect();
}

// ============================================================================
// Test Suite
//
// Wrapped in a single outer Deno.test with sanitizeResources: false because
// @db/sqlite loads an FFI dynamic library at module evaluation time. Deno's
// resource sanitizer would otherwise flag the first sub-test that triggers the
// import as a "dynamic library leak" even though the library is intentionally
// kept alive for the lifetime of the process.
// ============================================================================

Deno.test({
  name: "SQLiteBackend",
  sanitizeResources: false,
  async fn(t) {
    // ============================================================================
    // Connection Tests
    // ============================================================================

    await t.step("connect and disconnect", async () => {
      const backend = new SQLiteBackend({ path: ":memory:" });

      assertEquals(backend.isConnected, false);

      await backend.connect();
      assertEquals(backend.isConnected, true);

      await backend.disconnect();
      assertEquals(backend.isConnected, false);
    });

    await t.step("double connect is idempotent", async () => {
      const backend = new SQLiteBackend({ path: ":memory:" });

      await backend.connect();
      await backend.connect(); // Should not throw

      assertEquals(backend.isConnected, true);

      await backend.disconnect();
    });

    await t.step("db getter throws when not connected", () => {
      const backend = new SQLiteBackend({ path: ":memory:" });
      let threw = false;
      try {
        void backend.db;
      } catch {
        threw = true;
      }
      assertEquals(threw, true);
    });

    // ============================================================================
    // CRUD Tests
    // ============================================================================

    await t.step("insert and getById", async () => {
      const backend = await createBackend();

      try {
        const article = new SqliteTestArticle();
        article.title.set("Hello World");
        article.content.set("Some content");
        article.views.set(10);

        const result = await backend.insert(article);

        assertExists(result.id);
        assertEquals(result.title, "Hello World");
        assertEquals(result.content, "Some content");
        assertEquals(result.views, 10);

        // getById
        const fetched = await backend.getById(SqliteTestArticle, result.id);
        assertExists(fetched);
        assertEquals(fetched!.title, "Hello World");
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("getById returns null for missing record", async () => {
      const backend = await createBackend();

      try {
        const result = await backend.getById(SqliteTestArticle, 99999);
        assertEquals(result, null);
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("existsById", async () => {
      const backend = await createBackend();

      try {
        const article = new SqliteTestArticle();
        article.title.set("Exists Test");
        const result = await backend.insert(article);

        assertEquals(
          await backend.existsById(SqliteTestArticle, result.id),
          true,
        );
        assertEquals(
          await backend.existsById(SqliteTestArticle, 99999),
          false,
        );
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("update", async () => {
      const backend = await createBackend();

      try {
        const article = new SqliteTestArticle();
        article.title.set("Original Title");
        article.views.set(0);
        const inserted = await backend.insert(article);

        // Set the generated ID back on the instance and update fields.
        article.id.set(inserted.id as number);
        article.title.set("Updated Title");
        article.views.set(42);
        await backend.update(article);

        const fetched = await backend.getById(SqliteTestArticle, inserted.id);
        assertEquals(fetched!.title, "Updated Title");
        assertEquals(fetched!.views, 42);
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("partialUpdate", async () => {
      const backend = await createBackend();

      try {
        const article = new SqliteTestArticle();
        article.title.set("Partial Test");
        article.views.set(5);
        const inserted = await backend.insert(article);

        article.id.set(inserted.id as number);
        article.title.set("Changed Title");
        article.views.set(999); // should NOT be written
        await backend.partialUpdate(article, ["title"]);

        const fetched = await backend.getById(SqliteTestArticle, inserted.id);
        assertEquals(fetched!.title, "Changed Title");
        assertEquals(fetched!.views, 5); // unchanged
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("delete", async () => {
      const backend = await createBackend();

      try {
        const article = new SqliteTestArticle();
        article.title.set("To Delete");
        const inserted = await backend.insert(article);

        article.id.set(inserted.id as number);
        await backend.delete(article);

        const fetched = await backend.getById(SqliteTestArticle, inserted.id);
        assertEquals(fetched, null);
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("deleteById", async () => {
      const backend = await createBackend();

      try {
        const article = new SqliteTestArticle();
        article.title.set("To Delete By Id");
        const inserted = await backend.insert(article);

        await backend.deleteById("sqlite_test_articles", inserted.id);

        const fetched = await backend.getById(SqliteTestArticle, inserted.id);
        assertEquals(fetched, null);
      } finally {
        await teardownBackend(backend);
      }
    });

    // ============================================================================
    // Query / Execute Tests
    // ============================================================================

    await t.step("execute (select all)", async () => {
      const backend = await createBackend();

      try {
        for (const title of ["Alpha", "Beta", "Gamma"]) {
          const a = new SqliteTestArticle();
          a.title.set(title);
          await backend.insert(a);
        }

        // deno-lint-ignore no-explicit-any
        const state = (SqliteTestArticle.objects.all() as any)._state;
        const rows = await backend.execute(state);
        assertEquals(rows.length, 3);
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("count", async () => {
      const backend = await createBackend();

      try {
        for (let i = 0; i < 5; i++) {
          const a = new SqliteTestArticle();
          a.title.set(`Article ${i}`);
          await backend.insert(a);
        }

        // deno-lint-ignore no-explicit-any
        const state = (SqliteTestArticle.objects.all() as any)._state;
        const n = await backend.count(state);
        assertEquals(n, 5);
      } finally {
        await teardownBackend(backend);
      }
    });

    // ============================================================================
    // Bulk Operation Tests
    // ============================================================================

    await t.step("bulkInsert", async () => {
      const backend = await createBackend();

      try {
        const instances: SqliteTestArticle[] = [];
        for (let i = 0; i < 3; i++) {
          const a = new SqliteTestArticle();
          a.title.set(`Bulk ${i}`);
          a.views.set(i * 10);
          instances.push(a);
        }

        const results = await backend.bulkInsert(instances);
        assertEquals(results.length, 3);
        for (const r of results) {
          assertExists(r.id);
        }
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("bulkUpdate", async () => {
      const backend = await createBackend();

      try {
        const instances: SqliteTestArticle[] = [];
        for (let i = 0; i < 3; i++) {
          const a = new SqliteTestArticle();
          a.title.set(`Update ${i}`);
          a.views.set(0);
          const r = await backend.insert(a);
          a.id.set(r.id as number);
          a.views.set(i + 100);
          instances.push(a);
        }

        const count = await backend.bulkUpdate(instances, ["views"]);
        assertEquals(count, 3);

        for (const a of instances) {
          const fetched = await backend.getById(SqliteTestArticle, a.id.get());
          assertNotEquals(fetched!.views, 0);
        }
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("deleteMany", async () => {
      const backend = await createBackend();

      try {
        for (let i = 0; i < 4; i++) {
          const a = new SqliteTestArticle();
          a.title.set(`Delete Many ${i}`);
          a.views.set(i < 2 ? 1 : 99);
          await backend.insert(a);
        }

        // deno-lint-ignore no-explicit-any
        const state = (SqliteTestArticle.objects.filter({ views: 1 }) as any)
          ._state;
        const deleted = await backend.deleteMany(state);
        assertEquals(deleted, 2);

        // deno-lint-ignore no-explicit-any
        const remaining = (SqliteTestArticle.objects.all() as any)._state;
        assertEquals(await backend.count(remaining), 2);
      } finally {
        await teardownBackend(backend);
      }
    });

    // ============================================================================
    // Transaction Tests
    // ============================================================================

    await t.step("transaction commit", async () => {
      const backend = await createBackend();

      try {
        const txn = await backend.beginTransaction();
        assertEquals(txn.isActive, true);

        const article = new SqliteTestArticle();
        article.title.set("In Transaction");
        await backend.insert(article);

        await txn.commit();
        assertEquals(txn.isActive, false);

        // deno-lint-ignore no-explicit-any
        const state = (SqliteTestArticle.objects.all() as any)._state;
        assertEquals(await backend.count(state), 1);
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("transaction rollback", async () => {
      const backend = await createBackend();

      try {
        const txn = await backend.beginTransaction();

        const article = new SqliteTestArticle();
        article.title.set("Should Rollback");
        await backend.insert(article);

        await txn.rollback();
        assertEquals(txn.isActive, false);

        // deno-lint-ignore no-explicit-any
        const state = (SqliteTestArticle.objects.all() as any)._state;
        assertEquals(await backend.count(state), 0);
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("committed transaction cannot be re-committed", async () => {
      const backend = new SQLiteBackend({ path: ":memory:" });
      await backend.connect();

      try {
        const txn = await backend.beginTransaction();
        await txn.commit();

        await assertRejects(
          () => txn.commit(),
          Error,
          "no longer active",
        );
      } finally {
        await backend.disconnect();
      }
    });

    // ============================================================================
    // Schema Editor Tests
    // ============================================================================

    await t.step("getSchemaEditor / tableExists", async () => {
      const backend = new SQLiteBackend({ path: ":memory:" });
      await backend.connect();

      try {
        const editor = backend.getSchemaEditor() as SQLiteSchemaEditor;

        assertEquals(await editor.tableExists("sqlite_test_articles"), false);

        await editor.createTable(SqliteTestArticle);

        assertEquals(await editor.tableExists("sqlite_test_articles"), true);
      } finally {
        await backend.disconnect();
      }
    });

    await t.step("tableExists", async () => {
      const backend = await createBackend();

      try {
        assertEquals(
          await backend.tableExists("sqlite_test_articles"),
          true,
        );
        assertEquals(
          await backend.tableExists("no_such_table"),
          false,
        );
      } finally {
        await teardownBackend(backend);
      }
    });

    await t.step("SQLiteSchemaEditor - getTables and getColumns", async () => {
      const backend = new SQLiteBackend({ path: ":memory:" });
      await backend.connect();

      try {
        const editor = backend.getSchemaEditor() as SQLiteSchemaEditor;
        await editor.createTable(SqliteTestArticle);

        const tables = await editor.getTables();
        assertEquals(tables.includes("sqlite_test_articles"), true);

        const columns = await editor.getColumns("sqlite_test_articles");
        const names = columns.map((c) => c.name);
        assertEquals(names.includes("id"), true);
        assertEquals(names.includes("title"), true);
      } finally {
        await backend.disconnect();
      }
    });

    await t.step("SQLiteSchemaEditor - removeField throws", async () => {
      const backend = new SQLiteBackend({ path: ":memory:" });
      await backend.connect();

      try {
        const editor = backend.getSchemaEditor() as SQLiteSchemaEditor;
        await editor.createTable(SqliteTestArticle);

        await assertRejects(
          () => editor.removeField(SqliteTestArticle, "views"),
          Error,
          "does not support DROP COLUMN",
        );
      } finally {
        await backend.disconnect();
      }
    });

    // ============================================================================
    // compile() Tests
    // ============================================================================

    await t.step("compile returns sql and params", async () => {
      const backend = new SQLiteBackend({ path: ":memory:" });
      await backend.connect();

      try {
        // deno-lint-ignore no-explicit-any
        const state = (SqliteTestArticle.objects.filter({ views: 5 }) as any)
          ._state;
        const compiled = backend.compile(state);

        assertExists(compiled.sql);
        assertEquals(compiled.sql!.includes("SELECT"), true);
        assertEquals(compiled.sql!.includes("WHERE"), true);
        assertEquals(compiled.params!.includes(5), true);
      } finally {
        await backend.disconnect();
      }
    });

    // ============================================================================
    // Value Conversion Tests
    // ============================================================================

    await t.step("toSQLiteValue - converts values correctly", () => {
      assertEquals(toSQLiteValue(undefined), null);
      assertEquals(toSQLiteValue(true), 1);
      assertEquals(toSQLiteValue(false), 0);
      assertEquals(toSQLiteValue(42), 42);
      assertEquals(toSQLiteValue("hello"), "hello");
      assertEquals(toSQLiteValue(null), null);

      const d = new Date("2024-01-15T10:00:00.000Z");
      assertEquals(toSQLiteValue(d), d.toISOString());

      assertEquals(toSQLiteValue({ foo: "bar" }), '{"foo":"bar"}');
    });

    await t.step("fromSQLiteValue - converts values correctly", () => {
      assertEquals(fromSQLiteValue(null), null);
      assertEquals(fromSQLiteValue(undefined), null);

      // BooleanField
      assertEquals(fromSQLiteValue(1, "BooleanField"), true);
      assertEquals(fromSQLiteValue(0, "BooleanField"), false);

      // DateTimeField
      const isoStr = "2024-01-15T10:00:00.000Z";
      const date = fromSQLiteValue(isoStr, "DateTimeField");
      assertEquals(date instanceof Date, true);
      assertEquals((date as Date).toISOString(), isoStr);

      // JSONField
      const parsed = fromSQLiteValue('{"key":"val"}', "JSONField");
      assertEquals((parsed as Record<string, string>).key, "val");

      // Raw passthrough
      assertEquals(fromSQLiteValue(99), 99);
      assertEquals(fromSQLiteValue("text"), "text");
    });

    // ============================================================================
    // SQLiteQueryBuilder Tests
    // ============================================================================

    await t.step(
      "SQLiteQueryBuilder - buildInsert generates correct SQL",
      () => {
        const compiled = SQLiteQueryBuilder.buildInsert("articles", {
          title: "Hello",
          views: 0,
        });

        assertEquals(compiled.sql!.startsWith("INSERT INTO"), true);
        assertEquals(compiled.sql!.includes('"articles"'), true);
        assertEquals(compiled.sql!.includes('"title"'), true);
        assertEquals(compiled.sql!.includes('"views"'), true);
        assertEquals(compiled.params!.length, 2);
        assertEquals(compiled.params![0], "Hello");
        assertEquals(compiled.params![1], 0);
      },
    );

    await t.step(
      "SQLiteQueryBuilder - buildUpdate generates correct SQL",
      () => {
        const compiled = SQLiteQueryBuilder.buildUpdate("articles", 42, {
          title: "Updated",
          views: 5,
        });

        assertEquals(compiled.sql!.startsWith("UPDATE"), true);
        assertEquals(compiled.sql!.includes("WHERE"), true);
        assertEquals(compiled.params!.includes(42), true);
        assertEquals(compiled.params!.includes("Updated"), true);
      },
    );

    await t.step(
      "SQLiteQueryBuilder - buildDelete generates correct SQL",
      () => {
        const compiled = SQLiteQueryBuilder.buildDelete("articles", 7);

        assertEquals(compiled.sql!, 'DELETE FROM "articles" WHERE "id" = ?');
        assertEquals(compiled.params!, [7]);
      },
    );
  },
});
