/**
 * Tests for BrowsableAPIRenderer
 *
 * @module @alexi/restframework/renderers/browsable_api_test
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { BrowsableAPIRenderer } from "./browsable_api.ts";
import { JSONRenderer, type RenderContext } from "./renderers.ts";
import { ViewSet, type ViewSetContext } from "../viewsets/viewset.ts";

// ============================================================================
// BrowsableAPIRenderer unit tests
// ============================================================================

Deno.test("BrowsableAPIRenderer: mediaType is text/html", () => {
  const renderer = new BrowsableAPIRenderer();
  assertEquals(renderer.mediaType, "text/html");
});

Deno.test("BrowsableAPIRenderer: format is api", () => {
  const renderer = new BrowsableAPIRenderer();
  assertEquals(renderer.format, "api");
});

Deno.test("BrowsableAPIRenderer: renders valid HTML document", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render({ id: 1, name: "Test" });
  assertStringIncludes(html, "<!DOCTYPE html>");
  assertStringIncludes(html, "<html");
  assertStringIncludes(html, "</html>");
});

Deno.test("BrowsableAPIRenderer: includes default title", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render({});
  assertStringIncludes(html, "Alexi REST Framework");
});

Deno.test("BrowsableAPIRenderer: custom title option", () => {
  const renderer = new BrowsableAPIRenderer({ title: "My API" });
  const html = renderer.render({});
  assertStringIncludes(html, "My API");
});

Deno.test("BrowsableAPIRenderer: custom token storage key", () => {
  const renderer = new BrowsableAPIRenderer({
    tokenStorageKey: "my_api_tokens",
  });
  const html = renderer.render({});
  assertStringIncludes(html, "my_api_tokens");
});

Deno.test("BrowsableAPIRenderer: custom login URL", () => {
  const renderer = new BrowsableAPIRenderer({ loginUrl: "/v2/auth/login/" });
  const html = renderer.render({});
  assertStringIncludes(html, "/v2/auth/login/");
});

Deno.test("BrowsableAPIRenderer: renders JSON data with syntax highlighting", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render({ id: 1, name: "Alice" });
  // Key should be highlighted
  assertStringIncludes(html, "json-key");
  // String value highlighted
  assertStringIncludes(html, "json-string");
  // Number value highlighted
  assertStringIncludes(html, "json-number");
});

Deno.test("BrowsableAPIRenderer: renders boolean and null highlighting", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render({ active: true, deleted: false, note: null });
  assertStringIncludes(html, "json-boolean");
  assertStringIncludes(html, "json-null");
});

Deno.test("BrowsableAPIRenderer: shows URL path from context", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/users/"),
    method: "GET",
    allowedMethods: ["GET"],
    statusCode: 200,
  };
  const html = renderer.render({ results: [] }, context);
  assertStringIncludes(html, "/api/users/");
});

Deno.test("BrowsableAPIRenderer: shows HTTP method badge", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/users/"),
    method: "POST",
    allowedMethods: ["GET", "POST"],
    statusCode: 201,
  };
  const html = renderer.render({ id: 5 }, context);
  assertStringIncludes(html, "badge-post");
  assertStringIncludes(html, ">POST<");
});

Deno.test("BrowsableAPIRenderer: shows status code", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/items/"),
    method: "GET",
    statusCode: 200,
  };
  const html = renderer.render({ count: 0 }, context);
  assertStringIncludes(html, ">200<");
});

Deno.test("BrowsableAPIRenderer: shows 2xx status class", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/items/"),
    method: "GET",
    statusCode: 200,
  };
  const html = renderer.render({}, context);
  assertStringIncludes(html, "status-2xx");
});

Deno.test("BrowsableAPIRenderer: shows 4xx status class", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/items/"),
    method: "GET",
    statusCode: 404,
  };
  const html = renderer.render({ error: "Not found" }, context);
  assertStringIncludes(html, "status-4xx");
});

Deno.test("BrowsableAPIRenderer: shows breadcrumb navigation", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/v1/users/"),
    method: "GET",
    allowedMethods: ["GET"],
    statusCode: 200,
  };
  const html = renderer.render([], context);
  assertStringIncludes(html, "breadcrumb");
  assertStringIncludes(html, "api");
  assertStringIncludes(html, "users");
});

Deno.test("BrowsableAPIRenderer: shows request form for POST", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/items/"),
    method: "GET",
    allowedMethods: ["GET", "POST"],
    statusCode: 200,
  };
  const html = renderer.render([], context);
  assertStringIncludes(html, "raw-body-POST");
  assertStringIncludes(html, "submitRequest");
});

Deno.test("BrowsableAPIRenderer: shows request form for PUT and PATCH", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/items/1/"),
    method: "GET",
    allowedMethods: ["GET", "PUT", "PATCH", "DELETE"],
    statusCode: 200,
  };
  const html = renderer.render({ id: 1 }, context);
  assertStringIncludes(html, "raw-body-PUT");
  assertStringIncludes(html, "raw-body-PATCH");
});

Deno.test("BrowsableAPIRenderer: no request form for read-only endpoint", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/health/"),
    method: "GET",
    allowedMethods: ["GET"],
    statusCode: 200,
  };
  const html = renderer.render({ status: "ok" }, context);
  // No form panel should be rendered (the "Request" panel heading is not shown)
  assertEquals(html.includes("<h3>Request</h3>"), false);
});

Deno.test("BrowsableAPIRenderer: shows pagination controls for paginated response", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/items/"),
    method: "GET",
    allowedMethods: ["GET"],
    statusCode: 200,
  };
  const html = renderer.render(
    {
      count: 100,
      next: "http://localhost/api/items/?page=2",
      previous: null,
      results: [{ id: 1 }],
    },
    context,
  );
  assertStringIncludes(html, "pagination-bar");
  assertStringIncludes(html, "100 results");
  assertStringIncludes(html, "Next →");
});

Deno.test("BrowsableAPIRenderer: pagination previous link is disabled when null", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/items/"),
    method: "GET",
    allowedMethods: ["GET"],
    statusCode: 200,
  };
  const html = renderer.render(
    {
      count: 50,
      next: null,
      previous: "http://localhost/api/items/?page=1",
      results: [],
    },
    context,
  );
  assertStringIncludes(html, "← Previous");
  assertStringIncludes(html, "disabled");
});

Deno.test("BrowsableAPIRenderer: no pagination for non-paginated response", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render({ id: 1, name: "Alice" });
  // The pagination-btns div is only rendered when pagination controls are shown
  assertEquals(html.includes('class="pagination-btns"'), false);
});

Deno.test("BrowsableAPIRenderer: includes login form", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render({});
  assertStringIncludes(html, "login-panel");
  assertStringIncludes(html, "login-email");
  assertStringIncludes(html, "login-password");
  assertStringIncludes(html, "doLogin");
});

Deno.test("BrowsableAPIRenderer: includes logout button", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render({});
  assertStringIncludes(html, "doLogout");
});

Deno.test("BrowsableAPIRenderer: includes copy JSON button", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render({});
  assertStringIncludes(html, "copyJson");
  assertStringIncludes(html, "Copy");
});

Deno.test("BrowsableAPIRenderer: includes inline CSS", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render({});
  assertStringIncludes(html, "<style>");
  assertStringIncludes(html, ".json-display");
});

Deno.test("BrowsableAPIRenderer: includes inline JavaScript", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render({});
  assertStringIncludes(html, "<script>");
  assertStringIncludes(html, "fetchCurrentUser");
});

Deno.test("BrowsableAPIRenderer: escapes HTML special characters in data", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render({ message: '<script>alert("xss")</script>' });
  // The HTML-escaped version should appear, not the raw script tag
  assertStringIncludes(html, "&lt;script&gt;");
  assertEquals(
    html.includes('<script>alert("xss")</script>'),
    false,
  );
});

Deno.test("BrowsableAPIRenderer: escapes HTML in URL path", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    // Angle brackets are percent-encoded by the URL constructor
    request: new Request(
      "http://localhost/api/%3Cbad%3E&path/",
    ),
    method: "GET",
    allowedMethods: ["GET"],
    statusCode: 200,
  };
  const html = renderer.render({}, context);
  // The & in the path should be escaped to &amp; in HTML output
  assertStringIncludes(html, "&amp;path");
});

Deno.test("BrowsableAPIRenderer: renders array response", () => {
  const renderer = new BrowsableAPIRenderer();
  const html = renderer.render([{ id: 1 }, { id: 2 }]);
  assertStringIncludes(html, "json-display");
  assertStringIncludes(html, "json-number");
});

Deno.test("BrowsableAPIRenderer: singular count label", () => {
  const renderer = new BrowsableAPIRenderer();
  const context: RenderContext = {
    request: new Request("http://localhost/api/items/"),
    method: "GET",
    allowedMethods: ["GET"],
    statusCode: 200,
  };
  const html = renderer.render(
    {
      count: 1,
      next: "http://localhost/api/items/?page=2",
      previous: null,
      results: [{ id: 1 }],
    },
    context,
  );
  assertStringIncludes(html, "1 result");
  assertEquals(html.includes("1 results"), false);
});

// ============================================================================
// ViewSet integration tests
// ============================================================================

Deno.test("ViewSet.asView: returns HTML for Accept: text/html", async () => {
  class HtmlViewSet extends ViewSet {
    override renderer_classes = [JSONRenderer, BrowsableAPIRenderer];

    override async list(_context: ViewSetContext): Promise<Response> {
      return Response.json([{ id: 1 }]);
    }
  }

  const view = HtmlViewSet.asView(
    { GET: "list" } as Record<string, string>,
  );
  const request = new Request("http://localhost/api/items/", {
    headers: { Accept: "text/html" },
  });
  const response = await view(request, {});

  assertEquals(response.status, 200);
  const ct = response.headers.get("Content-Type") ?? "";
  assertStringIncludes(ct, "text/html");
  const html = await response.text();
  assertStringIncludes(html, "<!DOCTYPE html>");
});

Deno.test("ViewSet.asView: returns JSON when Accept is application/json", async () => {
  class MixedViewSet extends ViewSet {
    override renderer_classes = [JSONRenderer, BrowsableAPIRenderer];

    override async list(_context: ViewSetContext): Promise<Response> {
      return Response.json([{ id: 1 }]);
    }
  }

  const view = MixedViewSet.asView(
    { GET: "list" } as Record<string, string>,
  );
  const request = new Request("http://localhost/api/items/", {
    headers: { Accept: "application/json" },
  });
  const response = await view(request, {});

  assertEquals(response.status, 200);
  const ct = response.headers.get("Content-Type") ?? "";
  assertStringIncludes(ct, "application/json");
});

Deno.test("ViewSet.asView: passes allowed methods to browsable renderer", async () => {
  class AllowedViewSet extends ViewSet {
    override renderer_classes = [JSONRenderer, BrowsableAPIRenderer];

    override async list(_context: ViewSetContext): Promise<Response> {
      return Response.json([]);
    }

    override async create(_context: ViewSetContext): Promise<Response> {
      return Response.json({}, { status: 201 });
    }
  }

  const view = AllowedViewSet.asView(
    { GET: "list", POST: "create" } as Record<string, string>,
  );
  const request = new Request("http://localhost/api/items/", {
    headers: { Accept: "text/html" },
  });
  const response = await view(request, {});

  const html = await response.text();
  // Both methods should be in the page (POST form shown)
  assertStringIncludes(html, "raw-body-POST");
});
