/**
 * Tests for Alexi HTTP Application
 *
 * @module @alexi/http/tests/application_test
 */

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

import { path } from "../../urls/mod.ts";
import { Application } from "../../core/management/application.ts";
import type { Middleware } from "../../middleware/types.ts";
import {
  BadRequestError,
  HttpError,
  NotFoundError,
} from "../../middleware/error.ts";

// ============================================================================
// Test Views
// ============================================================================

const home_view = () => Response.json({ page: "home" });
const about_view = () => Response.json({ page: "about" });
const get_asset = (_req: Request, params: Record<string, string>) =>
  Response.json({ asset: params.id });
const echo_method = (req: Request) => Response.json({ method: req.method });
const throw_error = () => {
  throw new Error("Something went wrong");
};
const throw_http_error = () => {
  throw new NotFoundError("Asset not found");
};
const throw_bad_request = () => {
  throw new BadRequestError("Invalid data", { field: "name" });
};

// ============================================================================
// Test URL Patterns
// ============================================================================

const urlpatterns = [
  path("", home_view, { name: "home" }),
  path("about/", about_view, { name: "about" }),
  path("assets/:id/", get_asset, { name: "asset-detail" }),
  path("echo/", echo_method, { name: "echo" }),
  path("error/", throw_error, { name: "error" }),
  path("http-error/", throw_http_error, { name: "http-error" }),
  path("bad-request/", throw_bad_request, { name: "bad-request" }),
];

// ============================================================================
// Helper function to create a mock request
// ============================================================================

function createRequest(
  path: string,
  options: RequestInit = {},
): Request {
  return new Request(`http://localhost:8000${path}`, options);
}

// ============================================================================
// Application tests
// ============================================================================

describe("Application", () => {
  describe("constructor", () => {
    it("should create an application with URL patterns", () => {
      const app = new Application({
        urls: urlpatterns,
      });

      assertEquals(app.urlpatterns, urlpatterns);
      assertEquals(app.middlewareStack.length, 0);
      assertEquals(app.isDebug, false);
    });

    it("should create an application with middleware", () => {
      const middleware: Middleware = async (_req, next) => next();

      const app = new Application({
        urls: urlpatterns,
        middleware: [middleware],
      });

      assertEquals(app.middlewareStack.length, 1);
    });

    it("should create an application with debug mode", () => {
      const app = new Application({
        urls: urlpatterns,
        debug: true,
      });

      assertEquals(app.isDebug, true);
    });
  });

  describe("handler", () => {
    it("should handle a simple request", async () => {
      const app = new Application({ urls: urlpatterns });
      const request = createRequest("/");

      const response = await app.handler(request);
      const body = await response.json();

      assertEquals(response.status, 200);
      assertEquals(body, { page: "home" });
    });

    it("should handle a request with parameters", async () => {
      const app = new Application({ urls: urlpatterns });
      const request = createRequest("/assets/123/");

      const response = await app.handler(request);
      const body = await response.json();

      assertEquals(response.status, 200);
      assertEquals(body, { asset: "123" });
    });

    it("should return 404 for non-matching routes", async () => {
      const app = new Application({ urls: urlpatterns });
      const request = createRequest("/nonexistent/");

      const response = await app.handler(request);
      const body = await response.json();

      assertEquals(response.status, 404);
      assertEquals(body.error, "Not Found");
    });

    it("should return 404 with path in debug mode", async () => {
      const app = new Application({ urls: urlpatterns, debug: true });
      const request = createRequest("/nonexistent/");

      const response = await app.handler(request);
      const body = await response.json();

      assertEquals(response.status, 404);
      assertEquals(body.error, "Not Found");
      assertEquals(body.path, "/nonexistent/");
    });

    it("should handle errors and return 500", async () => {
      const app = new Application({ urls: urlpatterns });
      const request = createRequest("/error/");

      const response = await app.handler(request);
      const body = await response.json();

      assertEquals(response.status, 500);
      assertEquals(body.error, "Internal Server Error");
    });

    it("should include stack trace in debug mode", async () => {
      const app = new Application({ urls: urlpatterns, debug: true });
      const request = createRequest("/error/");

      const response = await app.handler(request);
      const body = await response.json();

      assertEquals(response.status, 500);
      assertEquals(body.message, "Something went wrong");
      assertNotEquals(body.stack, undefined);
    });
  });

  describe("use()", () => {
    it("should add middleware to the stack", () => {
      const middleware: Middleware = async (_req, next) => next();

      const app = new Application({ urls: urlpatterns })
        .use(middleware);

      assertEquals(app.middlewareStack.length, 1);
    });

    it("should support chaining", () => {
      const middleware1: Middleware = async (_req, next) => next();
      const middleware2: Middleware = async (_req, next) => next();

      const app = new Application({ urls: urlpatterns })
        .use(middleware1)
        .use(middleware2);

      assertEquals(app.middlewareStack.length, 2);
    });
  });
});

