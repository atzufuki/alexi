/**
 * Tests for Content Negotiation and Renderers
 *
 * @module @alexi/restframework/renderers/renderers_test
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  CSVRenderer,
  JSONRenderer,
  parseAcceptHeader,
  renderResponse,
  selectRenderer,
  XMLRenderer,
} from "./renderers.ts";
import { ViewSet } from "../viewsets/viewset.ts";
import type { ViewSetContext } from "../viewsets/viewset.ts";

// ============================================================================
// Helpers
// ============================================================================

function makeRequest(
  url: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(url, { headers });
}

// ============================================================================
// JSONRenderer tests
// ============================================================================

Deno.test("JSONRenderer: renders object to JSON string", () => {
  const renderer = new JSONRenderer();
  const result = renderer.render({ id: 1, name: "Test" });
  assertEquals(result, '{"id":1,"name":"Test"}');
});

Deno.test("JSONRenderer: renders array", () => {
  const renderer = new JSONRenderer();
  const result = renderer.render([1, 2, 3]);
  assertEquals(result, "[1,2,3]");
});

Deno.test("JSONRenderer: mediaType is application/json", () => {
  const renderer = new JSONRenderer();
  assertEquals(renderer.mediaType, "application/json");
});

Deno.test("JSONRenderer: format is json", () => {
  const renderer = new JSONRenderer();
  assertEquals(renderer.format, "json");
});

Deno.test("JSONRenderer: getContentType includes charset", () => {
  const renderer = new JSONRenderer();
  assertEquals(renderer.getContentType(), "application/json; charset=utf-8");
});

// ============================================================================
// XMLRenderer tests
// ============================================================================

Deno.test("XMLRenderer: renders object to XML", () => {
  const renderer = new XMLRenderer();
  const result = renderer.render({ name: "Alice", age: 30 });
  assertExists(result);
  assertEquals(result.includes("<name>Alice</name>"), true);
  assertEquals(result.includes("<age>30</age>"), true);
  assertEquals(result.includes("<?xml"), true);
});

Deno.test("XMLRenderer: renders null value as self-closing tag", () => {
  const renderer = new XMLRenderer();
  const result = renderer.render({ value: null });
  assertEquals(result.includes("<value/>"), true);
});

Deno.test("XMLRenderer: renders array with item tags", () => {
  const renderer = new XMLRenderer();
  const result = renderer.render(["a", "b"]);
  assertEquals(result.includes("<item>a</item>"), true);
  assertEquals(result.includes("<item>b</item>"), true);
});

Deno.test("XMLRenderer: escapes special characters", () => {
  const renderer = new XMLRenderer();
  const result = renderer.render({ value: "<script>&</script>" });
  assertEquals(result.includes("&lt;script&gt;&amp;&lt;/script&gt;"), true);
});

Deno.test("XMLRenderer: mediaType is application/xml", () => {
  const renderer = new XMLRenderer();
  assertEquals(renderer.mediaType, "application/xml");
});

Deno.test("XMLRenderer: format is xml", () => {
  const renderer = new XMLRenderer();
  assertEquals(renderer.format, "xml");
});

// ============================================================================
// CSVRenderer tests
// ============================================================================

Deno.test("CSVRenderer: renders array of objects to CSV", () => {
  const renderer = new CSVRenderer();
  const result = renderer.render([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
  const lines = result.split("\n");
  assertEquals(lines[0], "id,name");
  assertEquals(lines[1], "1,Alice");
  assertEquals(lines[2], "2,Bob");
});

Deno.test("CSVRenderer: escapes values with commas", () => {
  const renderer = new CSVRenderer();
  const result = renderer.render([{ name: "Smith, John" }]);
  assertEquals(result.includes('"Smith, John"'), true);
});

Deno.test("CSVRenderer: escapes values with quotes", () => {
  const renderer = new CSVRenderer();
  const result = renderer.render([{ name: 'Say "hi"' }]);
  assertEquals(result.includes('"Say ""hi"""'), true);
});

Deno.test("CSVRenderer: handles empty array", () => {
  const renderer = new CSVRenderer();
  const result = renderer.render([]);
  assertEquals(result, "");
});

Deno.test("CSVRenderer: handles paginated response with results key", () => {
  const renderer = new CSVRenderer();
  const result = renderer.render({
    count: 2,
    results: [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ],
  });
  const lines = result.split("\n");
  assertEquals(lines[0], "id,name");
  assertEquals(lines[1], "1,Alice");
});

Deno.test("CSVRenderer: handles null values", () => {
  const renderer = new CSVRenderer();
  const result = renderer.render([{ id: 1, name: null }]);
  const lines = result.split("\n");
  assertEquals(lines[1], "1,");
});

Deno.test("CSVRenderer: mediaType is text/csv", () => {
  const renderer = new CSVRenderer();
  assertEquals(renderer.mediaType, "text/csv");
});

Deno.test("CSVRenderer: format is csv", () => {
  const renderer = new CSVRenderer();
  assertEquals(renderer.format, "csv");
});

// ============================================================================
// parseAcceptHeader tests
// ============================================================================

Deno.test("parseAcceptHeader: parses simple media type", () => {
  const result = parseAcceptHeader("application/json");
  assertEquals(result.length, 1);
  assertEquals(result[0].mediaType, "application/json");
  assertEquals(result[0].quality, 1.0);
});

Deno.test("parseAcceptHeader: parses multiple types with quality", () => {
  const result = parseAcceptHeader(
    "text/html, application/json;q=0.9, */*;q=0.8",
  );
  assertEquals(result.length, 3);
  assertEquals(result[0].mediaType, "text/html");
  assertEquals(result[0].quality, 1.0);
  assertEquals(result[1].mediaType, "application/json");
  assertEquals(result[1].quality, 0.9);
  assertEquals(result[2].mediaType, "*/*");
  assertEquals(result[2].quality, 0.8);
});

