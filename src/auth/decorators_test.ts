import { assertEquals } from "jsr:@std/assert@1";
import {
  getRequestUser,
  loginRequired,
  permissionRequired,
} from "./decorators.ts";
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
