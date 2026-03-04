/**
 * Login/Logout view tests for Alexi Admin
 *
 * Tests for GET /admin/login/, POST /admin/login/, and GET|POST /admin/logout/.
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
import type {
  AuthUserModelClass,
  LoginViewContext,
} from "../views/login_views.ts";
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

Deno.test("handleLogout: sets X-Admin-Logout header", () => {
  const site = makeSite();
  const response = handleLogout(site);

  assertEquals(response.headers.get("X-Admin-Logout"), "true");
});

Deno.test("handleLogout: sets X-Admin-Redirect to login page", () => {
  const site = makeSite();
  const response = handleLogout(site);

  assertEquals(response.headers.get("X-Admin-Redirect"), "/admin/login/");
});

Deno.test("handleLogout: clears adminToken cookie", () => {
  const site = makeSite();
  const response = handleLogout(site);

  const cookie = response.headers.get("Set-Cookie") ?? "";
  assertStringIncludes(cookie, "adminToken=");
  assertStringIncludes(cookie, "Max-Age=0");
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

// =============================================================================
// POST /admin/login/ — model-class pattern (AUTH_USER_MODEL = class)
// =============================================================================

/**
 * Build a minimal UserModel class that satisfies AuthUserModelClass.
 * Allows controlling what user is returned and whether verifyPassword passes.
 *
 * Returns an actual constructor function (class) so that
 * `typeof authUserModel === "function"` is true in loadUserModel().
 */
function makeUserModelClass(
  opts: {
    user?: {
      id: number;
      email: string;
      password: string;
      isAdmin: boolean;
      isActive: boolean;
    } | null;
    verifyResult?: boolean;
  } = {},
): AuthUserModelClass {
  const { user = null, verifyResult = false } = opts;

  // Build a fake model instance with .get() field accessors + verifyPassword
  const makeInstance = (u: NonNullable<typeof user>) => ({
    id: { get: () => u.id },
    email: { get: () => u.email },
    password: { get: () => u.password },
    isAdmin: { get: () => u.isAdmin },
    isActive: { get: () => u.isActive },
    async verifyPassword(_plain: string): Promise<boolean> {
      return verifyResult;
    },
  });

  // Must be a real class/constructor so typeof === "function" in loadUserModel()
  class UserModelMock {
    static objects = {
      using(_backend: DatabaseBackend) {
        return {
          filter(_q: Record<string, unknown>) {
            return {
              async first(): Promise<unknown> {
                return user ? makeInstance(user) : null;
              },
            };
          },
        };
      },
    };
  }

  return UserModelMock as unknown as AuthUserModelClass;
}

Deno.test("handleLoginPost (model-class): missing fields shows error", async () => {
  const site = makeSite();
  const request = new Request("http://localhost/admin/login/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=admin%40example.com", // missing password
  });

  const UserModel = makeUserModelClass();
  const ctx: LoginViewContext = {
    request,
    params: {},
    adminSite: site,
    backend: mockBackend,
    settings: { AUTH_USER_MODEL: UserModel },
  };

  const response = await handleLoginPost(ctx);
  const html = await response.text();

  assertEquals(response.status, 200);
  assertStringIncludes(html, "Please enter both email and password");
});

Deno.test("handleLoginPost (model-class): user not found shows error", async () => {
  const site = makeSite();
  const request = new Request("http://localhost/admin/login/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=nobody%40example.com&password=secret",
  });

  // No user returned from objects.using().filter().first()
  const UserModel = makeUserModelClass({ user: null });
  const ctx: LoginViewContext = {
    request,
    params: {},
    adminSite: site,
    backend: mockBackend,
    settings: { AUTH_USER_MODEL: UserModel },
  };

  const response = await handleLoginPost(ctx);
  const html = await response.text();

  assertEquals(response.status, 200);
  assertStringIncludes(html, "Invalid email or password");
});

Deno.test("handleLoginPost (model-class): wrong password shows error", async () => {
  const site = makeSite();
  const request = new Request("http://localhost/admin/login/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=admin%40example.com&password=wrongpassword",
  });

  const UserModel = makeUserModelClass({
    user: {
      id: 1,
      email: "admin@example.com",
      password: "hash",
      isAdmin: true,
      isActive: true,
    },
    verifyResult: false, // verifyPassword returns false
  });

  const ctx: LoginViewContext = {
    request,
    params: {},
    adminSite: site,
    backend: mockBackend,
    settings: { AUTH_USER_MODEL: UserModel },
  };

  const response = await handleLoginPost(ctx);
  const html = await response.text();

  assertEquals(response.status, 200);
  assertStringIncludes(html, "Invalid email or password");
});

Deno.test("handleLoginPost (model-class): inactive user shows error", async () => {
  const site = makeSite();
  const request = new Request("http://localhost/admin/login/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=inactive%40example.com&password=secret",
  });

  const UserModel = makeUserModelClass({
    user: {
      id: 2,
      email: "inactive@example.com",
      password: "hash",
      isAdmin: true,
      isActive: false, // inactive
    },
    verifyResult: true,
  });

  const ctx: LoginViewContext = {
    request,
    params: {},
    adminSite: site,
    backend: mockBackend,
    settings: { AUTH_USER_MODEL: UserModel },
  };

  const response = await handleLoginPost(ctx);
  const html = await response.text();

  assertEquals(response.status, 200);
  assertStringIncludes(html, "inactive");
});

Deno.test("handleLoginPost (model-class): non-admin user shows error", async () => {
  const site = makeSite();
  const request = new Request("http://localhost/admin/login/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=regular%40example.com&password=secret",
  });

  const UserModel = makeUserModelClass({
    user: {
      id: 3,
      email: "regular@example.com",
      password: "hash",
      isAdmin: false, // not admin
      isActive: true,
    },
    verifyResult: true,
  });

  const ctx: LoginViewContext = {
    request,
    params: {},
    adminSite: site,
    backend: mockBackend,
    settings: { AUTH_USER_MODEL: UserModel },
  };

  const response = await handleLoginPost(ctx);
  const html = await response.text();

  assertEquals(response.status, 200);
  assertStringIncludes(html, "permission");
});

Deno.test("handleLoginPost (model-class): successful login returns token headers", async () => {
  const site = makeSite();
  const request = new Request("http://localhost/admin/login/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=admin%40example.com&password=correctpassword",
  });

  const UserModel = makeUserModelClass({
    user: {
      id: 42,
      email: "admin@example.com",
      password: "hash",
      isAdmin: true,
      isActive: true,
    },
    verifyResult: true, // verifyPassword returns true
  });

  const ctx: LoginViewContext = {
    request,
    params: {},
    adminSite: site,
    backend: mockBackend,
    settings: {
      AUTH_USER_MODEL: UserModel,
      SECRET_KEY: "test-secret",
    },
  };

  const response = await handleLoginPost(ctx);

  assertEquals(response.status, 200);
  // Should set admin token and redirect
  assertStringIncludes(
    response.headers.get("X-Admin-Token") ?? "",
    ".", // JWT has dots
  );
  assertStringIncludes(
    response.headers.get("X-Admin-Redirect") ?? "",
    "/admin",
  );
});
