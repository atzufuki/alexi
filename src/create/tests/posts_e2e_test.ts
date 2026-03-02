/**
 * Posts App E2E Tests for @alexi/create
 *
 * Tests the scaffolded Posts application end-to-end:
 * - Creates a new project using @alexi/create
 * - Starts the web server
 * - Tests REST API endpoints via fetch
 * - Tests the browser UI via Playwright (server-rendered HTML, static files)
 *
 * The scaffolded app uses a server-side MPA architecture:
 * - The server renders all routes directly (/, /posts/, /posts/new/)
 * - The Service Worker is a progressive enhancement (fire-and-forget registration)
 * - There is no static SPA shell — the server is the source of truth for HTML
 *
 * Run manually with:
 *   deno test -A --unstable-kv src/create/tests/posts_e2e_test.ts
 *
 * @module @alexi/create/tests/posts_e2e_test
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { type Browser, chromium } from "playwright";
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
// Shared State
// =============================================================================

let tempDir: string;
let project: ScaffoldedProject;
let apiServer: ServerProcess;
let browser: Browser;
let baseUrl: string;
let apiUrl: string;

// =============================================================================
// Lifecycle
// =============================================================================

Deno.test.beforeAll(async () => {
  tempDir = await createTempDir();
  const projectName = generateProjectName();
  project = await createTestProject(projectName, tempDir);

  apiServer = await startApiServer(project.path, DEFAULT_API_PORT);
  baseUrl = apiServer.baseUrl;
  apiUrl = `${baseUrl}/api`;
  console.log(`[e2e] API server running at ${baseUrl}`);

  browser = await chromium.launch({ headless: true });
  console.log("[e2e] Playwright browser launched");
});

Deno.test.afterAll(async () => {
  if (browser) await browser.close();
  if (apiServer) await stopServer(apiServer);
  await sleep(500);
  if (project) await cleanupTestProject(project);
  if (tempDir) await cleanupTempDir(tempDir);
});

// =============================================================================
// API Tests — Root & Health
// =============================================================================

Deno.test({
  name: "API: GET / returns server-rendered HTML",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const response = await fetch(`${baseUrl}/`);
    assertEquals(response.status, 200);
    const body = await response.text();
    assertEquals(
      body.includes("<!DOCTYPE html>"),
      true,
      "GET / should return a server-rendered HTML page",
    );
  },
});

Deno.test({
  name: "API: GET /api/health/ returns ok",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const response = await fetch(`${apiUrl}/health/`);
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(data.status, "ok");
  },
});

// =============================================================================
// API Tests — Posts CRUD
// =============================================================================

let postId: number;

Deno.test({
  name: "API: POST /api/posts/ creates a post",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
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
  },
});

Deno.test({
  name: "API: GET /api/posts/ lists posts",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const response = await fetch(`${apiUrl}/posts/`);
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length >= 1, true);

    const post = data.find((p: { id: number }) => p.id === postId);
    assertExists(post);
    assertEquals(post.title, "My First Post");
  },
});

Deno.test({
  name: "API: GET /api/posts/:id/ retrieves a post",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const response = await fetch(`${apiUrl}/posts/${postId}/`);
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(data.id, postId);
    assertEquals(data.title, "My First Post");
    assertEquals(data.content, "Hello, world!");
  },
});

Deno.test({
  name: "API: PUT /api/posts/:id/ updates a post",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
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
  },
});

Deno.test({
  name: "API: POST /api/posts/:id/publish/ publishes a post",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const response = await fetch(`${apiUrl}/posts/${postId}/publish/`, {
      method: "POST",
    });

    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(data.published, true);
  },
});

Deno.test({
  name: "API: GET /api/posts/?published=true filters published posts",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const response = await fetch(`${apiUrl}/posts/?published=true`);
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(Array.isArray(data), true);
    for (const post of data) {
      assertEquals(post.published, true);
    }
  },
});

Deno.test({
  name: "API: POST /api/posts/ creates a second post (draft)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
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
  },
});

Deno.test({
  name: "API: GET /api/posts/?published=false filters draft posts",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const response = await fetch(`${apiUrl}/posts/?published=false`);
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(Array.isArray(data), true);
    for (const post of data) {
      assertEquals(post.published, false);
    }
  },
});

Deno.test({
  name: "API: DELETE /api/posts/:id/ deletes a post",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const response = await fetch(`${apiUrl}/posts/${postId}/`, {
      method: "DELETE",
    });
    assertEquals(response.status, 204);

    const getResponse = await fetch(`${apiUrl}/posts/${postId}/`);
    assertEquals(getResponse.status, 404);
    await getResponse.body?.cancel();
  },
});

// =============================================================================
// Browser Tests — Server-rendered pages
// =============================================================================

Deno.test({
  name: "Browser: GET / returns server-rendered home page with 200",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const page = await browser.newPage();
    try {
      const response = await page.goto(`${baseUrl}/`);
      assertExists(response, "Navigation response must not be null");
      assertEquals(response!.status(), 200, "GET / must return 200");

      const html = await page.content();
      assertEquals(
        html.includes("<!DOCTYPE html>") || html.includes("<!doctype html>"),
        true,
        "Home page must be a valid HTML document",
      );
    } finally {
      await page.close();
    }
  },
});

Deno.test({
  name: "Browser: home page contains nav links and Welcome heading",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const page = await browser.newPage();
    try {
      await page.goto(`${baseUrl}/`);

      // The base template has nav links
      const html = await page.content();
      assertEquals(
        html.includes("/posts/"),
        true,
        "Home page must contain a link to /posts/",
      );

      // The index template renders a Welcome heading
      const heading = await page.locator("h1").first().textContent({
        timeout: 5000,
      });
      assertEquals(
        heading?.includes("Welcome"),
        true,
        "Home page must render a Welcome heading",
      );
    } finally {
      await page.close();
    }
  },
});

Deno.test({
  name: "Browser: home page registers Service Worker (fire-and-forget)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const page = await browser.newPage();
    try {
      await page.goto(`${baseUrl}/`);
      const html = await page.content();
      assertEquals(
        html.includes("serviceWorker"),
        true,
        "Home page must contain SW registration script",
      );
      assertEquals(
        html.includes("worker.js"),
        true,
        "SW registration must reference worker.js",
      );
    } finally {
      await page.close();
    }
  },
});

Deno.test({
  name: "Browser: GET /posts/ returns server-rendered posts list",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const page = await browser.newPage();
    try {
      const response = await page.goto(`${baseUrl}/posts/`);
      assertExists(response, "Navigation response must not be null");
      assertEquals(response!.status(), 200, "GET /posts/ must return 200");

      const heading = await page.locator("h1").first().textContent({
        timeout: 5000,
      });
      assertEquals(
        heading?.includes("Posts"),
        true,
        "Posts page must render a Posts heading",
      );
    } finally {
      await page.close();
    }
  },
});

Deno.test({
  name: "Browser: GET /posts/new/ returns server-rendered post create form",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const page = await browser.newPage();
    try {
      const response = await page.goto(`${baseUrl}/posts/new/`);
      assertExists(response, "Navigation response must not be null");
      assertEquals(response!.status(), 200, "GET /posts/new/ must return 200");

      const formCount = await page.locator("form").count();
      assertEquals(
        formCount >= 1,
        true,
        "Post create page must contain a form",
      );

      const titleInput = await page.locator('input[name="title"]').count();
      assertEquals(titleInput >= 1, true, "Form must have a title input");
    } finally {
      await page.close();
    }
  },
});

Deno.test({
  name: "Browser: bundled worker.js is served",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const projectName = project.name;
    const response = await fetch(
      `${baseUrl}/static/${projectName}/worker.js`,
    );
    assertEquals(response.status, 200, "worker.js must be served");
    const body = await response.text();
    assertEquals(body.length > 0, true, "worker.js must not be empty");
    assertEquals(
      body.includes("Application") || body.includes("addEventListener"),
      true,
      "worker.js must contain SW application code",
    );
  },
});

Deno.test({
  name: "Browser: bundled app JS is served",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const projectName = project.name;
    const response = await fetch(
      `${baseUrl}/static/${projectName}/${projectName}.js`,
    );
    assertEquals(response.status, 200, "App JS bundle must be served");
    const body = await response.text();
    assertEquals(body.length > 0, true, "App JS bundle must not be empty");
  },
});
