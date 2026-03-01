/**
 * Test template generator
 *
 * @module @alexi/create/templates/unified/test_ts
 */

/**
 * Generate tests/todo_test.ts content for the unified app
 */
export function generateTodoTestTs(name: string): string {
  const appName = toPascalCase(name);

  return `/**
 * Todo API tests for ${name}
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { reset } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { setup } from "@alexi/core";
import { TodoModel } from "@${name}/models.ts";

Deno.test({
  name: "${appName}: TodoModel CRUD",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Setup in-memory database
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await setup({ DATABASES: { default: backend } });

    try {
      // Create
      const todo = await TodoModel.objects.create({
        title: "Test Todo",
        completed: false,
      });

      assertExists(todo.id.get());
      assertEquals(todo.title.get(), "Test Todo");
      assertEquals(todo.completed.get(), false);

      // Update
      todo.completed.set(true);
      await todo.save();

      const updated = await TodoModel.objects.get({ id: todo.id.get() });
      assertEquals(updated.completed.get(), true);

      // Delete
      await todo.delete();
      const deleted = await TodoModel.objects
        .filter({ id: todo.id.get() })
        .first();
      assertEquals(deleted, null);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
