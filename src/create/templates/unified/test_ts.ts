/**
 * Test template generator
 *
 * @module @alexi/create/templates/unified/test_ts
 */

/**
 * Generate tests/post_test.ts content for the unified app
 */
export function generatePostTestTs(name: string): string {
  const appName = toPascalCase(name);

  return `/**
 * Post API tests for ${name}
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { reset } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { setup } from "@alexi/core";
import { PostModel } from "@${name}/models.ts";

Deno.test({
  name: "${appName}: PostModel CRUD",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Setup in-memory database
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await setup({ DATABASES: { default: backend } });

    try {
      // Create
      const post = await PostModel.objects.create({
        title: "Test Post",
        content: "Hello, world!",
        published: false,
      });

      assertExists(post.id.get());
      assertEquals(post.title.get(), "Test Post");
      assertEquals(post.content.get(), "Hello, world!");
      assertEquals(post.published.get(), false);

      // Update
      post.published.set(true);
      await post.save();

      const updated = await PostModel.objects.get({ id: post.id.get() });
      assertEquals(updated.published.get(), true);

      // Delete
      await post.delete();
      const deleted = await PostModel.objects
        .filter({ id: post.id.get() })
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
