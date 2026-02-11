/**
 * Tests for redirect response utilities
 *
 * @module @alexi/urls/tests/redirect_test
 */

import { assertEquals, assertStrictEquals } from "@std/assert";
import {
  isRedirectResponse,
  redirect,
  type RedirectResponse,
} from "../redirect.ts";

// ============================================================================
// redirect() Tests
// ============================================================================

Deno.test({
  name: "redirect: creates redirect response with path",
  fn() {
    const response = redirect("/auth/signin/");

    assertEquals(response.__redirect, true);
    assertEquals(response.path, "/auth/signin/");
    assertEquals(response.permanent, false);
  },
});

Deno.test({
  name: "redirect: creates non-permanent redirect by default",
  fn() {
    const response = redirect("/home/");

    assertEquals(response.permanent, false);
  },
});

Deno.test({
  name: "redirect: creates permanent redirect when specified",
  fn() {
    const response = redirect("/new-page/", { permanent: true });

    assertEquals(response.__redirect, true);
    assertEquals(response.path, "/new-page/");
    assertEquals(response.permanent, true);
  },
});

Deno.test({
  name: "redirect: creates non-permanent redirect when explicitly false",
  fn() {
    const response = redirect("/page/", { permanent: false });

    assertEquals(response.permanent, false);
  },
});

Deno.test({
  name: "redirect: preserves various path formats",
  fn() {
    // Absolute path
    assertEquals(redirect("/absolute/path/").path, "/absolute/path/");

    // Path with query string
    assertEquals(
      redirect("/search/?q=test").path,
      "/search/?q=test",
    );

    // Path with hash
    assertEquals(redirect("/page/#section").path, "/page/#section");

    // Path with parameters
    assertEquals(redirect("/users/123/edit/").path, "/users/123/edit/");

    // External URL (for potential future use)
    assertEquals(
      redirect("https://example.com/").path,
      "https://example.com/",
    );

    // Relative path
    assertEquals(redirect("./relative/").path, "./relative/");

    // Root path
    assertEquals(redirect("/").path, "/");

    // Empty path
    assertEquals(redirect("").path, "");
  },
});

Deno.test({
  name: "redirect: response is readonly",
  fn() {
    const response = redirect("/test/");

    // Verify the structure is correct
    assertEquals(Object.keys(response).sort(), [
      "__redirect",
      "path",
      "permanent",
    ]);

    // TypeScript enforces readonly at compile time,
    // but we verify the values are as expected
    assertStrictEquals(response.__redirect, true);
    assertStrictEquals(response.path, "/test/");
    assertStrictEquals(response.permanent, false);
  },
});

// ============================================================================
// isRedirectResponse() Tests
// ============================================================================

Deno.test({
  name: "isRedirectResponse: returns true for redirect response",
  fn() {
    const response = redirect("/path/");

    assertEquals(isRedirectResponse(response), true);
  },
});

Deno.test({
  name: "isRedirectResponse: returns true for permanent redirect",
  fn() {
    const response = redirect("/path/", { permanent: true });

    assertEquals(isRedirectResponse(response), true);
  },
});

Deno.test({
  name: "isRedirectResponse: returns false for null",
  fn() {
    assertEquals(isRedirectResponse(null), false);
  },
});

Deno.test({
  name: "isRedirectResponse: returns false for undefined",
  fn() {
    assertEquals(isRedirectResponse(undefined), false);
  },
});

Deno.test({
  name: "isRedirectResponse: returns false for primitive types",
  fn() {
    assertEquals(isRedirectResponse("string"), false);
    assertEquals(isRedirectResponse(123), false);
    assertEquals(isRedirectResponse(true), false);
    assertEquals(isRedirectResponse(false), false);
    assertEquals(isRedirectResponse(Symbol("test")), false);
    assertEquals(isRedirectResponse(BigInt(123)), false);
  },
});

Deno.test({
  name: "isRedirectResponse: returns false for empty object",
  fn() {
    assertEquals(isRedirectResponse({}), false);
  },
});

