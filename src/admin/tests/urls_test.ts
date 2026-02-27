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
import { reset, setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { AutoField, CharField, Manager, Model } from "@alexi/db";

// Import admin classes (to be implemented)
import { AdminSite, ModelAdmin } from "../mod.ts";
import { AdminRouter, AdminUrlPattern, getAdminUrls } from "../urls.ts";

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
  // Should have dashboard + model list + model add + model detail + model delete per model
  // Dashboard: 1
  // Per model: 4 (list, add, detail, delete)
  // Total: 1 + (2 * 4) = 9
  assertEquals(urls.length >= 5, true);
});

Deno.test("getAdminUrls: includes dashboard URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const dashboardUrl = urls.find((u: AdminUrlPattern) =>
    u.name === "admin:index"
  );

  assertExists(dashboardUrl);
  assertEquals(dashboardUrl.pattern, "/admin/");
});

Deno.test("getAdminUrls: includes model list URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const listUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testarticle_changelist",
  );

  assertExists(listUrl);
  assertEquals(listUrl.pattern, "/admin/testarticle/");
});

Deno.test("getAdminUrls: includes model add URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const addUrl = urls.find((u: AdminUrlPattern) =>
    u.name === "admin:testarticle_add"
  );

  assertExists(addUrl);
  assertEquals(addUrl.pattern, "/admin/testarticle/add/");
});

Deno.test("getAdminUrls: includes model detail URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const detailUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testarticle_change",
  );

  assertExists(detailUrl);
  assertEquals(detailUrl.pattern, "/admin/testarticle/:id/");
});

Deno.test("getAdminUrls: includes model delete URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const deleteUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testarticle_delete",
  );

  assertExists(deleteUrl);
  assertEquals(deleteUrl.pattern, "/admin/testarticle/:id/delete/");
});

// =============================================================================
// URL Pattern Matching Tests
// =============================================================================

Deno.test("AdminUrlPattern: matches list URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const listUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testarticle_changelist",
  );

  assertExists(listUrl);
  assertEquals(listUrl.match("/admin/testarticle/"), true);
  assertEquals(listUrl.match("/admin/testarticle"), false); // Missing trailing slash
  assertEquals(listUrl.match("/admin/other/"), false);
});

Deno.test("AdminUrlPattern: matches detail URL with ID", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const detailUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testarticle_change",
  );

  assertExists(detailUrl);
  assertEquals(detailUrl.match("/admin/testarticle/123/"), true);
  assertEquals(detailUrl.match("/admin/testarticle/abc-def/"), true);
  assertEquals(detailUrl.match("/admin/testarticle/"), false);
});

Deno.test("AdminUrlPattern: extracts params from URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const detailUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testarticle_change",
  );

  assertExists(detailUrl);
  const params = detailUrl.extractParams("/admin/testarticle/456/");

  assertExists(params);
  assertEquals(params.id, "456");
});

// =============================================================================
// URL Prefix Tests
// =============================================================================

Deno.test("getAdminUrls: respects custom URL prefix", () => {
  const site = new AdminSite({ urlPrefix: "/custom-admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const listUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testarticle_changelist",
  );

  assertExists(listUrl);
  assertEquals(listUrl.pattern, "/custom-admin/testarticle/");
});

Deno.test("getAdminUrls: handles URL prefix without leading slash", () => {
  const site = new AdminSite({ urlPrefix: "admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const dashboardUrl = urls.find((u: AdminUrlPattern) =>
    u.name === "admin:index"
  );

  assertExists(dashboardUrl);
  assertEquals(dashboardUrl.pattern.startsWith("/"), true);
});

Deno.test("getAdminUrls: handles URL prefix with trailing slash", () => {
  const site = new AdminSite({ urlPrefix: "/admin/" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const dashboardUrl = urls.find((u: AdminUrlPattern) =>
    u.name === "admin:index"
  );

  assertExists(dashboardUrl);
  // Should normalize to avoid double slashes
  assertEquals(dashboardUrl.pattern.includes("//"), false);
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
    (u: AdminUrlPattern) => u.name === "admin:testarticle_changelist",
  );
  assertExists(articleListUrl);

  // Category URLs
  const categoryListUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testcategory_changelist",
  );
  assertExists(categoryListUrl);
});

// =============================================================================
// URL Handler Association Tests
// =============================================================================

Deno.test("AdminUrlPattern: has associated handler", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);
  const listUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testarticle_changelist",
  );

  assertExists(listUrl);
  assertExists(listUrl.handler);
  assertEquals(typeof listUrl.handler, "function");
});

Deno.test("AdminUrlPattern: handler has correct view type", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const urls = getAdminUrls(site);

  const listUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testarticle_changelist",
  );
  assertEquals(listUrl?.viewType, "list");

  const addUrl = urls.find((u: AdminUrlPattern) =>
    u.name === "admin:testarticle_add"
  );
  assertEquals(addUrl?.viewType, "add");

  const detailUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testarticle_change",
  );
  assertEquals(detailUrl?.viewType, "change");

  const deleteUrl = urls.find(
    (u: AdminUrlPattern) => u.name === "admin:testarticle_delete",
  );
  assertEquals(deleteUrl?.viewType, "delete");
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
    await setup({ backend });
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
    await setup({ backend });
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
    await setup({ backend });
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
