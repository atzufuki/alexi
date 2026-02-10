/**
 * Basic tests for Alexi ORM
 * @module
 */

import { assertEquals, assertExists } from "jsr:@std/assert";

import {
  AutoField,
  CharField,
  DateTimeField,
  IntegerField,
  Manager,
  Model,
  TextField,
} from "../mod.ts";

import { DenoKVBackend } from "../backends/denokv/mod.ts";
import { reset, setup } from "../setup.ts";

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
// Tests
// ============================================================================

Deno.test("Model - field initialization", () => {
  const article = new Article();

  // Initialize fields by calling getFields()
  const fields = article.getFields();

  // Check that fields are properly initialized
  assertExists(article.id);
  assertExists(article.title);
  assertExists(article.content);
  assertExists(article.views);
  assertExists(article.createdAt);
  assertExists(article.updatedAt);

  // Check field names are set
  assertEquals(article.id.name, "id");
  assertEquals(article.title.name, "title");
  assertEquals(article.content.name, "content");
  assertEquals(Object.keys(fields).length, 6);
});

Deno.test("Model - field default values", () => {
  const article = new Article();

  // Initialize fields
  article.getFields();

  // views should have default value of 0
  assertEquals(article.views.get(), 0);

  // Other fields should be null
  assertEquals(article.title.get(), null);
  assertEquals(article.content.get(), null);
});

Deno.test("Model - set and get field values", () => {
  const article = new Article();

  // Initialize fields
  article.getFields();

  article.title.set("Hello World");
  article.content.set("This is my first article");
  article.views.set(100);

  assertEquals(article.title.get(), "Hello World");
  assertEquals(article.content.get(), "This is my first article");
  assertEquals(article.views.get(), 100);
});

Deno.test("Model - toDB conversion", () => {
  const article = new Article();

  // Initialize fields
  article.getFields();

  article.title.set("Test Article");
  article.content.set("Test content");
  article.views.set(50);

  const data = article.toDB();

  assertEquals(data.title, "Test Article");
  assertEquals(data.content, "Test content");
  assertEquals(data.views, 50);
  // createdAt and updatedAt should be set due to autoNowAdd/autoNow
  assertExists(data.createdAt);
  assertExists(data.updatedAt);
});

Deno.test("Model - fromDB population", () => {
  const article = new Article();

  article.fromDB({
    id: 1,
    title: "Loaded Article",
    content: "Loaded content",
    views: 200,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
  });

  assertEquals(article.id.get(), 1);
  assertEquals(article.title.get(), "Loaded Article");
  assertEquals(article.content.get(), "Loaded content");
  assertEquals(article.views.get(), 200);
  assertEquals(article.isPersisted, true);
});

Deno.test("Model - toObject conversion", () => {
  const article = new Article();
  article.title.set("Test");
  article.content.set("Content");

  const obj = article.toObject();

  assertEquals(obj.title, "Test");
  assertEquals(obj.content, "Content");
  assertEquals(obj.views, 0);
});

Deno.test("Model - getTableName", () => {
  assertEquals(Article.getTableName(), "articles");
  assertEquals(Author.getTableName(), "authors");
});

Deno.test("CharField - maxLength validation", () => {
  const field = new CharField({ maxLength: 10 });
  field.setName("test");

  // Valid
  const validResult = field.validate("hello");
  assertEquals(validResult.valid, true);

  // Invalid - too long
  const invalidResult = field.validate("hello world!");
  assertEquals(invalidResult.valid, false);
  assertEquals(invalidResult.errors.length, 1);
});

Deno.test("IntegerField - integer validation", () => {
  const field = new IntegerField();
  field.setName("count");

  // Valid
  assertEquals(field.validate(42).valid, true);
  assertEquals(field.validate(0).valid, true);
  assertEquals(field.validate(-10).valid, true);

  // Invalid - not an integer
  const result = field.validate(3.14);
  assertEquals(result.valid, false);
});

Deno.test("DenoKVBackend - connection", async () => {
  // Use unique path for this test
  const dbPath = `./.test-db-conn-${Date.now()}`;
  const backend = new DenoKVBackend({ name: "test-db", path: dbPath });

  await backend.connect();
  assertEquals(backend.isConnected, true);

  await backend.disconnect();
  assertEquals(backend.isConnected, false);

  // Clean up test database
  try {
    await Deno.remove(dbPath, { recursive: true });
  } catch { /* ignore */ }
});

Deno.test("DenoKVBackend - CRUD operations", async () => {
  // Use unique path for this test
  const dbPath = `./.test-db-crud-${Date.now()}`;
  const backend = new DenoKVBackend({ name: "test-crud", path: dbPath });
  await backend.connect();

  try {
    // Use .using() to create a manager bound to this backend
    const authors = Author.objects.using(backend);

    // Create
    const author = await authors.create({
      name: "John Doe",
      email: "john@example.com",
    });

    assertExists(author.id.get());
    assertEquals(author.name.get(), "John Doe");
    assertEquals(author.email.get(), "john@example.com");

    // Read
    const fetchedAuthors = await authors.all().fetch();
    assertEquals(fetchedAuthors.length, 1);
    assertEquals(fetchedAuthors[0].name.get(), "John Doe");

    // Get by filter
    const found = await authors.get({ name: "John Doe" });
    assertEquals(found.email.get(), "john@example.com");

    // Update
    found.email.set("john.doe@example.com");
    await backend.update(found);

    const updated = await authors.get({ id: found.id.get() });
    assertEquals(updated.email.get(), "john.doe@example.com");

    // Delete
    await backend.delete(found);
    const remaining = await authors.all().fetch();
    assertEquals(remaining.length, 0);
  } finally {
    await backend.disconnect();
    // Clean up test database
    try {
      await Deno.remove(dbPath, { recursive: true });
    } catch { /* ignore */ }
  }
});

