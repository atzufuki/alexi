/**
 * Tests for the Admin Change Form view (#129)
 *
 * Covers:
 *  - Auth guard redirects unauthenticated requests
 *  - 404 for unknown model
 *  - 404 when editing a non-existent object
 *  - GET add form: returns 200 with blank form
 *  - GET change form: returns 200 pre-filled with instance data
 *  - Form HTML contains correct field inputs and labels
 *  - Save and add: breadcrumbs / heading
 *  - POST add (valid data): creates object and redirects to changelist
 *  - POST change (valid data): updates object and redirects
 *  - POST validation errors: re-renders form with 422 and error messages
 *  - POST with missing required field: re-renders with error
 *  - Delete button present on change form
 *  - No delete button on add form
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { reset } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { setup } from "@alexi/core";
import {
  AutoField,
  CharField,
  ForeignKey,
  IntegerField,
  Manager,
  Model,
  OnDelete,
} from "@alexi/db";
import { AdminSite } from "../site.ts";
import { ModelAdmin } from "../model_admin.ts";
import { renderChangeForm } from "../views/changeform_views.ts";

// =============================================================================
// Test model
// =============================================================================

class PostModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  body = new CharField({ maxLength: 1000, blank: true, default: "" });
  priority = new IntegerField({ default: 0 });

  static objects = new Manager(PostModel);
  static override meta = {
    dbTable: "cf_posts",
    verboseName: "Post",
    verboseNamePlural: "Posts",
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

function makePostRequest(
  path: string,
  data: Record<string, string>,
  token?: string,
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const body = new URLSearchParams(data).toString();
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers,
    body,
  });
}

// =============================================================================
// Setup / teardown helpers
// =============================================================================

async function makeBackend() {
  const backend = new DenoKVBackend({ name: "cf_test", path: ":memory:" });
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
  name: "renderChangeForm: redirects to login when no token (add)",
  async fn() {
    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makeGetRequest("/admin/postmodel/add/");
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
      );
      assertEquals(res.status, 302);
      assertEquals(res.headers.get("Location"), "/admin/login/");
    } finally {
      await teardownBackend(backend);
    }
  },
});

Deno.test({
  name: "renderChangeForm: redirects to login when no token (change)",
  async fn() {
    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makeGetRequest("/admin/postmodel/1/");
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
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
  name: "renderChangeForm: returns 404 for unknown model",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      const req = makeGetRequest("/admin/nomodel/add/", makeValidToken());
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "nomodel",
      );
      assertEquals(res.status, 404);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeForm: returns 404 when editing non-existent object",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makeGetRequest("/admin/postmodel/9999/", makeValidToken());
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
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
// GET: Add form
// =============================================================================

Deno.test({
  name: "renderChangeForm: GET add form returns 200 HTML",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makeGetRequest("/admin/postmodel/add/", makeValidToken());
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
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
  name: "renderChangeForm: GET add form contains 'Add Post' heading",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makeGetRequest("/admin/postmodel/add/", makeValidToken());
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "Add Post");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeForm: GET add form contains field inputs",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makeGetRequest("/admin/postmodel/add/", makeValidToken());
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
      );
      const html = await res.text();
      assertStringIncludes(html, 'name="title"');
      assertStringIncludes(html, 'name="body"');
      assertStringIncludes(html, 'name="priority"');
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeForm: GET add form has Save button",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makeGetRequest("/admin/postmodel/add/", makeValidToken());
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
      );
      const html = await res.text();
      assertStringIncludes(html, 'value="Save"');
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeForm: GET add form has no Delete button",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makeGetRequest("/admin/postmodel/add/", makeValidToken());
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
      );
      const html = await res.text();
      assertEquals(html.includes("admin-delete-btn"), false);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// GET: Change form
// =============================================================================

Deno.test({
  name: "renderChangeForm: GET change form pre-fills existing instance data",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const post = await PostModel.objects.create({
        title: "My Test Post",
        body: "Some body text",
        priority: 5,
      });
      const id = String(post.id.get());

      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makeGetRequest(`/admin/postmodel/${id}/`, makeValidToken());
      const res = await renderChangeForm(
        { request: req, params: { id }, adminSite: site, backend },
        "postmodel",
        id,
      );
      assertEquals(res.status, 200);
      const html = await res.text();
      assertStringIncludes(html, "My Test Post");
      assertStringIncludes(html, "Some body text");
      assertStringIncludes(html, "5");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeForm: GET change form has Delete button",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const post = await PostModel.objects.create({
        title: "To Delete",
        priority: 0,
      });
      const id = String(post.id.get());

      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makeGetRequest(`/admin/postmodel/${id}/`, makeValidToken());
      const res = await renderChangeForm(
        { request: req, params: { id }, adminSite: site, backend },
        "postmodel",
        id,
      );
      const html = await res.text();
      assertStringIncludes(html, "admin-delete-btn");
      assertStringIncludes(html, `/admin/postmodel/${id}/delete/`);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeForm: GET change form has 'Change Post' heading",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const post = await PostModel.objects.create({
        title: "Change Me",
        priority: 0,
      });
      const id = String(post.id.get());

      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makeGetRequest(`/admin/postmodel/${id}/`, makeValidToken());
      const res = await renderChangeForm(
        { request: req, params: { id }, adminSite: site, backend },
        "postmodel",
        id,
      );
      const html = await res.text();
      assertStringIncludes(html, "Change Post");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// POST: Create
// =============================================================================

Deno.test({
  name: "renderChangeForm: POST add with valid data redirects to changelist",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makePostRequest(
        "/admin/postmodel/add/",
        { title: "New Post", body: "Content here", priority: "3" },
        makeValidToken(),
      );
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
      );
      assertEquals(res.status, 302);
      assertEquals(res.headers.get("Location"), "/admin/postmodel/");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeForm: POST add actually persists the object",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makePostRequest(
        "/admin/postmodel/add/",
        { title: "Persisted Post", body: "", priority: "0" },
        makeValidToken(),
      );
      await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
      );

      // Verify the object was created
      const posts = await PostModel.objects.filter({
        title: "Persisted Post",
      }).fetch();
      assertEquals(posts.array().length, 1);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// POST: Update
// =============================================================================

Deno.test({
  name: "renderChangeForm: POST change with valid data redirects to changelist",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const post = await PostModel.objects.create({
        title: "Original",
        priority: 1,
      });
      const id = String(post.id.get());

      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makePostRequest(
        `/admin/postmodel/${id}/`,
        { title: "Updated Title", body: "", priority: "2" },
        makeValidToken(),
      );
      const res = await renderChangeForm(
        { request: req, params: { id }, adminSite: site, backend },
        "postmodel",
        id,
      );
      assertEquals(res.status, 302);
      assertEquals(res.headers.get("Location"), "/admin/postmodel/");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeForm: POST change actually updates the object",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const post = await PostModel.objects.create({
        title: "Before Update",
        priority: 0,
      });
      const id = String(post.id.get());

      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makePostRequest(
        `/admin/postmodel/${id}/`,
        { title: "After Update", body: "", priority: "99" },
        makeValidToken(),
      );
      await renderChangeForm(
        { request: req, params: { id }, adminSite: site, backend },
        "postmodel",
        id,
      );

      const updated = await PostModel.objects.get({
        id: parseInt(id, 10),
      });
      assertEquals(updated.title.get(), "After Update");
      assertEquals(updated.priority.get(), 99);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// POST: Validation errors
// =============================================================================

Deno.test({
  name: "renderChangeForm: POST with missing required field returns 422",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      // title is required (no blank=true), so omit it
      const req = makePostRequest(
        "/admin/postmodel/add/",
        { body: "no title", priority: "0" },
        makeValidToken(),
      );
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
      );
      assertEquals(res.status, 422);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name:
    "renderChangeForm: POST validation error re-renders form with error message",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makePostRequest(
        "/admin/postmodel/add/",
        { body: "no title", priority: "0" },
        makeValidToken(),
      );
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "This field is required.");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeForm: POST with invalid integer returns 422",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makePostRequest(
        "/admin/postmodel/add/",
        { title: "Test", body: "", priority: "not-a-number" },
        makeValidToken(),
      );
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
      );
      assertEquals(res.status, 422);
      const html = await res.text();
      assertStringIncludes(html, "Enter a whole number.");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name:
    "renderChangeForm: POST validation re-renders with global error message",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(PostModel, ModelAdmin);
      const req = makePostRequest(
        "/admin/postmodel/add/",
        { body: "missing title", priority: "0" },
        makeValidToken(),
      );
      const res = await renderChangeForm(
        { request: req, params: {}, adminSite: site, backend },
        "postmodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "Please correct the errors below.");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// ForeignKey field support (#159)
// =============================================================================

class CategoryModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  static objects = new Manager(CategoryModel);
  static override meta = {
    dbTable: "cf_categories",
    verboseName: "Category",
    verboseNamePlural: "Categories",
  };
}

class ArticleModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  category = new ForeignKey<CategoryModel>("CategoryModel", {
    onDelete: OnDelete.CASCADE,
  });

  static objects = new Manager(ArticleModel);
  static override meta = {
    dbTable: "cf_articles",
    verboseName: "Article",
    verboseNamePlural: "Articles",
  };
}

Deno.test({
  name:
    "renderChangeForm: GET change form does not throw for model with ForeignKey field",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const category = await CategoryModel.objects.create({ name: "Tech" });
      const article = await ArticleModel.objects.create({
        title: "FK Article",
        category: category.id.get(),
      });
      const id = String(article.id.get());

      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      const req = makeGetRequest(
        `/admin/articlemodel/${id}/`,
        makeValidToken(),
      );
      const res = await renderChangeForm(
        { request: req, params: { id }, adminSite: site, backend },
        "articlemodel",
        id,
      );
      // Must render 200, not 404 (which was the symptom before the fix)
      assertEquals(res.status, 200);
      const html = await res.text();
      assertStringIncludes(html, "FK Article");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name:
    "renderChangeForm: GET change form pre-fills FK field with raw ID value",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const category = await CategoryModel.objects.create({ name: "Science" });
      const categoryId = category.id.get() as number;
      const article = await ArticleModel.objects.create({
        title: "Science Article",
        category: categoryId,
      });
      const id = String(article.id.get());

      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);
      const req = makeGetRequest(
        `/admin/articlemodel/${id}/`,
        makeValidToken(),
      );
      const res = await renderChangeForm(
        { request: req, params: { id }, adminSite: site, backend },
        "articlemodel",
        id,
      );
      const html = await res.text();
      // The FK widget renders a number input — it should contain the raw FK id
      assertStringIncludes(html, `value="${categoryId}"`);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});
