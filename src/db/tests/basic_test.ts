/**
 * Basic tests for Alexi ORM
 * @module
 */

import { assertEquals, assertExists } from "jsr:@std/assert";

import {
  AutoField,
  CharField,
  DateTimeField,
  ForeignKey,
  IntegerField,
  Manager,
  Model,
  OnDelete,
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

Deno.test(
  "Model - field.set() before _initializeFields() is not overwritten by default",
  async () => {
    const backend = new DenoKVBackend({
      name: "test_preset",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ backend });

    try {
      // Set a field value BEFORE any method that triggers _initializeFields()
      const article = new Article();
      article.views.set(42); // set before getFields() / save() / toDB()

      // _initializeFields() runs lazily here (inside save → toDB)
      const saved = await Article.objects.create({ title: "Test", views: 42 });
      assertEquals(saved.views.get(), 42);

      // Also verify via direct set + save path (the exact bug scenario)
      const doc = new Article();
      doc.title.set("hello");
      doc.views.set(99);
      await doc.save(); // triggers _initializeFields() internally

      const fetched = await Article.objects.get({ id: doc.pk });
      assertEquals(
        fetched.views.get(),
        99,
        "views set before _initializeFields() must not be overwritten by default (0)",
      );
      assertEquals(
        fetched.title.get(),
        "hello",
        "title set before _initializeFields() must be preserved",
      );
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
);

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
    const fetchedAuthors = (await authors.all().fetch()).array();
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
    const remaining = (await authors.all().fetch()).array();
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
    const typescript = (await articles
      .filter({ title: "TypeScript Guide" })
      .fetch()).array();
    assertEquals(typescript.length, 1);
    assertEquals(typescript[0].title.get(), "TypeScript Guide");

    // Filter by contains
    const learnArticles = (await articles
      .filter({ title__contains: "Guide" })
      .fetch()).array();
    assertEquals(learnArticles.length, 1);

    // Filter by gte
    const popularArticles = (await articles
      .filter({ views__gte: 100 })
      .fetch()).array();
    assertEquals(popularArticles.length, 2);

    // Filter by lt
    const unpopularArticles = (await articles
      .filter({ views__lt: 100 })
      .fetch()).array();
    assertEquals(unpopularArticles.length, 1);

    // Ordering
    const orderedByViews = (await articles.orderBy("-views").fetch()).array();
    assertEquals(orderedByViews[0].views.get(), 200);
    assertEquals(orderedByViews[2].views.get(), 50);

    // Limit
    const limited = (await articles.orderBy("-views").limit(2).fetch()).array();
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
    const all = (await UniqueEmail.objects.all().fetch()).array();
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

// ============================================================================
// ForeignKey fromDB Tests
// ============================================================================

class Employee extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  static objects = new Manager(Employee);
  static override meta = {
    dbTable: "employees",
  };
}

class Competence extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  static objects = new Manager(Competence);
  static override meta = {
    dbTable: "competences",
  };
}

class EmployeeCompetence extends Model {
  id = new AutoField({ primaryKey: true });
  employee = new ForeignKey("Employee", { onDelete: OnDelete.CASCADE });
  competence = new ForeignKey("Competence", { onDelete: OnDelete.CASCADE });
  addedAt = new DateTimeField({ autoNowAdd: true });

  static objects = new Manager(EmployeeCompetence);
  static override meta = {
    dbTable: "employee_competences",
  };
}

Deno.test("Model.fromDB - ForeignKey with column name format (employee_id)", () => {
  const empComp = new EmployeeCompetence();

  // Database/IndexedDB format uses column names with _id suffix
  empComp.fromDB({
    id: 1,
    employee_id: 5,
    competence_id: 3,
    addedAt: "2024-01-01T00:00:00.000Z",
  });

  assertEquals(empComp.id.get(), 1);
  // Use .id to get the foreign key ID (new API)
  assertEquals(empComp.employee.id, 5);
  assertEquals(empComp.competence.id, 3);
  assertEquals(empComp.isPersisted, true);
});

Deno.test("Model.fromDB - ForeignKey with field name format (employee)", () => {
  const empComp = new EmployeeCompetence();

  // REST API format uses field names without _id suffix (Django convention)
  empComp.fromDB({
    id: 2,
    employee: 10,
    competence: 7,
    addedAt: "2024-02-01T00:00:00.000Z",
  });

  assertEquals(empComp.id.get(), 2);
  // Use .id to get the foreign key ID (new API)
  assertEquals(empComp.employee.id, 10);
  assertEquals(empComp.competence.id, 7);
  assertEquals(empComp.isPersisted, true);
});

Deno.test("Model.fromDB - ForeignKey column name takes precedence over field name", () => {
  const empComp = new EmployeeCompetence();

  // If both are present, column name (employee_id) should take precedence
  empComp.fromDB({
    id: 3,
    employee: 100, // field name
    employee_id: 5, // column name - should be used
    competence: 200,
    competence_id: 3,
    addedAt: "2024-03-01T00:00:00.000Z",
  });

  assertEquals(empComp.id.get(), 3);
  // Use .id to get the foreign key ID (new API)
  assertEquals(empComp.employee.id, 5); // column name value
  assertEquals(empComp.competence.id, 3); // column name value
});

Deno.test("Model.fromDB - ForeignKey with null values", () => {
  const empComp = new EmployeeCompetence();

  empComp.fromDB({
    id: 4,
    employee: null,
    competence: null,
    addedAt: "2024-04-01T00:00:00.000Z",
  });

  assertEquals(empComp.id.get(), 4);
  // Use .id to get the foreign key ID (new API)
  assertEquals(empComp.employee.id, null);
  assertEquals(empComp.competence.id, null);
});

Deno.test("Model.toDB - ForeignKey outputs column name format", () => {
  const empComp = new EmployeeCompetence();
  empComp.getFields();

  empComp.id.set(1);
  // Use .set() with raw ID values (new API supports this)
  empComp.employee.set(5 as unknown as Employee);
  empComp.competence.set(3 as unknown as Competence);

  const data = empComp.toDB();

  // toDB should output column names with _id suffix
  assertEquals(data.employee_id, 5);
  assertEquals(data.competence_id, 3);
  // Field names without suffix should NOT be present
  assertEquals("employee" in data, false);
  assertEquals("competence" in data, false);
});

// ============================================================================
// Manager.getOrCreate() and Manager.updateOrCreate() Tests (DenoKV)
// ============================================================================

Deno.test("DenoKVBackend - getOrCreate creates new object", async () => {
  const dbPath = `./.test-db-get-or-create-${Date.now()}`;
  const backend = new DenoKVBackend({
    name: "test-get-or-create",
    path: dbPath,
  });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    // Should create new object
    const [author1, created1] = await authors.getOrCreate(
      { name: "New Author" },
      { email: "new@example.com" },
    );

    assertEquals(created1, true);
    assertEquals(author1.name.get(), "New Author");
    assertEquals(author1.email.get(), "new@example.com");
    assertExists(author1.id.get());

    // Verify it's persisted
    const count = await authors.count();
    assertEquals(count, 1);
  } finally {
    await backend.disconnect();
    try {
      await Deno.remove(dbPath, { recursive: true });
    } catch { /* ignore */ }
  }
});

