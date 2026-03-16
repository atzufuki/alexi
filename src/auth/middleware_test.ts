/**
 * Tests for AuthenticationMiddleware.
 */

import { assertEquals } from "jsr:@std/assert@1";
import { AuthenticationMiddleware } from "./middleware.ts";
import { getRequestUser, getRequestUserInstance } from "./decorators.ts";
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

// ---------------------------------------------------------------------------
// AuthenticationMiddleware.configure: userModel integration
// ---------------------------------------------------------------------------

Deno.test(
  "AuthenticationMiddleware.configure: fetches user instance from userModel",
  async () => {
    const request = await requestWithToken(7, "carol@example.com", false);

    // Minimal fake user model that returns a stub instance for id=7
    const fakeInstance = { id: 7, name: "Carol" };
    const FakeUserModel = {
      objects: {
        filter(query: Record<string, unknown>) {
          return {
            async first() {
              if (query["id"] === 7) return fakeInstance;
              return null;
            },
          };
        },
      },
    };

    const ConfiguredMW = AuthenticationMiddleware.configure({
      userModel: FakeUserModel,
    });

    let capturedInstance: unknown;
    const mw = new ConfiguredMW(async (req?) => {
      capturedInstance = getRequestUserInstance(req!);
      return new Response("ok");
    });

    await mw.call(request);

    assertEquals(capturedInstance, fakeInstance);
  },
);

Deno.test(
  "AuthenticationMiddleware.configure: no instance for anonymous request",
  async () => {
    const request = new Request("http://localhost/test");

    const FakeUserModel = {
      objects: {
        filter(_query: Record<string, unknown>) {
          return {
            async first() {
              return null;
            },
          };
        },
      },
    };

    const ConfiguredMW = AuthenticationMiddleware.configure({
      userModel: FakeUserModel,
    });

    let capturedInstance: unknown = "sentinel";
    const mw = new ConfiguredMW(async (req?) => {
      capturedInstance = getRequestUserInstance(req!);
      return new Response("ok");
    });

    await mw.call(request);

    assertEquals(capturedInstance, undefined);
  },
);

Deno.test(
  "AuthenticationMiddleware.configure: no instance when user not found in DB",
  async () => {
    const request = await requestWithToken(999, "ghost@example.com", false);

    // Always returns null — user 999 doesn't exist
    const FakeUserModel = {
      objects: {
        filter(_query: Record<string, unknown>) {
          return {
            async first() {
              return null;
            },
          };
        },
      },
    };

    const ConfiguredMW = AuthenticationMiddleware.configure({
      userModel: FakeUserModel,
    });

    let capturedInstance: unknown = "sentinel";
    const mw = new ConfiguredMW(async (req?) => {
      capturedInstance = getRequestUserInstance(req!);
      return new Response("ok");
    });

    await mw.call(request);

    assertEquals(capturedInstance, undefined);
  },
);

Deno.test(
  "AuthenticationMiddleware.configure: base class still works without userModel",
  async () => {
    // Ensure configure() doesn't affect the undecorated base class
    const request = await requestWithToken(5, "dave@example.com", false);

    let capturedInstance: unknown = "sentinel";
    const mw = new AuthenticationMiddleware(async (req?) => {
      capturedInstance = getRequestUserInstance(req!);
      return new Response("ok");
    });

    await mw.call(request);

    // Base class has no userModel → instance should always be undefined
    assertEquals(capturedInstance, undefined);
  },
);

// ---------------------------------------------------------------------------
// request.user property
// ---------------------------------------------------------------------------

Deno.test(
  "AuthenticationMiddleware: sets request.user for authenticated request",
  async () => {
    const request = await requestWithToken(10, "grace@example.com", false);

    const mw = new AuthenticationMiddleware(async (_req?) =>
      new Response("ok")
    );
    await mw.call(request);

    assertEquals(request.user?.id, 10);
    assertEquals(request.user?.email, "grace@example.com");
    assertEquals(request.user?.isAdmin, false);
  },
);

Deno.test(
  "AuthenticationMiddleware: sets request.user to null for anonymous request",
  async () => {
    const request = new Request("http://localhost/test");

    const mw = new AuthenticationMiddleware(async (_req?) =>
      new Response("ok")
    );
    await mw.call(request);

    assertEquals(request.user, null);
  },
);

Deno.test(
  "AuthenticationMiddleware: request.user accessible inside next handler",
  async () => {
    const request = await requestWithToken(20, "hank@example.com", true);

    let userInsideHandler: Request["user"];
    const mw = new AuthenticationMiddleware(async (req?) => {
      userInsideHandler = req?.user;
      return new Response("ok");
    });

    await mw.call(request);

    assertEquals(userInsideHandler?.id, 20);
    assertEquals(userInsideHandler?.isAdmin, true);
  },
);
