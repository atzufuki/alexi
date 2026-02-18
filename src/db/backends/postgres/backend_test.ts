/**
 * PostgreSQL Backend Integration Tests
 *
 * These tests require a running PostgreSQL database.
 * Set DATABASE_URL environment variable or individual PG* env vars.
 *
 * Skip these tests if no database is available by running:
 *   deno test --ignore="**\/postgres\/backend_test.ts"
 *
 * @module
 */

import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert";
import {
  AutoField,
  CharField,
  DateTimeField,
  IntegerField,
  Manager,
  Model,
  TextField,
} from "../../mod.ts";
import { PostgresBackend } from "./backend.ts";
import type { PostgresConfig } from "./types.ts";

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Check if PostgreSQL is available
 */
function hasPostgres(): boolean {
  return !!(
    Deno.env.get("DATABASE_URL") ||
    Deno.env.get("PGHOST") ||
    Deno.env.get("PGDATABASE")
  );
}

/**
 * Get test database configuration
 */
function getTestConfig(): PostgresConfig {
  const connectionString = Deno.env.get("DATABASE_URL");

  if (connectionString) {
    return {
      engine: "postgres",
      name: "test",
      connectionString,
      debug: Deno.env.get("DEBUG") === "true",
    };
  }

  return {
    engine: "postgres",
    name: Deno.env.get("PGDATABASE") ?? "alexi_test",
    host: Deno.env.get("PGHOST") ?? "localhost",
    port: parseInt(Deno.env.get("PGPORT") ?? "5432"),
    user: Deno.env.get("PGUSER") ?? "postgres",
    password: Deno.env.get("PGPASSWORD"),
    debug: Deno.env.get("DEBUG") === "true",
  };
}

// ============================================================================
// Test Model
// ============================================================================

class PgTestArticle extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  content = new TextField({ blank: true });
  views = new IntegerField({ default: 0 });
  createdAt = new DateTimeField({ autoNowAdd: true });

  static objects = new Manager(PgTestArticle);
  static override meta = {
    dbTable: "pg_test_articles",
  };
}

// ============================================================================
// Test Utilities
// ============================================================================

