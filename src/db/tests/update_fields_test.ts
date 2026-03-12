/**
 * Tests for Model.save({ updateFields }) — partial update support
 *
 * Covers:
 * - DenoKV backend: only the listed fields are overwritten in the stored record
 * - RestBackend: a PATCH request is issued with only the listed fields
 *
 * @module
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "jsr:@std/assert";

import {
  AutoField,
  CharField,
  IntegerField,
  Manager,
  Model,
  TextField,
} from "../mod.ts";

import { DenoKVBackend } from "../backends/denokv/mod.ts";
import { registerBackend, reset } from "../setup.ts";

// ============================================================================
// Test Models
// ============================================================================

class Task extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  description = new TextField({ blank: true, default: "" });
  priority = new IntegerField({ default: 0 });

  static objects = new Manager(Task);
  static override meta = {
    dbTable: "tasks_update_fields",
  };
}

// ============================================================================
// DenoKV backend tests
// ============================================================================

Deno.test(
  "Model.save({ updateFields }) - only listed fields are updated in DenoKV",
  async () => {
    const dbPath = `./.test-db-update-fields-${Date.now()}`;
    const backend = new DenoKVBackend({
      name: "test-update-fields",
      path: dbPath,
    });
    await backend.connect();
    registerBackend("default", backend);

    try {
      // Create a task with all fields set
      const task = await Task.objects.create({
        title: "Original Title",
        description: "Original Description",
        priority: 5,
      });

      assertExists(task.id.get());

      // Modify all three fields, but only save "title"
      task.title.set("Updated Title");
      task.description.set("Updated Description");
      task.priority.set(99);

      await task.save({ updateFields: ["title"] });

      // Re-fetch from the database
      const reloaded = await Task.objects.get({ id: task.id.get() });

      // title should be updated
      assertEquals(reloaded.title.get(), "Updated Title");
      // description and priority should retain original values
      assertEquals(reloaded.description.get(), "Original Description");
      assertEquals(reloaded.priority.get(), 5);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
);

Deno.test(
  "Model.save({ updateFields }) - multiple fields can be updated at once",
  async () => {
    const dbPath = `./.test-db-update-fields-multi-${Date.now()}`;
    const backend = new DenoKVBackend({
      name: "test-update-fields-multi",
      path: dbPath,
    });
    await backend.connect();
    registerBackend("default", backend);

    try {
      const task = await Task.objects.create({
        title: "Original",
        description: "Original Desc",
        priority: 1,
      });

      task.title.set("New Title");
      task.description.set("New Desc");
      task.priority.set(99);

      // Save two fields, leave priority untouched
      await task.save({ updateFields: ["title", "description"] });

      const reloaded = await Task.objects.get({ id: task.id.get() });

      assertEquals(reloaded.title.get(), "New Title");
      assertEquals(reloaded.description.get(), "New Desc");
      assertEquals(reloaded.priority.get(), 1); // unchanged
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
);

Deno.test(
  "Model.save() without updateFields - full update still works",
  async () => {
    const dbPath = `./.test-db-full-update-${Date.now()}`;
    const backend = new DenoKVBackend({
      name: "test-full-update",
      path: dbPath,
    });
    await backend.connect();
    registerBackend("default", backend);

    try {
      const task = await Task.objects.create({
        title: "Original",
        description: "Original Desc",
        priority: 1,
      });

      task.title.set("Updated");
      task.priority.set(7);

      // Full update — no updateFields
      await task.save();

      const reloaded = await Task.objects.get({ id: task.id.get() });

      assertEquals(reloaded.title.get(), "Updated");
      assertEquals(reloaded.priority.get(), 7);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
);

// ============================================================================
// RestBackend PATCH test (via fetch mock)
// ============================================================================

Deno.test(
  "RestBackend.partialUpdate() - issues PATCH with only listed fields",
  async () => {
    // Track outgoing requests
    const requests: { method: string; url: string; body: string }[] = [];

    // Minimal fetch stub
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
      const method = init?.method ?? "GET";
      const body = init?.body ? String(init.body) : "";

      requests.push({ method, url, body });

      // Return a minimal successful response
      return new Response(JSON.stringify({ id: 1, title: "patched" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const { RestBackend } = await import(
      "../backends/rest/backend.ts"
    );
    const { ModelEndpoint } = await import(
      "../backends/rest/endpoints.ts"
    );

    class TaskRestEndpoint extends ModelEndpoint {
      override model = Task;
      override path = "/tasks/";
    }

    const backend = new RestBackend({
      apiUrl: "https://api.example.com/api",
      endpoints: [TaskRestEndpoint],
    });
    await backend.connect();

    try {
      // Build a model instance that looks like it was fetched (has a pk)
      const task = new Task();
      task.getFields();
      task.id.set(42);
      task.title.set("New title");
      task.description.set("Should NOT be sent");
      task.priority.set(99);

      await backend.partialUpdate(task, ["title"]);

      assertEquals(requests.length, 1);
      const req = requests[0];
      assertEquals(req.method, "PATCH");
      assertStringIncludes(req.url, "/tasks/42/");

      const body = JSON.parse(req.body);
      assertExists(body.title);
      assertEquals(body.title, "New title");
      // description and priority must NOT appear in the PATCH body
      assertEquals(
        Object.prototype.hasOwnProperty.call(body, "description"),
        false,
      );
      assertEquals(
        Object.prototype.hasOwnProperty.call(body, "priority"),
        false,
      );
    } finally {
      globalThis.fetch = originalFetch;
      await backend.disconnect();
    }
  },
);

Deno.test(
  "Model.save({ updateFields }) via RestBackend - routes to PATCH",
  async () => {
    const requests: { method: string; url: string; body: string }[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
      const method = init?.method ?? "GET";
      const body = init?.body ? String(init.body) : "";
      requests.push({ method, url, body });

      return new Response(JSON.stringify({ id: 5 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const { RestBackend } = await import(
      "../backends/rest/backend.ts"
    );
    const { ModelEndpoint } = await import(
      "../backends/rest/endpoints.ts"
    );

    class TaskRestEndpoint2 extends ModelEndpoint {
      override model = Task;
      override path = "/tasks/";
    }

    const backend = new RestBackend({
      apiUrl: "https://api.example.com/api",
      endpoints: [TaskRestEndpoint2],
    });
    await backend.connect();

    try {
      const task = new Task();
      task.getFields();
      task.id.set(5);
      task.title.set("Partial");
      task.priority.set(3);

      await task.save({ using: backend, updateFields: ["title"] });

      assertEquals(requests.length, 1);
      assertEquals(requests[0].method, "PATCH");
      assertStringIncludes(requests[0].url, "/tasks/5/");

      const body = JSON.parse(requests[0].body);
      assertEquals(body.title, "Partial");
      assertEquals(
        Object.prototype.hasOwnProperty.call(body, "priority"),
        false,
      );
    } finally {
      globalThis.fetch = originalFetch;
      await backend.disconnect();
    }
  },
);
