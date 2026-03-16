/**
 * Tests for AuthenticationMiddleware.
 */

import { assertEquals } from "jsr:@std/assert@1";
import { AuthenticationMiddleware } from "./middleware.ts";
import { getRequestUser } from "./decorators.ts";
import { createTokenPair } from "./jwt.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Request with a valid JWT bearer token for the given user. */
async function requestWithToken(
  userId: number,
  email: string,
  isAdmin = false,
): Promise<Request> {
  const { accessToken } = await createTokenPair(userId, email, isAdmin);
  return new Request("http://localhost/test", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** Create a middleware instance wrapping a simple 200 OK handler. */
function makeMiddleware(): AuthenticationMiddleware {
  const handler = async (_request?: Request): Promise<Response> =>
    new Response("ok", { status: 200 });
  return new AuthenticationMiddleware(handler);
}

// ---------------------------------------------------------------------------
// AuthenticationMiddleware: pass-through behaviour
// ---------------------------------------------------------------------------

Deno.test(
  "AuthenticationMiddleware: passes request to next handler",
  async () => {
    const mw = makeMiddleware();
    const request = new Request("http://localhost/test");
    const response = await mw.call(request);
    assertEquals(response.status, 200);
  },
);

Deno.test(
  "AuthenticationMiddleware: does not reject anonymous request",
  async () => {
    const mw = makeMiddleware();
    const request = new Request("http://localhost/test");
    const response = await mw.call(request);
    // Anonymous requests pass through — middleware never rejects on its own
    assertEquals(response.status, 200);
  },
);

// ---------------------------------------------------------------------------
// AuthenticationMiddleware: user resolution
// ---------------------------------------------------------------------------

Deno.test(
  "AuthenticationMiddleware: attaches user for valid token",
  async () => {
    const request = await requestWithToken(1, "alice@example.com", false);

    let capturedUser: ReturnType<typeof getRequestUser>;
    const mw = new AuthenticationMiddleware(async (req?) => {
      capturedUser = getRequestUser(req!);
      return new Response("ok");
    });

    await mw.call(request);

    assertEquals(capturedUser?.id, 1);
    assertEquals(capturedUser?.email, "alice@example.com");
    assertEquals(capturedUser?.isAdmin, false);
  },
);

Deno.test(
  "AuthenticationMiddleware: attaches admin user for valid admin token",
  async () => {
    const request = await requestWithToken(99, "admin@example.com", true);

    let capturedUser: ReturnType<typeof getRequestUser>;
    const mw = new AuthenticationMiddleware(async (req?) => {
      capturedUser = getRequestUser(req!);
      return new Response("ok");
    });

    await mw.call(request);

    assertEquals(capturedUser?.id, 99);
    assertEquals(capturedUser?.isAdmin, true);
  },
);

Deno.test(
  "AuthenticationMiddleware: no user for missing Authorization header",
  async () => {
    const request = new Request("http://localhost/test");

    let capturedUser: ReturnType<typeof getRequestUser>;
    const mw = new AuthenticationMiddleware(async (req?) => {
      capturedUser = getRequestUser(req!);
      return new Response("ok");
    });

    await mw.call(request);

    assertEquals(capturedUser, undefined);
  },
);

Deno.test(
  "AuthenticationMiddleware: no user for invalid token",
  async () => {
    const request = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer not.a.valid.token" },
    });

    let capturedUser: ReturnType<typeof getRequestUser>;
    const mw = new AuthenticationMiddleware(async (req?) => {
      capturedUser = getRequestUser(req!);
      return new Response("ok");
    });

    await mw.call(request);

    assertEquals(capturedUser, undefined);
  },
);

Deno.test(
  "AuthenticationMiddleware: no user for non-Bearer scheme",
  async () => {
    const request = new Request("http://localhost/test", {
      headers: { Authorization: "Token abc123" },
    });

    let capturedUser: ReturnType<typeof getRequestUser>;
    const mw = new AuthenticationMiddleware(async (req?) => {
      capturedUser = getRequestUser(req!);
      return new Response("ok");
    });

    await mw.call(request);

    assertEquals(capturedUser, undefined);
  },
);

// ---------------------------------------------------------------------------
// Integration: middleware + loginRequired interoperability
// ---------------------------------------------------------------------------

Deno.test(
  "AuthenticationMiddleware: user set by middleware is visible via getRequestUser",
  async () => {
    // Verify the shared WeakMap: user set by middleware should be readable
    // by getRequestUser called outside the middleware chain (e.g. in views).
    const request = await requestWithToken(42, "bob@example.com", false);

    const mw = new AuthenticationMiddleware(async (_req?) =>
      new Response("ok")
    );
    await mw.call(request);

    // getRequestUser reads the same WeakMap that middleware writes to
    const user = getRequestUser(request);
    assertEquals(user?.id, 42);
    assertEquals(user?.email, "bob@example.com");
  },
);
