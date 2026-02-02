/**
 * SPA URL Resolution Tests
 *
 * Unit tests for the admin SPA URL routing utilities.
 * Tests resolve(), reverse(), path(), and include() functions.
 *
 * ## Running Tests
 *
 * ```bash
 * deno test src/admin/tests/spa_urls_test.ts
 * ```
 *
 * @module tests/spa_urls_test
 */

import { assertEquals, assertExists, assertThrows } from "jsr:@std/assert@1";
import {
  clearRegistryCache,
  include,
  path,
  resolve,
  reverse,
  type SPAURLPattern,
} from "../app/spa_urls.ts";

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_OPTIONS = {
  sanitizeOps: false,
  sanitizeResources: false,
};

// =============================================================================
// Mock Views
// =============================================================================

const mockDashboardView = async () => document.createElement("div");
const mockLoginView = async () => document.createElement("div");
const mockModelListView = async () => document.createElement("div");
const mockModelDetailView = async () => document.createElement("div");
const mockModelAddView = async () => document.createElement("div");
const mockModelDeleteView = async () => document.createElement("div");

// =============================================================================
// Test URL Patterns (mirrors admin/app/urls.ts)
// =============================================================================

const testUrlPatterns: SPAURLPattern[] = [
  path("login/", mockLoginView, { name: "admin:login" }),
  path("", mockDashboardView, { name: "admin:index" }),
  path(":model/", mockModelListView, { name: "admin:model_changelist" }),
  path(":model/add/", mockModelAddView, { name: "admin:model_add" }),
  path(":model/:id/", mockModelDetailView, { name: "admin:model_change" }),
  path(":model/:id/delete/", mockModelDeleteView, {
    name: "admin:model_delete",
  }),
];

// =============================================================================
// Setup & Teardown
// =============================================================================

Deno.test.beforeEach(() => {
  // Clear the route registry cache before each test
  clearRegistryCache();
});

// =============================================================================
// path() Function Tests
// =============================================================================

