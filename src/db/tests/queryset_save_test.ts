/**
 * Tests for QuerySet.save() method
 * @module
 */

import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert";

import {
  AutoField,
  CharField,
  IntegerField,
  Manager,
  Model,
  QuerySet,
} from "../mod.ts";
import type { SaveResult } from "../mod.ts";

import { DenoKVBackend } from "../backends/denokv/mod.ts";
import { registerBackend, reset } from "../setup.ts";

// ============================================================================
// Test Models
// ============================================================================

class Project extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 200 });
  status = new CharField({ maxLength: 50 });
  priority = new IntegerField({ default: 0 });

  static objects = new Manager(Project);
  static override meta = {
    dbTable: "projects",
    ordering: ["name"],
  };
}

// ============================================================================
// Test Setup
// ============================================================================

async function setupTestBackend(): Promise<DenoKVBackend> {
  const dbPath = `:memory:`;
  const backend = new DenoKVBackend({ name: "save_test", path: dbPath });
  await backend.connect();
  registerBackend("default", backend);
  return backend;
}

async function teardown(): Promise<void> {
  await reset();
}

// ============================================================================
// Tests
// ============================================================================

Deno.test({
  name: "QuerySet.save() - throws if not fetched",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      const qs = Project.objects.filter({ status: "draft" });

      await assertRejects(
        async () => await qs.save(),
        Error,
        "QuerySet not fetched",
      );
    } finally {
      await teardown();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet.save() - inserts new records",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create records in one backend, then save to the same backend
      // (simulating cross-backend sync would require two backends)
      const project1 = await Project.objects.create({
        name: "Project A",
        status: "draft",
        priority: 1,
      });
      const project2 = await Project.objects.create({
        name: "Project B",
        status: "draft",
        priority: 2,
      });

      // Fetch the records
      const qs = await Project.objects.filter({ status: "draft" }).fetch();
      assertEquals(qs.array().length, 2);

      // Modify the records
      for (const project of qs.array()) {
        project.status.set("published");
      }

      // Save (should update existing records)
      const result = await qs.save();

      assertEquals(result.updated, 2);
      assertEquals(result.inserted, 0);
      assertEquals(result.failed, 0);
      assertEquals(result.total, 2);

      // Verify changes persisted
      const updated = await Project.objects.filter({ status: "published" })
        .fetch();
      assertEquals(updated.array().length, 2);
    } finally {
      await teardown();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet.save() - updates existing records",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create some projects
      await Project.objects.create({
        name: "Project 1",
        status: "draft",
        priority: 1,
      });
      await Project.objects.create({
        name: "Project 2",
        status: "draft",
        priority: 2,
      });
      await Project.objects.create({
        name: "Project 3",
        status: "active",
        priority: 3,
      });

      // Fetch draft projects
      const drafts = await Project.objects.filter({ status: "draft" }).fetch();
      assertEquals(drafts.array().length, 2);

      // Update all to published
      for (const project of drafts.array()) {
        project.status.set("published");
        project.priority.set(project.priority.get()! + 10);
      }

      // Save changes
      const result = await drafts.save();

      assertEquals(result.updated, 2);
      assertEquals(result.inserted, 0);
      assertEquals(result.failed, 0);

      // Verify
      const published = await Project.objects.filter({ status: "published" })
        .fetch();
      assertEquals(published.array().length, 2);

      for (const project of published.array()) {
        const priority = project.priority.get()!;
        assertEquals(
          priority >= 11,
          true,
          `Priority should be >= 11, got ${priority}`,
        );
      }
    } finally {
      await teardown();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet.save() - returns SaveResult with correct counts",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create projects
      await Project.objects.create({
        name: "Project A",
        status: "draft",
        priority: 1,
      });

      // Fetch and save
      const qs = await Project.objects.all().fetch();
      const result: SaveResult = await qs.save();

      // Verify SaveResult structure
      assertExists(result.inserted);
      assertExists(result.updated);
      assertExists(result.failed);
      assertExists(result.total);
      assertExists(result.errors);

      assertEquals(typeof result.inserted, "number");
      assertEquals(typeof result.updated, "number");
      assertEquals(typeof result.failed, "number");
      assertEquals(typeof result.total, "number");
      assertEquals(Array.isArray(result.errors), true);

      assertEquals(result.total, 1);
      assertEquals(result.updated, 1);
      assertEquals(result.errors.length, 0);
    } finally {
      await teardown();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet.save() - empty queryset returns zero counts",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Fetch empty result
      const qs = await Project.objects.filter({ status: "nonexistent" })
        .fetch();
      assertEquals(qs.array().length, 0);

      // Save empty queryset
      const result = await qs.save();

      assertEquals(result.inserted, 0);
      assertEquals(result.updated, 0);
      assertEquals(result.failed, 0);
      assertEquals(result.total, 0);
    } finally {
      await teardown();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet.save() - works with using() for different backend",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Set up two backends
    const backend1 = new DenoKVBackend({ name: "backend1", path: ":memory:" });
    const backend2 = new DenoKVBackend({ name: "backend2", path: ":memory:" });

    await backend1.connect();
    await backend2.connect();
    registerBackend("default", backend1);

    try {
      // Create in backend1
      await Project.objects.create({
        name: "Cross Backend Project",
        status: "draft",
        priority: 5,
      });

      // Fetch from backend1
      const qs = await Project.objects.all().fetch();
      assertEquals(qs.array().length, 1);

      // Save to backend2 (cross-backend sync)
      const result = await qs.using(backend2).save();

      assertEquals(result.inserted, 1);
      assertEquals(result.updated, 0);

      // Verify it exists in backend2
      const inBackend2 = await Project.objects.using(backend2).all().fetch();
      assertEquals(inBackend2.array().length, 1);
      assertEquals(inBackend2.array()[0].name.get(), "Cross Backend Project");

      // Verify it still exists in backend1
      const inBackend1 = await Project.objects.using(backend1).all().fetch();
      assertEquals(inBackend1.array().length, 1);
    } finally {
      await teardown();
      await backend1.disconnect();
      await backend2.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet.save() - handles mixed insert and update",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend1 = new DenoKVBackend({ name: "source", path: ":memory:" });
    const backend2 = new DenoKVBackend({ name: "target", path: ":memory:" });

    await backend1.connect();
    await backend2.connect();
    registerBackend("default", backend1);

    try {
      // Create two projects in backend1
      const projectA = await Project.objects.create({
        name: "Existing Project",
        status: "draft",
        priority: 1,
      });
      await Project.objects.create({
        name: "New Project",
        status: "draft",
        priority: 2,
      });

      // Create one of them in backend2 (simulate partial sync state)
      const existingInBackend2 = new Project();
      existingInBackend2.id.set(projectA.id.get());
      existingInBackend2.name.set("Existing Project");
      existingInBackend2.status.set("old_status");
      existingInBackend2.priority.set(1);
      await backend2.insert(existingInBackend2);

      // Fetch from backend1
      const qs = await Project.objects.all().fetch();
      assertEquals(qs.array().length, 2);

      // Modify and save to backend2
      for (const project of qs.array()) {
        project.status.set("synced");
      }
      const result = await qs.using(backend2).save();

      // One should be updated (existing), one should be inserted (new)
      assertEquals(result.updated, 1);
      assertEquals(result.inserted, 1);
      assertEquals(result.failed, 0);
      assertEquals(result.total, 2);

      // Verify both exist in backend2 with new status
      const synced = await Project.objects.using(backend2).all().fetch();
      assertEquals(synced.array().length, 2);
      for (const project of synced.array()) {
        assertEquals(project.status.get(), "synced");
      }
    } finally {
      await teardown();
      await backend1.disconnect();
      await backend2.disconnect();
    }
  },
});
