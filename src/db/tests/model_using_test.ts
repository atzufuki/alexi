/**
 * Tests for Model.save(), Model.delete(), and Model.refresh() with using parameter
 *
 * Tests that model instances can specify which backend to use for operations.
 *
 * @module
 */

import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert";

import { AutoField, CharField, IntegerField, Manager, Model } from "../mod.ts";

import { DenoKVBackend } from "../backends/denokv/mod.ts";
import { registerBackend, reset } from "../setup.ts";

// ============================================================================
// Test Models
// ============================================================================

class Task extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  priority = new IntegerField({ default: 0 });

  static objects = new Manager(Task);
  static override meta = {
    dbTable: "tasks",
  };
}

// ============================================================================
// Tests
// ============================================================================

Deno.test("Model.save() - uses using parameter over default backend", async () => {
  // Setup two backends
  const dbPath1 = `./.test-db-using-save-1-${Date.now()}`;
  const dbPath2 = `./.test-db-using-save-2-${Date.now()}`;

  const backend1 = new DenoKVBackend({ name: "backend1", path: dbPath1 });
  const backend2 = new DenoKVBackend({ name: "backend2", path: dbPath2 });

  await backend1.connect();
  await backend2.connect();

  // Setup with backend1 as default
  registerBackend("default", backend1);

  try {
    // Create a task and save to backend2 using the using parameter
    const task = new Task();
    task.getFields();
    task.title.set("Test Task");
    task.priority.set(1);

    await task.save({ using: backend2 });

    // Task should exist in backend2
    const tasksInBackend2 = await Task.objects.using(backend2).all().fetch();
    assertEquals(tasksInBackend2.length(), 1);
    assertEquals(tasksInBackend2.array()[0].title.get(), "Test Task");

    // Task should NOT exist in backend1 (the default)
    const tasksInBackend1 = await Task.objects.using(backend1).all().fetch();
    assertEquals(tasksInBackend1.length(), 0);
  } finally {
    await reset();
    await backend1.disconnect();
    await backend2.disconnect();

    try {
      await Deno.remove(dbPath1, { recursive: true });
      await Deno.remove(dbPath2, { recursive: true });
    } catch { /* ignore */ }
  }
});

Deno.test("Model.save() - uses using parameter with named backend", async () => {
  const dbPath1 = `./.test-db-using-save-named-1-${Date.now()}`;
  const dbPath2 = `./.test-db-using-save-named-2-${Date.now()}`;

  const backend1 = new DenoKVBackend({ name: "default", path: dbPath1 });
  const backend2 = new DenoKVBackend({ name: "secondary", path: dbPath2 });

  await backend1.connect();
  await backend2.connect();

  // Setup with named backends
  registerBackend("default", backend1);
  registerBackend("secondary", backend2);

  try {
    // Create a task and save to named backend "secondary"
    const task = new Task();
    task.getFields();
    task.title.set("Named Backend Task");
    task.priority.set(2);

    await task.save({ using: "secondary" });

    // Task should exist in secondary backend
    const tasksInSecondary = await Task.objects.using("secondary").all()
      .fetch();
    assertEquals(tasksInSecondary.length(), 1);
    assertEquals(tasksInSecondary.array()[0].title.get(), "Named Backend Task");

    // Task should NOT exist in default backend
    const tasksInDefault = await Task.objects.using(backend1).all().fetch();
    assertEquals(tasksInDefault.length(), 0);
  } finally {
    await reset();
    await backend1.disconnect();
    await backend2.disconnect();

    try {
      await Deno.remove(dbPath1, { recursive: true });
      await Deno.remove(dbPath2, { recursive: true });
    } catch { /* ignore */ }
  }
});

Deno.test("Model.delete() - uses using parameter", async () => {
  const dbPath1 = `./.test-db-using-delete-1-${Date.now()}`;
  const dbPath2 = `./.test-db-using-delete-2-${Date.now()}`;

  const backend1 = new DenoKVBackend({ name: "backend1", path: dbPath1 });
  const backend2 = new DenoKVBackend({ name: "backend2", path: dbPath2 });

  await backend1.connect();
  await backend2.connect();
  registerBackend("default", backend1);

  try {
    // Create task in both backends
    const task1 = await Task.objects.using(backend1).create({
      title: "Task in Backend 1",
      priority: 1,
    });
    const task2 = await Task.objects.using(backend2).create({
      title: "Task in Backend 2",
      priority: 2,
    });

    // Verify both exist
    assertEquals(
      (await Task.objects.using(backend1).all().fetch()).length(),
      1,
    );
    assertEquals(
      (await Task.objects.using(backend2).all().fetch()).length(),
      1,
    );

    // Delete task from backend2 using the using parameter
    await task2.delete({ using: backend2 });

    // Task in backend2 should be deleted
    assertEquals(
      (await Task.objects.using(backend2).all().fetch()).length(),
      0,
    );

    // Task in backend1 should still exist
    assertEquals(
      (await Task.objects.using(backend1).all().fetch()).length(),
      1,
    );
  } finally {
    await reset();
    await backend1.disconnect();
    await backend2.disconnect();

    try {
      await Deno.remove(dbPath1, { recursive: true });
      await Deno.remove(dbPath2, { recursive: true });
    } catch { /* ignore */ }
  }
});

