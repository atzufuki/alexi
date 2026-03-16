import { assertEquals } from "jsr:@std/assert@1";
import {
  getRequestUser,
  loginRequired,
  permissionRequired,
} from "./decorators.ts";
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

/** A minimal view that always returns 200 OK. */
async function okView(
  _request: Request,
  _params: Record<string, string>,
): Promise<Response> {
  return new Response("ok", { status: 200 });
}

// ---------------------------------------------------------------------------
// loginRequired
// ---------------------------------------------------------------------------

Deno.test("loginRequired: allows authenticated request", async () => {
  const request = await requestWithToken(1, "user@example.com");
  const view = loginRequired(okView);
  const response = await view(request, {});
  assertEquals(response.status, 200);
});

Deno.test("loginRequired: returns 401 with no Authorization header", async () => {
  const request = new Request("http://localhost/test");
  const view = loginRequired(okView);
  const response = await view(request, {});
  assertEquals(response.status, 401);
  const body = await response.json();
  assertEquals(body.detail, "Authentication required.");
});

Deno.test("loginRequired: returns 401 with invalid token", async () => {
  const request = new Request("http://localhost/test", {
    headers: { Authorization: "Bearer not.a.valid.token" },
  });
  const view = loginRequired(okView);
  const response = await view(request, {});
  assertEquals(response.status, 401);
});

Deno.test("loginRequired: returns 401 with malformed header", async () => {
  const request = new Request("http://localhost/test", {
    headers: { Authorization: "Token abc123" },
  });
  const view = loginRequired(okView);
  const response = await view(request, {});
  assertEquals(response.status, 401);
});

// ---------------------------------------------------------------------------
// getRequestUser
// ---------------------------------------------------------------------------

Deno.test("getRequestUser: returns undefined for unauthenticated request", () => {
  const request = new Request("http://localhost/test");
  assertEquals(getRequestUser(request), undefined);
});

Deno.test("getRequestUser: returns user inside loginRequired view", async () => {
  const request = await requestWithToken(42, "alice@example.com", false);
  let capturedUser: ReturnType<typeof getRequestUser>;

  const view = loginRequired(async (req, _params) => {
    capturedUser = getRequestUser(req);
    return new Response("ok");
  });

  await view(request, {});

  assertEquals(capturedUser?.id, 42);
  assertEquals(capturedUser?.email, "alice@example.com");
  assertEquals(capturedUser?.isAdmin, false);
});

Deno.test("getRequestUser: returns admin user inside loginRequired view", async () => {
  const request = await requestWithToken(1, "admin@example.com", true);
  let capturedUser: ReturnType<typeof getRequestUser>;

  const view = loginRequired(async (req, _params) => {
    capturedUser = getRequestUser(req);
    return new Response("ok");
  });

  await view(request, {});

  assertEquals(capturedUser?.isAdmin, true);
});

// ---------------------------------------------------------------------------
// permissionRequired
// ---------------------------------------------------------------------------

Deno.test("permissionRequired: allows admin user with 'admin' perm", async () => {
  const request = await requestWithToken(1, "admin@example.com", true);
  const view = permissionRequired("admin", okView);
  const response = await view(request, {});
  assertEquals(response.status, 200);
});

Deno.test("permissionRequired: returns 403 for non-admin user with 'admin' perm", async () => {
  const request = await requestWithToken(2, "user@example.com", false);
  const view = permissionRequired("admin", okView);
  const response = await view(request, {});
  assertEquals(response.status, 403);
  const body = await response.json();
  assertEquals(body.detail, "Permission denied.");
});

Deno.test("permissionRequired: returns 401 with no token", async () => {
  const request = new Request("http://localhost/test");
  const view = permissionRequired("admin", okView);
  const response = await view(request, {});
  assertEquals(response.status, 401);
  const body = await response.json();
  assertEquals(body.detail, "Authentication required.");
});

Deno.test("permissionRequired: returns 403 for unknown permission string", async () => {
  const request = await requestWithToken(1, "user@example.com", true);
  const view = permissionRequired("superpower", okView);
  const response = await view(request, {});
  assertEquals(response.status, 403);
});

Deno.test("permissionRequired: sets user on request when allowed", async () => {
  const request = await requestWithToken(7, "admin@example.com", true);
  let capturedUser: ReturnType<typeof getRequestUser>;

  const view = permissionRequired("admin", async (req, _params) => {
    capturedUser = getRequestUser(req);
    return new Response("ok");
  });

  await view(request, {});

  assertEquals(capturedUser?.id, 7);
  assertEquals(capturedUser?.isAdmin, true);
});

// ---------------------------------------------------------------------------
// request.user property
// ---------------------------------------------------------------------------