Deno.test("DenoKVBackend - filter operations", async () => {
  // Use unique path for this test
  const dbPath = `./.test-db-filter-${Date.now()}`;
  const backend = new DenoKVBackend({ name: "test-filter", path: dbPath });
  await backend.connect();

  try {
    // Use .using() to create a manager bound to this backend
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
    await articles.create({
      title: "JavaScript Basics",
      content: "Learn JavaScript",
      views: 50,
    });

    // Filter by exact match
    const typescript = await articles
      .filter({ title: "TypeScript Guide" })
      .fetch();
    assertEquals(typescript.length, 1);
    assertEquals(typescript[0].title.get(), "TypeScript Guide");

    // Filter by contains
    const learnArticles = await articles
      .filter({ title__contains: "Guide" })
      .fetch();
    assertEquals(learnArticles.length, 1);

    // Filter by gte
    const popularArticles = await articles
      .filter({ views__gte: 100 })
      .fetch();
    assertEquals(popularArticles.length, 2);

    // Filter by lt
    const unpopularArticles = await articles
      .filter({ views__lt: 100 })
      .fetch();
    assertEquals(unpopularArticles.length, 1);

    // Ordering
    const orderedByViews = await articles.orderBy("-views").fetch();
    assertEquals(orderedByViews[0].views.get(), 200);
    assertEquals(orderedByViews[2].views.get(), 50);

    // Limit
    const limited = await articles.orderBy("-views").limit(2).fetch();
    assertEquals(limited.length, 2);

    // Count
    const count = await articles.count();
    assertEquals(count, 3);

    // Exists
    const exists = await articles
      .filter({ title: "TypeScript Guide" })
      .exists();
    assertEquals(exists, true);

    const notExists = await articles
      .filter({ title: "Nonexistent" })
      .exists();
    assertEquals(notExists, false);
  } finally {
    await backend.disconnect();
    // Clean up test database
    try {
      await Deno.remove(dbPath, { recursive: true });
    } catch { /* ignore */ }
  }
});

Deno.test("DenoKVBackend - aggregation", async () => {
  // Use unique path for this test
  const dbPath = `./.test-db-aggregate-${Date.now()}`;
  const backend = new DenoKVBackend({ name: "test-aggregate", path: dbPath });
  await backend.connect();

  try {
    // Use .using() to create a manager bound to this backend
    const articles = Article.objects.using(backend);

    // Create test data
    await articles.bulkCreate([
      { title: "Article 1", content: "Content 1", views: 100 },
      { title: "Article 2", content: "Content 2", views: 200 },
      { title: "Article 3", content: "Content 3", views: 300 },
    ]);

    // Import aggregation functions
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
    // Clean up test database
    try {
      await Deno.remove(dbPath, { recursive: true });
    } catch { /* ignore */ }
  }
});

// Model with unique field for testing
class UniqueEmail extends Model {
  id = new AutoField({ primaryKey: true });
  email = new CharField({ maxLength: 255, unique: true });
  name = new CharField({ maxLength: 100 });

  static objects = new Manager(UniqueEmail);
  static override meta = {
    dbTable: "unique_emails",
  };
}

Deno.test("DenoKVBackend - unique field constraint", async () => {
  // Use unique path for this test
  const dbPath = `./.test-db-unique-${Date.now()}`;
  const backend = new DenoKVBackend({ name: "test-db", path: dbPath });
  await backend.connect();
  await setup({ backend });

  try {
    // Create first record - should succeed
    const record1 = new UniqueEmail();
    record1.getFields();
    record1.email.set("test@example.com");
    record1.name.set("Test User");
    await backend.insert(record1);

    // Try to create second record with same email - should fail
    const record2 = new UniqueEmail();
    record2.getFields();
    record2.email.set("test@example.com");
    record2.name.set("Another User");

    let errorThrown = false;
    try {
      await backend.insert(record2);
    } catch (error) {
      errorThrown = true;
      assertEquals(
        (error as Error).message.includes("Unique constraint violation"),
        true,
      );
    }
    assertEquals(errorThrown, true);

    // Create record with different email - should succeed
    const record3 = new UniqueEmail();
    record3.getFields();
    record3.email.set("other@example.com");
    record3.name.set("Other User");
    await backend.insert(record3);

    // Verify we have 2 records
    const all = await UniqueEmail.objects.all().fetch();
    assertEquals(all.length, 2);

    // Test case-insensitive uniqueness
    const record4 = new UniqueEmail();
    record4.getFields();
    record4.email.set("TEST@EXAMPLE.COM");
    record4.name.set("Case Test");

    let caseErrorThrown = false;
    try {
      await backend.insert(record4);
    } catch (error) {
      caseErrorThrown = true;
      assertEquals(
        (error as Error).message.includes("Unique constraint violation"),
        true,
      );
    }
    assertEquals(caseErrorThrown, true);
  } finally {
    await reset();
    await backend.disconnect();
    // Clean up test database
    try {
      await Deno.remove(dbPath, { recursive: true });
    } catch { /* ignore */ }
  }
});
