/**
 * Login/Logout view tests for Alexi Admin
 *
 * Tests for GET /admin/login/, POST /admin/login/, and GET /admin/logout/.
 * Uses an in-memory mock backend so no real database is needed.
 *
 * @module
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { AdminSite } from "../mod.ts";
import {
  handleLoginPost,
  handleLogout,
  renderLoginPage,
} from "../views/login_views.ts";
import type { LoginViewContext } from "../views/login_views.ts";
import type { DatabaseBackend } from "@alexi/db";

// =============================================================================
// Minimal mock backend (we only need it for type satisfaction in the context)
// =============================================================================

const mockBackend = {} as DatabaseBackend;

// =============================================================================
// Helpers
// =============================================================================

function makeSite(): AdminSite {
  return new AdminSite({ urlPrefix: "/admin", title: "Test Admin" });
}

// =============================================================================
// GET /admin/login/ — renderLoginPage
// =============================================================================

Deno.test("renderLoginPage: returns 200 HTML", () => {
  const site = makeSite();
  const response = renderLoginPage(site);

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
});

Deno.test("renderLoginPage: contains form action", async () => {
  const site = makeSite();
  const response = renderLoginPage(site);
  const html = await response.text();

  assertStringIncludes(html, "/admin/login/");
  assertStringIncludes(html, 'type="email"');
  assertStringIncludes(html, 'type="password"');
});

Deno.test("renderLoginPage: shows error message when provided", async () => {
  const site = makeSite();
  const response = renderLoginPage(site, { error: "Invalid credentials" });
  const html = await response.text();

  assertStringIncludes(html, "Invalid credentials");
});

Deno.test("renderLoginPage: includes next hidden field when provided", async () => {
  const site = makeSite();
  const response = renderLoginPage(site, { next: "/admin/users/" });
  const html = await response.text();

  assertStringIncludes(html, "/admin/users/");
});

// =============================================================================
// POST /admin/login/ — handleLoginPost
// =============================================================================

Deno.test("handleLoginPost: returns error when AUTH_USER_MODEL not configured", async () => {
  const site = makeSite();
  const request = new Request("http://localhost/admin/login/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=admin%40example.com&password=secret",
  });

  const ctx: LoginViewContext = {
    request,
    params: {},
    adminSite: site,
    backend: mockBackend,
    settings: {}, // No AUTH_USER_MODEL
  };

  const response = await handleLoginPost(ctx);
  const html = await response.text();

  assertEquals(response.status, 200);
  assertStringIncludes(html, "Authentication is not configured");
});

Deno.test("handleLoginPost: returns error when fields are missing", async () => {
  const site = makeSite();
  const request = new Request("http://localhost/admin/login/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=admin%40example.com", // missing password
  });

  const ctx: LoginViewContext = {
    request,
    params: {},
    adminSite: site,
    backend: mockBackend,
    settings: { AUTH_USER_MODEL: "./nonexistent.ts" },
  };

  const response = await handleLoginPost(ctx);
  const html = await response.text();

  assertEquals(response.status, 200);
  assertStringIncludes(html, "Please enter both email and password");
});

Deno.test("handleLoginPost: returns config error when user model cannot be loaded", async () => {
  const site = makeSite();

  const request = new Request("http://localhost/admin/login/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=nobody%40example.com&password=wrong",
  });

  const ctx: LoginViewContext = {
    request,
    params: {},
    adminSite: site,
    backend: mockBackend,
    // Point to a module that doesn't exist — loadUserModel returns null
    settings: { AUTH_USER_MODEL: "/nonexistent/path/user.ts" },
  };

  const response = await handleLoginPost(ctx);
  const html = await response.text();

  assertEquals(response.status, 200);
  // Can't load module → config error is shown
  assertStringIncludes(html, "Authentication configuration error");
});

// =============================================================================
// GET /admin/logout/ — handleLogout
// =============================================================================

Deno.test("handleLogout: returns 200 HTML", () => {
  const site = makeSite();
  const response = handleLogout(site);

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
});

Deno.test("handleLogout: clears adminToken from localStorage", async () => {
  const site = makeSite();
  const response = handleLogout(site);
  const html = await response.text();

  assertStringIncludes(html, "removeItem");
  assertStringIncludes(html, "adminToken");
});

Deno.test("handleLogout: sets HX-Redirect to login page", () => {
  const site = makeSite();
  const response = handleLogout(site);

  assertEquals(response.headers.get("HX-Redirect"), "/admin/login/");
});

Deno.test("handleLogout: redirects to login page", async () => {
  const site = makeSite();
  const response = handleLogout(site);
  const html = await response.text();

  assertStringIncludes(html, "/admin/login/");
});

// =============================================================================
// URL routing — login/logout routes present in getAdminUrls
// =============================================================================

Deno.test("getAdminUrls: includes login URL in placeholder mode", async () => {
  const { getAdminUrls } = await import("../urls.ts");
  const site = makeSite();
  const urls = getAdminUrls(site);

  const loginUrl = urls.find((u) => u.name === "admin:login");
  assertEquals(loginUrl?.pattern, "/admin/login/");
});

Deno.test("getAdminUrls: includes logout URL in placeholder mode", async () => {
  const { getAdminUrls } = await import("../urls.ts");
  const site = makeSite();
  const urls = getAdminUrls(site);

  const logoutUrl = urls.find((u) => u.name === "admin:logout");
  assertEquals(logoutUrl?.pattern, "/admin/logout/");
});