Deno.test("DenoKVBackend - getOrCreate returns existing object", async () => {
  const dbPath = `./.test-db-get-or-create-existing-${Date.now()}`;
  const backend = new DenoKVBackend({
    name: "test-get-or-create",
    path: dbPath,
  });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    // Create initial object
    await authors.create({
      name: "Existing Author",
      email: "existing@example.com",
    });

    // getOrCreate should return existing object
    const [author, created] = await authors.getOrCreate(
      { name: "Existing Author" },
      { email: "different@example.com" }, // defaults should be ignored
    );

    assertEquals(created, false);
    assertEquals(author.name.get(), "Existing Author");
    assertEquals(author.email.get(), "existing@example.com"); // original email, not defaults

    // Verify only one record exists
    const count = await authors.count();
    assertEquals(count, 1);
  } finally {
    await backend.disconnect();
    try {
      await Deno.remove(dbPath, { recursive: true });
    } catch { /* ignore */ }
  }
});

Deno.test("DenoKVBackend - updateOrCreate creates new object", async () => {
  const dbPath = `./.test-db-update-or-create-${Date.now()}`;
  const backend = new DenoKVBackend({
    name: "test-update-or-create",
    path: dbPath,
  });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    // Should create new object
    const [author, created] = await authors.updateOrCreate(
      { name: "New Author" },
      { email: "new@example.com" },
    );

    assertEquals(created, true);
    assertEquals(author.name.get(), "New Author");
    assertEquals(author.email.get(), "new@example.com");
    assertExists(author.id.get());

    // Verify it's persisted
    const count = await authors.count();
    assertEquals(count, 1);
  } finally {
    await backend.disconnect();
    try {
      await Deno.remove(dbPath, { recursive: true });
    } catch { /* ignore */ }
  }
});

Deno.test("DenoKVBackend - updateOrCreate updates existing object", async () => {
  const dbPath = `./.test-db-update-or-create-existing-${Date.now()}`;
  const backend = new DenoKVBackend({
    name: "test-update-or-create",
    path: dbPath,
  });
  await backend.connect();

  try {
    const authors = Author.objects.using(backend);

    // Create initial object
    await authors.create({
      name: "Existing Author",
      email: "old@example.com",
    });

    // updateOrCreate should update existing object
    const [author, created] = await authors.updateOrCreate(
      { name: "Existing Author" },
      { email: "updated@example.com" },
    );

    assertEquals(created, false);
    assertEquals(author.name.get(), "Existing Author");
    assertEquals(author.email.get(), "updated@example.com"); // email should be updated

    // Verify only one record exists
    const count = await authors.count();
    assertEquals(count, 1);

    // Verify change is persisted
    const fetched = await authors.get({ name: "Existing Author" });
    assertEquals(fetched.email.get(), "updated@example.com");
  } finally {
    await backend.disconnect();
    try {
      await Deno.remove(dbPath, { recursive: true });
    } catch { /* ignore */ }
  }
});
