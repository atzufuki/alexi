/**
 * Tests for QuerySet.none() method
 *
 * @module
 */

import { assertEquals } from "jsr:@std/assert@1";
import {
  AutoField,
  CharField,
  IntegerField,
  Manager,
  Model,
  reset,
} from "../mod.ts";
import { registerBackend } from "../setup.ts";
import { DenoKVBackend } from "../backends/denokv/mod.ts";

// ============================================================================
// Test Models
// ============================================================================

class Task extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  status = new CharField({ maxLength: 20, default: "open" });
  priority = new IntegerField({ default: 0 });

  static objects = new Manager(Task);
  static override meta = {
    dbTable: "tasks",
    ordering: ["-priority"],
  };
}

// ============================================================================
// Test Setup
// ============================================================================

const TEST_OPTIONS = {
  sanitizeOps: false,
  sanitizeResources: false,
};

let backend: DenoKVBackend;

async function setupTestDb(): Promise<void> {
  backend = new DenoKVBackend({ name: "test", path: ":memory:" });
  await backend.connect();
  registerBackend("default", backend);
}

async function teardownTestDb(): Promise<void> {
  await reset();
  await backend.disconnect();
}

// ============================================================================
// Tests
// ============================================================================

Deno.test({
  name: "QuerySet.none() returns empty QuerySet",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create some tasks first
      await Task.objects.create({ title: "Task 1", status: "open" });
      await Task.objects.create({ title: "Task 2", status: "closed" });
      await Task.objects.create({ title: "Task 3", status: "open" });

      // Verify tasks exist
      const allTasks = await Task.objects.all().fetch();
      assertEquals(await allTasks.length(), 3);

      // Get empty QuerySet via none()
      const emptyQs = Task.objects.none();

      // Verify it's empty
      const fetched = await emptyQs.fetch();
      assertEquals(await fetched.length(), 0);
      assertEquals(fetched.array(), []);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none().count() returns 0 without database query",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create some tasks
      await Task.objects.create({ title: "Task 1" });
      await Task.objects.create({ title: "Task 2" });

      // none().count() should return 0
      const count = await Task.objects.none().count();
      assertEquals(count, 0);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none().first() returns null",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create a task
      await Task.objects.create({ title: "Task 1" });

      // none().first() should return null
      const first = await Task.objects.none().first();
      assertEquals(first, null);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none().last() returns null",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create a task
      await Task.objects.create({ title: "Task 1" });

      // none().last() should return null
      const last = await Task.objects.none().last();
      assertEquals(last, null);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none().exists() returns false",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create a task
      await Task.objects.create({ title: "Task 1" });

      // none().exists() should return false
      const exists = await Task.objects.none().exists();
      assertEquals(exists, false);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none().length() returns 0",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create a task
      await Task.objects.create({ title: "Task 1" });

      // none().length() should return 0
      const emptyQs = Task.objects.none();
      const length = await emptyQs.length();
      assertEquals(length, 0);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none() can be chained with filter()",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create tasks
      await Task.objects.create({ title: "Task 1", status: "open" });

      // Chaining filter on none() should still return empty
      const filtered = Task.objects.none().filter({ status: "open" });
      const fetched = await filtered.fetch();
      assertEquals(await fetched.length(), 0);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none() can be chained with exclude()",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create tasks
      await Task.objects.create({ title: "Task 1", status: "open" });

      // Chaining exclude on none() should still return empty
      const excluded = Task.objects.none().exclude({ status: "closed" });
      const fetched = await excluded.fetch();
      assertEquals(await fetched.length(), 0);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none() can be chained with orderBy()",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create tasks
      await Task.objects.create({ title: "Task 1", priority: 1 });

      // Chaining orderBy on none() should still return empty
      const ordered = Task.objects.none().orderBy("-priority");
      const fetched = await ordered.fetch();
      assertEquals(await fetched.length(), 0);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none() can be chained with limit()",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create tasks
      await Task.objects.create({ title: "Task 1" });

      // Chaining limit on none() should still return empty
      const limited = Task.objects.none().limit(10);
      const fetched = await limited.fetch();
      assertEquals(await fetched.length(), 0);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none() is iterable (yields nothing)",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create tasks
      await Task.objects.create({ title: "Task 1" });

      // Iterating over none() should yield nothing
      const items: Task[] = [];
      for await (const task of Task.objects.none()) {
        items.push(task);
      }
      assertEquals(items.length, 0);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none() from existing QuerySet",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create tasks
      await Task.objects.create({ title: "Task 1", status: "open" });
      await Task.objects.create({ title: "Task 2", status: "open" });

      // Get a filtered QuerySet
      const openTasks = Task.objects.filter({ status: "open" });

      // Call none() on it
      const emptyQs = openTasks.none();
      const fetched = await emptyQs.fetch();
      assertEquals(await fetched.length(), 0);

      // Original QuerySet should still work
      const originalFetched = await openTasks.fetch();
      assertEquals(await originalFetched.length(), 2);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none().isFetched() returns true",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // none() returns a pre-fetched empty QuerySet
      const emptyQs = Task.objects.none();
      assertEquals(emptyQs.isFetched(), true);
    } finally {
      await teardownTestDb();
    }
  },
});

Deno.test({
  name: "QuerySet.none() use case: conditional query",
  ...TEST_OPTIONS,
  async fn() {
    await setupTestDb();

    try {
      // Create tasks
      await Task.objects.create({ title: "Task 1", status: "open" });
      await Task.objects.create({ title: "Task 2", status: "open" });

      // Simulate a function that returns tasks based on condition
      function getTasks(hasAccess: boolean) {
        if (!hasAccess) {
          return Task.objects.none();
        }
        return Task.objects.filter({ status: "open" });
      }

      // Without access
      const noAccessTasks = await getTasks(false).fetch();
      assertEquals(await noAccessTasks.length(), 0);

      // With access
      const withAccessTasks = await getTasks(true).fetch();
      assertEquals(await withAccessTasks.length(), 2);
    } finally {
      await teardownTestDb();
    }
  },
});
