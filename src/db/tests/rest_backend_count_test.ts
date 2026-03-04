/**
 * Tests for RestBackend.count() with filters
 *
 * Verifies that count() correctly forwards filters as query parameters
 * to the /{endpoint}/count/ endpoint.
 *
 * @module
 */

import { assertEquals } from "jsr:@std/assert@1";
import { AutoField, CharField, Manager, Model } from "../mod.ts";
import { ModelEndpoint, RestBackend } from "../backends/rest/mod.ts";
import { createQueryState } from "../query/types.ts";

// ============================================================================
// Test Models
// ============================================================================

class FarmModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  ownerId = new AutoField({});

  static objects = new Manager(FarmModel);
  static override meta = {
    dbTable: "farms",
  };
}

class FarmEndpoint extends ModelEndpoint {
  model = FarmModel;
  path = "/farms/";
}

// ============================================================================
// Test Helper: intercept fetch calls
// ============================================================================

type FetchCall = { url: string; options?: RequestInit };

class TrackingRestBackend extends RestBackend {
  fetchCalls: FetchCall[] = [];

  constructor(
    private mockResponse: Record<string, unknown> | unknown[],
    apiUrl = "http://test.local/api",
  ) {
    super({ apiUrl, endpoints: [FarmEndpoint] });
  }

  // deno-lint-ignore require-await
  protected override async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    this.fetchCalls.push({ url: path, options });
    return this.mockResponse as T;
  }
}

// ============================================================================
// Tests
// ============================================================================

Deno.test({
  name:
    "RestBackend.count() — no filters → calls /farms/count/ without query params",
  async fn() {
    const backend = new TrackingRestBackend({ count: 5 });
    const state = createQueryState(FarmModel);

    const result = await backend.count(state);

    assertEquals(result, 5);
    assertEquals(backend.fetchCalls.length, 1);
    assertEquals(backend.fetchCalls[0].url, "/farms/count/");
  },
});

Deno.test({
  name: "RestBackend.count() — with exact filter → appends query params",
  async fn() {
    const backend = new TrackingRestBackend({ count: 2 });
    const state = createQueryState(FarmModel);
    state.filters.push(
      { field: "ownerId", lookup: "exact", value: 42, negated: false },
    );

    const result = await backend.count(state);

    assertEquals(result, 2);
    assertEquals(backend.fetchCalls.length, 1);
    assertEquals(backend.fetchCalls[0].url, "/farms/count/?ownerId=42");
  },
});

Deno.test({
  name: "RestBackend.count() — with lookup filter → uses field__lookup format",
  async fn() {
    const backend = new TrackingRestBackend({ count: 3 });
    const state = createQueryState(FarmModel);
    state.filters.push({
      field: "name",
      lookup: "icontains",
      value: "sunset",
      negated: false,
    });

    const result = await backend.count(state);

    assertEquals(result, 3);
    assertEquals(backend.fetchCalls.length, 1);
    assertEquals(
      backend.fetchCalls[0].url,
      "/farms/count/?name__icontains=sunset",
    );
  },
});

Deno.test({
  name:
    "RestBackend.count() — with multiple filters → includes all as query params",
  async fn() {
    const backend = new TrackingRestBackend({ count: 1 });
    const state = createQueryState(FarmModel);
    state.filters.push(
      { field: "ownerId", lookup: "exact", value: 42, negated: false },
    );
    state.filters.push({
      field: "name",
      lookup: "icontains",
      value: "sunset",
      negated: false,
    });

    const result = await backend.count(state);

    assertEquals(result, 1);
    assertEquals(backend.fetchCalls.length, 1);

    const url = backend.fetchCalls[0].url;
    // Both params must be present (order may vary)
    const params = new URLSearchParams(url.split("?")[1]);
    assertEquals(params.get("ownerId"), "42");
    assertEquals(params.get("name__icontains"), "sunset");
  },
});

Deno.test({
  name: "RestBackend.count() — fallback to execute() when /count/ throws",
  async fn() {
    // Backend that fails on /count/ but returns results for list
    const backend = new class extends RestBackend {
      constructor() {
        super({ apiUrl: "http://test.local/api", endpoints: [FarmEndpoint] });
      }

      // deno-lint-ignore require-await
      protected override async request<T>(path: string): Promise<T> {
        if (path.includes("/count/")) {
          throw new Error("Not Found");
        }
        // Simulate list response with 3 items
        return [{ id: 1 }, { id: 2 }, { id: 3 }] as T;
      }
    }();

    const state = createQueryState(FarmModel);
    state.filters.push(
      { field: "ownerId", lookup: "exact", value: 7, negated: false },
    );

    const result = await backend.count(state);

    // Falls back to execute() which returns 3 items
    assertEquals(result, 3);
  },
});
