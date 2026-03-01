/**
 * Posts App E2E Tests for @alexi/create
 *
 * Tests the scaffolded Posts application:
 * - Creates a new project using @alexi/create
 * - Starts the web server
 * - Tests Posts REST API endpoints
 *
 * Run manually with:
 *   deno test -A --unstable-kv src/create/tests/posts_e2e_test.ts
 *
 * @module @alexi/create/tests/posts_e2e_test
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  cleanupTempDir,
  cleanupTestProject,
  createTempDir,
  createTestProject,
  DEFAULT_API_PORT,
  generateProjectName,
  type ScaffoldedProject,
  type ServerProcess,
  sleep,
  startApiServer,
  stopServer,
} from "./e2e_utils.ts";

// =============================================================================
// Test Suite
// =============================================================================

Deno.test({
  name: "Posts App E2E Tests",
  // E2E tests are slow (project scaffolding + server startup + API calls).
  // Run manually or in CI with: deno test -A --unstable-kv --filter "Posts App E2E"
  ignore: false,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    let tempDir: string;
    let project: ScaffoldedProject;
    let apiServer: ServerProcess;
    const apiUrl = `http://localhost:${DEFAULT_API_PORT}/api`;

    // =========================================================================
    // Setup
    // =========================================================================

    await t.step("setup: create project and start server", async () => {
      tempDir = await createTempDir();
      const projectName = generateProjectName();
      project = await createTestProject(projectName, tempDir);

      // Start API server
      apiServer = await startApiServer(project.path, DEFAULT_API_PORT);
      console.log(`[e2e] API server running at ${apiServer.baseUrl}`);
    });

    // =========================================================================
    // Root Route
    // =========================================================================

    await t.step("GET / returns welcome message", async () => {
      const response = await fetch(`http://localhost:${DEFAULT_API_PORT}/`);
      assertEquals(response.status, 200);

      const data = await response.json();
      assertExists(data.message);
    });

    // =========================================================================
    // Health Check
    // =========================================================================

    await t.step("GET /api/health/ returns ok", async () => {
      const response = await fetch(`${apiUrl}/health/`);
      assertEquals(response.status, 200);

      const data = await response.json();
      assertEquals(data.status, "ok");
    });

    // =========================================================================
    // Posts CRUD
    // =========================================================================

    let postId: number;

    await t.step("POST /api/posts/ creates a post", async () => {
      const response = await fetch(`${apiUrl}/posts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "My First Post",
          content: "Hello, world!",
          published: false,
        }),
      });

      assertEquals(response.status, 201);

      const data = await response.json();
      assertExists(data.id);
      assertEquals(data.title, "My First Post");
      assertEquals(data.content, "Hello, world!");
      assertEquals(data.published, false);
      postId = data.id;
    });

    await t.step("GET /api/posts/ lists posts", async () => {
      const response = await fetch(`${apiUrl}/posts/`);
      assertEquals(response.status, 200);

      const data = await response.json();
      assertEquals(Array.isArray(data), true);
      assertEquals(data.length >= 1, true);

      // Find our post
      const post = data.find((p: { id: number }) => p.id === postId);
      assertExists(post);
      assertEquals(post.title, "My First Post");
    });

    await t.step("GET /api/posts/:id/ retrieves a post", async () => {
      const response = await fetch(`${apiUrl}/posts/${postId}/`);
      assertEquals(response.status, 200);

      const data = await response.json();
      assertEquals(data.id, postId);
      assertEquals(data.title, "My First Post");
      assertEquals(data.content, "Hello, world!");
    });

    await t.step("PUT /api/posts/:id/ updates a post", async () => {
      const response = await fetch(`${apiUrl}/posts/${postId}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Post",
          content: "Updated content.",
          published: false,
        }),
      });

      assertEquals(response.status, 200);

      const data = await response.json();
      assertEquals(data.title, "Updated Post");
      assertEquals(data.content, "Updated content.");
    });

    await t.step("POST /api/posts/:id/publish/ publishes a post", async () => {
      const response = await fetch(`${apiUrl}/posts/${postId}/publish/`, {
        method: "POST",
      });

      assertEquals(response.status, 200);

      const data = await response.json();
      assertEquals(data.published, true);
    });

    await t.step(
      "GET /api/posts/?published=true filters published posts",
      async () => {
        const response = await fetch(`${apiUrl}/posts/?published=true`);
        assertEquals(response.status, 200);

        const data = await response.json();
        assertEquals(Array.isArray(data), true);
        // All returned posts should be published
        for (const post of data) {
          assertEquals(post.published, true);
        }
      },
    );

    await t.step("POST /api/posts/ creates a second post", async () => {
      const response = await fetch(`${apiUrl}/posts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Draft Post",
          content: "This is a draft.",
          published: false,
        }),
      });

      assertEquals(response.status, 201);
      const data = await response.json();
      assertEquals(data.title, "Draft Post");
      assertEquals(data.published, false);
    });

    await t.step(
      "GET /api/posts/?published=false filters draft posts",
      async () => {
        const response = await fetch(`${apiUrl}/posts/?published=false`);
        assertEquals(response.status, 200);

        const data = await response.json();
        assertEquals(Array.isArray(data), true);
        // All returned posts should be unpublished
        for (const post of data) {
          assertEquals(post.published, false);
        }
      },
    );

    await t.step("DELETE /api/posts/:id/ deletes a post", async () => {
      const response = await fetch(`${apiUrl}/posts/${postId}/`, {
        method: "DELETE",
      });

      assertEquals(response.status, 204);

      // Verify it's gone
      const getResponse = await fetch(`${apiUrl}/posts/${postId}/`);
      assertEquals(getResponse.status, 404);
      // Consume the body
      await getResponse.body?.cancel();
    });

    // =========================================================================
    // Cleanup
    // =========================================================================

    await t.step("cleanup: stop server and remove project", async () => {
      if (apiServer) {
        await stopServer(apiServer);
      }
      // Give the process time to release file handles
      await sleep(500);
      if (project) {
        await cleanupTestProject(project);
      }
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    });
  },
});
