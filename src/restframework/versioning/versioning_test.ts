/**
 * Tests for API Versioning classes
 *
 * @module @alexi/restframework/versioning/versioning_test
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  AcceptHeaderVersioning,
  applyVersioning,
  QueryParameterVersioning,
  URLPathVersioning,
  VersionNotAllowedError,
} from "./versioning.ts";
import { ViewSet } from "../viewsets/viewset.ts";
import type { ViewSetContext } from "../viewsets/viewset.ts";

// ============================================================================
// Helpers
// ============================================================================

function makeContext(
  url: string,
  params: Record<string, string> = {},
  headers: Record<string, string> = {},
): ViewSetContext {
  return {
    request: new Request(url, { headers }),
    params,
    action: "list",
  };
}

// ============================================================================
// URLPathVersioning tests
// ============================================================================

Deno.test("URLPathVersioning: extracts version from URL params", () => {
  const versioning = new URLPathVersioning();
  const ctx = makeContext("http://localhost/api/v1/users/", { version: "v1" });

  const version = versioning.determineVersion(ctx.request, ctx.params);
  assertEquals(version, "v1");
});

Deno.test("URLPathVersioning: returns null when no version param", () => {
  const versioning = new URLPathVersioning();
  const ctx = makeContext("http://localhost/api/users/", {});

  const version = versioning.determineVersion(ctx.request, ctx.params);
  assertEquals(version, null);
});

Deno.test("URLPathVersioning: custom versionParam", () => {
  const versioning = new URLPathVersioning();
  versioning.versionParam = "ver";
  const ctx = makeContext("http://localhost/api/v2/users/", { ver: "v2" });

  const version = versioning.determineVersion(ctx.request, ctx.params);
  assertEquals(version, "v2");
});

Deno.test("URLPathVersioning: getVersion uses defaultVersion when no param", () => {
  const versioning = new URLPathVersioning();
  versioning.defaultVersion = "v1";
  const ctx = makeContext("http://localhost/api/users/", {});

  const version = versioning.getVersion(ctx.request, ctx.params);
  assertEquals(version, "v1");
});

Deno.test("URLPathVersioning: throws VersionNotAllowedError for invalid version", () => {
  const versioning = new URLPathVersioning();
  versioning.allowedVersions = ["v1", "v2"];
  const ctx = makeContext("http://localhost/api/v3/users/", { version: "v3" });

  let threw = false;
  try {
    versioning.getVersion(ctx.request, ctx.params);
  } catch (e) {
    threw = true;
    assertEquals(e instanceof VersionNotAllowedError, true);
    assertEquals((e as VersionNotAllowedError).allowedVersions, ["v1", "v2"]);
    assertEquals((e as VersionNotAllowedError).status, 400);
  }
  assertEquals(threw, true);
});

Deno.test("URLPathVersioning: allows version in allowedVersions", () => {
  const versioning = new URLPathVersioning();
  versioning.allowedVersions = ["v1", "v2"];
  const ctx = makeContext("http://localhost/api/v2/users/", { version: "v2" });

  const version = versioning.getVersion(ctx.request, ctx.params);
  assertEquals(version, "v2");
});

// ============================================================================
// QueryParameterVersioning tests
// ============================================================================

Deno.test("QueryParameterVersioning: extracts version from query string", () => {
  const versioning = new QueryParameterVersioning();
  const ctx = makeContext("http://localhost/api/users/?version=v2");

  const version = versioning.determineVersion(ctx.request, ctx.params);
  assertEquals(version, "v2");
});

Deno.test("QueryParameterVersioning: returns null when no query param", () => {
  const versioning = new QueryParameterVersioning();
  const ctx = makeContext("http://localhost/api/users/");

  const version = versioning.determineVersion(ctx.request, ctx.params);
  assertEquals(version, null);
});

Deno.test("QueryParameterVersioning: custom versionParam", () => {
  const versioning = new QueryParameterVersioning();
  versioning.versionParam = "ver";
  const ctx = makeContext("http://localhost/api/users/?ver=2.0");

  const version = versioning.determineVersion(ctx.request, ctx.params);
  assertEquals(version, "2.0");
});

Deno.test("QueryParameterVersioning: uses defaultVersion as fallback", () => {
  const versioning = new QueryParameterVersioning();
  versioning.defaultVersion = "1.0";
  const ctx = makeContext("http://localhost/api/users/");

  const version = versioning.getVersion(ctx.request, ctx.params);
  assertEquals(version, "1.0");
});

// ============================================================================
// AcceptHeaderVersioning tests
// ============================================================================

Deno.test("AcceptHeaderVersioning: extracts version from Accept header", () => {
  const versioning = new AcceptHeaderVersioning();
  const ctx = makeContext(
    "http://localhost/api/users/",
    {},
    { "Accept": "application/json; version=2.0" },
  );

  const version = versioning.determineVersion(ctx.request, ctx.params);
  assertEquals(version, "2.0");
});

Deno.test("AcceptHeaderVersioning: returns null when no version in header", () => {
  const versioning = new AcceptHeaderVersioning();
  const ctx = makeContext(
    "http://localhost/api/users/",
    {},
    { "Accept": "application/json" },
  );

  const version = versioning.determineVersion(ctx.request, ctx.params);
  assertEquals(version, null);
});

Deno.test("AcceptHeaderVersioning: returns null when no Accept header", () => {
  const versioning = new AcceptHeaderVersioning();
  const ctx = makeContext("http://localhost/api/users/");

  const version = versioning.determineVersion(ctx.request, ctx.params);
  assertEquals(version, null);
});

Deno.test("AcceptHeaderVersioning: handles vendor media type", () => {
  const versioning = new AcceptHeaderVersioning();
  const ctx = makeContext(
    "http://localhost/api/users/",
    {},
    { "Accept": "application/vnd.mycompany.com+json; version=1.5" },
  );

  const version = versioning.determineVersion(ctx.request, ctx.params);
  assertEquals(version, "1.5");
});

// ============================================================================
// applyVersioning helper tests
// ============================================================================

Deno.test("applyVersioning: returns null when no versioning", () => {
  const ctx = makeContext("http://localhost/api/users/");
  const result = applyVersioning(null, ctx);
  assertEquals(result, null);
});

Deno.test("applyVersioning: sets context.version", () => {
  const versioning = new URLPathVersioning();
  versioning.defaultVersion = "v1";
  const ctx = makeContext("http://localhost/api/v2/users/", { version: "v2" });

  const result = applyVersioning(versioning, ctx);
  assertEquals(result, null);
  assertEquals(ctx.version, "v2");
});

Deno.test("applyVersioning: returns 400 for invalid version", () => {
  const versioning = new URLPathVersioning();
  versioning.allowedVersions = ["v1", "v2"];
  const ctx = makeContext("http://localhost/api/v9/users/", { version: "v9" });

  const result = applyVersioning(versioning, ctx);
  assertExists(result);
  assertEquals(result!.status, 400);
});

// ============================================================================
// ViewSet integration tests
// ============================================================================

Deno.test("ViewSet.getVersioning: returns null when no versioning_class", () => {
  const vs = new ViewSet();
  assertEquals(vs.getVersioning(), null);
});

Deno.test("ViewSet.getVersioning: returns versioning instance", () => {
  const vs = new ViewSet();
  vs.versioning_class = URLPathVersioning;
  const versioning = vs.getVersioning();
  assertExists(versioning);
  assertEquals(versioning instanceof URLPathVersioning, true);
});

Deno.test("ViewSet.getVersioning: applies versioning_config", () => {
  const vs = new ViewSet();
  vs.versioning_class = URLPathVersioning;
  vs.versioning_config = {
    defaultVersion: "v1",
    allowedVersions: ["v1", "v2"],
    versionParam: "ver",
  };
  const versioning = vs.getVersioning() as URLPathVersioning;
  assertExists(versioning);
  assertEquals(versioning.defaultVersion, "v1");
  assertEquals(versioning.allowedVersions, ["v1", "v2"]);
  assertEquals(versioning.versionParam, "ver");
});

Deno.test("ViewSet.getVersioning: applies QueryParameterVersioning config", () => {
  const vs = new ViewSet();
  vs.versioning_class = QueryParameterVersioning;
  vs.versioning_config = {
    defaultVersion: "1.0",
    allowedVersions: ["1.0", "2.0"],
    versionParam: "api_version",
  };
  const versioning = vs.getVersioning() as QueryParameterVersioning;
  assertExists(versioning);
  assertEquals(versioning.defaultVersion, "1.0");
  assertEquals(versioning.versionParam, "api_version");
});

Deno.test("VersionNotAllowedError: has correct properties", () => {
  const err = new VersionNotAllowedError("Invalid version", ["v1", "v2"]);
  assertEquals(err.status, 400);
  assertEquals(err.allowedVersions, ["v1", "v2"]);
  assertEquals(err.name, "VersionNotAllowedError");
});
