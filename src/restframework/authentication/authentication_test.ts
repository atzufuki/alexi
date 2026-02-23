/**
 * Tests for authentication classes
 *
 * @module @alexi/restframework/authentication/authentication_test
 */

import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { BaseAuthentication, JWTAuthentication } from "./authentication.ts";
import type { AuthenticatedUser } from "./authentication.ts";
import type { ViewSetContext } from "../viewsets/viewset.ts";
import { ViewSet } from "../viewsets/viewset.ts";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock ViewSetContext with optional Authorization header
 */
function createContext(options: {
  authorizationHeader?: string;
  method?: string;
}): ViewSetContext {
  const headers: Record<string, string> = {};
  if (options.authorizationHeader) {
    headers["Authorization"] = options.authorizationHeader;
  }
  const request = new Request("http://localhost/test", {
    method: options.method ?? "GET",
    headers,
  });

  return {
    request,
    params: {},
    action: "list",
  };
}

/**
 * Create a minimal unsigned JWT (alg: none) for testing without a secret key.
 * NOT for production use.
 */
function createUnsignedJWT(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.`;
}

/**
 * Create an HS256-signed JWT for testing
 */
async function createSignedJWT(
  payload: Record<string, unknown>,
  secretKey: string,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const toB64Url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = toB64Url(header);
  const payloadB64 = toB64Url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signingInput),
  );

  const signatureB64 = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer)),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

// ============================================================================
// BaseAuthentication Tests
// ============================================================================

Deno.test({
  name: "BaseAuthentication: can be extended",
  async fn() {
    class AlwaysAuthAuthentication extends BaseAuthentication {
      authenticate(_context: ViewSetContext): AuthenticatedUser {
        return { id: 42, email: "test@test.com", isAdmin: false };
      }
    }

    const auth = new AlwaysAuthAuthentication();
    const context = createContext({});
    const user = await auth.authenticate(context);

    assertEquals(user?.id, 42);
    assertEquals(user?.email, "test@test.com");
  },
});

Deno.test({
  name: "BaseAuthentication: can return null for anonymous",
  async fn() {
    class NeverAuthAuthentication extends BaseAuthentication {
      authenticate(_context: ViewSetContext): null {
        return null;
      }
    }

    const auth = new NeverAuthAuthentication();
    const context = createContext({});
    const user = await auth.authenticate(context);

    assertEquals(user, null);
  },
});

// ============================================================================
// JWTAuthentication: No header
// ============================================================================

Deno.test({
  name: "JWTAuthentication: returns null when no Authorization header",
  async fn() {
    const auth = new JWTAuthentication();
    auth.secretKey = ""; // No secret, allow unsigned
    const context = createContext({});
    const user = await auth.authenticate(context);

    assertEquals(user, null);
  },
});

Deno.test({
  name: "JWTAuthentication: returns null for non-Bearer scheme",
  async fn() {
    const token = createUnsignedJWT({ userId: 1, email: "test@test.com" });
    const auth = new JWTAuthentication();
    auth.secretKey = "";
    const context = createContext({ authorizationHeader: `Basic ${token}` });
    const user = await auth.authenticate(context);

    assertEquals(user, null);
  },
});

Deno.test({
  name: "JWTAuthentication: returns null for malformed token",
  async fn() {
    const auth = new JWTAuthentication();
    auth.secretKey = "";
    const context = createContext({
      authorizationHeader: "Bearer not.a.valid.jwt.at.all",
    });
    const user = await auth.authenticate(context);

    assertEquals(user, null);
  },
});

// ============================================================================
// JWTAuthentication: Unsigned tokens (no secretKey)
// ============================================================================

Deno.test({
  name: "JWTAuthentication: authenticates valid unsigned JWT when no secret",
  async fn() {
    const token = createUnsignedJWT({
      userId: 7,
      email: "user@test.com",
      isAdmin: false,
    });

    const auth = new JWTAuthentication();
    auth.secretKey = ""; // Explicitly no secret
    const context = createContext({ authorizationHeader: `Bearer ${token}` });
    const user = await auth.authenticate(context);

    assertNotEquals(user, null);
    assertEquals(user?.id, 7);
    assertEquals(user?.email, "user@test.com");
    assertEquals(user?.isAdmin, false);
  },
});

Deno.test({
  name: "JWTAuthentication: rejects unsigned JWT when secret key is set",
  async fn() {
    const token = createUnsignedJWT({ userId: 1 });

    const auth = new JWTAuthentication();
    auth.secretKey = "my-secret";
    const context = createContext({ authorizationHeader: `Bearer ${token}` });
    const user = await auth.authenticate(context);

    assertEquals(user, null);
  },
});

Deno.test({
  name: "JWTAuthentication: returns null for expired unsigned token",
  async fn() {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const token = createUnsignedJWT({
      userId: 1,
      exp: pastTimestamp,
    });

    const auth = new JWTAuthentication();
    auth.secretKey = "";
    const context = createContext({ authorizationHeader: `Bearer ${token}` });
    const user = await auth.authenticate(context);

    assertEquals(user, null);
  },
});

Deno.test({
  name: "JWTAuthentication: returns null for token without userId",
  async fn() {
    const token = createUnsignedJWT({ email: "user@test.com" });

    const auth = new JWTAuthentication();
    auth.secretKey = "";
    const context = createContext({ authorizationHeader: `Bearer ${token}` });
    const user = await auth.authenticate(context);

    assertEquals(user, null);
  },
});

Deno.test({
  name: "JWTAuthentication: supports sub claim as userId fallback",
  async fn() {
    const token = createUnsignedJWT({ sub: "123", email: "user@test.com" });

    const auth = new JWTAuthentication();
    auth.secretKey = "";
    const context = createContext({ authorizationHeader: `Bearer ${token}` });
    const user = await auth.authenticate(context);

    assertNotEquals(user, null);
    assertEquals(user?.id, 123);
  },
});

Deno.test({
  name: "JWTAuthentication: sets isAdmin correctly",
  async fn() {
    const adminToken = createUnsignedJWT({
      userId: 1,
      email: "admin@test.com",
      isAdmin: true,
    });
    const userToken = createUnsignedJWT({
      userId: 2,
      email: "user@test.com",
      isAdmin: false,
    });
    const noAdminToken = createUnsignedJWT({
      userId: 3,
      email: "nofield@test.com",
    });

    const auth = new JWTAuthentication();
    auth.secretKey = "";

    const adminContext = createContext({
      authorizationHeader: `Bearer ${adminToken}`,
    });
    const userContext = createContext({
      authorizationHeader: `Bearer ${userToken}`,
    });
    const noAdminContext = createContext({
      authorizationHeader: `Bearer ${noAdminToken}`,
    });

    const adminUser = await auth.authenticate(adminContext);
    const regularUser = await auth.authenticate(userContext);
    const noAdminUser = await auth.authenticate(noAdminContext);

    assertEquals(adminUser?.isAdmin, true);
    assertEquals(regularUser?.isAdmin, false);
    assertEquals(noAdminUser?.isAdmin, false);
  },
});

// ============================================================================
// JWTAuthentication: HS256 signed tokens
// ============================================================================

Deno.test({
  name: "JWTAuthentication: authenticates valid HS256 JWT",
  async fn() {
    const secret = "test-secret-key";
    const token = await createSignedJWT(
      { userId: 5, email: "signed@test.com", isAdmin: true },
      secret,
    );

    const auth = new JWTAuthentication();
    auth.secretKey = secret;
    const context = createContext({ authorizationHeader: `Bearer ${token}` });
    const user = await auth.authenticate(context);

    assertNotEquals(user, null);
    assertEquals(user?.id, 5);
    assertEquals(user?.email, "signed@test.com");
    assertEquals(user?.isAdmin, true);
  },
});

Deno.test({
  name: "JWTAuthentication: rejects HS256 JWT with wrong secret",
  async fn() {
    const token = await createSignedJWT(
      { userId: 5, email: "signed@test.com" },
      "correct-secret",
    );

    const auth = new JWTAuthentication();
    auth.secretKey = "wrong-secret";
    const context = createContext({ authorizationHeader: `Bearer ${token}` });
    const user = await auth.authenticate(context);

    assertEquals(user, null);
  },
});

Deno.test({
  name: "JWTAuthentication: rejects HS256 JWT with no secret configured",
  async fn() {
    const token = await createSignedJWT(
      { userId: 5 },
      "some-secret",
    );

    const auth = new JWTAuthentication();
    auth.secretKey = ""; // No secret
    const context = createContext({ authorizationHeader: `Bearer ${token}` });
    const user = await auth.authenticate(context);

    // HS256 requires a secret key for verification
    assertEquals(user, null);
  },
});

// ============================================================================
// ViewSet.performAuthentication() Integration Tests
// ============================================================================

Deno.test({
  name: "ViewSet.performAuthentication: populates context.user on success",
  async fn() {
    const token = createUnsignedJWT({
      userId: 99,
      email: "viewset@test.com",
      isAdmin: false,
    });

    class TestAuth extends JWTAuthentication {
      override secretKey = "";
    }

    class TestViewSet extends ViewSet {
      override authentication_classes = [TestAuth];
    }

    const viewset = new TestViewSet();
    const context = createContext({ authorizationHeader: `Bearer ${token}` });
    await viewset.performAuthentication(context);

    assertNotEquals(context.user, undefined);
    assertEquals(context.user?.id, 99);
    assertEquals(context.user?.email, "viewset@test.com");
  },
});

Deno.test({
  name:
    "ViewSet.performAuthentication: context.user remains undefined without credentials",
  async fn() {
    class TestAuth extends JWTAuthentication {
      override secretKey = "";
    }

    class TestViewSet extends ViewSet {
      override authentication_classes = [TestAuth];
    }

    const viewset = new TestViewSet();
    const context = createContext({});
    await viewset.performAuthentication(context);

    assertEquals(context.user, undefined);
  },
});

Deno.test({
  name:
    "ViewSet.performAuthentication: no authentication_classes leaves user undefined",
  async fn() {
    class TestViewSet extends ViewSet {}

    const viewset = new TestViewSet();
    const context = createContext({});
    await viewset.performAuthentication(context);

    assertEquals(context.user, undefined);
  },
});

Deno.test({
  name: "ViewSet.performAuthentication: first successful authenticator wins",
  async fn() {
    let firstCalled = false;
    let secondCalled = false;

    class FirstAuth extends BaseAuthentication {
      authenticate(_context: ViewSetContext): AuthenticatedUser {
        firstCalled = true;
        return { id: 1, email: "first@test.com" };
      }
    }

    class SecondAuth extends BaseAuthentication {
      authenticate(_context: ViewSetContext): AuthenticatedUser {
        secondCalled = true;
        return { id: 2, email: "second@test.com" };
      }
    }

    class TestViewSet extends ViewSet {
      override authentication_classes = [FirstAuth, SecondAuth];
    }

    const viewset = new TestViewSet();
    const context = createContext({});
    await viewset.performAuthentication(context);

    assertEquals(firstCalled, true);
    assertEquals(secondCalled, false); // Should not be called since FirstAuth succeeded
    assertEquals(context.user?.id, 1);
  },
});

Deno.test({
  name: "ViewSet.performAuthentication: falls through to second authenticator",
  async fn() {
    class FailingAuth extends BaseAuthentication {
      authenticate(_context: ViewSetContext): null {
        return null;
      }
    }

    class SucceedingAuth extends BaseAuthentication {
      authenticate(_context: ViewSetContext): AuthenticatedUser {
        return { id: 42, email: "fallback@test.com" };
      }
    }

    class TestViewSet extends ViewSet {
      override authentication_classes = [FailingAuth, SucceedingAuth];
    }

    const viewset = new TestViewSet();
    const context = createContext({});
    await viewset.performAuthentication(context);

    assertEquals(context.user?.id, 42);
  },
});

// ============================================================================
// End-to-end: asView() with authentication + permission
// ============================================================================

Deno.test({
  name: "asView: returns 401 when authentication_classes set but no token",
  async fn() {
    class TestAuth extends JWTAuthentication {
      override secretKey = "";
    }

    const { IsAuthenticated } = await import("../permissions/permission.ts");

    class ProtectedViewSet extends ViewSet {
      override authentication_classes = [TestAuth];
      override permission_classes = [IsAuthenticated];

      override async list(_context: ViewSetContext): Promise<Response> {
        return Response.json({ data: "secret" });
      }
    }

    const view = ProtectedViewSet.asView(
      { GET: "list" } as Record<string, string>,
    );
    const request = new Request("http://localhost/test");
    const response = await view(request, {});

    assertEquals(response.status, 401);
  },
});

Deno.test({
  name: "asView: returns 200 when valid JWT provided with IsAuthenticated",
  async fn() {
    const token = createUnsignedJWT({ userId: 1, email: "test@test.com" });

    class TestAuth extends JWTAuthentication {
      override secretKey = "";
    }

    const { IsAuthenticated } = await import("../permissions/permission.ts");

    class ProtectedViewSet extends ViewSet {
      override authentication_classes = [TestAuth];
      override permission_classes = [IsAuthenticated];

      override async list(_context: ViewSetContext): Promise<Response> {
        return Response.json({ data: "secret" });
      }
    }

    const view = ProtectedViewSet.asView(
      { GET: "list" } as Record<string, string>,
    );
    const request = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const response = await view(request, {});

    assertEquals(response.status, 200);
  },
});

Deno.test({
  name: "asView: context.user available in action after authentication",
  async fn() {
    const token = createUnsignedJWT({
      userId: 42,
      email: "me@test.com",
      isAdmin: false,
    });

    class TestAuth extends JWTAuthentication {
      override secretKey = "";
    }

    let capturedUserId: unknown = undefined;

    class MyViewSet extends ViewSet {
      override authentication_classes = [TestAuth];

      override async list(context: ViewSetContext): Promise<Response> {
        capturedUserId = context.user?.id;
        return Response.json({ ok: true });
      }
    }

    const view = MyViewSet.asView({ GET: "list" } as Record<string, string>);
    const request = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${token}` },
    });
    await view(request, {});

    assertEquals(capturedUserId, 42);
  },
});
