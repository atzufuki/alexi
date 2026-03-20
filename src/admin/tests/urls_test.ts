/**
 * URL Routing tests for Alexi Admin
 *
 * These tests verify the URL routing configuration for the admin system.
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "jsr:@std/assert@1";
import { reset } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { setup } from "@alexi/core";
import { AutoField, CharField, Manager, Model } from "@alexi/db";
import { include, path, resolve } from "@alexi/urls";
import type { URLPattern } from "@alexi/urls";

// Import admin classes
import { AdminSite, ModelAdmin } from "../mod.ts";
import { AdminRouter, getAdminUrls } from "../urls.ts";

// =============================================================================
// Test Models
// =============================================================================

class TestArticle extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });

  static objects = new Manager(TestArticle);
  static override meta = { dbTable: "test_articles" };
}

class TestCategory extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  static objects = new Manager(TestCategory);
  static override meta = { dbTable: "test_categories" };
}

// suppress unused import warning
const _unused = ModelAdmin;

// =============================================================================
// URL Pattern Generation Tests
// =============================================================================

Deno.test("getAdminUrls: returns URL patterns for registered models", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);
  site.register(TestCategory);

  const urls = getAdminUrls(site);

  assertExists(urls);
  assertEquals(Array.isArray(urls), true);
  // Dashboard: 1, Per model: 4 (list, add, detail, delete), Total: 1 + (2*4) = 9
  assertEquals(urls.length >= 5, true);
});

Deno.test("getAdminUrls: includes dashboard URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const dashboardUrl = urls.find((u: URLPattern) => u.name === "admin:index");

  assertExists(dashboardUrl);
  // Patterns are relative (no prefix) — the dashboard is the mount root
  assertEquals(dashboardUrl.pattern, "");
});

Deno.test("getAdminUrls: includes model list URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const listUrl = urls.find(
    (u: URLPattern) => u.name === "admin:testarticle_changelist",
  );

  assertExists(listUrl);
  assertEquals(listUrl.pattern, "testarticle/");
});

Deno.test("getAdminUrls: includes model add URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const addUrl = urls.find(
    (u: URLPattern) => u.name === "admin:testarticle_add",
  );

  assertExists(addUrl);
  assertEquals(addUrl.pattern, "testarticle/add/");
});

Deno.test("getAdminUrls: includes model detail URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const detailUrl = urls.find(
    (u: URLPattern) => u.name === "admin:testarticle_change",
  );

  assertExists(detailUrl);
  assertEquals(detailUrl.pattern, "testarticle/:id/");
});

Deno.test("getAdminUrls: includes model delete URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const deleteUrl = urls.find(
    (u: URLPattern) => u.name === "admin:testarticle_delete",
  );

  assertExists(deleteUrl);
  assertEquals(deleteUrl.pattern, "testarticle/:id/delete/");
});

// =============================================================================
// URL Prefix Tests
// =============================================================================

Deno.test("getAdminUrls: respects custom URL prefix", () => {
  const site = new AdminSite({ urlPrefix: "/custom-admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const listUrl = urls.find(
    (u: URLPattern) => u.name === "admin:testarticle_changelist",
  );

  assertExists(listUrl);
  // Patterns are relative — prefix is NOT included
  assertEquals(listUrl.pattern, "testarticle/");
});

Deno.test("getAdminUrls: handles URL prefix without leading slash", () => {
  const site = new AdminSite({ urlPrefix: "admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const dashboardUrl = urls.find((u: URLPattern) => u.name === "admin:index");

  assertExists(dashboardUrl);
  // Pattern is relative — the dashboard is always the mount-point root
  assertEquals(dashboardUrl.pattern, "");
});

Deno.test("getAdminUrls: handles URL prefix with trailing slash", () => {
  const site = new AdminSite({ urlPrefix: "/admin/" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const dashboardUrl = urls.find((u: URLPattern) => u.name === "admin:index");

  assertExists(dashboardUrl);
  // Should normalize to avoid double slashes
  assertEquals(dashboardUrl.pattern.includes("//"), false);
});

// =============================================================================
// URL Pattern view function Tests
// =============================================================================

Deno.test("getAdminUrls (placeholder): patterns have view functions", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  // No backend supplied → placeholder handlers
  const urls = getAdminUrls(site);
  const listUrl = urls.find(
    (u: URLPattern) => u.name === "admin:testarticle_changelist",
  );

  assertExists(listUrl);
  assertExists(listUrl.view);
  assertEquals(typeof listUrl.view, "function");
});

// =============================================================================
// URL Reverse Resolution Tests
// =============================================================================

Deno.test("AdminSite: reverse URL for dashboard", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });

  const url = site.reverse("admin:index");
  assertEquals(url, "/admin/");
});

Deno.test("AdminSite: reverse URL for model list", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const url = site.reverse("admin:testarticle_changelist");
  assertEquals(url, "/admin/testarticle/");
});

Deno.test("AdminSite: reverse URL for model detail with params", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const url = site.reverse("admin:testarticle_change", { id: "789" });
  assertEquals(url, "/admin/testarticle/789/");
});

Deno.test("AdminSite: reverse URL for model add", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const url = site.reverse("admin:testarticle_add");
  assertEquals(url, "/admin/testarticle/add/");
});

Deno.test("AdminSite: reverse URL for model delete", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const url = site.reverse("admin:testarticle_delete", { id: "123" });
  assertEquals(url, "/admin/testarticle/123/delete/");
});

// =============================================================================
// Multiple Models Tests
// =============================================================================

Deno.test("getAdminUrls: generates URLs for multiple models", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);
  site.register(TestCategory);

  const urls = getAdminUrls(site);

  // Article URLs
  const articleListUrl = urls.find(
    (u: URLPattern) => u.name === "admin:testarticle_changelist",
  );
  assertExists(articleListUrl);

  // Category URLs
  const categoryListUrl = urls.find(
    (u: URLPattern) => u.name === "admin:testcategory_changelist",
  );
  assertExists(categoryListUrl);
});

// =============================================================================
// AdminRouter.match() Tests
// =============================================================================

Deno.test({
  name: "AdminRouter.match: matches dashboard path",
  async fn() {
    const backend = new DenoKVBackend({
      name: "router_match_test",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ DATABASES: { default: backend } });
    try {
      const site = new AdminSite({ urlPrefix: "/admin" });
      const router = new AdminRouter(site, backend);

      const matched = router.match("/admin/");
      assertExists(matched);
      assertExists(matched.pattern.view);
      assertEquals(typeof matched.pattern.view, "function");
      assertEquals(matched.params, {});
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "AdminRouter.match: matches model changelist path",
  async fn() {
    const backend = new DenoKVBackend({
      name: "router_match_list_test",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ DATABASES: { default: backend } });
    try {
      const site = new AdminSite({ urlPrefix: "/admin" });
      site.register(TestArticle);
      const router = new AdminRouter(site, backend);

      const matched = router.match("/admin/testarticle/");
      assertExists(matched);
      assertExists(matched.pattern.view);
      assertEquals(matched.params, {});
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "AdminRouter.match: matches model change path and extracts id",
  async fn() {
    const backend = new DenoKVBackend({
      name: "router_match_detail_test",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ DATABASES: { default: backend } });
    try {
      const site = new AdminSite({ urlPrefix: "/admin" });
      site.register(TestArticle);
      const router = new AdminRouter(site, backend);

      const matched = router.match("/admin/testarticle/456/");
      assertExists(matched);
      assertExists(matched.pattern.view);
      assertEquals(matched.params.id, "456");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "AdminRouter.match: returns null for unknown path",
  async fn() {
    const backend = new DenoKVBackend({
      name: "router_match_null_test",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ DATABASES: { default: backend } });
    try {
      const site = new AdminSite({ urlPrefix: "/admin" });
      const router = new AdminRouter(site, backend);

      const matched = router.match("/totally/unknown/path/");
      assertEquals(matched, null);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

// =============================================================================
// Static file serving via fetch() — regression for JSR https:// URLs (#148)
// =============================================================================

Deno.test({
  name: "createStaticHandler: serves css/admin.css with correct content-type",
  async fn() {
    const backend = new DenoKVBackend({
      name: "urls_static_test",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ DATABASES: { default: backend } });
    try {
      const site = new AdminSite({ urlPrefix: "/admin" });
      const router = new AdminRouter(site, backend);
      const req = new Request("http://localhost/admin/static/css/admin.css");
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("Content-Type"), "text/css; charset=utf-8");
      const text = await res.text();
      // The CSS file must have content (non-empty)
      assertEquals(text.length > 0, true);
      assertStringIncludes(text, "{");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "createStaticHandler: serves js/admin.js with correct content-type",
  async fn() {
    const backend = new DenoKVBackend({
      name: "urls_static_js_test",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ DATABASES: { default: backend } });
    try {
      const site = new AdminSite({ urlPrefix: "/admin" });
      const router = new AdminRouter(site, backend);
      const req = new Request("http://localhost/admin/static/js/admin.js");
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      assertEquals(
        res.headers.get("Content-Type"),
        "application/javascript; charset=utf-8",
      );
      const text = await res.text();
      assertEquals(text.length > 0, true);
      assertStringIncludes(text, "adminToken");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "createStaticHandler: returns 404 for unknown static path",
  async fn() {
    const backend = new DenoKVBackend({
      name: "urls_static_404_test",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ DATABASES: { default: backend } });
    try {
      const site = new AdminSite({ urlPrefix: "/admin" });
      const router = new AdminRouter(site, backend);
      const req = new Request("http://localhost/admin/static/css/unknown.css");
      const res = await router.handle(req);
      assertEquals(res.status, 404);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

// =============================================================================
// Lazy init regression test (#228)
// =============================================================================

Deno.test({
  name:
    "AdminRouter: patterns built lazily — constructor before setup() still serves real SSR handlers",
  async fn() {
    // Simulate the runserver evaluation order described in issue #228:
    //
    //   1. ROOT_URLCONF is imported → AdminRouter is constructed (no backend registered yet)
    //   2. setup() is called          → backend registered globally
    //   3. First HTTP request arrives → _getPatterns() runs for the first time
    //                                   → backend is now available → SSR handlers built
    //
    // The old (eager) implementation resolved hasBackend() in the constructor
    // at step 1, captured `undefined`, and permanently used placeholder handlers.
    // The lazy implementation defers resolution to step 3, so it always picks up
    // the registered backend.

    const backend = new DenoKVBackend({
      name: "lazy_init_test",
      path: ":memory:",
    });
    await backend.connect();

    try {
      const site = new AdminSite({ urlPrefix: "/admin" });
      site.register(TestArticle);

      // Step 1: construct BEFORE setup() — no backend in the global registry yet.
      const router = new AdminRouter(site);

      // Step 2: register the backend globally (mirrors getHttpApplication/setup).
      await setup({ DATABASES: { default: backend } });

      // Step 3: first real request — lazy init must now resolve the backend and
      // build SSR handlers rather than placeholder handlers.
      const req = new Request("http://localhost/admin/static/css/admin.css");
      const res = await router.handle(req);

      // SSR static handler returns 200 text/css, NOT a JSON placeholder.
      assertEquals(res.status, 200);
      assertEquals(
        res.headers.get("Content-Type"),
        "text/css; charset=utf-8",
      );
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

// =============================================================================
// include(adminSite.urls) lazy resolution regression test (#228)
// =============================================================================

Deno.test({
  name:
    "AdminSite.urls + include(): resolve() finds admin handlers when backend registered after URLconf evaluation",
  async fn() {
    // This is the exact scenario that caused the original bug:
    //
    //   1. URLconf is evaluated (module-load time) — adminSite.urls getter is
    //      called and the result is passed to include() → path(). At this point
    //      hasBackend("default") is false.
    //   2. setup() registers the backend globally (mirrors getHttpApplication).
    //   3. An HTTP request arrives — resolve() is called for the first time.
    //      With the old eager implementation the placeholder handlers had already
    //      been frozen into the children array.  With the new lazyChildren fix,
    //      the children are resolved fresh at step 3 and the SSR handlers are used.

    const backend = new DenoKVBackend({
      name: "include_lazy_test",
      path: ":memory:",
    });
    await backend.connect();

    try {
      const site = new AdminSite({ urlPrefix: "/admin" });
      site.register(TestArticle);

      // Step 1: Build URL conf — mirrors module evaluation in user projects.
      // adminSite.urls is captured here, BEFORE setup() is called.
      const urlpatterns = [
        path("admin/", include(site.urls)),
      ];

      // Step 2: Register backend (mirrors getHttpApplication / setup).
      await setup({ DATABASES: { default: backend } });

      // Step 3: Resolve — must use SSR handlers, not placeholder handlers.
      const result = resolve("/admin/testarticle/", urlpatterns);

      // The route must be found and return a real view function.
      assertExists(result, "resolve() should find a matching handler");
      assertEquals(typeof result.view, "function");

      // Invoke the view to confirm it uses the real SSR handler, not the placeholder.
      // Without auth the SSR changelist view redirects to /admin/login/ (302).
      // The placeholder would return 200 application/json {"message":"Admin placeholder"}.
      const req = new Request("http://localhost/admin/testarticle/");
      const res = await result.view(req, result.params);

      // Placeholder: 200 + Content-Type: application/json
      // Real SSR:    302 redirect to login (no JSON body)
      const contentType = res.headers.get("Content-Type") ?? "";
      assertEquals(
        contentType.includes("application/json"),
        false,
        `Got placeholder JSON response instead of real SSR handler (Content-Type: ${contentType})`,
      );
      // The SSR auth guard redirects unauthenticated requests to the login page.
      assertEquals(
        res.status,
        302,
        `Expected 302 redirect from SSR auth guard, got status ${res.status}`,
      );
      assertStringIncludes(
        res.headers.get("Location") ?? "",
        "/admin/login/",
      );
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

// =============================================================================
// AdminRouter.asView() tests (#346)
// =============================================================================

Deno.test({
  name: "AdminRouter.asView: returns a two-argument view function",
  fn() {
    const site = new AdminSite({ urlPrefix: "/admin" });
    site.register(TestArticle);
    const router = new AdminRouter(site);

    const view = router.asView();

    assertEquals(typeof view, "function");
    assertEquals(view.length, 2); // (request, params)
  },
});

Deno.test({
  name: "AdminRouter.asView: view function dispatches to handle()",
  async fn() {
    const backend = new DenoKVBackend({
      name: "as_view_test",
      path: ":memory:",
    });
    await backend.connect();

    try {
      const site = new AdminSite({ urlPrefix: "/admin" });
      site.register(TestArticle);
      const router = new AdminRouter(site, backend);

      const view = router.asView();

      // The asView() wrapper should dispatch the same way as handle() directly.
      const req = new Request("http://localhost/admin/static/css/admin.css");
      const res = await view(req, {});

      assertEquals(res.status, 200);
      assertEquals(
        res.headers.get("Content-Type"),
        "text/css; charset=utf-8",
      );
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});
