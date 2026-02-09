/**
 * Tests for Alexi URL resolver
 *
 * @module @alexi/urls/tests/resolver_test
 */

import {
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

import { include, path } from "../path.ts";
import { clearRegistryCache, resolve, reverse } from "../resolver.ts";
import type { View } from "../types.ts";

// ============================================================================
// Test Views (mock functions)
// ============================================================================

const home_view: View = () => Response.json({ page: "home" });
const about_view: View = () => Response.json({ page: "about" });
const list_assets: View = () => Response.json({ assets: [] });
const get_asset: View = (_req, params) => Response.json({ asset: params.id });
const create_asset: View = () => Response.json({ created: true });
const list_tasks: View = () => Response.json({ tasks: [] });
const get_task: View = (_req, params) => Response.json({ task: params.id });
const get_user_post: View = (_req, params) =>
  Response.json({ userId: params.userId, postId: params.postId });

// ============================================================================
// path() tests
// ============================================================================

describe("path()", () => {
  it("should create a simple URL pattern", () => {
    const pattern = path("about/", about_view);

    assertEquals(pattern.pattern, "about/");
    assertEquals(pattern.view, about_view);
    assertEquals(pattern.name, undefined);
  });

  it("should create a URL pattern with name", () => {
    const pattern = path("about/", about_view, { name: "about" });

    assertEquals(pattern.pattern, "about/");
    assertEquals(pattern.view, about_view);
    assertEquals(pattern.name, "about");
  });

  it("should create a URL pattern with parameters", () => {
    const pattern = path("assets/:id/", get_asset, { name: "asset-detail" });

    assertEquals(pattern.pattern, "assets/:id/");
    assertEquals(pattern.view, get_asset);
    assertEquals(pattern.name, "asset-detail");
  });
});

// ============================================================================
// include() tests
// ============================================================================

describe("include()", () => {
  it("should return patterns as-is when called with array", () => {
    const assetPatterns = [
      path("", list_assets, { name: "asset-list" }),
      path(":id/", get_asset, { name: "asset-detail" }),
    ];

    const result = include(assetPatterns);

    assertEquals(result, assetPatterns);
  });

  it("should create a pattern with children when called with route and patterns", () => {
    const assetPatterns = [
      path("", list_assets, { name: "asset-list" }),
      path(":id/", get_asset, { name: "asset-detail" }),
    ];

    const result = include("api/assets/", assetPatterns);

    assertEquals(result.pattern, "api/assets/");
    assertEquals(result.children, assetPatterns);
    assertEquals(result.view, undefined);
  });
});

// ============================================================================
// resolve() tests
// ============================================================================

describe("resolve()", () => {
  // Reset cache before each test suite
  beforeEach(() => {
    clearRegistryCache();
  });

  it("should resolve a simple static route", () => {
    const urlpatterns = [
      path("", home_view, { name: "home" }),
      path("about/", about_view, { name: "about" }),
    ];

    const result = resolve("/about/", urlpatterns);

    assertNotEquals(result, null);
    assertEquals(result!.view, about_view);
    assertEquals(result!.params, {});
    assertEquals(result!.name, "about");
  });

  it("should resolve the root path", () => {
    const urlpatterns = [
      path("", home_view, { name: "home" }),
    ];

    const result = resolve("/", urlpatterns);

    assertNotEquals(result, null);
    assertEquals(result!.view, home_view);
    assertEquals(result!.name, "home");
  });

  it("should resolve a route with one parameter", () => {
    const urlpatterns = [
      path("assets/", list_assets, { name: "asset-list" }),
      path("assets/:id/", get_asset, { name: "asset-detail" }),
    ];

    const result = resolve("/assets/123/", urlpatterns);

    assertNotEquals(result, null);
    assertEquals(result!.view, get_asset);
    assertEquals(result!.params, { id: "123" });
    assertEquals(result!.name, "asset-detail");
  });

  it("should resolve a route with multiple parameters", () => {
    const urlpatterns = [
      path("users/:userId/posts/:postId/", get_user_post, {
        name: "user-post",
      }),
    ];

    const result = resolve("/users/5/posts/42/", urlpatterns);

    assertNotEquals(result, null);
    assertEquals(result!.view, get_user_post);
    assertEquals(result!.params, { userId: "5", postId: "42" });
    assertEquals(result!.name, "user-post");
  });

  it("should return null for non-matching routes", () => {
    const urlpatterns = [
      path("about/", about_view, { name: "about" }),
    ];

    const result = resolve("/nonexistent/", urlpatterns);

    assertEquals(result, null);
  });

  it("should resolve nested routes with include()", () => {
    const assetPatterns = [
      path("", list_assets, { name: "asset-list" }),
      path(":id/", get_asset, { name: "asset-detail" }),
    ];

    const taskPatterns = [
      path("", list_tasks, { name: "task-list" }),
      path(":id/", get_task, { name: "task-detail" }),
    ];

    const urlpatterns = [
      path("api/assets/", include(assetPatterns)),
      path("api/tasks/", include(taskPatterns)),
    ];

    // Test asset list
    const assetListResult = resolve("/api/assets/", urlpatterns);
    assertNotEquals(assetListResult, null);
    assertEquals(assetListResult!.view, list_assets);
    assertEquals(assetListResult!.name, "asset-list");

    // Test asset detail
    const assetDetailResult = resolve("/api/assets/456/", urlpatterns);
    assertNotEquals(assetDetailResult, null);
    assertEquals(assetDetailResult!.view, get_asset);
    assertEquals(assetDetailResult!.params, { id: "456" });

    // Test task list
    const taskListResult = resolve("/api/tasks/", urlpatterns);
    assertNotEquals(taskListResult, null);
    assertEquals(taskListResult!.view, list_tasks);

    // Test task detail
    const taskDetailResult = resolve("/api/tasks/789/", urlpatterns);
    assertNotEquals(taskDetailResult, null);
    assertEquals(taskDetailResult!.view, get_task);
    assertEquals(taskDetailResult!.params, { id: "789" });
  });

  it("should handle URLs without leading slash", () => {
    const urlpatterns = [
      path("about/", about_view, { name: "about" }),
    ];

    const result = resolve("about/", urlpatterns);

    assertNotEquals(result, null);
    assertEquals(result!.view, about_view);
  });

  it("should handle URLs without trailing slash", () => {
    const urlpatterns = [
      path("about", about_view, { name: "about" }),
    ];

    const result = resolve("/about", urlpatterns);

    assertNotEquals(result, null);
    assertEquals(result!.view, about_view);
  });

  it("should not match partial paths", () => {
    const urlpatterns = [
      path("assets/", list_assets, { name: "asset-list" }),
    ];

    // This should not match because there are extra segments
    const result = resolve("/assets/extra/segments/", urlpatterns);

    assertEquals(result, null);
  });
});

// ============================================================================
// reverse() tests
// ============================================================================

describe("reverse()", () => {
  beforeEach(() => {
    clearRegistryCache();
  });

  it("should generate a URL for a simple route", () => {
    const urlpatterns = [
      path("about/", about_view, { name: "about" }),
    ];

    const url = reverse("about", {}, urlpatterns);

    assertEquals(url, "/about/");
  });

  it("should generate a URL for the root path", () => {
    const urlpatterns = [
      path("", home_view, { name: "home" }),
    ];

    const url = reverse("home", {}, urlpatterns);

    assertEquals(url, "/");
  });

  it("should generate a URL with one parameter", () => {
    const urlpatterns = [
      path("assets/:id/", get_asset, { name: "asset-detail" }),
    ];

    const url = reverse("asset-detail", { id: "123" }, urlpatterns);

    assertEquals(url, "/assets/123/");
  });

  it("should generate a URL with multiple parameters", () => {
    const urlpatterns = [
      path("users/:userId/posts/:postId/", get_user_post, {
        name: "user-post",
      }),
    ];

    const url = reverse(
      "user-post",
      { userId: "5", postId: "42" },
      urlpatterns,
    );

    assertEquals(url, "/users/5/posts/42/");
  });

  it("should throw for unknown route name", () => {
    const urlpatterns = [
      path("about/", about_view, { name: "about" }),
    ];

    assertThrows(
      () => reverse("nonexistent", {}, urlpatterns),
      Error,
      "No route found with name: nonexistent",
    );
  });

  it("should throw for missing required parameter", () => {
    const urlpatterns = [
      path("assets/:id/", get_asset, { name: "asset-detail" }),
    ];

    assertThrows(
      () => reverse("asset-detail", {}, urlpatterns),
      Error,
      "Missing required parameter 'id' for route 'asset-detail'",
    );
  });

  it("should generate URLs for nested routes", () => {
    const assetPatterns = [
      path("", list_assets, { name: "asset-list" }),
      path(":id/", get_asset, { name: "asset-detail" }),
      path("create/", create_asset, { name: "asset-create" }),
    ];

    const urlpatterns = [
      path("api/assets/", include(assetPatterns)),
    ];

    assertEquals(reverse("asset-list", {}, urlpatterns), "/api/assets/");
    assertEquals(
      reverse("asset-detail", { id: "456" }, urlpatterns),
      "/api/assets/456/",
    );
    assertEquals(
      reverse("asset-create", {}, urlpatterns),
      "/api/assets/create/",
    );
  });
});

// ============================================================================
// Integration tests
// ============================================================================

describe("Integration", () => {
  beforeEach(() => {
    clearRegistryCache();
  });

  it("should work with a complete URL configuration", () => {
    // Asset module URLs
    const assetUrls = [
      path("", list_assets, { name: "asset-list" }),
      path(":id/", get_asset, { name: "asset-detail" }),
    ];

    // Task module URLs
    const taskUrls = [
      path("", list_tasks, { name: "task-list" }),
      path(":id/", get_task, { name: "task-detail" }),
    ];

    // Main URL configuration
    const urlpatterns = [
      path("", home_view, { name: "home" }),
      path("about/", about_view, { name: "about" }),
      path("api/assets/", include(assetUrls)),
      path("api/tasks/", include(taskUrls)),
    ];

    // Test resolving
    assertEquals(resolve("/", urlpatterns)!.name, "home");
    assertEquals(resolve("/about/", urlpatterns)!.name, "about");
    assertEquals(resolve("/api/assets/", urlpatterns)!.name, "asset-list");
    assertEquals(resolve("/api/assets/123/", urlpatterns)!.params, {
      id: "123",
    });
    assertEquals(resolve("/api/tasks/456/", urlpatterns)!.params, {
      id: "456",
    });

    // Test reversing
    assertEquals(reverse("home", {}, urlpatterns), "/");
    assertEquals(reverse("about", {}, urlpatterns), "/about/");
    assertEquals(reverse("asset-list", {}, urlpatterns), "/api/assets/");
    assertEquals(
      reverse("asset-detail", { id: "123" }, urlpatterns),
      "/api/assets/123/",
    );
    assertEquals(
      reverse("task-detail", { id: "456" }, urlpatterns),
      "/api/tasks/456/",
    );
  });
});

// Helper for beforeEach in describe blocks
function beforeEach(fn: () => void) {
  fn();
}