async function setupTestTable(backend: PostgresBackend): Promise<void> {
  // Create test table
  await backend.executeRaw(`
    CREATE TABLE IF NOT EXISTS "public"."pg_test_articles" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      content TEXT,
      views INTEGER DEFAULT 0,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Clean existing data
  await backend.executeRaw('DELETE FROM "public"."pg_test_articles"');
}

async function cleanupTestTable(backend: PostgresBackend): Promise<void> {
  try {
    await backend.executeRaw(
      'DROP TABLE IF EXISTS "public"."pg_test_articles" CASCADE',
    );
  } catch {
    // Ignore errors during cleanup
  }
}

// ============================================================================
// Connection Tests
// ============================================================================

Deno.test({
  name: "PostgresBackend - connect and disconnect",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    assertEquals(backend.isConnected, false);

    await backend.connect();
    assertEquals(backend.isConnected, true);

    await backend.disconnect();
    assertEquals(backend.isConnected, false);
  },
});

Deno.test({
  name: "PostgresBackend - double connect is idempotent",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    await backend.connect();
    await backend.connect(); // Should not throw

    assertEquals(backend.isConnected, true);

    await backend.disconnect();
  },
});

// ============================================================================
// CRUD Tests
// ============================================================================

Deno.test({
  name: "PostgresBackend - insert and getById",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Create a new article
      const article = new PgTestArticle();
      article.title.set("Test Article");
      article.content.set("This is test content");
      article.views.set(42);

      const result = await backend.insert(article);

      assertExists(result.id);
      assertEquals(result.title, "Test Article");
      assertEquals(result.content, "This is test content");
      assertEquals(result.views, 42);

      // Retrieve by ID
      const retrieved = await backend.getById(PgTestArticle, result.id);

      assertExists(retrieved);
      assertEquals(retrieved!.title, "Test Article");
      assertEquals(retrieved!.views, 42);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend - update",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Insert
      const article = new PgTestArticle();
      article.title.set("Original Title");
      article.views.set(0);

      const inserted = await backend.insert(article);

      // Update - need to load the record first
      article.id.set(inserted.id as number);
      article.title.set("Updated Title");
      article.views.set(100);

      await backend.update(article);

      // Verify
      const retrieved = await backend.getById(PgTestArticle, inserted.id);
      assertEquals(retrieved!.title, "Updated Title");
      assertEquals(retrieved!.views, 100);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend - delete",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Insert
      const article = new PgTestArticle();
      article.title.set("To Delete");

      const inserted = await backend.insert(article);
      article.id.set(inserted.id as number);

      // Verify exists
      const exists = await backend.existsById(PgTestArticle, inserted.id);
      assertEquals(exists, true);

      // Delete
      await backend.delete(article);

      // Verify deleted
      const existsAfter = await backend.existsById(PgTestArticle, inserted.id);
      assertEquals(existsAfter, false);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend - deleteById",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Insert
      const article = new PgTestArticle();
      article.title.set("To Delete By ID");

      const inserted = await backend.insert(article);

      // Delete by ID
      await backend.deleteById("pg_test_articles", inserted.id);

      // Verify deleted
      const exists = await backend.existsById(PgTestArticle, inserted.id);
      assertEquals(exists, false);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

// ============================================================================
// Query Execution Tests
// ============================================================================

Deno.test({
  name: "PostgresBackend - execute with filters",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Insert test data
      for (const title of ["Alpha", "Beta", "Gamma"]) {
        const article = new PgTestArticle();
        article.title.set(title);
        article.views.set(title === "Alpha" ? 100 : 50);
        await backend.insert(article);
      }

      // Query with filter
      const { createQueryState } = await import("../../query/types.ts");
      const state = createQueryState(PgTestArticle);
      state.filters = [
        { field: "views", lookup: "gte", value: 100, negated: false },
      ];

      const results = await backend.execute(state);

      assertEquals(results.length, 1);
      assertEquals(results[0].title, "Alpha");
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend - execute with ordering",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Insert test data
      for (const [title, views] of [["A", 10], ["B", 30], ["C", 20]] as const) {
        const article = new PgTestArticle();
        article.title.set(title);
        article.views.set(views);
        await backend.insert(article);
      }

      // Query with ordering
      const { createQueryState } = await import("../../query/types.ts");
      const state = createQueryState(PgTestArticle);
      state.ordering = [{ field: "views", direction: "DESC" }];

      const results = await backend.execute(state);

      assertEquals(results.length, 3);
      assertEquals(results[0].title, "B");
      assertEquals(results[1].title, "C");
      assertEquals(results[2].title, "A");
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend - execute with limit and offset",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Insert test data
      for (let i = 1; i <= 5; i++) {
        const article = new PgTestArticle();
        article.title.set(`Article ${i}`);
        article.views.set(i);
        await backend.insert(article);
      }

      // Query with limit and offset
      const { createQueryState } = await import("../../query/types.ts");
      const state = createQueryState(PgTestArticle);
      state.ordering = [{ field: "views", direction: "ASC" }];
      state.limit = 2;
      state.offset = 2;

      const results = await backend.execute(state);

      assertEquals(results.length, 2);
      assertEquals(results[0].title, "Article 3");
      assertEquals(results[1].title, "Article 4");
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

// ============================================================================
// Aggregation Tests
// ============================================================================

Deno.test({
  name: "PostgresBackend - count",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Insert test data
      for (let i = 0; i < 5; i++) {
        const article = new PgTestArticle();
        article.title.set(`Article ${i}`);
        await backend.insert(article);
      }

      // Count all
      const { createQueryState } = await import("../../query/types.ts");
      const state = createQueryState(PgTestArticle);

      const count = await backend.count(state);
      assertEquals(count, 5);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend - aggregate",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Insert test data
      for (const views of [10, 20, 30, 40, 50]) {
        const article = new PgTestArticle();
        article.title.set(`Article`);
        article.views.set(views);
        await backend.insert(article);
      }

      // Aggregate
      const { createQueryState } = await import("../../query/types.ts");
      const state = createQueryState(PgTestArticle);

      const results = await backend.aggregate(state, {
        total: { func: "SUM", field: "views" },
        avg: { func: "AVG", field: "views" },
        min: { func: "MIN", field: "views" },
        max: { func: "MAX", field: "views" },
      });

      assertEquals(results.total, 150);
      assertEquals(results.avg, 30);
      assertEquals(results.min, 10);
      assertEquals(results.max, 50);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

// ============================================================================
// Bulk Operations Tests
// ============================================================================

Deno.test({
  name: "PostgresBackend - bulkInsert",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Create multiple articles
      const articles = [];
      for (let i = 0; i < 3; i++) {
        const article = new PgTestArticle();
        article.title.set(`Bulk Article ${i}`);
        article.views.set(i * 10);
        articles.push(article);
      }

      const results = await backend.bulkInsert(articles);

      assertEquals(results.length, 3);
      for (const result of results) {
        assertExists(result.id);
      }

      // Verify count
      const { createQueryState } = await import("../../query/types.ts");
      const state = createQueryState(PgTestArticle);
      const count = await backend.count(state);
      assertEquals(count, 3);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend - deleteMany",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Insert test data
      for (const views of [10, 20, 30, 40, 50]) {
        const article = new PgTestArticle();
        article.title.set(`Article`);
        article.views.set(views);
        await backend.insert(article);
      }

      // Delete articles with views < 30
      const { createQueryState } = await import("../../query/types.ts");
      const state = createQueryState(PgTestArticle);
      state.filters = [
        { field: "views", lookup: "lt", value: 30, negated: false },
      ];

      const deleted = await backend.deleteMany(state);
      assertEquals(deleted, 2);

      // Verify remaining count
      const countState = createQueryState(PgTestArticle);
      const count = await backend.count(countState);
      assertEquals(count, 3);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend - updateMany",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      // Insert test data
      for (const views of [10, 20, 30, 40, 50]) {
        const article = new PgTestArticle();
        article.title.set(`Article`);
        article.views.set(views);
        await backend.insert(article);
      }

      // Update articles with views >= 30
      const { createQueryState } = await import("../../query/types.ts");
      const state = createQueryState(PgTestArticle);
      state.filters = [
        { field: "views", lookup: "gte", value: 30, negated: false },
      ];

      const updated = await backend.updateMany(state, { title: "Updated" });
      assertEquals(updated, 3);

      // Verify
      const verifyState = createQueryState(PgTestArticle);
      verifyState.filters = [
        { field: "title", lookup: "exact", value: "Updated", negated: false },
      ];
      const count = await backend.count(verifyState);
      assertEquals(count, 3);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

// ============================================================================
// Transaction Tests
// ============================================================================

Deno.test({
  name: "PostgresBackend - transaction commit",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      const tx = await backend.beginTransaction();

      // Insert within transaction (note: would need to use tx.client directly)
      // For now, we just test the transaction API works
      assertEquals(tx.isActive, true);

      await tx.commit();
      assertEquals(tx.isActive, false);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend - transaction rollback",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      const tx = await backend.beginTransaction();
      assertEquals(tx.isActive, true);

      await tx.rollback();
      assertEquals(tx.isActive, false);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

// ============================================================================
// Schema Tests
// ============================================================================

Deno.test({
  name: "PostgresBackend - tableExists",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();
      await setupTestTable(backend);

      const exists = await backend.tableExists("pg_test_articles");
      assertEquals(exists, true);

      const notExists = await backend.tableExists("nonexistent_table_xyz");
      assertEquals(notExists, false);
    } finally {
      await cleanupTestTable(backend);
      await backend.disconnect();
    }
  },
});

// ============================================================================
// Error Handling Tests
// ============================================================================

Deno.test({
  name: "PostgresBackend - update without ID throws",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();

      const article = new PgTestArticle();
      article.title.set("No ID");

      await assertRejects(
        () => backend.update(article),
        Error,
        "Cannot update a record without an ID",
      );
    } finally {
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend - delete without ID throws",
  ignore: !hasPostgres(),
  async fn() {
    const config = getTestConfig();
    const backend = new PostgresBackend(config);

    try {
      await backend.connect();

      const article = new PgTestArticle();
      article.title.set("No ID");

      await assertRejects(
        () => backend.delete(article),
        Error,
        "Cannot delete a record without an ID",
      );
    } finally {
      await backend.disconnect();
    }
  },
});
