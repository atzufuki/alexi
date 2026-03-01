/**
 * Tests for the Admin Delete Confirmation view (#130)
 *
 * Covers:
 *  - Auth guard redirects unauthenticated requests
 *  - 404 for unknown model
 *  - 404 when object does not exist
 *  - GET: returns 200 confirmation page
 *  - GET: page contains object summary
 *  - GET: page has "Yes, I'm sure" and "No, go back" buttons
 *  - POST: deletes the object and redirects to changelist
 *  - POST: object is actually removed from the backend
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { reset } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { setup } from "@alexi/core";
import { AutoField, CharField, IntegerField, Manager, Model } from "@alexi/db";
import { AdminSite } from "../site.ts";
import { ModelAdmin } from "../model_admin.ts";
import { renderDeleteConfirmation } from "../views/delete_views.ts";

// =============================================================================
// Test model
// =============================================================================

class ArticleModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  views = new IntegerField({ default: 0 });

  static objects = new Manager(ArticleModel);
  static override meta = {
    dbTable: "dv_articles",
    verboseName: "Article",
    verboseNamePlural: "Articles",
  };
}

// =============================================================================
// JWT helper (unsigned dev token)
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

function makeGetRequest(path: string, token?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request(`http://localhost${path}`, { method: "GET", headers });
}

function makePostRequest(path: string, token?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: "_delete=confirm",
  });
}

// =============================================================================
// Setup / teardown helpers
// =============================================================================

async function makeBackend() {
  const backend = new DenoKVBackend({ name: "dv_test", path: ":memory:" });
  await backend.connect();
  await setup({ DATABASES: { default: backend } });
  return backend;
}

async function teardownBackend(backend: DenoKVBackend) {
  await reset();
  await backend.disconnect();
}

function makeSite(): AdminSite {
  return new AdminSite({ title: "Test Admin", urlPrefix: "/admin" });
}

// =============================================================================
// Auth guard
// =============================================================================

Deno.test({
  name: "renderDeleteConfirmation: redirects to login when no token",
  async fn() {
    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      const req = makeGetRequest("/admin/articlemodel/1/delete/");
      const res = await renderDeleteConfirmation(
        { request: req, params: { id: "1" }, adminSite: site, backend },
        "articlemodel",
        "1",
      );
      assertEquals(res.status, 302);
      assertEquals(res.headers.get("Location"), "/admin/login/");
    } finally {
      await teardownBackend(backend);
    }
  },
});

// =============================================================================
// 404 cases
// =============================================================================

Deno.test({
  name: "renderDeleteConfirmation: returns 404 for unknown model",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      const req = makeGetRequest("/admin/nomodel/1/delete/", makeValidToken());
      const res = await renderDeleteConfirmation(
        { request: req, params: { id: "1" }, adminSite: site, backend },
        "nomodel",
        "1",
      );
      assertEquals(res.status, 404);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderDeleteConfirmation: returns 404 for non-existent object",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      const req = makeGetRequest(
        "/admin/articlemodel/9999/delete/",
        makeValidToken(),
      );
      const res = await renderDeleteConfirmation(
        { request: req, params: { id: "9999" }, adminSite: site, backend },
        "articlemodel",
        "9999",
      );
      assertEquals(res.status, 404);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// GET: Confirmation page
// =============================================================================

Deno.test({
  name: "renderDeleteConfirmation: GET returns 200 HTML",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const article = await ArticleModel.objects.create({
        title: "My Article",
        views: 0,
      });
      const id = String(article.id.get());

      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      const req = makeGetRequest(
        `/admin/articlemodel/${id}/delete/`,
        makeValidToken(),
      );
      const res = await renderDeleteConfirmation(
        { request: req, params: { id }, adminSite: site, backend },
        "articlemodel",
        id,
      );
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("Content-Type"), "text/html; charset=utf-8");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderDeleteConfirmation: GET page contains 'Delete Article' heading",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const article = await ArticleModel.objects.create({
        title: "Heading Test",
        views: 0,
      });
      const id = String(article.id.get());

      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      const req = makeGetRequest(
        `/admin/articlemodel/${id}/delete/`,
        makeValidToken(),
      );
      const res = await renderDeleteConfirmation(
        { request: req, params: { id }, adminSite: site, backend },
        "articlemodel",
        id,
      );
      const html = await res.text();
      assertStringIncludes(html, "Delete Article");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderDeleteConfirmation: GET page shows object summary",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const article = await ArticleModel.objects.create({
        title: "Showing In Summary",
        views: 0,
      });
      const id = String(article.id.get());

      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      const req = makeGetRequest(
        `/admin/articlemodel/${id}/delete/`,
        makeValidToken(),
      );
      const res = await renderDeleteConfirmation(
        { request: req, params: { id }, adminSite: site, backend },
        "articlemodel",
        id,
      );
      const html = await res.text();
      assertStringIncludes(html, "Showing In Summary");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderDeleteConfirmation: GET page has Yes/No buttons",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const article = await ArticleModel.objects.create({
        title: "Button Test",
        views: 0,
      });
      const id = String(article.id.get());

      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      const req = makeGetRequest(
        `/admin/articlemodel/${id}/delete/`,
        makeValidToken(),
      );
      const res = await renderDeleteConfirmation(
        { request: req, params: { id }, adminSite: site, backend },
        "articlemodel",
        id,
      );
      const html = await res.text();
      assertStringIncludes(html, "Yes, I'm sure");
      assertStringIncludes(html, "No, go back");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderDeleteConfirmation: GET page has warning text",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const article = await ArticleModel.objects.create({
        title: "Warning Test",
        views: 0,
      });
      const id = String(article.id.get());

      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      const req = makeGetRequest(
        `/admin/articlemodel/${id}/delete/`,
        makeValidToken(),
      );
      const res = await renderDeleteConfirmation(
        { request: req, params: { id }, adminSite: site, backend },
        "articlemodel",
        id,
      );
      const html = await res.text();
      assertStringIncludes(html, "cannot be undone");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// POST: Delete
// =============================================================================

Deno.test({
  name: "renderDeleteConfirmation: POST redirects to changelist on success",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const article = await ArticleModel.objects.create({
        title: "To Delete",
        views: 0,
      });
      const id = String(article.id.get());

      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      const req = makePostRequest(
        `/admin/articlemodel/${id}/delete/`,
        makeValidToken(),
      );
      const res = await renderDeleteConfirmation(
        { request: req, params: { id }, adminSite: site, backend },
        "articlemodel",
        id,
      );
      assertEquals(res.status, 302);
      assertEquals(res.headers.get("Location"), "/admin/articlemodel/");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderDeleteConfirmation: POST actually deletes the object",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const article = await ArticleModel.objects.create({
        title: "Will Be Deleted",
        views: 42,
      });
      const id = String(article.id.get());

      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      const req = makePostRequest(
        `/admin/articlemodel/${id}/delete/`,
        makeValidToken(),
      );
      await renderDeleteConfirmation(
        { request: req, params: { id }, adminSite: site, backend },
        "articlemodel",
        id,
      );

      // Verify the object is gone
      const remaining = await ArticleModel.objects.filter({
        title: "Will Be Deleted",
      }).fetch();
      assertEquals(remaining.array().length, 0);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});