Deno.test({
  ...TEST_OPTIONS,
  name: "path: creates pattern with view function",
  fn() {
    const pattern = path("users/", mockModelListView);

    assertEquals(pattern.pattern, "users/");
    assertEquals(pattern.view, mockModelListView);
    assertEquals(pattern.children, undefined);
    assertEquals(pattern.name, undefined);
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "path: creates pattern with name option",
  fn() {
    const pattern = path("users/", mockModelListView, { name: "user-list" });

    assertEquals(pattern.pattern, "users/");
    assertEquals(pattern.name, "user-list");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "path: creates pattern with children (include)",
  fn() {
    const childPatterns = [
      path("list/", mockModelListView),
      path("add/", mockModelAddView),
    ];

    const pattern = path("users/", childPatterns);

    assertEquals(pattern.pattern, "users/");
    assertEquals(pattern.view, undefined);
    assertEquals(pattern.children, childPatterns);
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "path: creates pattern with parameter placeholder",
  fn() {
    const pattern = path(":id/", mockModelDetailView, { name: "detail" });

    assertEquals(pattern.pattern, ":id/");
    assertEquals(pattern.name, "detail");
  },
});

// =============================================================================
// include() Function Tests
// =============================================================================

Deno.test({
  ...TEST_OPTIONS,
  name: "include: returns patterns array unchanged",
  fn() {
    const patterns = [
      path("a/", mockModelListView),
      path("b/", mockModelAddView),
    ];

    const result = include(patterns);

    assertEquals(result, patterns);
    assertEquals(result.length, 2);
  },
});

// =============================================================================
// resolve() Function Tests
// =============================================================================

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: matches empty path to dashboard",
  fn() {
    const result = resolve("", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:index");
    assertEquals(result.view, mockDashboardView);
    assertEquals(Object.keys(result.params).length, 0);
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: matches login path",
  fn() {
    const result = resolve("login", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:login");
    assertEquals(result.view, mockLoginView);
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: matches login path with trailing slash",
  fn() {
    const result = resolve("login/", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:login");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: matches model list with parameter",
  fn() {
    const result = resolve("users", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:model_changelist");
    assertEquals(result.params.model, "users");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: matches model add route",
  fn() {
    const result = resolve("users/add", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:model_add");
    assertEquals(result.params.model, "users");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: matches model detail with two parameters",
  fn() {
    const result = resolve("users/123", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:model_change");
    assertEquals(result.params.model, "users");
    assertEquals(result.params.id, "123");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: matches model delete route",
  fn() {
    const result = resolve("tasks/456/delete", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:model_delete");
    assertEquals(result.params.model, "tasks");
    assertEquals(result.params.id, "456");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: returns null for non-matching path",
  fn() {
    const result = resolve("nonexistent/path/here/extra", testUrlPatterns);

    assertEquals(result, null);
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: handles leading slashes",
  fn() {
    const result = resolve("/users/", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:model_changelist");
    assertEquals(result.params.model, "users");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: handles multiple leading slashes",
  fn() {
    const result = resolve("///login///", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:login");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: handles UUID-like IDs",
  fn() {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const result = resolve(`units/${uuid}`, testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:model_change");
    assertEquals(result.params.model, "units");
    assertEquals(result.params.id, uuid);
  },
});

// =============================================================================
// resolve() with Nested Patterns Tests
// =============================================================================

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: matches nested patterns",
  fn() {
    const nestedPatterns: SPAURLPattern[] = [
      path("api/", [
        path("users/", mockModelListView, { name: "api:users" }),
        path("posts/", mockModelListView, { name: "api:posts" }),
      ]),
    ];

    const result = resolve("api/users", nestedPatterns);

    assertExists(result);
    assertEquals(result.name, "api:users");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "resolve: matches deeply nested patterns with parameters",
  fn() {
    const nestedPatterns: SPAURLPattern[] = [
      path("api/", [
        path("v1/", [
          path("users/", mockModelListView, { name: "api:v1:users:list" }),
          path("users/:id/", mockModelDetailView, {
            name: "api:v1:users:detail",
          }),
        ]),
      ]),
    ];

    const result = resolve("api/v1/users/42", nestedPatterns);

    assertExists(result);
    assertEquals(result.name, "api:v1:users:detail");
    assertEquals(result.params.id, "42");
  },
});

// =============================================================================
// reverse() Function Tests
// =============================================================================

Deno.test({
  ...TEST_OPTIONS,
  name: "reverse: generates URL for named route without params",
  fn() {
    const url = reverse("admin:index", {}, testUrlPatterns);

    assertEquals(url, "/");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "reverse: generates URL for login route",
  fn() {
    const url = reverse("admin:login", {}, testUrlPatterns);

    assertEquals(url, "/login/");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "reverse: generates URL for model list with parameter",
  fn() {
    const url = reverse(
      "admin:model_changelist",
      { model: "users" },
      testUrlPatterns,
    );

    assertEquals(url, "/users/");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "reverse: generates URL for model add",
  fn() {
    const url = reverse("admin:model_add", { model: "tasks" }, testUrlPatterns);

    assertEquals(url, "/tasks/add/");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "reverse: generates URL for model detail with two params",
  fn() {
    const url = reverse(
      "admin:model_change",
      { model: "users", id: "123" },
      testUrlPatterns,
    );

    assertEquals(url, "/users/123/");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "reverse: generates URL for model delete",
  fn() {
    const url = reverse(
      "admin:model_delete",
      { model: "tickets", id: "999" },
      testUrlPatterns,
    );

    assertEquals(url, "/tickets/999/delete/");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "reverse: throws error for unknown route name",
  fn() {
    assertThrows(
      () => reverse("nonexistent:route", {}, testUrlPatterns),
      Error,
      "No route found with name: nonexistent:route",
    );
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "reverse: throws error for missing required parameter",
  fn() {
    assertThrows(
      () => reverse("admin:model_changelist", {}, testUrlPatterns),
      Error,
      "Missing required parameter 'model'",
    );
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "reverse: throws error for missing one of multiple params",
  fn() {
    assertThrows(
      () => reverse("admin:model_change", { model: "users" }, testUrlPatterns),
      Error,
      "Missing required parameter 'id'",
    );
  },
});

// =============================================================================
// Round-trip Tests (resolve + reverse)
// =============================================================================

Deno.test({
  ...TEST_OPTIONS,
  name: "round-trip: resolve then reverse produces same path",
  fn() {
    const originalPath = "users/42";
    const resolved = resolve(originalPath, testUrlPatterns);

    assertExists(resolved);

    const reversed = reverse(resolved.name!, resolved.params, testUrlPatterns);

    // Reversed path should match when normalized
    assertEquals(reversed, "/users/42/");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "round-trip: reverse then resolve produces same params",
  fn() {
    const routeName = "admin:model_delete";
    const params = { model: "tasks", id: "789" };

    const url = reverse(routeName, params, testUrlPatterns);
    const resolved = resolve(url, testUrlPatterns);

    assertExists(resolved);
    assertEquals(resolved.name, routeName);
    assertEquals(resolved.params.model, params.model);
    assertEquals(resolved.params.id, params.id);
  },
});

// =============================================================================
// Edge Cases
// =============================================================================

Deno.test({
  ...TEST_OPTIONS,
  name: "edge case: empty patterns array returns null",
  fn() {
    const result = resolve("anything", []);

    assertEquals(result, null);
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "edge case: pattern with special characters in parameter",
  fn() {
    const result = resolve("user-profile", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:model_changelist");
    assertEquals(result.params.model, "user-profile");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "edge case: pattern with numeric model name",
  fn() {
    const result = resolve("123/456", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:model_change");
    assertEquals(result.params.model, "123");
    assertEquals(result.params.id, "456");
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "edge case: reverse with extra unused params",
  fn() {
    // Extra params should be ignored
    const url = reverse(
      "admin:model_changelist",
      { model: "users", unused: "value", another: "param" },
      testUrlPatterns,
    );

    assertEquals(url, "/users/");
  },
});

// =============================================================================
// Pattern Priority Tests
// =============================================================================

Deno.test({
  ...TEST_OPTIONS,
  name: "priority: more specific pattern matches first (add before :id)",
  fn() {
    // "add" should match admin:model_add, not admin:model_change with id="add"
    const result = resolve("users/add", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:model_add");
    assertEquals(result.params.model, "users");
    assertEquals(result.params.id, undefined);
  },
});

Deno.test({
  ...TEST_OPTIONS,
  name: "priority: login matches before :model",
  fn() {
    // "login" should match admin:login, not admin:model_changelist with model="login"
    const result = resolve("login", testUrlPatterns);

    assertExists(result);
    assertEquals(result.name, "admin:login");
    assertEquals(result.params.model, undefined);
  },
});
