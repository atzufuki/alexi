/**
 * DefaultRouter Tests
 *
 * Tests for route generation order and custom @action registration.
 *
 * @module @alexi/restframework/routers/default_router_test
 */

import { assertEquals } from "jsr:@std/assert";
import { action, ViewSet } from "../viewsets/viewset.ts";
import type { ViewSetContext } from "../viewsets/viewset.ts";
import { DefaultRouter } from "./default_router.ts";

// ============================================================================
// Test ViewSet
// ============================================================================

class FarmViewSet extends ViewSet {
  override async list(_context: ViewSetContext): Promise<Response> {
    return Response.json([]);
  }

  override async retrieve(_context: ViewSetContext): Promise<Response> {
    return Response.json({});
  }

  @action({ detail: false, methods: ["GET"] })
  async count(_context: ViewSetContext): Promise<Response> {
    return Response.json({ count: 0 });
  }

  @action({ detail: true, methods: ["POST"] })
  async archive(_context: ViewSetContext): Promise<Response> {
    return Response.json({ archived: true });
  }
}

// ============================================================================
// Tests
// ============================================================================

Deno.test({
  name:
    "DefaultRouter: detail=False custom action registered before /:id/ route",
  fn() {
    const router = new DefaultRouter();
    router.register("farms", FarmViewSet);

    const urls = router.urls;

    // Find indices of the relevant routes.
    // Basename strips "ViewSet" suffix and lowercases: FarmViewSet → "farm"
    const countIdx = urls.findIndex((u) => u.name === "farm-count");
    const detailIdx = urls.findIndex((u) => u.name === "farm-detail");

    // count (detail=False) must come BEFORE /:id/ so it is not shadowed
    assertEquals(
      countIdx < detailIdx,
      true,
      `Expected 'count' route (index ${countIdx}) to appear before 'detail' route (index ${detailIdx})`,
    );
  },
});

Deno.test({
  name: "DefaultRouter: detail=True custom action registered after /:id/ route",
  fn() {
    const router = new DefaultRouter();
    router.register("farms", FarmViewSet);

    const urls = router.urls;

    const archiveIdx = urls.findIndex((u) => u.name === "farm-archive");
    const detailIdx = urls.findIndex((u) => u.name === "farm-detail");

    // archive (detail=True) must come AFTER /:id/
    assertEquals(
      archiveIdx > detailIdx,
      true,
      `Expected 'archive' route (index ${archiveIdx}) to appear after 'detail' route (index ${detailIdx})`,
    );
  },
});

Deno.test({
  name:
    "DefaultRouter: route order is list → list-actions → detail → detail-actions",
  fn() {
    const router = new DefaultRouter();
    router.register("farms", FarmViewSet);

    const urls = router.urls;
    const names = urls.map((u) => u.name);

    // FarmViewSet has list/retrieve, so all four route types are present.
    const listIdx = names.indexOf("farm-list");
    const countIdx = names.indexOf("farm-count");
    const detailIdx = names.indexOf("farm-detail");
    const archiveIdx = names.indexOf("farm-archive");

    assertEquals(listIdx < countIdx, true, "list must come before count");
    assertEquals(countIdx < detailIdx, true, "count must come before detail");
    assertEquals(
      detailIdx < archiveIdx,
      true,
      "detail must come before archive",
    );
  },
});

Deno.test({
  name:
    "DefaultRouter: GET /farms/count/ resolves to count action, not retrieve",
  fn() {
    const router = new DefaultRouter();
    router.register("farms", FarmViewSet);

    const urls = router.urls;

    // The first route that could match /farms/count/ should be the count route.
    // Without the fix, "farms/:id/" would appear first and swallow "count" as id.
    const firstMatchingName = urls.find((u) => {
      return u.name === "farm-count" || u.name === "farm-detail";
    })?.name;

    assertEquals(
      firstMatchingName,
      "farm-count",
      "The first route that could match /farms/count/ should be the count route",
    );
  },
});