Deno.test("Model.delete() - uses instance _backend when no using parameter", async () => {
  const dbPath1 = `./.test-db-instance-backend-1-${Date.now()}`;
  const dbPath2 = `./.test-db-instance-backend-2-${Date.now()}`;

  const backend1 = new DenoKVBackend({ name: "backend1", path: dbPath1 });
  const backend2 = new DenoKVBackend({ name: "backend2", path: dbPath2 });

  await backend1.connect();
  await backend2.connect();
  registerBackend("default", backend1);

  try {
    // Create task in backend2 - the instance should remember it was fetched from backend2
    await Task.objects.using(backend2).create({
      title: "Task in Backend 2",
      priority: 1,
    });

    // Fetch the task from backend2 - instance should have _backend set
    const fetchedTask = await Task.objects.using(backend2).first();
    assertExists(fetchedTask);

    // Delete without using parameter - should use instance's _backend (backend2)
    await fetchedTask.delete();

    // Task should be deleted from backend2
    assertEquals(
      (await Task.objects.using(backend2).all().fetch()).length(),
      0,
    );
  } finally {
    await reset();
    await backend1.disconnect();
    await backend2.disconnect();

    try {
      await Deno.remove(dbPath1, { recursive: true });
      await Deno.remove(dbPath2, { recursive: true });
    } catch { /* ignore */ }
  }
});

Deno.test("Model.save() - update uses instance _backend when no using parameter", async () => {
  const dbPath = `./.test-db-instance-backend-save-${Date.now()}`;
  const backend = new DenoKVBackend({ name: "test", path: dbPath });

  await backend.connect();
  registerBackend("default", backend);

  try {
    // Create task
    await Task.objects.create({
      title: "Original Title",
      priority: 1,
    });

    // Fetch and update
    const task = await Task.objects.first();
    assertExists(task);

    task.title.set("Updated Title");
    await task.save(); // Should use instance's _backend

    // Verify update
    const updated = await Task.objects.first();
    assertExists(updated);
    assertEquals(updated.title.get(), "Updated Title");
  } finally {
    await reset();
    await backend.disconnect();

    try {
      await Deno.remove(dbPath, { recursive: true });
    } catch { /* ignore */ }
  }
});

Deno.test("Model.refresh() - uses using parameter", async () => {
  const dbPath = `./.test-db-refresh-using-${Date.now()}`;
  const backend = new DenoKVBackend({ name: "test", path: dbPath });

  await backend.connect();
  registerBackend("default", backend);

  try {
    // Create task
    const task = await Task.objects.create({
      title: "Original Title",
      priority: 1,
    });

    // Update directly in the database
    const fromDb = await Task.objects.get({ id: task.id.get() });
    fromDb.title.set("Database Updated Title");
    await fromDb.save();

    // Refresh the original task
    await task.refresh({ using: backend });

    assertEquals(task.title.get(), "Database Updated Title");
  } finally {
    await reset();
    await backend.disconnect();

    try {
      await Deno.remove(dbPath, { recursive: true });
    } catch { /* ignore */ }
  }
});

Deno.test("Model.save() - throws error for unknown named backend", async () => {
  const dbPath = `./.test-db-unknown-backend-${Date.now()}`;
  const backend = new DenoKVBackend({ name: "test", path: dbPath });

  await backend.connect();
  registerBackend("default", backend);

  try {
    const task = new Task();
    task.getFields();
    task.title.set("Test");

    await assertRejects(
      () => task.save({ using: "nonexistent" }),
      Error,
      "Unknown database backend: 'nonexistent'",
    );
  } finally {
    await reset();
    await backend.disconnect();

    try {
      await Deno.remove(dbPath, { recursive: true });
    } catch { /* ignore */ }
  }
});