Deno.test({
  name: "isRedirectResponse: returns false for object without __redirect",
  fn() {
    assertEquals(isRedirectResponse({ path: "/test/" }), false);
    assertEquals(
      isRedirectResponse({ path: "/test/", permanent: false }),
      false,
    );
  },
});

Deno.test({
  name: "isRedirectResponse: returns false for object with __redirect !== true",
  fn() {
    assertEquals(
      isRedirectResponse({ __redirect: false, path: "/test/" }),
      false,
    );
    assertEquals(
      isRedirectResponse({ __redirect: "true", path: "/test/" }),
      false,
    );
    assertEquals(isRedirectResponse({ __redirect: 1, path: "/test/" }), false);
    assertEquals(
      isRedirectResponse({ __redirect: null, path: "/test/" }),
      false,
    );
    assertEquals(
      isRedirectResponse({ __redirect: undefined, path: "/test/" }),
      false,
    );
  },
});

Deno.test({
  name:
    "isRedirectResponse: returns true for manually constructed redirect response",
  fn() {
    const manualResponse: RedirectResponse = {
      __redirect: true,
      path: "/manual/",
      permanent: false,
    };

    assertEquals(isRedirectResponse(manualResponse), true);
  },
});

Deno.test({
  name: "isRedirectResponse: returns false for array",
  fn() {
    assertEquals(isRedirectResponse([]), false);
    assertEquals(isRedirectResponse([{ __redirect: true }]), false);
  },
});

Deno.test({
  name: "isRedirectResponse: returns false for function",
  fn() {
    assertEquals(isRedirectResponse(() => {}), false);
    assertEquals(isRedirectResponse(function () {}), false);
  },
});

Deno.test({
  name: "isRedirectResponse: returns false for DOM-like objects",
  fn() {
    // Simulating a DOM Node-like object
    const nodeLike = {
      nodeType: 1,
      nodeName: "DIV",
      appendChild: () => {},
    };

    assertEquals(isRedirectResponse(nodeLike), false);
  },
});

// ============================================================================
// Integration-like Tests (simulating router usage)
// ============================================================================

Deno.test({
  name: "redirect: can be used in view function pattern",
  async fn() {
    // Simulate a view function that returns redirect
    const protectedView = async (
      _ctx: unknown,
      _params: Record<string, string>,
    ): Promise<RedirectResponse | { content: string }> => {
      const isAuthenticated = false; // Simulating unauthenticated user

      if (!isAuthenticated) {
        return redirect("/auth/signin/");
      }

      return { content: "Protected content" };
    };

    const result = await protectedView({}, {});

    // Router would check this
    if (isRedirectResponse(result)) {
      assertEquals(result.path, "/auth/signin/");
    } else {
      throw new Error("Expected redirect response");
    }
  },
});

Deno.test({
  name: "redirect: can be distinguished from regular view response",
  async fn() {
    // Simulate two different view outcomes
    const viewWithRedirect = async () => redirect("/other/");
    const viewWithContent = async () => ({ type: "node", content: "Hello" });

    const result1 = await viewWithRedirect();
    const result2 = await viewWithContent();

    assertEquals(isRedirectResponse(result1), true);
    assertEquals(isRedirectResponse(result2), false);

    // Type narrowing works
    if (isRedirectResponse(result1)) {
      assertEquals(result1.path, "/other/");
    }
  },
});

Deno.test({
  name: "redirect: supports post-action redirect pattern",
  async fn() {
    // Common pattern: redirect after successful form submission
    const createItemView = async (
      _ctx: unknown,
      _params: Record<string, string>,
    ): Promise<RedirectResponse> => {
      // Simulate creating an item
      const newItemId = 42;

      // Redirect to the detail page
      return redirect(`/items/${newItemId}/`);
    };

    const result = await createItemView({}, {});

    assertEquals(isRedirectResponse(result), true);
    assertEquals(result.path, "/items/42/");
  },
});