Deno.test("parseAcceptHeader: sorts by quality descending", () => {
  const result = parseAcceptHeader("text/csv;q=0.5, application/json;q=0.9");
  assertEquals(result[0].mediaType, "application/json");
  assertEquals(result[1].mediaType, "text/csv");
});

// ============================================================================
// selectRenderer tests
// ============================================================================

Deno.test("selectRenderer: selects first renderer for *//* Accept", () => {
  const renderers = [new JSONRenderer(), new XMLRenderer()];
  const request = makeRequest("http://localhost/api/", {
    "Accept": "*/*",
  });
  const result = selectRenderer(request, renderers);
  assertExists(result);
  assertEquals(result!.renderer instanceof JSONRenderer, true);
});

Deno.test("selectRenderer: selects by Accept header", () => {
  const renderers = [new JSONRenderer(), new XMLRenderer()];
  const request = makeRequest("http://localhost/api/", {
    "Accept": "application/xml",
  });
  const result = selectRenderer(request, renderers);
  assertExists(result);
  assertEquals(result!.renderer instanceof XMLRenderer, true);
  assertEquals(result!.mediaType, "application/xml");
});

Deno.test("selectRenderer: selects by ?format= query param", () => {
  const renderers = [new JSONRenderer(), new CSVRenderer()];
  const request = makeRequest("http://localhost/api/?format=csv");
  const result = selectRenderer(request, renderers);
  assertExists(result);
  assertEquals(result!.renderer instanceof CSVRenderer, true);
});

Deno.test("selectRenderer: ?format= takes precedence over Accept header", () => {
  const renderers = [new JSONRenderer(), new XMLRenderer(), new CSVRenderer()];
  const request = makeRequest("http://localhost/api/?format=csv", {
    "Accept": "application/xml",
  });
  const result = selectRenderer(request, renderers);
  assertExists(result);
  assertEquals(result!.renderer instanceof CSVRenderer, true);
});

Deno.test("selectRenderer: returns null for unsupported format", () => {
  const renderers = [new JSONRenderer()];
  const request = makeRequest("http://localhost/api/?format=csv");
  const result = selectRenderer(request, renderers);
  assertEquals(result, null);
});

Deno.test("selectRenderer: returns null for unsupported Accept type", () => {
  const renderers = [new JSONRenderer()];
  const request = makeRequest("http://localhost/api/", {
    "Accept": "text/csv",
  });
  const result = selectRenderer(request, renderers);
  assertEquals(result, null);
});

Deno.test("selectRenderer: returns first renderer when no Accept header", () => {
  const renderers = [new JSONRenderer(), new XMLRenderer()];
  const request = makeRequest("http://localhost/api/");
  const result = selectRenderer(request, renderers);
  assertExists(result);
  assertEquals(result!.renderer instanceof JSONRenderer, true);
});

