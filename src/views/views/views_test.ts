/**
 * Tests for Alexi class-based views.
 *
 * Covers: View dispatch, TemplateView, RedirectView, ListView, DetailView.
 *
 * ORM-backed tests (ListView, DetailView) use DenoKVBackend with :memory:.
 */

import {
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "jsr:@std/assert@1";

import { AutoField, CharField, IntegerField, Manager, Model } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { registerBackend, reset } from "../../db/setup.ts";

import {
  ContextMixin,
  DetailView,
  ListView,
  RedirectView,
  TemplateResponseMixin,
  TemplateView,
  View,
} from "./mod.ts";
import { MemoryTemplateLoader, templateRegistry } from "../engine/mod.ts";

// =============================================================================
// Helpers
// =============================================================================

function makeRequest(
  url = "http://localhost/",
  method = "GET",
): Request {
  // Ensure absolute URL (Deno's Request requires it)
  const absUrl = url.startsWith("http") ? url : `http://localhost${url}`;
  return new Request(absUrl, { method });
}

// =============================================================================
// Test Model
// =============================================================================

class NoteModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  priority = new IntegerField({ default: 0 });

  static objects = new Manager(NoteModel);
  static override meta = { dbTable: "notes" };
}

// =============================================================================
// View — base dispatch
// =============================================================================

Deno.test("View: GET dispatches to get()", async () => {
  class MyView extends View {
    get(_req: Request, _params: Record<string, string>): Response {
      return new Response("hello", { status: 200 });
    }
  }

  const handler = MyView.as_view();
  const res = await handler(makeRequest(), {});
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "hello");
});

Deno.test("View: unknown method returns 405", async () => {
  class MyView extends View {
    get(_req: Request, _params: Record<string, string>): Response {
      return new Response("ok");
    }
  }

  const handler = MyView.as_view();
  const res = await handler(makeRequest("/", "POST"), {});
  assertEquals(res.status, 405);
});

Deno.test("View: as_view() applies initkwargs", async () => {
  class MyView extends View {
    message = "default";

    get(_req: Request, _params: Record<string, string>): Response {
      return new Response(this.message);
    }
  }

  const handler = MyView.as_view({ message: "overridden" });
  const res = await handler(makeRequest(), {});
  assertEquals(await res.text(), "overridden");
});

Deno.test("View: OPTIONS returns Allow header", async () => {
  class MyView extends View {
    get(_req: Request, _params: Record<string, string>): Response {
      return new Response("ok");
    }
  }

  const handler = MyView.as_view();
  const res = await handler(makeRequest("/", "OPTIONS"), {});
  assertEquals(res.status, 200);
  assertStringIncludes(res.headers.get("Allow") ?? "", "GET");
  assertStringIncludes(res.headers.get("Allow") ?? "", "OPTIONS");
});

Deno.test("View: fresh instance per request (no shared state)", async () => {
  let callCount = 0;

  class CountingView extends View {
    count = 0;

    get(_req: Request, _params: Record<string, string>): Response {
      callCount++;
      this.count++;
      return new Response(String(this.count));
    }
  }

  const handler = CountingView.as_view();
  const r1 = await handler(makeRequest(), {});
  const r2 = await handler(makeRequest(), {});
  // Each call gets a fresh instance, so count is always 1
  assertEquals(await r1.text(), "1");
  assertEquals(await r2.text(), "1");
  assertEquals(callCount, 2);
});

// =============================================================================
// ContextMixin
// =============================================================================

Deno.test("ContextMixin: getContextData returns empty object by default", async () => {
  const mixin = new ContextMixin();
  const ctx = await mixin.getContextData(makeRequest(), {});
  assertEquals(ctx, {});
});

Deno.test("ContextMixin: getContextData merges extra", async () => {
  const mixin = new ContextMixin();
  const ctx = await mixin.getContextData(makeRequest(), {}, {
    foo: "bar",
  });
  assertEquals(ctx, { foo: "bar" });
});

// =============================================================================
// TemplateResponseMixin
// =============================================================================

