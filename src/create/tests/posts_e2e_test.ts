/**
 * Posts App E2E Tests for @alexi/create
 *
 * Tests the scaffolded Posts application end-to-end:
 * - Creates a new project using @alexi/create
 * - Starts the web server (which bundles the Service Worker)
 * - Tests REST API endpoints via fetch
 * - Tests the browser UI via Playwright (HTML shell, SW registration, static files)
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
  name: "API: GET / returns welcome message",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const response = await fetch(`${baseUrl}/`);
    assertEquals(response.status, 200);
    const data = await response.json();
    assertExists(data.message);
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
// Browser Tests — Playwright
// =============================================================================

Deno.test({
  name: "Browser: static index.html loads and returns HTTP 200",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const page = await browser.newPage();
    try {
      // The scaffolded app serves static/index.html which is the SPA shell
      const projectName = project.name;
      const response = await page.goto(
        `${baseUrl}/static/${projectName}/index.html`,
      );
      assertExists(response, "Navigation response must not be null");
      assertEquals(
        response!.status(),
        200,
        "Static index.html must return 200",
      );
    } finally {
      await page.close();
    }
  },
});

Deno.test({
  name: "Browser: index.html contains SPA shell structure",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const page = await browser.newPage();
    try {
      const projectName = project.name;
      await page.goto(`${baseUrl}/static/${projectName}/index.html`);

      // The shell must have a #content mounting point for HTMX
      const contentCount = await page.locator("#content").count();
      assertEquals(contentCount, 1, "Page must contain a #content element");

      // The shell must reference the Service Worker script
      const html = await page.content();
      assertEquals(
        html.includes("worker.js"),
        true,
        "HTML must reference worker.js for SW registration",
      );

      // The shell must load HTMX
      assertEquals(
        html.includes("htmx"),
        true,
        "HTML must include htmx script",
      );
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
    // The bundled SW should contain Application setup code
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

Deno.test({
  name: "Browser: Service Worker registers and activates",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const projectName = project.name;
      const indexUrl = `${baseUrl}/static/${projectName}/index.html`;
      await page.goto(indexUrl);

      // Wait for SW to register and activate
      const isActive = await page.evaluate(async () => {
        const nav = navigator as unknown as {
          serviceWorker?: {
            ready: Promise<{ active: unknown }>;
          };
        };
        if (!nav.serviceWorker) return false;

        const timeout = new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error("SW ready timeout (20s)")), 20000);
        });

        try {
          const reg = await Promise.race([nav.serviceWorker.ready, timeout]);
          return reg.active !== null;
        } catch {
          return false;
        }
      });

      assertEquals(
        isActive,
        true,
        "Service Worker must be active",
      );
    } finally {
      await page.close();
      await context.close();
    }
  },
});

Deno.test({
  name: "Browser: SW renders welcome page via HTMX",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      const projectName = project.name;
      await page.goto(`${baseUrl}/static/${projectName}/index.html`);

      // Wait for SW to activate
      await page.evaluate(async () => {
        const nav = navigator as unknown as {
          serviceWorker?: { ready: Promise<unknown> };
        };
        if (!nav.serviceWorker) return;
        await nav.serviceWorker.ready;
      });

      // HTMX fetches "/" from the SW and injects into #content.
      // Use .first() because the SW-rendered content may create nested #content elements.
      const content = await page.locator("#content").first().textContent({
        timeout: 15000,
      });
      assertExists(content, "#content must have text rendered by SW");
      assertEquals(
        content!.includes("Welcome"),
        true,
        "SW-rendered content must contain 'Welcome'",
      );
    } finally {
      await page.close();
      await context.close();
    }
  },
});
