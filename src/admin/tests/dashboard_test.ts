/**
 * Tests for the Admin Dashboard view (#127)
 *
 * These tests cover:
 *  - Auth guard: unauthenticated requests redirect to /admin/login/
 *  - Authenticated requests return 200 with dashboard HTML
 *  - Dashboard HTML contains expected elements (nav, model list, breadcrumbs)
 *  - Sidebar nav contains registered models
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { AdminSite } from "../site.ts";
import { ModelAdmin } from "../model_admin.ts";
import { renderDashboard } from "../views/dashboard_views.ts";
import { verifyAdminToken } from "../views/auth_guard.ts";
import { AutoField, CharField, Manager, Model } from "@alexi/db";

// =============================================================================
// Test models
// =============================================================================

class ArticleModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  static objects = new Manager(ArticleModel);
  static override meta = {
    dbTable: "articles",
    verboseName: "Article",
    verboseNamePlural: "Articles",
  };
}

class UserModel extends Model {
  id = new AutoField({ primaryKey: true });
  email = new CharField({ maxLength: 200 });
  static objects = new Manager(UserModel);
  static override meta = {
    dbTable: "users",
    verboseName: "User",
    verboseNamePlural: "Users",
  };
}

// =============================================================================
// Helper: create an unsigned dev JWT (alg: none)
// =============================================================================

function makeDevToken(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) => {
    const json = JSON.stringify(obj);
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(
      /=+$/,
      "",
    );
  };
  const header = encode({ alg: "none", typ: "JWT" });
  const body = encode(payload);
  return `${header}.${body}.`;
}

function makeValidToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return makeDevToken({
    userId: 1,
    email: "admin@example.com",
    isAdmin: true,
    iat: now,
    exp: now + 900,
  });
}

function makeExpiredToken(): string {
  const past = Math.floor(Date.now() / 1000) - 1000;
  return makeDevToken({
    userId: 1,
    email: "admin@example.com",
    isAdmin: true,
    iat: past - 900,
    exp: past,
  });
}

function makeRequest(
  path = "/admin/",
  token?: string,
): Request {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request(`http://localhost${path}`, { headers });
}

// =============================================================================
// verifyAdminToken tests
// =============================================================================

Deno.test({
  name:
    "verifyAdminToken: returns authenticated=false when no Authorization header",
  async fn() {
    const req = new Request("http://localhost/admin/");
    const result = await verifyAdminToken(req);
    assertEquals(result.authenticated, false);
  },
});

Deno.test({
  name: "verifyAdminToken: returns authenticated=false for malformed header",
  async fn() {
    const req = new Request("http://localhost/admin/", {
      headers: { Authorization: "Basic abc123" },
    });
    const result = await verifyAdminToken(req);
    assertEquals(result.authenticated, false);
  },
});

Deno.test({
  name: "verifyAdminToken: returns authenticated=false for expired token",
  async fn() {
    const req = makeRequest("/admin/", makeExpiredToken());
    const result = await verifyAdminToken(req);
    assertEquals(result.authenticated, false);
  },
});

Deno.test({
  name:
    "verifyAdminToken: returns authenticated=true for valid unsigned dev token (no SECRET_KEY)",
  async fn() {
    // Remove SECRET_KEY from env if set (dev mode)
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    try {
      const req = makeRequest("/admin/", makeValidToken());
      const result = await verifyAdminToken(req);
      assertEquals(result.authenticated, true);
      assertEquals(result.email, "admin@example.com");
      assertEquals(result.isAdmin, true);
    } finally {
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "verifyAdminToken: rejects unsigned token when SECRET_KEY is set",
  async fn() {
    const original = Deno.env.get("SECRET_KEY");
    Deno.env.set("SECRET_KEY", "supersecret");

    try {
      const req = makeRequest("/admin/", makeValidToken());
      const result = await verifyAdminToken(req);
      assertEquals(result.authenticated, false);
    } finally {
      if (original !== undefined) {
        Deno.env.set("SECRET_KEY", original);
      } else {
        Deno.env.delete("SECRET_KEY");
      }
    }
  },
});

// =============================================================================
// renderDashboard tests
// =============================================================================

function makeSite(): AdminSite {
  return new AdminSite({ title: "Test Admin", urlPrefix: "/admin" });
}

Deno.test({
  name: "renderDashboard: redirects to login when no Authorization header",
  async fn() {
    const site = makeSite();
    const req = new Request("http://localhost/admin/");
    const res = await renderDashboard({
      request: req,
      params: {},
      adminSite: site,
    });
    assertEquals(res.status, 302);
    assertEquals(res.headers.get("Location"), "/admin/login/");
  },
});

Deno.test({
  name:
    "renderDashboard: redirects to login with HX-Redirect for HTMX requests",
  async fn() {
    const site = makeSite();
    const req = new Request("http://localhost/admin/");
    const res = await renderDashboard({
      request: req,
      params: {},
      adminSite: site,
    });
    assertEquals(res.headers.get("HX-Redirect"), "/admin/login/");
  },
});

Deno.test({
  name: "renderDashboard: returns 200 HTML for authenticated request",
  async fn() {
    const original = Deno.env.get("SECRET_KEY");
    if (original) Deno.env.delete("SECRET_KEY");

    try {
      const site = makeSite();
      const req = makeRequest("/admin/", makeValidToken());
      const res = await renderDashboard({
        request: req,
        params: {},
        adminSite: site,
      });
      assertEquals(res.status, 200);
      assertEquals(
        res.headers.get("Content-Type"),
        "text/html; charset=utf-8",
      );
    } finally {
      if (original) Deno.env.set("SECRET_KEY", original);
    }
  },
});

Deno.test({
  name: "renderDashboard: HTML contains site title",
  async fn() {
    const original = Deno.env.get("SECRET_KEY");
    if (original) Deno.env.delete("SECRET_KEY");

    try {
      const site = makeSite();
      const req = makeRequest("/admin/", makeValidToken());
      const res = await renderDashboard({
        request: req,
        params: {},
        adminSite: site,
      });
      const html = await res.text();
      assertStringIncludes(html, "Test Admin");
    } finally {
      if (original) Deno.env.set("SECRET_KEY", original);
    }
  },
});

Deno.test({
  name: "renderDashboard: HTML contains 'Site administration' heading",
  async fn() {
    const original = Deno.env.get("SECRET_KEY");
    if (original) Deno.env.delete("SECRET_KEY");

    try {
      const site = makeSite();
      const req = makeRequest("/admin/", makeValidToken());
      const res = await renderDashboard({
        request: req,
        params: {},
        adminSite: site,
      });
      const html = await res.text();
      assertStringIncludes(html, "Site administration");
    } finally {
      if (original) Deno.env.set("SECRET_KEY", original);
    }
  },
});

Deno.test({
  name: "renderDashboard: HTML contains user email in header",
  async fn() {
    const original = Deno.env.get("SECRET_KEY");
    if (original) Deno.env.delete("SECRET_KEY");

    try {
      const site = makeSite();
      const req = makeRequest("/admin/", makeValidToken());
      const res = await renderDashboard({
        request: req,
        params: {},
        adminSite: site,
      });
      const html = await res.text();
      assertStringIncludes(html, "admin@example.com");
    } finally {
      if (original) Deno.env.set("SECRET_KEY", original);
    }
  },
});

Deno.test({
  name: "renderDashboard: HTML contains registered model links",
  async fn() {
    const original = Deno.env.get("SECRET_KEY");
    if (original) Deno.env.delete("SECRET_KEY");

    try {
      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      site.register(UserModel, ModelAdmin);

      const req = makeRequest("/admin/", makeValidToken());
      const res = await renderDashboard({
        request: req,
        params: {},
        adminSite: site,
      });
      const html = await res.text();
      assertStringIncludes(html, "/admin/articlemodel/");
      assertStringIncludes(html, "/admin/usermodel/");
    } finally {
      if (original) Deno.env.set("SECRET_KEY", original);
    }
  },
});

Deno.test({
  name: "renderDashboard: HTML contains logout link",
  async fn() {
    const original = Deno.env.get("SECRET_KEY");
    if (original) Deno.env.delete("SECRET_KEY");

    try {
      const site = makeSite();
      const req = makeRequest("/admin/", makeValidToken());
      const res = await renderDashboard({
        request: req,
        params: {},
        adminSite: site,
      });
      const html = await res.text();
      assertStringIncludes(html, "/admin/logout/");
    } finally {
      if (original) Deno.env.set("SECRET_KEY", original);
    }
  },
});

Deno.test({
  name: "renderDashboard: HTML includes HTMX script tag",
  async fn() {
    const original = Deno.env.get("SECRET_KEY");
    if (original) Deno.env.delete("SECRET_KEY");

    try {
      const site = makeSite();
      const req = makeRequest("/admin/", makeValidToken());
      const res = await renderDashboard({
        request: req,
        params: {},
        adminSite: site,
      });
      const html = await res.text();
      assertStringIncludes(html, "htmx.org");
      assertStringIncludes(html, "admin.js");
    } finally {
      if (original) Deno.env.set("SECRET_KEY", original);
    }
  },
});

Deno.test({
  name: "renderDashboard: shows 'No models registered' when site is empty",
  async fn() {
    const original = Deno.env.get("SECRET_KEY");
    if (original) Deno.env.delete("SECRET_KEY");

    try {
      const site = makeSite();
      const req = makeRequest("/admin/", makeValidToken());
      const res = await renderDashboard({
        request: req,
        params: {},
        adminSite: site,
      });
      const html = await res.text();
      assertStringIncludes(html, "No models registered");
    } finally {
      if (original) Deno.env.set("SECRET_KEY", original);
    }
  },
});