Deno.test("TemplateResponseMixin: getTemplateName throws without templateName", () => {
  const mixin = new TemplateResponseMixin();
  let threw = false;
  try {
    mixin.getTemplateName();
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("TemplateResponseMixin: getTemplateName returns templateName", () => {
  const mixin = new TemplateResponseMixin();
  mixin.templateName = "myapp/index.html";
  assertEquals(mixin.getTemplateName(), "myapp/index.html");
});

// =============================================================================
// TemplateView
// =============================================================================

Deno.test("TemplateView: renders template", async () => {
  const loader = new MemoryTemplateLoader();
  loader.register("test/hello.html", "<p>Hello {{ name }}</p>");

  class HelloView extends TemplateView {
    override templateName = "test/hello.html";
    override templateLoader = loader;

    override async getContextData(
      request: Request,
      params: Record<string, string>,
    ) {
      return {
        ...(await super.getContextData(request, params)),
        name: "World",
      };
    }
  }

  const handler = HelloView.as_view();
  const res = await handler(makeRequest(), {});
  assertEquals(res.status, 200);
  assertStringIncludes(await res.text(), "Hello World");
  assertStringIncludes(
    res.headers.get("Content-Type") ?? "",
    "text/html",
  );
});

Deno.test("TemplateView: as_view with templateName initkwarg", async () => {
  const loader = new MemoryTemplateLoader();
  loader.register("test/simple.html", "<h1>Simple</h1>");

  // Temporarily set in registry for this test
  templateRegistry.register("test/simple.html", "<h1>Simple</h1>");

  const handler = TemplateView.as_view({ templateName: "test/simple.html" });
  const res = await handler(makeRequest(), {});
  assertEquals(res.status, 200);
  assertStringIncludes(await res.text(), "Simple");
});

Deno.test("TemplateView: 500 for missing template", async () => {
  class MissingView extends TemplateView {
    override templateName = "does/not/exist.html";
  }

  const handler = MissingView.as_view();
  const res = await handler(makeRequest(), {});
  assertEquals(res.status, 500);
});

// =============================================================================
// RedirectView
// =============================================================================

Deno.test("RedirectView: temporary redirect (302)", async () => {
  const handler = RedirectView.as_view({ url: "/new/" });
  const res = await handler(makeRequest(), {});
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("Location"), "/new/");
});

Deno.test("RedirectView: permanent redirect (301)", async () => {
  const handler = RedirectView.as_view({ url: "/new/", permanent: true });
  const res = await handler(makeRequest(), {});
  assertEquals(res.status, 301);
});

Deno.test("RedirectView: substitutes URL params", async () => {
  const handler = RedirectView.as_view({ url: "/users/:username/profile/" });
  const res = await handler(makeRequest(), { username: "alice" });
  assertEquals(res.headers.get("Location"), "/users/alice/profile/");
});

Deno.test("RedirectView: forwards query string", async () => {
  const handler = RedirectView.as_view({
    url: "/new/",
    queryStringForward: true,
  });
  const res = await handler(makeRequest("http://localhost/old/?foo=bar"), {});
  assertEquals(res.headers.get("Location"), "/new/?foo=bar");
});

Deno.test("RedirectView: does not forward query string when disabled", async () => {
  const handler = RedirectView.as_view({
    url: "/new/",
    queryStringForward: false,
  });
  const res = await handler(makeRequest("http://localhost/old/?foo=bar"), {});
  assertEquals(res.headers.get("Location"), "/new/");
});

Deno.test("RedirectView: 410 when url is null and getRedirectUrl returns null", async () => {
  class NullRedirect extends RedirectView {
    override getRedirectUrl() {
      return null;
    }
  }

  const handler = NullRedirect.as_view();
  const res = await handler(makeRequest(), {});
  assertEquals(res.status, 410);
});

Deno.test("RedirectView: dynamic override via getRedirectUrl", async () => {
  class DynamicRedirect extends RedirectView {
    override getRedirectUrl(
      _req: Request,
      params: Record<string, string>,
    ): string {
      return `/profile/${params.id}/`;
    }
  }

  const handler = DynamicRedirect.as_view();
  const res = await handler(makeRequest(), { id: "42" });
  assertEquals(res.headers.get("Location"), "/profile/42/");
});

// =============================================================================
// ListView
// =============================================================================

Deno.test({
  name: "ListView: renders object_list in template",
  async fn() {
    const backend = new DenoKVBackend({ name: "test_list", path: ":memory:" });
    await backend.connect();
    registerBackend("default", backend);

    try {
      await NoteModel.objects.create({ title: "Note A", priority: 1 });
      await NoteModel.objects.create({ title: "Note B", priority: 2 });

      const loader = new MemoryTemplateLoader();
      loader.register(
        "test/note_list.html",
        "{% for note in object_list %}{{ note.title }}{% endfor %}",
      );

      class NoteListView extends ListView<NoteModel> {
        override model = NoteModel;
        override templateName = "test/note_list.html";
        override templateLoader = loader;
      }

      const handler = NoteListView.as_view();
      const res = await handler(makeRequest(), {});
      assertEquals(res.status, 200);
      const body = await res.text();
      assertStringIncludes(body, "Note A");
      assertStringIncludes(body, "Note B");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ListView: paginates object_list",
  async fn() {
    const backend = new DenoKVBackend({
      name: "test_list_page",
      path: ":memory:",
    });
    await backend.connect();
    registerBackend("default", backend);

    try {
      for (let i = 1; i <= 5; i++) {
        await NoteModel.objects.create({ title: `Note ${i}`, priority: i });
      }

      const loader = new MemoryTemplateLoader();
      loader.register(
        "test/note_page.html",
        "count:{{ page_obj.count }} page:{{ page_obj.number }} pages:{{ page_obj.numPages }}",
      );

      class PagedListView extends ListView<NoteModel> {
        override model = NoteModel;
        override templateName = "test/note_page.html";
        override templateLoader = loader;
        override paginateBy = 2;
      }

      const handler = PagedListView.as_view();
      // Page 1
      const res1 = await handler(makeRequest("http://localhost/?page=1"), {});
      const body1 = await res1.text();
      assertStringIncludes(body1, "count:5");
      assertStringIncludes(body1, "page:1");
      assertStringIncludes(body1, "pages:3");

      // Page 2
      const res2 = await handler(makeRequest("http://localhost/?page=2"), {});
      assertStringIncludes(await res2.text(), "page:2");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ListView: custom queryset via getQueryset()",
  async fn() {
    const backend = new DenoKVBackend({
      name: "test_list_qs",
      path: ":memory:",
    });
    await backend.connect();
    registerBackend("default", backend);

    try {
      await NoteModel.objects.create({ title: "Low", priority: 1 });
      await NoteModel.objects.create({ title: "High", priority: 10 });

      const loader = new MemoryTemplateLoader();
      loader.register(
        "test/note_filtered.html",
        "{% for note in object_list %}{{ note.title }}{% endfor %}",
      );

      class HighPriorityListView extends ListView<NoteModel> {
        override model = NoteModel;
        override templateName = "test/note_filtered.html";
        override templateLoader = loader;

        override getQueryset() {
          return NoteModel.objects.filter({ priority__gte: 5 });
        }
      }

      const handler = HighPriorityListView.as_view();
      const res = await handler(makeRequest(), {});
      const body = await res.text();
      assertStringIncludes(body, "High");
      assertEquals(body.includes("Low"), false);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

// =============================================================================
// DetailView
// =============================================================================

Deno.test({
  name: "DetailView: renders single object by id",
  async fn() {
    const backend = new DenoKVBackend({
      name: "test_detail",
      path: ":memory:",
    });
    await backend.connect();
    registerBackend("default", backend);

    try {
      const note = await NoteModel.objects.create({
        title: "My Note",
        priority: 5,
      });
      const noteId = String(note.id.get());

      const loader = new MemoryTemplateLoader();
      loader.register("test/note_detail.html", "{{ object.title }}");

      class NoteDetailView extends DetailView<NoteModel> {
        override model = NoteModel;
        override templateName = "test/note_detail.html";
        override templateLoader = loader;
      }

      const handler = NoteDetailView.as_view();
      const res = await handler(makeRequest(), { id: noteId });
      assertEquals(res.status, 200);
      assertStringIncludes(await res.text(), "My Note");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "DetailView: 404 for missing object",
  async fn() {
    const backend = new DenoKVBackend({
      name: "test_detail_404",
      path: ":memory:",
    });
    await backend.connect();
    registerBackend("default", backend);

    try {
      const loader = new MemoryTemplateLoader();
      loader.register("test/note_detail.html", "{{ object.title }}");

      class NoteDetailView extends DetailView<NoteModel> {
        override model = NoteModel;
        override templateName = "test/note_detail.html";
        override templateLoader = loader;
      }

      const handler = NoteDetailView.as_view();
      const res = await handler(makeRequest(), { id: "9999" });
      assertEquals(res.status, 404);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "DetailView: adds model-name convenience context key",
  async fn() {
    const backend = new DenoKVBackend({
      name: "test_detail_ctx",
      path: ":memory:",
    });
    await backend.connect();
    registerBackend("default", backend);

    try {
      const note = await NoteModel.objects.create({
        title: "Context Note",
        priority: 1,
      });
      const noteId = String(note.id.get());

      const loader = new MemoryTemplateLoader();
      // Access via model-name key "note" (NoteModel → note)
      loader.register("test/note_ctx.html", "{{ note.title }}");

      class NoteDetailView extends DetailView<NoteModel> {
        override model = NoteModel;
        override templateName = "test/note_ctx.html";
        override templateLoader = loader;
      }

      const handler = NoteDetailView.as_view();
      const res = await handler(makeRequest(), { id: noteId });
      assertEquals(res.status, 200);
      assertStringIncludes(await res.text(), "Context Note");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});