// ============================================================================
// Middleware tests
// ============================================================================

describe("Middleware", () => {
  it("should execute middleware in order", async () => {
    const order: number[] = [];

    const middleware1: Middleware = async (_req, next) => {
      order.push(1);
      const response = await next();
      order.push(4);
      return response;
    };

    const middleware2: Middleware = async (_req, next) => {
      order.push(2);
      const response = await next();
      order.push(3);
      return response;
    };

    const app = new Application({
      urls: urlpatterns,
      middleware: [middleware1, middleware2],
    });

    const request = createRequest("/");
    await app.handler(request);

    assertEquals(order, [1, 2, 3, 4]);
  });

  it("should allow middleware to modify the response", async () => {
    const addHeaderMiddleware: Middleware = async (_req, next) => {
      const response = await next();
      const newResponse = new Response(response.body, {
        status: response.status,
        headers: new Headers(response.headers),
      });
      newResponse.headers.set("X-Custom-Header", "test-value");
      return newResponse;
    };

    const app = new Application({
      urls: urlpatterns,
      middleware: [addHeaderMiddleware],
    });

    const request = createRequest("/");
    const response = await app.handler(request);

    assertEquals(response.headers.get("X-Custom-Header"), "test-value");
  });

  it("should allow middleware to short-circuit the chain", async () => {
    const authMiddleware: Middleware = async (req, next) => {
      const token = req.headers.get("Authorization");
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return next();
    };

    const app = new Application({
      urls: urlpatterns,
      middleware: [authMiddleware],
    });

    // Without token
    const requestWithoutToken = createRequest("/");
    const responseWithoutToken = await app.handler(requestWithoutToken);
    assertEquals(responseWithoutToken.status, 401);

    // With token
    const requestWithToken = createRequest("/", {
      headers: { Authorization: "Bearer token" },
    });
    const responseWithToken = await app.handler(requestWithToken);
    assertEquals(responseWithToken.status, 200);
  });

  it("should allow middleware to transform the request", async () => {
    let capturedMethod = "";

    const transformMiddleware: Middleware = async (req, next) => {
      // Create a new request with a modified method (for testing purposes)
      capturedMethod = req.method;
      return next();
    };

    const app = new Application({
      urls: urlpatterns,
      middleware: [transformMiddleware],
    });

    const request = createRequest("/echo/", { method: "POST" });
    await app.handler(request);

    assertEquals(capturedMethod, "POST");
  });
});

// ============================================================================
// Error handling tests
// ============================================================================

describe("Error handling", () => {
  it("should handle HttpError instances correctly", async () => {
    const app = new Application({ urls: urlpatterns });
    const request = createRequest("/http-error/");

    const response = await app.handler(request);
    const body = await response.json();

    assertEquals(response.status, 404); // HttpError returns its own status code
    assertEquals(body.error, "Asset not found");
  });

  it("should handle BadRequestError with details", async () => {
    const app = new Application({ urls: urlpatterns, debug: true });
    const request = createRequest("/bad-request/");

    const response = await app.handler(request);
    const body = await response.json();

    assertEquals(response.status, 400); // BadRequestError returns 400
    assertEquals(body.error, "Invalid data");
  });
});

// ============================================================================
// Integration tests
// ============================================================================

describe("Integration", () => {
  it("should work with a typical middleware stack", async () => {
    // Logging middleware (simplified)
    const logs: string[] = [];
    const loggingMiddleware: Middleware = async (req, next) => {
      const url = new URL(req.url);
      logs.push(`→ ${req.method} ${url.pathname}`);
      const response = await next();
      logs.push(`← ${response.status}`);
      return response;
    };

    // Timing middleware
    let duration = 0;
    const timingMiddleware: Middleware = async (_req, next) => {
      const start = performance.now();
      const response = await next();
      duration = performance.now() - start;
      return response;
    };

    const app = new Application({
      urls: urlpatterns,
      middleware: [loggingMiddleware, timingMiddleware],
    });

    const request = createRequest("/about/");
    const response = await app.handler(request);

    assertEquals(response.status, 200);
    assertEquals(logs, ["→ GET /about/", "← 200"]);
    assertNotEquals(duration, 0);
  });

  it("should handle multiple requests independently", async () => {
    const app = new Application({ urls: urlpatterns });

    const request1 = createRequest("/");
    const request2 = createRequest("/about/");
    const request3 = createRequest("/assets/456/");

    const [response1, response2, response3] = await Promise.all([
      app.handler(request1),
      app.handler(request2),
      app.handler(request3),
    ]);

    const body1 = await response1.json();
    const body2 = await response2.json();
    const body3 = await response3.json();

    assertEquals(body1, { page: "home" });
    assertEquals(body2, { page: "about" });
    assertEquals(body3, { asset: "456" });
  });
});