Deno.test("selectRenderer: returns null for empty renderer list", () => {
  const request = makeRequest("http://localhost/api/");
  const result = selectRenderer(request, []);
  assertEquals(result, null);
});

Deno.test("selectRenderer: handles wildcard subtype in Accept", () => {
  const renderers = [new CSVRenderer()];
  const request = makeRequest("http://localhost/api/", {
    "Accept": "text/*",
  });
  const result = selectRenderer(request, renderers);
  assertExists(result);
  assertEquals(result!.renderer instanceof CSVRenderer, true);
});

// ============================================================================
// renderResponse tests
// ============================================================================

Deno.test("renderResponse: re-renders JSON response with XMLRenderer", async () => {
  const renderer = new XMLRenderer();
  const original = Response.json({ id: 1, name: "Test" });
  const result = await renderResponse(original, renderer);
  assertEquals(
    result.headers.get("Content-Type"),
    "application/xml; charset=utf-8",
  );
  const body = await result.text();
  assertEquals(body.includes("<name>Test</name>"), true);
});

Deno.test("renderResponse: preserves response status", async () => {
  const renderer = new JSONRenderer();
  const original = Response.json({ error: "Not found" }, { status: 404 });
  const result = await renderResponse(original, renderer);
  assertEquals(result.status, 404);
});

Deno.test("renderResponse: renders to CSV", async () => {
  const renderer = new CSVRenderer();
  const original = Response.json([{ id: 1, name: "Alice" }]);
  const result = await renderResponse(original, renderer);
  assertEquals(result.headers.get("Content-Type"), "text/csv; charset=utf-8");
  const body = await result.text();
  assertEquals(body.includes("id,name"), true);
  assertEquals(body.includes("1,Alice"), true);
});

// ============================================================================
// ViewSet integration tests
// ============================================================================

Deno.test("ViewSet.getRenderers: returns JSONRenderer by default", () => {
  const vs = new ViewSet();
  const renderers = vs.getRenderers();
  assertEquals(renderers.length, 1);
  assertEquals(renderers[0] instanceof JSONRenderer, true);
});

Deno.test("ViewSet.getRenderers: returns configured renderer_classes", () => {
  const vs = new ViewSet();
  vs.renderer_classes = [JSONRenderer, XMLRenderer, CSVRenderer];
  const renderers = vs.getRenderers();
  assertEquals(renderers.length, 3);
  assertEquals(renderers[0] instanceof JSONRenderer, true);
  assertEquals(renderers[1] instanceof XMLRenderer, true);
  assertEquals(renderers[2] instanceof CSVRenderer, true);
});

Deno.test("ViewSet.asView: returns 406 for unsupported Accept type", async () => {
  class TestViewSet extends ViewSet {
    override renderer_classes = [JSONRenderer];
    override async list(_context: ViewSetContext): Promise<Response> {
      return Response.json({ ok: true });
    }
  }

  const view = TestViewSet.asView(
    { GET: "list" } as Record<string, string>,
  );
  const request = new Request("http://localhost/api/", {
    headers: { "Accept": "text/csv" },
  });
  const response = await view(request, {});
  assertEquals(response.status, 406);
});

Deno.test("ViewSet.asView: applies XML renderer for matching Accept", async () => {
  class TestViewSet extends ViewSet {
    override renderer_classes = [JSONRenderer, XMLRenderer];
    override async list(_context: ViewSetContext): Promise<Response> {
      return Response.json({ name: "Alice" });
    }
  }

  const view = TestViewSet.asView(
    { GET: "list" } as Record<string, string>,
  );
  const request = new Request("http://localhost/api/", {
    headers: { "Accept": "application/xml" },
  });
  const response = await view(request, {});
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/xml; charset=utf-8",
  );
  const body = await response.text();
  assertEquals(body.includes("<name>Alice</name>"), true);
});

Deno.test("ViewSet.asView: applies CSV renderer for ?format=csv", async () => {
  class TestViewSet extends ViewSet {
    override renderer_classes = [JSONRenderer, CSVRenderer];
    override async list(_context: ViewSetContext): Promise<Response> {
      return Response.json([{ id: 1, name: "Alice" }]);
    }
  }

  const view = TestViewSet.asView(
    { GET: "list" } as Record<string, string>,
  );
  const request = new Request("http://localhost/api/?format=csv");
  const response = await view(request, {});
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "text/csv; charset=utf-8",
  );
  const body = await response.text();
  assertEquals(body.includes("id,name"), true);
});
