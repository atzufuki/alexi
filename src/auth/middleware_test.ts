/**
 * Tests for AuthenticationMiddleware.
 */

import { assertEquals } from "jsr:@std/assert@1";
import { AuthenticationMiddleware } from "./middleware.ts";
import { getRequestUser, getRequestUserInstance } from "./decorators.ts";
import { createTokenPair, signJWT } from "./jwt.ts";
import "./test_types.ts";

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
  "AuthenticationMiddleware.configure: sets request.user to ORM instance (server path)",
  async () => {
    const request = await requestWithToken(7, "carol@example.com", false);

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

    const mw = new ConfiguredMW(async (_req?) => new Response("ok"));
    await mw.call(request);

    // request.user must be the ORM instance, not plain AuthenticatedUser
    assertEquals(request.user, fakeInstance as unknown as typeof request.user);
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

// ---------------------------------------------------------------------------
// Service Worker mode: decodeToken fallback (no SECRET_KEY)
//
// In a SW / browser environment verifyToken() returns null because either
// Deno.env is unavailable or the secret key is not set. The middleware and
// decorators must fall back to decodeToken() so that request.user is still
// populated from the JWT payload.
//
// We simulate SW mode by:
//   1. Creating an HS256-signed token with a specific secret ("sw-secret").
//   2. Ensuring SECRET_KEY is NOT set in the test env (default in tests).
//      verifyToken() → null  (HS256 token but no secret → rejected)
//      decodeToken() → payload  (no signature check)
// ---------------------------------------------------------------------------

/** Build a Request carrying an HS256-signed token whose secret is NOT the
 *  active SECRET_KEY, simulating a SW environment where only decodeToken()
 *  can decode the token. */
async function swRequestWithToken(
  userId: number,
  email: string,
  isAdmin = false,
  extra: Record<string, unknown> = {},
): Promise<Request> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId,
    email,
    isAdmin,
    exp: now + 3600,
    iat: now,
    ...extra,
  };
  // Sign with a secret that won't match Deno.env SECRET_KEY (which is unset
  // in tests), so verifyToken() returns null and decodeToken() is the only
  // path that succeeds.
  const token = await signJWT(payload, "sw-only-secret");
  return new Request("http://localhost/test", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

Deno.test(
  "AuthenticationMiddleware (SW mode): sets request.user via decodeToken fallback",
  async () => {
    const request = await swRequestWithToken(30, "sw@example.com", false);

    const mw = new AuthenticationMiddleware(async (_req?) =>
      new Response("ok")
    );
    await mw.call(request);

    // Must be populated via decodeToken() fallback
    assertEquals(request.user?.id, 30);
    assertEquals(request.user?.email, "sw@example.com");
    assertEquals(request.user?.isAdmin, false);
  },
);

Deno.test(
  "AuthenticationMiddleware (SW mode): extra JWT claims available on request.user",
  async () => {
    const request = await swRequestWithToken(
      31,
      "sw2@example.com",
      false,
      { firstName: "Service", lastName: "Worker" },
    );

    const mw = new AuthenticationMiddleware(async (_req?) =>
      new Response("ok")
    );
    await mw.call(request);

    assertEquals(request.user?.id, 31);
    // Extra claims spread from JWT payload — accessible via index signature
    assertEquals(request.user?.["firstName"], "Service");
    assertEquals(request.user?.["lastName"], "Worker");
  },
);

Deno.test(
  "AuthenticationMiddleware (SW mode): request.user null for missing token",
  async () => {
    const request = new Request("http://localhost/test");

    const mw = new AuthenticationMiddleware(async (_req?) =>
      new Response("ok")
    );
    await mw.call(request);

    assertEquals(request.user, null);
  },
);

// ---------------------------------------------------------------------------
// Extra JWT claims via spread (server mode)
// ---------------------------------------------------------------------------

Deno.test(
  "AuthenticationMiddleware: extra JWT claims spread onto request.user (server mode)",
  async () => {
    // createTokenPair only includes standard fields; test spread via signJWT
    // with an unsigned token (empty secret → alg:none accepted in dev mode).
    const now = Math.floor(Date.now() / 1000);
    const token = await signJWT(
      {
        userId: 50,
        email: "extra@example.com",
        isAdmin: false,
        firstName: "Extra",
        lastName: "Claims",
        exp: now + 3600,
        iat: now,
      },
      "", // unsigned — accepted when SECRET_KEY is not set
    );

    const request = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const mw = new AuthenticationMiddleware(async (_req?) =>
      new Response("ok")
    );
    await mw.call(request);

    assertEquals(request.user?.id, 50);
    assertEquals(request.user?.["firstName"], "Extra");
    assertEquals(request.user?.["lastName"], "Claims");
  },
);

// ---------------------------------------------------------------------------
// AuthenticationMiddleware.configure: fromJWT (Service Worker path)
// ---------------------------------------------------------------------------

Deno.test(
  "AuthenticationMiddleware.configure: uses fromJWT factory instead of DB lookup",
  async () => {
    const request = await requestWithToken(8, "sw@example.com", false);

    // fromJWT is called — DB filter must NOT be called
    let dbCalled = false;
    const FakeUserModel = {
      objects: {
        filter(_query: Record<string, unknown>) {
          dbCalled = true;
          return {
            async first() {
              return null;
            },
          };
        },
      },
    };

    const fromJWTInstance = { id: 8, fromJWT: true };
    const ConfiguredMW = AuthenticationMiddleware.configure({
      userModel: FakeUserModel,
      fromJWT: (_payload) => fromJWTInstance,
    });

    let capturedInstance: unknown;
    const mw = new ConfiguredMW(async (req?) => {
      capturedInstance = getRequestUserInstance(req!);
      return new Response("ok");
    });

    await mw.call(request);

    // fromJWT instance is stored and returned
    assertEquals(capturedInstance, fromJWTInstance);
    // DB must not have been called
    assertEquals(dbCalled, false);
  },
);

Deno.test(
  "AuthenticationMiddleware.configure: sets request.user to fromJWT instance (SW path)",
  async () => {
    const request = await requestWithToken(9, "sw2@example.com", true);

    const fromJWTInstance = { id: 9, isAdmin: true, fromJWT: true };
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
      fromJWT: (_payload) => fromJWTInstance,
    });

    const mw = new ConfiguredMW(async (_req?) => new Response("ok"));
    await mw.call(request);

    // request.user must be the fromJWT instance
    assertEquals(
      request.user,
      fromJWTInstance as unknown as typeof request.user,
    );
  },
);

