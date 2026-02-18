/**
 * Tests for permission classes
 *
 * @module @alexi/restframework/permissions/permission_test
 */

import { assertEquals } from "jsr:@std/assert@1";
import {
  AllowAny,
  And,
  BasePermission,
  DenyAll,
  IsAdminUser,
  IsAuthenticated,
  IsAuthenticatedOrReadOnly,
  Not,
  Or,
} from "./permission.ts";
import type { ViewSetContext } from "../viewsets/viewset.ts";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock ViewSetContext for testing
 */
function createContext(options: {
  user?: { id: number | string; email?: string; isAdmin?: boolean };
  method?: string;
}): ViewSetContext {
  const request = new Request("http://localhost/test", {
    method: options.method ?? "GET",
  });

  return {
    request,
    params: {},
    action: "list",
    user: options.user,
  };
}

// ============================================================================
// AllowAny Tests
// ============================================================================

Deno.test({
  name: "AllowAny: allows unauthenticated requests",
  fn() {
    const permission = new AllowAny();
    const context = createContext({});

    assertEquals(permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "AllowAny: allows authenticated requests",
  fn() {
    const permission = new AllowAny();
    const context = createContext({ user: { id: 1, email: "test@test.com" } });

    assertEquals(permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "AllowAny: allows object permission for any user",
  fn() {
    const permission = new AllowAny();
    const context = createContext({});
    const obj = { id: 1 };

    assertEquals(permission.hasObjectPermission(context, obj), true);
  },
});

// ============================================================================
// DenyAll Tests
// ============================================================================

Deno.test({
  name: "DenyAll: denies unauthenticated requests",
  fn() {
    const permission = new DenyAll();
    const context = createContext({});

    assertEquals(permission.hasPermission(context), false);
  },
});

Deno.test({
  name: "DenyAll: denies authenticated requests",
  fn() {
    const permission = new DenyAll();
    const context = createContext({
      user: { id: 1, email: "admin@test.com", isAdmin: true },
    });

    assertEquals(permission.hasPermission(context), false);
  },
});

// ============================================================================
// IsAuthenticated Tests
// ============================================================================

Deno.test({
  name: "IsAuthenticated: denies unauthenticated requests",
  fn() {
    const permission = new IsAuthenticated();
    const context = createContext({});

    assertEquals(permission.hasPermission(context), false);
  },
});

Deno.test({
  name: "IsAuthenticated: allows authenticated requests",
  fn() {
    const permission = new IsAuthenticated();
    const context = createContext({ user: { id: 1, email: "test@test.com" } });

    assertEquals(permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "IsAuthenticated: denies user with null id",
  fn() {
    const permission = new IsAuthenticated();
    const context = createContext({
      user: { id: null as unknown as number, email: "test@test.com" },
    });

    assertEquals(permission.hasPermission(context), false);
  },
});

// ============================================================================
// IsAdminUser Tests
// ============================================================================

Deno.test({
  name: "IsAdminUser: denies unauthenticated requests",
  fn() {
    const permission = new IsAdminUser();
    const context = createContext({});

    assertEquals(permission.hasPermission(context), false);
  },
});

Deno.test({
  name: "IsAdminUser: denies non-admin users",
  fn() {
    const permission = new IsAdminUser();
    const context = createContext({
      user: { id: 1, email: "user@test.com", isAdmin: false },
    });

    assertEquals(permission.hasPermission(context), false);
  },
});

Deno.test({
  name: "IsAdminUser: allows admin users",
  fn() {
    const permission = new IsAdminUser();
    const context = createContext({
      user: { id: 1, email: "admin@test.com", isAdmin: true },
    });

    assertEquals(permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "IsAdminUser: denies users without isAdmin property",
  fn() {
    const permission = new IsAdminUser();
    const context = createContext({
      user: { id: 1, email: "user@test.com" },
    });

    assertEquals(permission.hasPermission(context), false);
  },
});

// ============================================================================
// IsAuthenticatedOrReadOnly Tests
// ============================================================================

Deno.test({
  name: "IsAuthenticatedOrReadOnly: allows GET for unauthenticated",
  fn() {
    const permission = new IsAuthenticatedOrReadOnly();
    const context = createContext({ method: "GET" });

    assertEquals(permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "IsAuthenticatedOrReadOnly: allows HEAD for unauthenticated",
  fn() {
    const permission = new IsAuthenticatedOrReadOnly();
    const context = createContext({ method: "HEAD" });

    assertEquals(permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "IsAuthenticatedOrReadOnly: allows OPTIONS for unauthenticated",
  fn() {
    const permission = new IsAuthenticatedOrReadOnly();
    const context = createContext({ method: "OPTIONS" });

    assertEquals(permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "IsAuthenticatedOrReadOnly: denies POST for unauthenticated",
  fn() {
    const permission = new IsAuthenticatedOrReadOnly();
    const context = createContext({ method: "POST" });

    assertEquals(permission.hasPermission(context), false);
  },
});

Deno.test({
  name: "IsAuthenticatedOrReadOnly: denies PUT for unauthenticated",
  fn() {
    const permission = new IsAuthenticatedOrReadOnly();
    const context = createContext({ method: "PUT" });

    assertEquals(permission.hasPermission(context), false);
  },
});

Deno.test({
  name: "IsAuthenticatedOrReadOnly: denies PATCH for unauthenticated",
  fn() {
    const permission = new IsAuthenticatedOrReadOnly();
    const context = createContext({ method: "PATCH" });

    assertEquals(permission.hasPermission(context), false);
  },
});

Deno.test({
  name: "IsAuthenticatedOrReadOnly: denies DELETE for unauthenticated",
  fn() {
    const permission = new IsAuthenticatedOrReadOnly();
    const context = createContext({ method: "DELETE" });

    assertEquals(permission.hasPermission(context), false);
  },
});

Deno.test({
  name: "IsAuthenticatedOrReadOnly: allows POST for authenticated",
  fn() {
    const permission = new IsAuthenticatedOrReadOnly();
    const context = createContext({
      method: "POST",
      user: { id: 1, email: "user@test.com" },
    });

    assertEquals(permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "IsAuthenticatedOrReadOnly: allows DELETE for authenticated",
  fn() {
    const permission = new IsAuthenticatedOrReadOnly();
    const context = createContext({
      method: "DELETE",
      user: { id: 1, email: "user@test.com" },
    });

    assertEquals(permission.hasPermission(context), true);
  },
});

// ============================================================================
// And Operator Tests
// ============================================================================

Deno.test({
  name: "And: passes when all permissions pass",
  async fn() {
    const permission = And.of(AllowAny, IsAuthenticated);
    const context = createContext({ user: { id: 1, email: "test@test.com" } });

    assertEquals(await permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "And: fails when one permission fails",
  async fn() {
    const permission = And.of(AllowAny, IsAuthenticated);
    const context = createContext({});

    assertEquals(await permission.hasPermission(context), false);
  },
});

Deno.test({
  name: "And: sets correct message on failure",
  async fn() {
    const permission = And.of(IsAuthenticated, IsAdminUser);
    const context = createContext({});

    await permission.hasPermission(context);
    assertEquals(permission.message, "Authentication required.");
  },
});

Deno.test({
  name: "And: works with object permissions",
  async fn() {
    const permission = And.of(IsAuthenticated, AllowAny);
    const context = createContext({ user: { id: 1, email: "test@test.com" } });
    const obj = { id: 1 };

    assertEquals(await permission.hasObjectPermission(context, obj), true);
  },
});

// ============================================================================
// Or Operator Tests
// ============================================================================

Deno.test({
  name: "Or: passes when at least one permission passes",
  async fn() {
    const permission = Or.of(IsAuthenticated, AllowAny);
    const context = createContext({});

    assertEquals(await permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "Or: passes when first permission passes",
  async fn() {
    const permission = Or.of(AllowAny, IsAuthenticated);
    const context = createContext({});

    assertEquals(await permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "Or: fails when all permissions fail",
  async fn() {
    const permission = Or.of(IsAuthenticated, IsAdminUser);
    const context = createContext({});

    assertEquals(await permission.hasPermission(context), false);
  },
});

Deno.test({
  name: "Or: works with object permissions",
  async fn() {
    const permission = Or.of(DenyAll, AllowAny);
    const context = createContext({});
    const obj = { id: 1 };

    assertEquals(await permission.hasObjectPermission(context, obj), true);
  },
});

// ============================================================================
// Not Operator Tests
// ============================================================================

Deno.test({
  name: "Not: inverts AllowAny to deny",
  async fn() {
    const permission = Not.of(AllowAny);
    const context = createContext({});

    assertEquals(await permission.hasPermission(context), false);
  },
});

Deno.test({
  name: "Not: inverts DenyAll to allow",
  async fn() {
    const permission = Not.of(DenyAll);
    const context = createContext({});

    assertEquals(await permission.hasPermission(context), true);
  },
});

Deno.test({
  name: "Not: inverts IsAuthenticated",
  async fn() {
    const permission = Not.of(IsAuthenticated);

    // Unauthenticated should now be allowed
    const unauthContext = createContext({});
    assertEquals(await permission.hasPermission(unauthContext), true);

    // Authenticated should now be denied
    const authContext = createContext({
      user: { id: 1, email: "test@test.com" },
    });
    assertEquals(await permission.hasPermission(authContext), false);
  },
});

Deno.test({
  name: "Not: works with object permissions",
  async fn() {
    const permission = Not.of(DenyAll);
    const context = createContext({});
    const obj = { id: 1 };

    assertEquals(await permission.hasObjectPermission(context, obj), true);
  },
});

// ============================================================================
// Custom Permission Tests
// ============================================================================

Deno.test({
  name: "Custom permission: can implement hasObjectPermission",
  async fn() {
    // Custom permission that checks if user owns the object
    class IsOwner extends BasePermission {
      override message = "You must be the owner.";

      hasPermission(_context: ViewSetContext): boolean {
        return true; // Allow access, object check will happen later
      }

      override hasObjectPermission(
        context: ViewSetContext,
        obj: unknown,
      ): boolean {
        const record = obj as { ownerId?: number };
        return record.ownerId === context.user?.id;
      }
    }

    const permission = new IsOwner();

    // Owner accessing their object
    const ownerContext = createContext({ user: { id: 1 } });
    assertEquals(
      await permission.hasObjectPermission(ownerContext, { ownerId: 1 }),
      true,
    );

    // Non-owner accessing object
    const nonOwnerContext = createContext({ user: { id: 2 } });
    assertEquals(
      await permission.hasObjectPermission(nonOwnerContext, { ownerId: 1 }),
      false,
    );
  },
});

// ============================================================================
// Message Tests
// ============================================================================

Deno.test({
  name: "Permission messages: AllowAny has positive message",
  fn() {
    const permission = new AllowAny();
    assertEquals(permission.message, "Access allowed.");
  },
});

Deno.test({
  name: "Permission messages: DenyAll has denial message",
  fn() {
    const permission = new DenyAll();
    assertEquals(permission.message, "Access denied.");
  },
});

Deno.test({
  name: "Permission messages: IsAuthenticated has auth message",
  fn() {
    const permission = new IsAuthenticated();
    assertEquals(permission.message, "Authentication required.");
  },
});

Deno.test({
  name: "Permission messages: IsAdminUser has admin message",
  fn() {
    const permission = new IsAdminUser();
    assertEquals(permission.message, "Admin access required.");
  },
});

Deno.test({
  name: "Permission messages: IsAuthenticatedOrReadOnly has action message",
  fn() {
    const permission = new IsAuthenticatedOrReadOnly();
    assertEquals(
      permission.message,
      "Authentication required for this action.",
    );
  },
});
