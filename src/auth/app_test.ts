/**
 * Tests for @alexi/auth app configuration exports
 *
 * Verifies that AuthConfig is exported as a named export so that
 * `import { AuthConfig } from "@alexi/auth"` works in INSTALLED_APPS.
 *
 * @module @alexi/auth/app_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { AuthConfig } from "./mod.ts";

Deno.test("auth mod: AuthConfig is a named export", () => {
  assertExists(AuthConfig);
});

Deno.test("auth mod: AuthConfig has required AppConfig fields", () => {
  assertExists(AuthConfig.name);
  assertExists(AuthConfig.appPath);
  assertEquals(AuthConfig.name, "alexi_auth");
});

Deno.test("auth mod: AuthConfig.appPath points to auth directory", () => {
  // appPath should be an absolute file:// URL ending with /auth/
  const appPath = AuthConfig.appPath ?? "";
  assertEquals(typeof appPath, "string");
  assertEquals(appPath.includes("auth"), true);
});
