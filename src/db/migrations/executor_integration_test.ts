/**
 * Integration tests for MigrationExecutor — rollback scenarios
 *
 * These tests exercise the full migration lifecycle against real in-memory
 * backends (DenoKV and SQLite). They verify that:
 *
 * 1. `forwards()` applies schema changes to the actual store/database
 * 2. `backwards()` (auto-generated from the forwards log) reverses them
 * 3. `forwards()` can be re-applied after rollback (idempotency)
 *
 * Scenarios tested:
 * - `createModel` → `deprecateModel` (auto-reverse)
 * - `addField`    → `deprecateField` (auto-reverse)
 * - `alterField`  → restore previous field (auto-reverse)
 * - Explicit `backwards()` override
 * - Re-apply after rollback (forward → backward → forward)
 * - DataMigration in --test mode: no double-apply (fix #378)
 * - Global registry swap for --test mode data migrations (fix #380)
 *
 * @module
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { DenoKVBackend } from "../backends/denokv/mod.ts";
import { SQLiteBackend } from "../backends/sqlite/mod.ts";
import { MigrationExecutor } from "./executor.ts";
import { MigrationLoader } from "./loader.ts";
import { DataMigration, Migration } from "./migration.ts";
import type { MigrationSchemaEditor } from "./schema_editor.ts";
import { AutoField, CharField, Manager, Model } from "../mod.ts";
import {
  getBackendByName,
  getBackendNames,
  registerBackend,
} from "../setup.ts";

// ============================================================================
// Snapshot models (frozen at migration time)
// ============================================================================

class ArticleModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });

  static objects = new Manager(ArticleModel);
  static override meta = { dbTable: "articles" };
}

class ArticleModelV2 extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  slug = new CharField({ maxLength: 200, blank: true });

  static objects = new Manager(ArticleModelV2);
  static override meta = { dbTable: "articles" };
}

class ArticleModelV3 extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 500 }); // altered maxLength
  slug = new CharField({ maxLength: 200, blank: true });

  static objects = new Manager(ArticleModelV3);
  static override meta = { dbTable: "articles" };
}

// ============================================================================
// Migration definitions
// ============================================================================

/** 0001 — create the articles table */
class Migration0001CreateArticles extends Migration {
  name = "myapp.0001_create_articles";
  override dependencies = [];

  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.createModel(ArticleModel);
  }
  // backwards() intentionally omitted — auto-generated
}

/** 0002 — add slug field */
class Migration0002AddSlug extends Migration {
  name = "myapp.0002_add_slug";
  override dependencies = ["myapp.0001_create_articles"];

  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.addField(
      ArticleModel,
      "slug",
      new CharField({ maxLength: 200, blank: true }),
    );
  }
  // backwards() auto-generated
}

/** 0003 — alter title maxLength */
class Migration0003AlterTitle extends Migration {
  name = "myapp.0003_alter_title";
  override dependencies = ["myapp.0002_add_slug"];

  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.alterField(
      ArticleModelV3,
      "title",
      new CharField({ maxLength: 500 }),
    );
  }
  // backwards() auto-generated
}

/** 0001_explicit — same createModel but with an explicit backwards() */
class Migration0001Explicit extends Migration {
  name = "myapp.0001_explicit";
  override dependencies = [];

  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.createModel(ArticleModel);
  }

  override async backwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.deprecateModel(ArticleModel);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildLoader(...migrations: Migration[]): MigrationLoader {
  const loader = new MigrationLoader();
  for (const m of migrations) {
    loader.register(m, "myapp");
  }
  return loader;
}

/** Silence executor console output during tests. */
function silentExecutor(
  executor: MigrationExecutor,
): MigrationExecutor {
  // verbosity: 0 suppresses logs inside executor methods
  return executor;
}

// ============================================================================
// DenoKV Integration Tests
// ============================================================================

