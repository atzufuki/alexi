/**
 * Tests for the Admin Change List view (#128)
 *
 * These tests cover:
 *  - Auth guard: unauthenticated requests redirect to /admin/login/
 *  - Authenticated requests return 200 with change list HTML
 *  - Unknown model name returns 404
 *  - Table headers rendered from listDisplay
 *  - Data rows rendered from backend
 *  - Search filtering
 *  - Pagination controls
 *  - Ordering toggle in column headers
 *  - Filters sidebar for BooleanField / choices
 *  - Bulk actions dropdown
 *  - "Add" button link
 *  - Link cells for listDisplayLinks
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { reset, setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { AutoField, BooleanField, CharField, Manager, Model } from "@alexi/db";
import { AdminSite } from "../site.ts";
import { ModelAdmin } from "../model_admin.ts";
import { renderChangeList } from "../views/changelist_views.ts";

// =============================================================================
// Test models
// =============================================================================

class ArticleModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  status = new CharField({
    maxLength: 20,
    default: "draft",
    choices: [
      ["draft", "Draft"],
      ["published", "Published"],
    ],
  });
  isActive = new BooleanField({ default: true });

  static objects = new Manager(ArticleModel);
  static override meta = {
    dbTable: "cl_articles",
    verboseName: "Article",
    verboseNamePlural: "Articles",
  };
}

// =============================================================================
// Helper: unsigned dev JWT (alg: none)
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

function makeRequest(path: string, token?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request(`http://localhost${path}`, { headers });
}

// =============================================================================
// Setup / teardown helpers
// =============================================================================

async function makeBackend() {
  const backend = new DenoKVBackend({ name: "cl_test", path: ":memory:" });
  await backend.connect();
  await setup({ backend });
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
  name: "renderChangeList: redirects to login when no token",
  async fn() {
    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);

      const req = makeRequest("/admin/articlemodel/");
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      assertEquals(res.status, 302);
      assertEquals(res.headers.get("Location"), "/admin/login/");
      assertEquals(res.headers.get("HX-Redirect"), "/admin/login/");
    } finally {
      await teardownBackend(backend);
    }
  },
});

// =============================================================================
// 404 for unknown model
// =============================================================================

Deno.test({
  name: "renderChangeList: returns 404 for unknown model name",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      const req = makeRequest("/admin/unknownmodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "unknownmodel",
      );
      assertEquals(res.status, 404);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Basic response
// =============================================================================

Deno.test({
  name: "renderChangeList: returns 200 HTML for authenticated request",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
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
  name: "renderChangeList: HTML contains model verbose name plural",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "Articles");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeList: HTML contains Add button link",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "/admin/articlemodel/add/");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeList: HTML contains HTMX and admin.js",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "htmx.org");
      assertStringIncludes(html, "admin.js");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Data rows
// =============================================================================

Deno.test({
  name: "renderChangeList: renders data rows from backend",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      await ArticleModel.objects.create({
        title: "Hello World",
        status: "draft",
      });
      await ArticleModel.objects.create({
        title: "Second Article",
        status: "published",
      });

      const site = makeSite();

      class ArticleAdmin extends ModelAdmin {
        override listDisplay = ["id", "title", "status"];
      }
      site.register(ArticleModel, ArticleAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "Hello World");
      assertStringIncludes(html, "Second Article");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeList: shows empty message when no objects",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();
      site.register(ArticleModel, ModelAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "0 articles");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Column headers
// =============================================================================

Deno.test({
  name: "renderChangeList: renders listDisplay column headers",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();

      class ArticleAdmin extends ModelAdmin {
        override listDisplay = ["id", "title", "status"];
      }
      site.register(ArticleModel, ArticleAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      // Headers should include humanized column names
      assertStringIncludes(html, "Title");
      assertStringIncludes(html, "Status");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeList: column header links include ordering param",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();

      class ArticleAdmin extends ModelAdmin {
        override listDisplay = ["id", "title"];
      }
      site.register(ArticleModel, ArticleAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "?o=title");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name:
    "renderChangeList: active ordering column shows arrow and toggle to desc",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();

      class ArticleAdmin extends ModelAdmin {
        override listDisplay = ["id", "title"];
      }
      site.register(ArticleModel, ArticleAdmin);

      // Request with o=title (ascending)
      const req = makeRequest("/admin/articlemodel/?o=title", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      // Ascending arrow
      assertStringIncludes(html, "▴");
      // Clicking again should toggle to descending
      assertStringIncludes(html, "?o=-title");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Search
// =============================================================================

Deno.test({
  name: "renderChangeList: search bar rendered when searchFields configured",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();

      class ArticleAdmin extends ModelAdmin {
        override searchFields = ["title"];
      }
      site.register(ArticleModel, ArticleAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, 'name="q"');
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeList: search filters results in-memory",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      await ArticleModel.objects.create({
        title: "Alpha Article",
        status: "draft",
      });
      await ArticleModel.objects.create({
        title: "Beta Post",
        status: "draft",
      });

      const site = makeSite();

      class ArticleAdmin extends ModelAdmin {
        override listDisplay = ["id", "title"];
        override searchFields = ["title"];
      }
      site.register(ArticleModel, ArticleAdmin);

      const req = makeRequest(
        "/admin/articlemodel/?q=alpha",
        makeValidToken(),
      );
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "Alpha Article");
      // Beta should NOT appear
      assertEquals(html.includes("Beta Post"), false);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Filters sidebar
// =============================================================================

Deno.test({
  name:
    "renderChangeList: filters sidebar rendered for BooleanField in listFilter",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();

      class ArticleAdmin extends ModelAdmin {
        override listFilter = ["isActive"];
      }
      site.register(ArticleModel, ArticleAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "By Is Active");
      assertStringIncludes(html, "isActive=true");
      assertStringIncludes(html, "isActive=false");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name:
    "renderChangeList: filters sidebar rendered for choices field in listFilter",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();

      class ArticleAdmin extends ModelAdmin {
        override listFilter = ["status"];
      }
      site.register(ArticleModel, ArticleAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "By Status");
      assertStringIncludes(html, "status=draft");
      assertStringIncludes(html, "status=published");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Bulk actions
// =============================================================================

Deno.test({
  name:
    "renderChangeList: bulk actions dropdown rendered when actions configured",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const site = makeSite();

      class ArticleAdmin extends ModelAdmin {
        override getActions() {
          return [{ name: "delete_selected", label: "Delete selected" }];
        }
      }
      site.register(ArticleModel, ArticleAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, "delete_selected");
      assertStringIncludes(html, "Delete selected");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Pagination
// =============================================================================

Deno.test({
  name:
    "renderChangeList: pagination controls shown when total exceeds perPage",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      // Create more items than perPage (default 100) — use a small perPage admin
      for (let i = 0; i < 5; i++) {
        await ArticleModel.objects.create({
          title: `Article ${i}`,
          status: "draft",
        });
      }

      const site = makeSite();

      class SmallPageAdmin extends ModelAdmin {
        override listPerPage = 2;
        override listDisplay = ["id", "title"];
      }
      site.register(ArticleModel, SmallPageAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      // Should show page links
      assertStringIncludes(html, "admin-pagination");
      assertStringIncludes(html, "Next");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

Deno.test({
  name: "renderChangeList: page 2 shows correct slice of data",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      for (let i = 1; i <= 4; i++) {
        await ArticleModel.objects.create({
          title: `Article ${i}`,
          status: "draft",
        });
      }

      const site = makeSite();

      class SmallPageAdmin extends ModelAdmin {
        override listPerPage = 2;
        override listDisplay = ["id", "title"];
      }
      site.register(ArticleModel, SmallPageAdmin);

      const req = makeRequest("/admin/articlemodel/?p=2", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      // Page 2 should show "3–4 of 4"
      assertStringIncludes(html, "3–4 of 4");
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});

// =============================================================================
// Link cells
// =============================================================================

Deno.test({
  name: "renderChangeList: first listDisplay field is rendered as change link",
  async fn() {
    const originalKey = Deno.env.get("SECRET_KEY");
    if (originalKey) Deno.env.delete("SECRET_KEY");

    const backend = await makeBackend();
    try {
      const article = await ArticleModel.objects.create({
        title: "Linked Article",
        status: "draft",
      });
      const id = article.id.get();

      const site = makeSite();

      class ArticleAdmin extends ModelAdmin {
        override listDisplay = ["title", "status"];
      }
      site.register(ArticleModel, ArticleAdmin);

      const req = makeRequest("/admin/articlemodel/", makeValidToken());
      const res = await renderChangeList(
        { request: req, params: {}, adminSite: site, backend },
        "articlemodel",
      );
      const html = await res.text();
      assertStringIncludes(html, `/admin/articlemodel/${id}/`);
    } finally {
      await teardownBackend(backend);
      if (originalKey) Deno.env.set("SECRET_KEY", originalKey);
    }
  },
});
