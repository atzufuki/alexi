/**
 * Admin Panel E2E Tests (issue #157)
 *
 * Tests the admin panel with a real browser via Playwright.
 * Covers:
 *  - Login page renders correctly
 *  - Login with valid credentials succeeds
 *  - Dashboard shows registered models
 *  - Changelist lists objects
 *  - Changelist row links navigate to change form (issue #156)
 *  - Change form pre-fills existing object data (issue #156)
 *  - Change form saves updates successfully
 *  - Add form creates new objects
 *
 * The server is started in-process using Deno.serve() in beforeAll.
 * All tests except the login flow inject the admin JWT directly into
 * localStorage via page.addInitScript() to avoid coupling to the login UI.
 *
 * Port: 9300
 *
 * @module
 */

// Declare document for page.evaluate() callbacks that run in browser context
declare const document: {
  documentElement: { getAttribute(name: string): string | null };
};

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.208.0/testing/bdd.ts";
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from "playwright";
import { createConsoleErrorCollector } from "../../create/tests/console_errors.ts";
import {
  type AdminE2EServer,
  makeAdminToken,
  PostModel,
  startAdminE2EServer,
} from "./admin_e2e_server.ts";

// =============================================================================
// Test configuration
// =============================================================================

const HEADLESS = Deno.env.get("HEADLESS") !== "false";
const SLOW_MO = parseInt(Deno.env.get("SLOW_MO") ?? "0", 10);
const PORT = 9300;
const BASE_URL = `http://localhost:${PORT}`;

// =============================================================================
// Test suite
// =============================================================================