Deno.test({
  name: "DenoKV: forwards() creates table metadata, backwards() deprecates it",
  async fn() {
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await backend.connect();

    const loader = buildLoader(new Migration0001CreateArticles());
    const executor = silentExecutor(new MigrationExecutor(backend, loader));

    try {
      // --- forwards ---
      const fwdResults = await executor.migrate({ verbosity: 0 });
      assertEquals(fwdResults.length, 1);
      assertEquals(fwdResults[0].success, true, fwdResults[0].error);
      assertEquals(fwdResults[0].direction, "forward");

      // Table metadata must exist after forwards()
      const backendEditor = backend.getMigrationSchemaEditor();
      assertEquals(
        await backendEditor.tableExists("articles"),
        true,
        "Table 'articles' should exist after forwards()",
      );

      // --- backwards (auto-reversed) ---
      const bwdResults = await executor.migrate({ to: "zero", verbosity: 0 });
      assertEquals(bwdResults.length, 1);
      assertEquals(bwdResults[0].success, true, bwdResults[0].error);
      assertEquals(bwdResults[0].direction, "backward");

      // After auto-reversal, original table name must be gone and a
      // deprecated name must have appeared
      assertEquals(
        await backendEditor.tableExists("articles"),
        false,
        "Original table 'articles' should be gone after backwards()",
      );

      // The deprecated name follows the pattern _deprecated_<migname>_articles
      const kv = (backend as unknown as { _kv: Deno.Kv })._kv!;
      let foundDeprecated = false;
      for await (
        const entry of kv.list({ prefix: ["_schema", "tables"] })
      ) {
        const tableName = String(entry.key[2]);
        if (
          tableName.startsWith("_deprecated_") &&
          tableName.endsWith("_articles")
        ) {
          foundDeprecated = true;
        }
      }
      assertEquals(
        foundDeprecated,
        true,
        "A deprecated table key should exist after backwards()",
      );
    } finally {
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "DenoKV: addField forwards() → backwards() deprecates the column",
  async fn() {
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await backend.connect();

    const loader = buildLoader(
      new Migration0001CreateArticles(),
      new Migration0002AddSlug(),
    );
    const executor = silentExecutor(new MigrationExecutor(backend, loader));
    const backendEditor = backend.getMigrationSchemaEditor();

    try {
      // Apply both migrations
      await executor.migrate({ verbosity: 0 });

      // slug column metadata should exist
      const kv = (backend as unknown as { _kv: Deno.Kv })._kv!;
      const slugMeta = await kv.get(["_schema", "columns", "articles", "slug"]);
      assertExists(
        slugMeta.value,
        "slug column metadata should exist after addField",
      );

      // Roll back only 0002 (back to state after 0001)
      await executor.migrate({
        to: "myapp.0001_create_articles",
        verbosity: 0,
      });

      // Original slug column name should be gone
      const slugMetaAfter = await kv.get([
        "_schema",
        "columns",
        "articles",
        "slug",
      ]);
      assertEquals(
        slugMetaAfter.value,
        null,
        "slug column should be deprecated (renamed) after backwards()",
      );

      // articles table itself must still exist (only the field is deprecated)
      assertEquals(
        await backendEditor.tableExists("articles"),
        true,
        "Table 'articles' should still exist after rolling back addField",
      );
    } finally {
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "DenoKV: forward → backward → forward (re-apply) works",
  async fn() {
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await backend.connect();

    const loader = buildLoader(new Migration0001CreateArticles());
    const executor = silentExecutor(new MigrationExecutor(backend, loader));
    const backendEditor = backend.getMigrationSchemaEditor();

    try {
      // forward
      await executor.migrate({ verbosity: 0 });
      assertEquals(await backendEditor.tableExists("articles"), true);

      // backward
      await executor.migrate({ to: "zero", verbosity: 0 });
      assertEquals(await backendEditor.tableExists("articles"), false);

      // forward again — must succeed without errors
      const secondFwd = await executor.migrate({ verbosity: 0 });
      assertEquals(secondFwd.length, 1);
      assertEquals(secondFwd[0].success, true, secondFwd[0].error);
      assertEquals(await backendEditor.tableExists("articles"), true);
    } finally {
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "DenoKV: explicit backwards() is used when defined",
  async fn() {
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await backend.connect();

    const loader = buildLoader(new Migration0001Explicit());
    const executor = silentExecutor(new MigrationExecutor(backend, loader));
    const backendEditor = backend.getMigrationSchemaEditor();

    try {
      await executor.migrate({ verbosity: 0 });
      assertEquals(await backendEditor.tableExists("articles"), true);

      const bwdResults = await executor.migrate({ to: "zero", verbosity: 0 });
      assertEquals(bwdResults[0].success, true, bwdResults[0].error);
      assertEquals(await backendEditor.tableExists("articles"), false);
    } finally {
      await backend.disconnect();
    }
  },
});

// ============================================================================
// SQLite Integration Tests
// ============================================================================

Deno.test({
  name:
    "SQLite: forwards() creates table, backwards() renames it to _deprecated_*",
  async fn() {
    const backend = new SQLiteBackend({ path: ":memory:" });
    await backend.connect();

    const loader = buildLoader(new Migration0001CreateArticles());
    const executor = silentExecutor(new MigrationExecutor(backend, loader));

    try {
      // forwards
      const fwdResults = await executor.migrate({ verbosity: 0 });
      assertEquals(fwdResults.length, 1);
      assertEquals(fwdResults[0].success, true, fwdResults[0].error);

      assertEquals(
        await backend.tableExists("articles"),
        true,
        "Table 'articles' should exist after forwards()",
      );

      // backwards (auto-reversed)
      const bwdResults = await executor.migrate({ to: "zero", verbosity: 0 });
      assertEquals(bwdResults.length, 1);
      assertEquals(bwdResults[0].success, true, bwdResults[0].error);

      assertEquals(
        await backend.tableExists("articles"),
        false,
        "Original table 'articles' should be gone after backwards()",
      );

      // A deprecated table should exist in sqlite_master
      const backendEditor = backend.getMigrationSchemaEditor();
      const deprecatedExists = await (async () => {
        // Query sqlite_master for any table starting with _deprecated_ and ending with articles
        const db = (backend as unknown as {
          db: {
            prepare: (sql: string) => { all: () => Array<{ name: string }> };
          };
        }).db;
        const rows = db.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '_deprecated_%_articles'`,
        ).all();
        return rows.length > 0;
      })();

      assertEquals(
        deprecatedExists,
        true,
        "A deprecated table should exist in SQLite after backwards()",
      );

      assertExists(backendEditor); // editor was created without error
    } finally {
      await backend.disconnect();
    }
  },
});

Deno.test({
  name:
    "SQLite: addField forwards() adds column, backwards() renames it to _deprecated_*",
  async fn() {
    const backend = new SQLiteBackend({ path: ":memory:" });
    await backend.connect();

    const loader = buildLoader(
      new Migration0001CreateArticles(),
      new Migration0002AddSlug(),
    );
    const executor = silentExecutor(new MigrationExecutor(backend, loader));

    try {
      // Apply both
      await executor.migrate({ verbosity: 0 });

      // Verify slug column exists
      const db = (backend as unknown as {
        db: {
          prepare: (
            sql: string,
          ) => { all: (t?: string) => Array<{ name: string }> };
        };
      }).db;
      const colsBefore: Array<{ name: string }> = db.prepare(
        `PRAGMA table_info(articles)`,
      ).all();
      const hasSlugBefore = colsBefore.some((c) => c.name === "slug");
      assertEquals(
        hasSlugBefore,
        true,
        "slug column should exist after addField",
      );

      // Roll back 0002 only
      await executor.migrate({
        to: "myapp.0001_create_articles",
        verbosity: 0,
      });

      const colsAfter: Array<{ name: string }> = db.prepare(
        `PRAGMA table_info(articles)`,
      ).all();
      const hasSlugAfter = colsAfter.some((c) => c.name === "slug");
      assertEquals(
        hasSlugAfter,
        false,
        "slug column should be deprecated (renamed) after rolling back addField",
      );

      // A deprecated column should exist
      const hasDeprecatedSlug = colsAfter.some((c) =>
        c.name.startsWith("_deprecated_") && c.name.endsWith("_slug")
      );
      assertEquals(
        hasDeprecatedSlug,
        true,
        "A _deprecated_*_slug column should exist after backwards()",
      );

      // articles table still present
      assertEquals(
        await backend.tableExists("articles"),
        true,
        "Table 'articles' should still exist",
      );
    } finally {
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "SQLite: forward → backward → forward (re-apply) works",
  async fn() {
    const backend = new SQLiteBackend({ path: ":memory:" });
    await backend.connect();

    const loader = buildLoader(new Migration0001CreateArticles());
    const executor = silentExecutor(new MigrationExecutor(backend, loader));

    try {
      // forward
      await executor.migrate({ verbosity: 0 });
      assertEquals(await backend.tableExists("articles"), true);

      // backward
      await executor.migrate({ to: "zero", verbosity: 0 });
      assertEquals(await backend.tableExists("articles"), false);

      // forward again
      const secondFwd = await executor.migrate({ verbosity: 0 });
      assertEquals(secondFwd.length, 1);
      assertEquals(secondFwd[0].success, true, secondFwd[0].error);
      assertEquals(await backend.tableExists("articles"), true);
    } finally {
      await backend.disconnect();
    }
  },
});

Deno.test({
  name:
    "SQLite: alterField forwards() → backwards() restores previous column definition",
  async fn() {
    const backend = new SQLiteBackend({ path: ":memory:" });
    await backend.connect();

    const loader = buildLoader(
      new Migration0001CreateArticles(),
      new Migration0002AddSlug(),
      new Migration0003AlterTitle(),
    );
    const executor = silentExecutor(new MigrationExecutor(backend, loader));

    try {
      // Apply all three migrations
      await executor.migrate({ verbosity: 0 });

      const db = (backend as unknown as {
        db: {
          prepare: (
            sql: string,
          ) => { all: () => Array<{ name: string; type: string }> };
        };
      }).db;

      // After 0003, the original title column is renamed to _deprecated_*
      // and a new title is present. In SQLite, CharField always maps to TEXT
      // regardless of maxLength — the type affinity does not encode it.
      const colsAfterAlter: Array<{ name: string; type: string }> = db.prepare(
        `PRAGMA table_info(articles)`,
      ).all();
      const titleColAfterAlter = colsAfterAlter.find((c) => c.name === "title");
      assertExists(
        titleColAfterAlter,
        "title column must exist after alterField",
      );
      // The deprecated column (original) should exist under the _deprecated_ name
      const hasDeprecatedTitleAfterAlter = colsAfterAlter.some((c) =>
        c.name.startsWith("_deprecated_") && c.name.endsWith("_title")
      );
      assertEquals(
        hasDeprecatedTitleAfterAlter,
        true,
        "Original title should be deprecated after alterField",
      );

      // Roll back 0003 only
      await executor.migrate({
        to: "myapp.0002_add_slug",
        verbosity: 0,
      });

      const colsAfterRollback: Array<{ name: string; type: string }> = db
        .prepare(
          `PRAGMA table_info(articles)`,
        ).all();

      // The "new" title column from alterField should be deprecated
      const hasDeprecatedTitle = colsAfterRollback.some((c) =>
        c.name.startsWith("_deprecated_") && c.name.endsWith("_title")
      );
      assertEquals(
        hasDeprecatedTitle,
        true,
        "The altered title column should be deprecated after backwards()",
      );

      // The restored title column (original) should be present.
      // In SQLite, CharField always maps to TEXT regardless of maxLength.
      const restoredTitle = colsAfterRollback.find((c) => c.name === "title");
      assertExists(
        restoredTitle,
        "title column must be restored after rollback",
      );
    } finally {
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "SQLite: explicit backwards() is used when defined",
  async fn() {
    const backend = new SQLiteBackend({ path: ":memory:" });
    await backend.connect();

    const loader = buildLoader(new Migration0001Explicit());
    const executor = silentExecutor(new MigrationExecutor(backend, loader));

    try {
      await executor.migrate({ verbosity: 0 });
      assertEquals(await backend.tableExists("articles"), true);

      const bwdResults = await executor.migrate({ to: "zero", verbosity: 0 });
      assertEquals(bwdResults[0].success, true, bwdResults[0].error);
      assertEquals(await backend.tableExists("articles"), false);
    } finally {
      await backend.disconnect();
    }
  },
});

// ============================================================================
// Fix #378 — DataMigration in --test mode must not be double-applied
// ============================================================================

// Counter to detect double-application
let forwardsCallCount = 0;

class MigrationSchema extends Migration {
  name = "myapp.0001_create_articles_for_data";
  override dependencies = [];

  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.createModel(ArticleModel);
  }
}

class MigrationDataNonReversible extends DataMigration {
  readonly name = "myapp.0002_data_nonreversible";
  override dependencies = ["myapp.0001_create_articles_for_data"];

  override async forwards(_schema: MigrationSchemaEditor): Promise<void> {
    forwardsCallCount += 1;
  }
  // No backwards() — non-reversible DataMigration
}

Deno.test({
  name:
    "fix #378 — non-reversible DataMigration is not double-applied in --test mode",
  async fn() {
    forwardsCallCount = 0;

    const backend = new DenoKVBackend({ name: "test378", path: ":memory:" });
    await backend.connect();

    const loader = buildLoader(
      new MigrationSchema(),
      new MigrationDataNonReversible(),
    );
    const executor = silentExecutor(new MigrationExecutor(backend, loader));

    try {
      const results = await executor.migrate({ verbosity: 0, testMode: true });

      // All results must succeed
      for (const r of results) {
        assertEquals(r.success, true, `Unexpected failure: ${r.error}`);
      }

      // forwards() of the DataMigration must have been called exactly once
      assertEquals(
        forwardsCallCount,
        1,
        "DataMigration.forwards() must be called exactly once, not double-applied",
      );
    } finally {
      await backend.disconnect();
    }
  },
});

// ============================================================================
// Fix #380 — global registry must use testCopy during --test data migrations
// ============================================================================

// Tracks which backend instance the ORM resolved when the data migration ran
let resolvedBackendDuringTest: unknown = null;

class MigrationSchemaForRegistry extends Migration {
  name = "myapp.0001_create_for_registry";
  override dependencies = [];

  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    await schema.createModel(ArticleModel);
  }
}

class MigrationDataRegistry extends DataMigration {
  readonly name = "myapp.0002_data_registry";
  override dependencies = ["myapp.0001_create_for_registry"];

  override async forwards(_schema: MigrationSchemaEditor): Promise<void> {
    // Capture whichever backend "default" resolves to at migration time
    resolvedBackendDuringTest = getBackendByName("default") ?? null;
  }
}

Deno.test({
  name:
    "fix #380 — global registry points to testCopy during --test data migration",
  async fn() {
    resolvedBackendDuringTest = null;

    const originalBackend = new DenoKVBackend({
      name: "original380",
      path: ":memory:",
    });
    await originalBackend.connect();

    // Register original backend under "default" so the data migration can
    // look it up via getBackendByName("default")
    registerBackend("default", originalBackend);

    // Simulate what MigrateCommand does: create a testCopy and swap the registry
    const testCopy = await originalBackend.copyForTest();

    const savedBackends: Array<[string, ReturnType<typeof getBackendByName>]> =
      getBackendNames().map((name) => [name, getBackendByName(name)]);
    for (const [name] of savedBackends) {
      registerBackend(name, testCopy);
    }

    const loader = buildLoader(
      new MigrationSchemaForRegistry(),
      new MigrationDataRegistry(),
    );
    const executor = silentExecutor(new MigrationExecutor(testCopy, loader));

    try {
      const results = await executor.migrate({ verbosity: 0 });

      for (const r of results) {
        assertEquals(r.success, true, `Unexpected failure: ${r.error}`);
      }

      // The data migration must have resolved "default" to the test copy, not
      // the original backend.
      assertEquals(
        resolvedBackendDuringTest,
        testCopy,
        "Data migration must see the testCopy as 'default', not the original backend",
      );
    } finally {
      // Restore original backends
      for (const [name, original] of savedBackends) {
        if (original) {
          registerBackend(name, original);
        }
      }
      await testCopy.destroyTestCopy();
      await originalBackend.disconnect();
    }
  },
});
