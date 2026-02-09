/**
 * IndexedDB Backend tests for Alexi ORM
 *
 * NOTE: IndexedDB is a browser API and is not available in Deno natively.
 * These tests require a browser environment or a polyfill like fake-indexeddb.
 *
 * To run these tests:
 * 1. In a browser environment with the ORM bundled
 * 2. Using Deno with a fake-indexeddb polyfill
 *
 * @module
 */

import { assertEquals, assertExists } from "jsr:@std/assert";

// Import fake-indexeddb polyfill for Deno testing
import "fake-indexeddb/auto";

import {
  AutoField,
  CharField,
  DateTimeField,
  IntegerField,
  Manager,
  Model,
  TextField,
} from "../mod.ts";

import { IndexedDBBackend } from "../backends/indexeddb/mod.ts";

// ============================================================================
// Test Models
// ============================================================================

class Article extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  content = new TextField();
  views = new IntegerField({ default: 0 });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(Article);
  static override meta = {
    dbTable: "articles",
    ordering: ["-createdAt"],
  };
}

class Author extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  email = new CharField({ maxLength: 255 });

  static objects = new Manager(Author);
  static override meta = {
    dbTable: "authors",
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique database name for each test to avoid conflicts
 */
function uniqueDbName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Clean up a database after test
 */
async function cleanupDb(backend: IndexedDBBackend): Promise<void> {
  try {
    await backend.deleteDatabase();
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Connection Tests
// ============================================================================

Deno.test("IndexedDBBackend - connection", async () => {
  const dbName = uniqueDbName("test-idb-conn");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });

  try {
    await backend.connect();
    assertEquals(backend.isConnected, true);
    assertEquals(backend.version, 1);

    await backend.disconnect();
    assertEquals(backend.isConnected, false);
  } finally {
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - reconnection", async () => {
  const dbName = uniqueDbName("test-idb-reconn");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });

  try {
    await backend.connect();
    assertEquals(backend.isConnected, true);

    await backend.disconnect();
    assertEquals(backend.isConnected, false);

    // Reconnect
    await backend.connect();
    assertEquals(backend.isConnected, true);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

// ============================================================================
// CRUD Operations Tests
// ============================================================================

Deno.test("IndexedDBBackend - insert and retrieve", async () => {
  const dbName = uniqueDbName("test-idb-insert");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    // Create
    const author = await authors.create({
      name: "John Doe",
      email: "john@example.com",
    });

    assertExists(author.id.get());
    assertEquals(author.name.get(), "John Doe");
    assertEquals(author.email.get(), "john@example.com");

    // Retrieve all
    const fetchedAuthors = await authors.all().fetch();
    assertEquals(fetchedAuthors.length, 1);
    assertEquals(fetchedAuthors[0].name.get(), "John Doe");
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - update", async () => {
  const dbName = uniqueDbName("test-idb-update");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    // Create
    const author = await authors.create({
      name: "Jane Doe",
      email: "jane@example.com",
    });

    // Update
    author.email.set("jane.doe@newdomain.com");
    await backend.update(author);

    // Verify update
    const updated = await authors.get({ id: author.id.get() });
    assertEquals(updated.email.get(), "jane.doe@newdomain.com");
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - delete", async () => {
  const dbName = uniqueDbName("test-idb-delete");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    // Create
    const author = await authors.create({
      name: "To Be Deleted",
      email: "delete@example.com",
    });

    // Verify created
    let all = await authors.all().fetch();
    assertEquals(all.length, 1);

    // Delete
    await backend.delete(author);

    // Verify deleted
    all = await authors.all().fetch();
    assertEquals(all.length, 0);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

// ============================================================================
// Filter Tests
// ============================================================================

Deno.test("IndexedDBBackend - filter exact match", async () => {
  const dbName = uniqueDbName("test-idb-filter-exact");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    // Create test data
    await articles.create({
      title: "TypeScript Guide",
      content: "Learn TypeScript",
      views: 100,
    });
    await articles.create({
      title: "Deno Tutorial",
      content: "Learn Deno",
      views: 200,
    });

    // Filter by exact match
    const result = await articles.filter({ title: "TypeScript Guide" }).fetch();
    assertEquals(result.length, 1);
    assertEquals(result[0].title.get(), "TypeScript Guide");
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - filter contains", async () => {
  const dbName = uniqueDbName("test-idb-filter-contains");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.create({
      title: "TypeScript Guide",
      content: "TS",
      views: 100,
    });
    await articles.create({
      title: "JavaScript Basics",
      content: "JS",
      views: 50,
    });
    await articles.create({
      title: "Deno Tutorial",
      content: "Deno",
      views: 200,
    });

    // Filter by contains
    const scriptArticles = await articles.filter({ title__contains: "Script" })
      .fetch();
    assertEquals(scriptArticles.length, 2);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - filter comparison operators", async () => {
  const dbName = uniqueDbName("test-idb-filter-compare");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.create({ title: "Article 1", content: "C1", views: 50 });
    await articles.create({ title: "Article 2", content: "C2", views: 100 });
    await articles.create({ title: "Article 3", content: "C3", views: 200 });

    // Greater than or equal
    const gte100 = await articles.filter({ views__gte: 100 }).fetch();
    assertEquals(gte100.length, 2);

    // Less than
    const lt100 = await articles.filter({ views__lt: 100 }).fetch();
    assertEquals(lt100.length, 1);
    assertEquals(lt100[0].views.get(), 50);

    // Greater than
    const gt100 = await articles.filter({ views__gt: 100 }).fetch();
    assertEquals(gt100.length, 1);
    assertEquals(gt100[0].views.get(), 200);

    // Less than or equal
    const lte100 = await articles.filter({ views__lte: 100 }).fetch();
    assertEquals(lte100.length, 2);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - filter in operator", async () => {
  const dbName = uniqueDbName("test-idb-filter-in");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.create({ title: "Article 1", content: "C1", views: 50 });
    await articles.create({ title: "Article 2", content: "C2", views: 100 });
    await articles.create({ title: "Article 3", content: "C3", views: 200 });

    // In operator
    const inValues = await articles.filter({ views__in: [50, 200] }).fetch();
    assertEquals(inValues.length, 2);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

// ============================================================================
// Ordering Tests
// ============================================================================

Deno.test("IndexedDBBackend - ordering ascending", async () => {
  const dbName = uniqueDbName("test-idb-order-asc");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.create({ title: "B Article", content: "C", views: 200 });
    await articles.create({ title: "A Article", content: "C", views: 100 });
    await articles.create({ title: "C Article", content: "C", views: 50 });

    const ordered = await articles.orderBy("title").fetch();
    assertEquals(ordered[0].title.get(), "A Article");
    assertEquals(ordered[1].title.get(), "B Article");
    assertEquals(ordered[2].title.get(), "C Article");
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - ordering descending", async () => {
  const dbName = uniqueDbName("test-idb-order-desc");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.create({ title: "A", content: "C", views: 100 });
    await articles.create({ title: "B", content: "C", views: 200 });
    await articles.create({ title: "C", content: "C", views: 50 });

    const ordered = await articles.orderBy("-views").fetch();
    assertEquals(ordered[0].views.get(), 200);
    assertEquals(ordered[1].views.get(), 100);
    assertEquals(ordered[2].views.get(), 50);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

// ============================================================================
// Pagination Tests
// ============================================================================

Deno.test("IndexedDBBackend - limit", async () => {
  const dbName = uniqueDbName("test-idb-limit");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.create({ title: "Article 1", content: "C", views: 100 });
    await articles.create({ title: "Article 2", content: "C", views: 200 });
    await articles.create({ title: "Article 3", content: "C", views: 300 });

    const limited = await articles.orderBy("-views").limit(2).fetch();
    assertEquals(limited.length, 2);
    assertEquals(limited[0].views.get(), 300);
    assertEquals(limited[1].views.get(), 200);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - offset", async () => {
  const dbName = uniqueDbName("test-idb-offset");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.create({ title: "Article 1", content: "C", views: 100 });
    await articles.create({ title: "Article 2", content: "C", views: 200 });
    await articles.create({ title: "Article 3", content: "C", views: 300 });

    const offsetted = await articles.orderBy("-views").offset(1).fetch();
    assertEquals(offsetted.length, 2);
    assertEquals(offsetted[0].views.get(), 200);
    assertEquals(offsetted[1].views.get(), 100);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - limit and offset combined", async () => {
  const dbName = uniqueDbName("test-idb-limit-offset");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.create({ title: "Article 1", content: "C", views: 100 });
    await articles.create({ title: "Article 2", content: "C", views: 200 });
    await articles.create({ title: "Article 3", content: "C", views: 300 });
    await articles.create({ title: "Article 4", content: "C", views: 400 });

    // Skip first, take 2
    const result = await articles.orderBy("-views").offset(1).limit(2).fetch();
    assertEquals(result.length, 2);
    assertEquals(result[0].views.get(), 300);
    assertEquals(result[1].views.get(), 200);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

// ============================================================================
// Bulk Operations Tests
// ============================================================================

Deno.test("IndexedDBBackend - bulk create", async () => {
  const dbName = uniqueDbName("test-idb-bulk-create");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    const created = await articles.bulkCreate([
      { title: "Bulk 1", content: "C1", views: 10 },
      { title: "Bulk 2", content: "C2", views: 20 },
      { title: "Bulk 3", content: "C3", views: 30 },
    ]);

    assertEquals(created.length, 3);

    const all = await articles.all().fetch();
    assertEquals(all.length, 3);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - updateMany", async () => {
  const dbName = uniqueDbName("test-idb-update-many");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.bulkCreate([
      { title: "Update 1", content: "C", views: 100 },
      { title: "Update 2", content: "C", views: 200 },
      { title: "Keep", content: "C", views: 300 },
    ]);

    // Update articles with views <= 200
    const updated = await articles.filter({ views__lte: 200 }).update({
      views: 999,
    });
    assertEquals(updated, 2);

    // Verify
    const articles999 = await articles.filter({ views: 999 }).fetch();
    assertEquals(articles999.length, 2);

    const articles300 = await articles.filter({ views: 300 }).fetch();
    assertEquals(articles300.length, 1);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - deleteMany", async () => {
  const dbName = uniqueDbName("test-idb-delete-many");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.bulkCreate([
      { title: "Delete 1", content: "C", views: 50 },
      { title: "Delete 2", content: "C", views: 75 },
      { title: "Keep", content: "C", views: 150 },
    ]);

    // Delete articles with views < 100
    const deleted = await articles.filter({ views__lt: 100 }).delete();
    assertEquals(deleted, 2);

    // Verify
    const remaining = await articles.all().fetch();
    assertEquals(remaining.length, 1);
    assertEquals(remaining[0].title.get(), "Keep");
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

// ============================================================================
// Aggregation Tests
// ============================================================================

Deno.test("IndexedDBBackend - count", async () => {
  const dbName = uniqueDbName("test-idb-count");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.bulkCreate([
      { title: "A1", content: "C", views: 100 },
      { title: "A2", content: "C", views: 200 },
      { title: "A3", content: "C", views: 300 },
    ]);

    const count = await articles.count();
    assertEquals(count, 3);

    const filteredCount = await articles.filter({ views__gte: 200 }).count();
    assertEquals(filteredCount, 2);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - exists", async () => {
  const dbName = uniqueDbName("test-idb-exists");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.create({
      title: "Existing Article",
      content: "C",
      views: 100,
    });

    const exists = await articles.filter({ title: "Existing Article" })
      .exists();
    assertEquals(exists, true);

    const notExists = await articles.filter({ title: "Non-existent" }).exists();
    assertEquals(notExists, false);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - aggregation functions", async () => {
  const dbName = uniqueDbName("test-idb-aggregate");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.bulkCreate([
      { title: "A1", content: "C", views: 100 },
      { title: "A2", content: "C", views: 200 },
      { title: "A3", content: "C", views: 300 },
    ]);

    const { Count, Sum, Avg, Min, Max } = await import("../query/mod.ts");

    const stats = await articles.all().aggregate({
      count: Count("*"),
      totalViews: Sum("views"),
      avgViews: Avg("views"),
      minViews: Min("views"),
      maxViews: Max("views"),
    });

    assertEquals(stats.count, 3);
    assertEquals(stats.totalViews, 600);
    assertEquals(stats.avgViews, 200);
    assertEquals(stats.minViews, 100);
    assertEquals(stats.maxViews, 300);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

// ============================================================================
// Query Utility Tests
// ============================================================================

Deno.test("IndexedDBBackend - first", async () => {
  const dbName = uniqueDbName("test-idb-first");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.bulkCreate([
      { title: "First", content: "C", views: 100 },
      { title: "Second", content: "C", views: 200 },
    ]);

    const first = await articles.orderBy("views").first();
    assertExists(first);
    assertEquals(first.views.get(), 100);

    // First on empty
    const emptyFirst = await articles.filter({ views: 999 }).first();
    assertEquals(emptyFirst, null);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - last", async () => {
  const dbName = uniqueDbName("test-idb-last");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const articles = Article.objects.using(backend);

    await articles.bulkCreate([
      { title: "First", content: "C", views: 100 },
      { title: "Second", content: "C", views: 200 },
    ]);

    const last = await articles.orderBy("views").last();
    assertExists(last);
    assertEquals(last.views.get(), 200);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - getOrCreate", async () => {
  const dbName = uniqueDbName("test-idb-get-or-create");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    // Should create
    const [author1, created1] = await authors.getOrCreate(
      { name: "New Author" },
      { email: "new@example.com" },
    );
    assertEquals(created1, true);
    assertEquals(author1.name.get(), "New Author");

    // Should get existing
    const [author2, created2] = await authors.getOrCreate(
      { name: "New Author" },
      { email: "different@example.com" },
    );
    assertEquals(created2, false);
    assertEquals(author2.email.get(), "new@example.com");
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - updateOrCreate", async () => {
  const dbName = uniqueDbName("test-idb-update-or-create");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    // Should create
    const [author1, created1] = await authors.updateOrCreate(
      { name: "Author Name" },
      { email: "first@example.com" },
    );
    assertEquals(created1, true);
    assertEquals(author1.email.get(), "first@example.com");

    // Should update
    const [author2, created2] = await authors.updateOrCreate(
      { name: "Author Name" },
      { email: "updated@example.com" },
    );
    assertEquals(created2, false);
    assertEquals(author2.email.get(), "updated@example.com");

    // Verify only one record exists
    const count = await authors.count();
    assertEquals(count, 1);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

// ============================================================================
// Table/Store Existence Tests
// ============================================================================

Deno.test("IndexedDBBackend - tableExists", async () => {
  const dbName = uniqueDbName("test-idb-table-exists");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    // Initially, authors table should not exist
    const existsBefore = await backend.tableExists("authors");
    assertEquals(existsBefore, false);

    // Create an author to trigger store creation
    const authors = Author.objects.using(backend);
    await authors.create({ name: "Test", email: "test@test.com" });

    // Now it should exist
    const existsAfter = await backend.tableExists("authors");
    assertEquals(existsAfter, true);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

// ============================================================================
// getById Tests
// ============================================================================

Deno.test("IndexedDBBackend - getById", async () => {
  const dbName = uniqueDbName("test-idb-get-by-id");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    const author = await authors.create({
      name: "Find Me",
      email: "find@example.com",
    });

    const id = author.id.get();
    const found = await backend.getById(Author, id);

    assertExists(found);
    assertEquals(found.name, "Find Me");
    assertEquals(found.email, "find@example.com");

    // Non-existent ID
    const notFound = await backend.getById(Author, 99999);
    assertEquals(notFound, null);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

// ============================================================================
// Transaction Tests
// ============================================================================

Deno.test("IndexedDBBackend - atomic transaction", async () => {
  const dbName = uniqueDbName("test-idb-tx-atomic");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    // Create initial record
    await authors.create({ name: "Initial", email: "initial@test.com" });

    // Use atomic() helper for transaction
    await backend.atomic(async () => {
      await authors.create({ name: "TX Author 1", email: "tx1@test.com" });
      await authors.create({ name: "TX Author 2", email: "tx2@test.com" });
    });

    // Verify all were created
    const all = await authors.all().fetch();
    assertEquals(all.length, 3);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

Deno.test("IndexedDBBackend - transaction interface", async () => {
  const dbName = uniqueDbName("test-idb-tx-interface");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    // Create initial record to ensure store exists
    await authors.create({ name: "Keep Me", email: "keep@test.com" });

    // Start transaction
    const tx = await backend.beginTransaction();
    assertEquals(tx.isActive, true);

    // Rollback should deactivate the transaction
    await tx.rollback();
    assertEquals(tx.isActive, false);

    // Verify nothing changed
    const all = await authors.all().fetch();
    assertEquals(all.length, 1);
    assertEquals(all[0].name.get(), "Keep Me");
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});

// ============================================================================
// clearStore Tests
// ============================================================================

Deno.test("IndexedDBBackend - clearStore", async () => {
  const dbName = uniqueDbName("test-idb-clear-store");
  const backend = new IndexedDBBackend({ name: dbName, version: 1 });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    await authors.bulkCreate([
      { name: "Author 1", email: "a1@test.com" },
      { name: "Author 2", email: "a2@test.com" },
      { name: "Author 3", email: "a3@test.com" },
    ]);

    // Verify created
    let count = await authors.count();
    assertEquals(count, 3);

    // Clear the store
    await backend.clearStore("authors");

    // Verify cleared
    count = await authors.count();
    assertEquals(count, 0);
  } finally {
    await backend.disconnect();
    await cleanupDb(backend);
  }
});