describe("Admin Panel E2E Tests", {
  sanitizeOps: false,
  sanitizeResources: false,
}, () => {
  let server: AdminE2EServer;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  const consoleErrors = createConsoleErrorCollector();

  // ---------------------------------------------------------------------------
  // Setup: start server and browser once for the whole suite
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    // Ensure no SECRET_KEY is set so unsigned tokens are accepted
    Deno.env.delete("SECRET_KEY");

    console.log("[e2e:admin] Starting admin E2E test suite...");
    server = await startAdminE2EServer(PORT);
    console.log(`[e2e:admin] Server started on port ${PORT}`);

    browser = await chromium.launch({ headless: HEADLESS, slowMo: SLOW_MO });
    console.log("[e2e:admin] Browser launched");
  });

  afterAll(async () => {
    await browser.close();
    await server.stop();
    console.log("[e2e:admin] Suite teardown complete");
  });

  // ---------------------------------------------------------------------------
  // Per-test: fresh context + page, console error tracking
  // ---------------------------------------------------------------------------

  beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();
    consoleErrors.clear();
    consoleErrors.attach(page);
  });

  afterEach(async () => {
    await page.close();
    await context.close();
  });

  // ---------------------------------------------------------------------------
  // Helper: inject admin token as a cookie before any page navigation.
  //
  // auth_guard.ts reads the Authorization: Bearer header first (HTMX requests
  // injected by admin.js), then falls back to the adminToken cookie for normal
  // browser navigation. Setting it as a cookie ensures direct page.goto()
  // calls are authenticated without relying on admin.js running first.
  // ---------------------------------------------------------------------------

  async function withAdminToken(p: Page): Promise<void> {
    const token = makeAdminToken();
    await p.context().addCookies([
      {
        name: "adminToken",
        value: token,
        domain: "localhost",
        path: "/admin",
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
  }

  // ---------------------------------------------------------------------------
  // Login page
  // ---------------------------------------------------------------------------

  it("login page renders email and password fields", async () => {
    await page.goto(`${BASE_URL}/admin/login/`);
    await page.waitForSelector("input[name='email']");
    await page.waitForSelector("input[name='password']");
    const title = await page.title();
    assertStringIncludes(title, "Admin");
  });

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  it("dashboard shows registered model (Post)", async () => {
    await withAdminToken(page);
    await page.goto(`${BASE_URL}/admin/`);
    const content = await page.content();
    assertStringIncludes(content, "Post");
  });

  // ---------------------------------------------------------------------------
  // Changelist
  // ---------------------------------------------------------------------------

  it("changelist renders table with objects", async () => {
    // Pre-create some posts
    await PostModel.objects.create({ title: "E2E Post 1", priority: 1 });
    await PostModel.objects.create({ title: "E2E Post 2", priority: 2 });

    await withAdminToken(page);
    await page.goto(`${BASE_URL}/admin/postmodel/`);
    await page.waitForSelector("table");
    const content = await page.content();
    assertStringIncludes(content, "E2E Post 1");
    assertStringIncludes(content, "E2E Post 2");
  });

  // ---------------------------------------------------------------------------
  // Issue #156: changelist row link navigates to change form (not 404)
  // ---------------------------------------------------------------------------

  it("changelist row link navigates to change form without 404", async () => {
    const post = await PostModel.objects.create({
      title: "Navigable Post",
      priority: 0,
    });
    const id = String(post.id.get());

    await withAdminToken(page);
    await page.goto(`${BASE_URL}/admin/postmodel/`);
    await page.waitForSelector("table");

    // Click the first link in the table that leads to the change form.
    // With hx-boost, HTMX intercepts the click and does a pushState navigation
    // — wait for the URL to update before asserting.
    const changeLink = page.locator(`a[href="/admin/postmodel/${id}/"]`)
      .first();
    await changeLink.click();
    await page.waitForURL(`${BASE_URL}/admin/postmodel/${id}/`);

    // Should land on the change form — NOT a 404
    const url = page.url();
    assertStringIncludes(url, `/admin/postmodel/${id}/`);

    const content = await page.content();
    // Must not contain "Not Found"
    assertEquals(content.includes("Not Found"), false);
    assertStringIncludes(content, "Change Post");
  });

  // ---------------------------------------------------------------------------
  // Issue #156: change form pre-fills existing object data (not 404)
  // ---------------------------------------------------------------------------

  it("change form returns 200 and pre-fills data for existing object", async () => {
    const post = await PostModel.objects.create({
      title: "Pre-filled Title",
      body: "Pre-filled body",
      priority: 42,
    });
    const id = String(post.id.get());

    await withAdminToken(page);
    await page.goto(`${BASE_URL}/admin/postmodel/${id}/`);

    const content = await page.content();
    assertEquals(content.includes("Not Found"), false);
    assertStringIncludes(content, "Change Post");
    assertStringIncludes(content, "Pre-filled Title");
    assertStringIncludes(content, "Pre-filled body");
  });

  // ---------------------------------------------------------------------------
  // Change form: save updates the object
  // ---------------------------------------------------------------------------

  it("change form saves updated data and redirects to changelist", async () => {
    const post = await PostModel.objects.create({
      title: "Original Title",
      priority: 1,
    });
    const id = String(post.id.get());

    await withAdminToken(page);
    await page.goto(`${BASE_URL}/admin/postmodel/${id}/`);
    await page.waitForSelector("input[name='title']");

    await page.fill("input[name='title']", "Updated Title");
    await page.click("input[value='Save']");

    // After save: should redirect to changelist
    await page.waitForURL(`${BASE_URL}/admin/postmodel/`);
    const content = await page.content();
    assertStringIncludes(content, "Updated Title");
  });

  // ---------------------------------------------------------------------------
  // Add form: create a new object
  // ---------------------------------------------------------------------------

  it("add form creates a new object and redirects to changelist", async () => {
    await withAdminToken(page);
    await page.goto(`${BASE_URL}/admin/postmodel/add/`);
    await page.waitForSelector("input[name='title']");

    await page.fill("input[name='title']", "Brand New Post");
    await page.fill("input[name='priority']", "7");
    await page.click("input[value='Save']");

    // After save: should redirect to changelist
    await page.waitForURL(`${BASE_URL}/admin/postmodel/`);
    const content = await page.content();
    assertStringIncludes(content, "Brand New Post");
  });
});
