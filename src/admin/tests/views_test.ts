/**
 * HTTP integration tests for Alexi Admin MPA (#133)
 *
 * These tests use AdminRouter.handle() as the HTTP entry point, exercising
 * the full request/response cycle through URL routing and view handlers.
 *
 * Coverage:
 *  - GET /admin/login/ → 200 with login form
 *  - POST /admin/login/ with no AUTH_USER_MODEL → error in HTML
 *  - POST /admin/login/ with missing fields → error in HTML
 *  - GET /admin/ without auth → 302 redirect to login
 *  - GET /admin/ with valid JWT → 200 dashboard HTML
 *  - GET /admin/:model/ → 200 changelist HTML
 *  - GET /admin/:model/?q=search → filtered changelist
 *  - GET /admin/:model/?p=2 → paginated changelist
 *  - GET /admin/:model/add/ → 200 blank add form
 *  - POST /admin/:model/add/ with valid data → creates object + HX-Redirect
 *  - POST /admin/:model/add/ with invalid data → 422 with validation errors
 *  - GET /admin/:model/:id/ → 200 pre-filled edit form
 *  - POST /admin/:model/:id/ with valid data → updates object + HX-Redirect
 *  - GET /admin/:model/:id/delete/ → 200 delete confirmation page
 *  - POST /admin/:model/:id/delete/ → deletes object + HX-Redirect
 *  - POST /admin/:model/ with action=delete_selected → bulk delete
 *  - GET /admin/static/css/admin.css → 200 CSS content
 *  - GET /admin/static/js/admin.js → 200 JS content
 *  - GET /admin/nonexistent/ → 404 Not Found
 *
 * @module
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { reset, setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import {
  AutoField,
  BooleanField,
  CharField,
  IntegerField,
  Manager,
  Model,
} from "@alexi/db";
import { AdminSite } from "../site.ts";
import { ModelAdmin } from "../model_admin.ts";
import { AdminRouter } from "../urls.ts";

// =============================================================================
// Test model
// =============================================================================

class NoteModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  body = new CharField({ maxLength: 1000, blank: true, default: "" });
  priority = new IntegerField({ default: 0 });
  isPublished = new BooleanField({ default: false });

  static objects = new Manager(NoteModel);
  static override meta = {
    dbTable: "vt_notes",
    verboseName: "Note",
    verboseNamePlural: "Notes",
  };
}

class NoteAdmin extends ModelAdmin {
  override listDisplay = ["id", "title", "priority", "isPublished"];
  override searchFields = ["title"];
  override listFilter = ["isPublished"];
  override listPerPage = 3;

  override getActions() {
    return [{ name: "delete_selected", label: "Delete selected" }];
  }
}

// =============================================================================
// JWT helper (unsigned dev token — works when no SECRET_KEY set)
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

function makeRequest(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: string;
    contentType?: string;
  } = {},
): Request {
  const headers: Record<string, string> = {};
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
  if (options.contentType) headers["Content-Type"] = options.contentType;
  return new Request(`http://localhost${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
  });
}

// =============================================================================
// Setup / teardown helpers
// =============================================================================

async function makeBackend(): Promise<DenoKVBackend> {
  const backend = new DenoKVBackend({ name: "vt_test", path: ":memory:" });
  await backend.connect();
  await setup({ backend });
  return backend;
}

async function teardownBackend(backend: DenoKVBackend): Promise<void> {
  await reset();
  await backend.disconnect();
}

function makeSiteAndRouter(
  backend: DenoKVBackend,
  settings: Record<string, unknown> = {},
): { site: AdminSite; router: AdminRouter } {
  const site = new AdminSite({ title: "Test Admin", urlPrefix: "/admin" });
  site.register(NoteModel, NoteAdmin);
  const router = new AdminRouter(site, backend, settings);
  return { site, router };
}

// =============================================================================
// Static file serving
// =============================================================================

Deno.test({
  name: "GET /admin/static/css/admin.css → 200 with CSS content",
  async fn() {
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/static/css/admin.css");
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("Content-Type"), "text/css; charset=utf-8");
      const text = await res.text();
      // Admin CSS should have some content
      assertStringIncludes(text, "{");
    } finally {
      await teardownBackend(backend);
    }
  },
});

Deno.test({
  name: "GET /admin/static/js/admin.js → 200 with JS content",
  async fn() {
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/static/js/admin.js");
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      assertEquals(
        res.headers.get("Content-Type"),
        "application/javascript; charset=utf-8",
      );
      const text = await res.text();
      assertStringIncludes(text, "adminToken");
    } finally {
      await teardownBackend(backend);
    }
  },
});

Deno.test({
  name: "GET /admin/static/css/unknown.css → 404",
  async fn() {
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/static/css/unknown.css");
      const res = await router.handle(req);
      assertEquals(res.status, 404);
    } finally {
      await teardownBackend(backend);
    }
  },
});

// =============================================================================
// Login page
// =============================================================================

Deno.test({
  name: "GET /admin/login/ → 200 with login form",
  async fn() {
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/login/");
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      assertEquals(
        res.headers.get("Content-Type"),
        "text/html; charset=utf-8",
      );
      const html = await res.text();
      assertStringIncludes(html, "/admin/login/");
      assertStringIncludes(html, 'type="email"');
      assertStringIncludes(html, 'type="password"');
    } finally {
      await teardownBackend(backend);
    }
  },
});

Deno.test({
  name:
    "POST /admin/login/ without AUTH_USER_MODEL → error 'Authentication is not configured'",
  async fn() {
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend, {}); // no AUTH_USER_MODEL
      const req = makeRequest("/admin/login/", {
        method: "POST",
        body: "email=admin%40example.com&password=secret",
        contentType: "application/x-www-form-urlencoded",
      });
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      const html = await res.text();
      assertStringIncludes(html, "Authentication is not configured");
    } finally {
      await teardownBackend(backend);
    }
  },
});

Deno.test({
  name: "POST /admin/login/ with missing password → error about missing fields",
  async fn() {
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend, {
        AUTH_USER_MODEL: "/nonexistent/user.ts",
      });
      const req = makeRequest("/admin/login/", {
        method: "POST",
        body: "email=admin%40example.com",
        contentType: "application/x-www-form-urlencoded",
      });
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      const html = await res.text();
      assertStringIncludes(html, "Please enter both email and password");
    } finally {
      await teardownBackend(backend);
    }
  },
});

Deno.test({
  name: "POST /admin/login/ with invalid module path → config error",
  async fn() {
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend, {
        AUTH_USER_MODEL: "/nonexistent/user.ts",
      });
      const req = makeRequest("/admin/login/", {
        method: "POST",
        body: "email=admin%40example.com&password=wrong",
        contentType: "application/x-www-form-urlencoded",
      });
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      const html = await res.text();
      assertStringIncludes(html, "Authentication configuration error");
    } finally {
      await teardownBackend(backend);
    }
  },
});

// =============================================================================
// Logout
// =============================================================================

Deno.test({
  name: "GET /admin/logout/ → 200 with HX-Redirect to login",
  async fn() {
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const token = makeValidToken();
      const req = makeRequest("/admin/logout/", { token });
      const originalKey = Deno.env.get("SECRET_KEY");
      if (originalKey) Deno.env.delete("SECRET_KEY");
      try {
        const res = await router.handle(req);
        assertEquals(res.status, 200);
        assertEquals(res.headers.get("HX-Redirect"), "/admin/login/");
        const html = await res.text();
        assertStringIncludes(html, "removeItem");
        assertStringIncludes(html, "adminToken");
      } finally {
        if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
      }
    } finally {
      await teardownBackend(backend);
    }
  },
});

// =============================================================================
// Dashboard
// =============================================================================

Deno.test({
  name: "GET /admin/ without auth → 302 redirect to login",
  async fn() {
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/");
      const res = await router.handle(req);
      assertEquals(res.status, 302);
      assertEquals(res.headers.get("Location"), "/admin/login/");
    } finally {
      await teardownBackend(backend);
    }
  },
});

Deno.test({
  name: "GET /admin/ with valid JWT → 200 dashboard HTML",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/", { token: makeValidToken() });
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      assertEquals(
        res.headers.get("Content-Type"),
        "text/html; charset=utf-8",
      );
      const html = await res.text();
      assertStringIncludes(html, "Site administration");
      assertStringIncludes(html, "admin@example.com");
      assertStringIncludes(html, "/admin/notemodel/");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Change list
// =============================================================================

Deno.test({
  name: "GET /admin/notemodel/ without auth → 302 redirect to login",
  async fn() {
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/notemodel/");
      const res = await router.handle(req);
      assertEquals(res.status, 302);
      assertEquals(res.headers.get("Location"), "/admin/login/");
    } finally {
      await teardownBackend(backend);
    }
  },
});

Deno.test({
  name: "GET /admin/notemodel/ with valid JWT → 200 changelist HTML",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/notemodel/", {
        token: makeValidToken(),
      });
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      const html = await res.text();
      assertStringIncludes(html, "Notes");
      assertStringIncludes(html, "/admin/notemodel/add/");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "GET /admin/notemodel/?q=hello → search filters results",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      await NoteModel.objects.create({ title: "Hello World", priority: 1 });
      await NoteModel.objects.create({ title: "Goodbye World", priority: 2 });

      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/notemodel/?q=Hello", {
        token: makeValidToken(),
      });
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      const html = await res.text();
      assertStringIncludes(html, "Hello World");
      assertEquals(html.includes("Goodbye World"), false);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "GET /admin/notemodel/?p=2 → paginated results",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      for (let i = 1; i <= 5; i++) {
        await NoteModel.objects.create({ title: `Note ${i}`, priority: i });
      }

      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/notemodel/?p=2", {
        token: makeValidToken(),
      });
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      const html = await res.text();
      // Page 2 with perPage=3 shows items 4–5
      assertStringIncludes(html, "4–5 of 5");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "GET /admin/unknownmodel/ → 404 Not Found",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/unknownmodel/", {
        token: makeValidToken(),
      });
      const res = await router.handle(req);
      assertEquals(res.status, 404);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Add form (GET)
// =============================================================================

Deno.test({
  name: "GET /admin/notemodel/add/ → 200 blank add form",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/notemodel/add/", {
        token: makeValidToken(),
      });
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      const html = await res.text();
      assertStringIncludes(html, "Add Note");
      assertStringIncludes(html, 'name="title"');
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Add form (POST)
// =============================================================================

Deno.test({
  name:
    "POST /admin/notemodel/add/ with valid data → creates object + HX-Redirect",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/notemodel/add/", {
        method: "POST",
        token: makeValidToken(),
        body: "title=My+New+Note&body=Some+body+text&priority=5",
        contentType: "application/x-www-form-urlencoded",
      });
      const res = await router.handle(req);
      // Should redirect to changelist on success
      assertEquals(res.headers.get("HX-Redirect"), "/admin/notemodel/");
      // Verify object was created in backend
      const notes = await NoteModel.objects.all().fetch();
      assertEquals(notes.array().length, 1);
      assertEquals(notes.array()[0].title.get(), "My New Note");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name:
    "POST /admin/notemodel/add/ with missing required field → 422 with validation errors",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/notemodel/add/", {
        method: "POST",
        token: makeValidToken(),
        body: "title=&body=",
        contentType: "application/x-www-form-urlencoded",
      });
      const res = await router.handle(req);
      assertEquals(res.status, 422);
      const html = await res.text();
      assertStringIncludes(html, "required");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Change form (GET)
// =============================================================================

Deno.test({
  name: "GET /admin/notemodel/:id/ → 200 pre-filled edit form",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const note = await NoteModel.objects.create({
        title: "Existing Note",
        body: "Existing body",
        priority: 3,
      });
      const id = note.id.get();

      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest(`/admin/notemodel/${id}/`, {
        token: makeValidToken(),
      });
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      const html = await res.text();
      assertStringIncludes(html, "Existing Note");
      assertStringIncludes(html, "Existing body");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "GET /admin/notemodel/99999/ (non-existent) → 404",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/notemodel/99999/", {
        token: makeValidToken(),
      });
      const res = await router.handle(req);
      assertEquals(res.status, 404);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Change form (POST update)
// =============================================================================

Deno.test({
  name:
    "POST /admin/notemodel/:id/ with valid data → updates object + HX-Redirect",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const note = await NoteModel.objects.create({
        title: "Original Title",
        body: "",
        priority: 1,
      });
      const id = note.id.get();

      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest(`/admin/notemodel/${id}/`, {
        method: "POST",
        token: makeValidToken(),
        body: "title=Updated+Title&body=Updated+body&priority=9",
        contentType: "application/x-www-form-urlencoded",
      });
      const res = await router.handle(req);
      assertEquals(res.headers.get("HX-Redirect"), "/admin/notemodel/");

      // Verify the object was updated
      const updated = await NoteModel.objects.get({ id });
      assertEquals(updated.title.get(), "Updated Title");
      assertEquals(updated.priority.get(), 9);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Delete confirmation (GET)
// =============================================================================

Deno.test({
  name: "GET /admin/notemodel/:id/delete/ → 200 confirmation page",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const note = await NoteModel.objects.create({
        title: "To Be Deleted",
        priority: 1,
      });
      const id = note.id.get();

      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest(`/admin/notemodel/${id}/delete/`, {
        token: makeValidToken(),
      });
      const res = await router.handle(req);
      assertEquals(res.status, 200);
      const html = await res.text();
      assertStringIncludes(html, "To Be Deleted");
      assertStringIncludes(html, "delete");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Delete confirmation (POST)
// =============================================================================

Deno.test({
  name:
    "POST /admin/notemodel/:id/delete/ → deletes object + HX-Redirect to changelist",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const note = await NoteModel.objects.create({
        title: "Delete Me",
        priority: 1,
      });
      const id = note.id.get();

      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest(`/admin/notemodel/${id}/delete/`, {
        method: "POST",
        token: makeValidToken(),
        contentType: "application/x-www-form-urlencoded",
      });
      const res = await router.handle(req);
      assertEquals(res.headers.get("HX-Redirect"), "/admin/notemodel/");

      // Verify the object was removed
      const remaining = await NoteModel.objects.all().fetch();
      assertEquals(remaining.array().length, 0);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Bulk delete action
// =============================================================================

Deno.test({
  name:
    "POST /admin/notemodel/ with action=delete_selected → bulk deletes selected objects",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");
    const backend = await makeBackend();
    try {
      const n1 = await NoteModel.objects.create({
        title: "Note 1",
        priority: 1,
      });
      const n2 = await NoteModel.objects.create({
        title: "Note 2",
        priority: 2,
      });
      await NoteModel.objects.create({ title: "Note 3", priority: 3 });

      const id1 = n1.id.get();
      const id2 = n2.id.get();

      const { router } = makeSiteAndRouter(backend);
      const body =
        `action=delete_selected&_selected_action=${id1}&_selected_action=${id2}`;
      const req = makeRequest("/admin/notemodel/", {
        method: "POST",
        token: makeValidToken(),
        body,
        contentType: "application/x-www-form-urlencoded",
      });
      const res = await router.handle(req);
      // Should redirect back to changelist
      assertEquals(res.headers.get("HX-Redirect"), "/admin/notemodel/");

      // Verify only Note 3 remains
      const remaining = await NoteModel.objects.all().fetch();
      assertEquals(remaining.array().length, 1);
      assertEquals(remaining.array()[0].title.get(), "Note 3");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Unmatched URL
// =============================================================================

Deno.test({
  name: "GET /admin/totally/unknown/path → 404 Not Found",
  async fn() {
    const backend = await makeBackend();
    try {
      const { router } = makeSiteAndRouter(backend);
      const req = makeRequest("/admin/totally/unknown/path");
      const res = await router.handle(req);
      assertEquals(res.status, 404);
    } finally {
      await teardownBackend(backend);
    }
  },
});