Deno.test(
  "AuthenticationMiddleware.configure: fromJWT receives JWT payload",
  async () => {
    const request = await requestWithToken(11, "payload@example.com", false);

    let receivedPayload: unknown;
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
      fromJWT: (payload) => {
        receivedPayload = payload;
        return { id: payload.id };
      },
    });

    const mw = new ConfiguredMW(async (_req?) => new Response("ok"));
    await mw.call(request);

    // fromJWT must have received the AuthenticatedUser payload
    assertEquals((receivedPayload as { id: unknown })?.id, 11);
    assertEquals(
      (receivedPayload as { email: unknown })?.email,
      "payload@example.com",
    );
  },
);

Deno.test(
  "AuthenticationMiddleware.configure: request.user is plain AuthenticatedUser without userModel",
  async () => {
    const request = await requestWithToken(12, "plain@example.com", false);

    const mw = new AuthenticationMiddleware(async (_req?) =>
      new Response("ok")
    );
    await mw.call(request);

    // Without configure(), request.user is plain AuthenticatedUser — no ORM methods
    assertEquals(request.user?.id, 12);
    assertEquals(request.user?.email, "plain@example.com");
    // Must NOT be an ORM instance (no fromJWT field)
    assertEquals(
      (request.user as Record<string, unknown>)?.["fromJWT"],
      undefined,
    );
  },
);