Deno.test("loginRequired: sets request.user for authenticated request", async () => {
  const request = await requestWithToken(5, "eve@example.com", false);

  const view = loginRequired(async (req, _params) => {
    return Response.json({ user: req.user });
  });

  await view(request, {});

  assertEquals(request.user?.id, 5);
  assertEquals(request.user?.email, "eve@example.com");
  assertEquals(request.user?.isAdmin, false);
});

Deno.test("loginRequired: request.user is not set for unauthenticated request", async () => {
  const request = new Request("http://localhost/test");

  const view = loginRequired(async (req, _params) => {
    return Response.json({ user: req.user });
  });

  await view(request, {});

  // The view never runs — request.user should still be undefined
  assertEquals(request.user, undefined);
});

Deno.test("permissionRequired: sets request.user for authorised request", async () => {
  const request = await requestWithToken(9, "admin@example.com", true);

  const view = permissionRequired("admin", async (req, _params) => {
    return Response.json({ user: req.user });
  });

  await view(request, {});

  assertEquals(request.user?.id, 9);
  assertEquals(request.user?.isAdmin, true);
});

Deno.test("loginRequired: extra JWT claims available via request.user", async () => {
  // createTokenPair includes standard fields; verify index-signature access
  const request = await requestWithToken(3, "frank@example.com", false);
  let capturedUser: Request["user"];

  const view = loginRequired(async (req, _params) => {
    capturedUser = req.user;
    return new Response("ok");
  });

  await view(request, {});

  assertEquals(capturedUser?.id, 3);
  assertEquals(capturedUser?.email, "frank@example.com");
});

// ---------------------------------------------------------------------------
// Service Worker mode: decodeToken fallback (no SECRET_KEY)
//
// Simulated by signing with a secret that doesn't match the active SECRET_KEY
// (unset in tests). verifyToken() → null, decodeToken() → payload.
// ---------------------------------------------------------------------------

/** Build a Request with an HS256 token signed under a secret that won't match
 *  the test environment's SECRET_KEY, simulating the SW decodeToken path. */
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
  const token = await signJWT(payload, "sw-only-secret");
  return new Request("http://localhost/test", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

Deno.test("loginRequired (SW mode): allows request via decodeToken fallback", async () => {
  const request = await swRequestWithToken(40, "sw@example.com", false);
  const view = loginRequired(okView);
  const response = await view(request, {});
  assertEquals(response.status, 200);
});

Deno.test("loginRequired (SW mode): sets request.user via decodeToken fallback", async () => {
  const request = await swRequestWithToken(41, "sw2@example.com", false);

  const view = loginRequired(async (req, _params) => {
    return new Response("ok");
  });
  await view(request, {});

  assertEquals(request.user?.id, 41);
  assertEquals(request.user?.email, "sw2@example.com");
});

Deno.test("loginRequired (SW mode): extra JWT claims available on request.user", async () => {
  const request = await swRequestWithToken(
    42,
    "sw3@example.com",
    false,
    { firstName: "Service", lastName: "Worker" },
  );

  const view = loginRequired(async (req, _params) => {
    return new Response("ok");
  });
  await view(request, {});

  assertEquals(request.user?.id, 42);
  assertEquals(request.user?.["firstName"], "Service");
  assertEquals(request.user?.["lastName"], "Worker");
});

Deno.test("permissionRequired (SW mode): allows admin via decodeToken fallback", async () => {
  const request = await swRequestWithToken(43, "admin@example.com", true);
  const view = permissionRequired("admin", okView);
  const response = await view(request, {});
  assertEquals(response.status, 200);
});

Deno.test("permissionRequired (SW mode): sets request.user via decodeToken fallback", async () => {
  const request = await swRequestWithToken(44, "admin2@example.com", true);

  const view = permissionRequired("admin", async (req, _params) => {
    return new Response("ok");
  });
  await view(request, {});

  assertEquals(request.user?.id, 44);
  assertEquals(request.user?.isAdmin, true);
});

// ---------------------------------------------------------------------------
// Extra JWT claims via spread (server mode, unsigned token)
// ---------------------------------------------------------------------------

Deno.test("loginRequired: extra JWT claims spread onto request.user (server mode)", async () => {
  const now = Math.floor(Date.now() / 1000);
  // Unsigned token (alg:none) accepted in dev mode (no SECRET_KEY set)
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
    "",
  );
  const request = new Request("http://localhost/test", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const view = loginRequired(async (req, _params) => {
    return new Response("ok");
  });
  await view(request, {});

  assertEquals(request.user?.id, 50);
  assertEquals(request.user?.["firstName"], "Extra");
  assertEquals(request.user?.["lastName"], "Claims");
});
