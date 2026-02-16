/**
 * Filter Backends Tests
 *
 * Tests for QueryParamFilterBackend, SearchFilter, and OrderingFilter.
 *
 * @module @alexi/restframework/tests/filters_test
 */

import { assertEquals } from "jsr:@std/assert";
import {
  OrderingFilter,
  QueryParamFilterBackend,
  SearchFilter,
} from "../filters/mod.ts";
import type { FilterableViewSet } from "../filters/mod.ts";
import type { ViewSetContext } from "../viewsets/mod.ts";
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  IntegerField,
  Model,
  QuerySet,
} from "@alexi/db";

// ============================================================================
// Test Model
// ============================================================================

class TestTodoModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  completed = new BooleanField({ default: false });
  priority = new IntegerField({ default: 0 });
  createdAt = new DateTimeField({ autoNowAdd: true });

  static override meta = {
    dbTable: "test_todos",
  };
}

// ============================================================================
// Helpers
// ============================================================================

function createMockContext(url: string): ViewSetContext {
  return {
    request: new Request(url),
    params: {},
    action: "list",
  };
}

function createMockViewSet(
  options: Partial<FilterableViewSet> = {},
): FilterableViewSet {
  return {
    filtersetFields: options.filtersetFields,
    filterBackends: options.filterBackends,
  };
}

// ============================================================================
// QueryParamFilterBackend Tests
// ============================================================================

Deno.test("QueryParamFilterBackend - filters by allowed field", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext("http://localhost/api/todos/?id=18");
  const viewset = createMockViewSet({ filtersetFields: ["id", "completed"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  // Check that filter was added to state
  assertEquals(filtered.state.filters.length, 1);
  assertEquals(filtered.state.filters[0].field, "id");
  assertEquals(filtered.state.filters[0].value, 18);
  assertEquals(filtered.state.filters[0].lookup, "exact");
});

Deno.test("QueryParamFilterBackend - ignores fields not in filtersetFields", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?secret=hidden",
  );
  const viewset = createMockViewSet({ filtersetFields: ["id", "completed"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  // No filters should be added
  assertEquals(filtered.state.filters.length, 0);
});

Deno.test("QueryParamFilterBackend - parses boolean values", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?completed=true",
  );
  const viewset = createMockViewSet({ filtersetFields: ["completed"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters.length, 1);
  assertEquals(filtered.state.filters[0].field, "completed");
  assertEquals(filtered.state.filters[0].value, true);
});

Deno.test("QueryParamFilterBackend - parses false boolean", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?completed=false",
  );
  const viewset = createMockViewSet({ filtersetFields: ["completed"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters[0].value, false);
});

Deno.test("QueryParamFilterBackend - parses numeric values", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext("http://localhost/api/todos/?priority=5");
  const viewset = createMockViewSet({ filtersetFields: ["priority"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters[0].field, "priority");
  assertEquals(filtered.state.filters[0].value, 5);
});

Deno.test("QueryParamFilterBackend - handles lookup expressions", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?title__contains=test",
  );
  const viewset = createMockViewSet({ filtersetFields: ["title"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters.length, 1);
  assertEquals(filtered.state.filters[0].field, "title");
  assertEquals(filtered.state.filters[0].lookup, "contains");
  assertEquals(filtered.state.filters[0].value, "test");
});

Deno.test("QueryParamFilterBackend - handles icontains lookup", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?title__icontains=TEST",
  );
  const viewset = createMockViewSet({ filtersetFields: ["title"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters[0].lookup, "icontains");
  assertEquals(filtered.state.filters[0].value, "TEST");
});

Deno.test("QueryParamFilterBackend - handles gte/lte lookups", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?priority__gte=3",
  );
  const viewset = createMockViewSet({ filtersetFields: ["priority"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters[0].field, "priority");
  assertEquals(filtered.state.filters[0].lookup, "gte");
  assertEquals(filtered.state.filters[0].value, 3);
});

Deno.test("QueryParamFilterBackend - handles 'in' lookup with comma-separated values", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext("http://localhost/api/todos/?id__in=1,2,3");
  const viewset = createMockViewSet({ filtersetFields: ["id"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters[0].field, "id");
  assertEquals(filtered.state.filters[0].lookup, "in");
  assertEquals(filtered.state.filters[0].value, [1, 2, 3]);
});

Deno.test("QueryParamFilterBackend - handles isnull lookup", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?title__isnull=true",
  );
  const viewset = createMockViewSet({ filtersetFields: ["title"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters[0].lookup, "isnull");
  assertEquals(filtered.state.filters[0].value, true);
});

Deno.test("QueryParamFilterBackend - skips reserved parameters", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?limit=10&offset=20&ordering=-title&page=1&id=5",
  );
  const viewset = createMockViewSet({ filtersetFields: ["id", "limit"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  // Only id should be filtered, limit is reserved
  assertEquals(filtered.state.filters.length, 1);
  assertEquals(filtered.state.filters[0].field, "id");
});

Deno.test("QueryParamFilterBackend - multiple filters", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?completed=true&priority__gte=3",
  );
  const viewset = createMockViewSet({
    filtersetFields: ["completed", "priority"],
  });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters.length, 2);
});

Deno.test("QueryParamFilterBackend - no filtersetFields returns unfiltered", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext("http://localhost/api/todos/?id=5");
  const viewset = createMockViewSet({ filtersetFields: undefined });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters.length, 0);
});

Deno.test("QueryParamFilterBackend - empty filtersetFields returns unfiltered", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext("http://localhost/api/todos/?id=5");
  const viewset = createMockViewSet({ filtersetFields: [] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters.length, 0);
});

Deno.test("QueryParamFilterBackend - handles null value", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext("http://localhost/api/todos/?title=null");
  const viewset = createMockViewSet({ filtersetFields: ["title"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters[0].value, null);
});

Deno.test("QueryParamFilterBackend - preserves string values", () => {
  const backend = new QueryParamFilterBackend();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?title=hello%20world",
  );
  const viewset = createMockViewSet({ filtersetFields: ["title"] });

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters[0].value, "hello world");
});

// ============================================================================
// OrderingFilter Tests
// ============================================================================

Deno.test("OrderingFilter - applies ordering from query param", () => {
  const backend = new OrderingFilter();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?ordering=title",
  );
  const viewset = createMockViewSet() as FilterableViewSet & {
    orderingFields?: string[];
  };
  viewset.orderingFields = ["title", "createdAt"];

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.ordering.length, 1);
  assertEquals(filtered.state.ordering[0].field, "title");
  assertEquals(filtered.state.ordering[0].direction, "ASC");
});

Deno.test("OrderingFilter - handles descending order with minus prefix", () => {
  const backend = new OrderingFilter();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?ordering=-createdAt",
  );
  const viewset = createMockViewSet() as FilterableViewSet & {
    orderingFields?: string[];
  };
  viewset.orderingFields = ["title", "createdAt"];

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.ordering.length, 1);
  assertEquals(filtered.state.ordering[0].field, "createdAt");
  assertEquals(filtered.state.ordering[0].direction, "DESC");
});

Deno.test("OrderingFilter - handles multiple ordering fields", () => {
  const backend = new OrderingFilter();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?ordering=-createdAt,title",
  );
  const viewset = createMockViewSet() as FilterableViewSet & {
    orderingFields?: string[];
  };
  viewset.orderingFields = ["title", "createdAt"];

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.ordering.length, 2);
  assertEquals(filtered.state.ordering[0].field, "createdAt");
  assertEquals(filtered.state.ordering[0].direction, "DESC");
  assertEquals(filtered.state.ordering[1].field, "title");
  assertEquals(filtered.state.ordering[1].direction, "ASC");
});

Deno.test("OrderingFilter - ignores fields not in orderingFields", () => {
  const backend = new OrderingFilter();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?ordering=secret,-title",
  );
  const viewset = createMockViewSet() as FilterableViewSet & {
    orderingFields?: string[];
  };
  viewset.orderingFields = ["title", "createdAt"];

  const filtered = backend.filterQueryset(queryset, context, viewset);

  // Only title should be applied
  assertEquals(filtered.state.ordering.length, 1);
  assertEquals(filtered.state.ordering[0].field, "title");
});

Deno.test("OrderingFilter - uses default ordering when no param", () => {
  const backend = new OrderingFilter();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext("http://localhost/api/todos/");
  const viewset = createMockViewSet() as FilterableViewSet & {
    orderingFields?: string[];
    ordering?: string[];
  };
  viewset.orderingFields = ["title", "createdAt"];
  viewset.ordering = ["-createdAt"];

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.ordering.length, 1);
  assertEquals(filtered.state.ordering[0].field, "createdAt");
  assertEquals(filtered.state.ordering[0].direction, "DESC");
});

Deno.test("OrderingFilter - allows all fields when orderingFields not set", () => {
  const backend = new OrderingFilter();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?ordering=anyfield",
  );
  const viewset = createMockViewSet() as FilterableViewSet & {
    orderingFields?: string[];
  };

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.ordering.length, 1);
  assertEquals(filtered.state.ordering[0].field, "anyfield");
});

// ============================================================================
// SearchFilter Tests
// ============================================================================

Deno.test("SearchFilter - applies search on first field", () => {
  const backend = new SearchFilter();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext("http://localhost/api/todos/?search=hello");
  const viewset = createMockViewSet() as FilterableViewSet & {
    searchFields?: string[];
  };
  viewset.searchFields = ["title", "description"];

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters.length, 1);
  assertEquals(filtered.state.filters[0].field, "title");
  assertEquals(filtered.state.filters[0].lookup, "icontains");
  assertEquals(filtered.state.filters[0].value, "hello");
});

Deno.test("SearchFilter - trims search term", () => {
  const backend = new SearchFilter();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?search=%20hello%20",
  );
  const viewset = createMockViewSet() as FilterableViewSet & {
    searchFields?: string[];
  };
  viewset.searchFields = ["title"];

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters[0].value, "hello");
});

Deno.test("SearchFilter - returns unfiltered when no searchFields", () => {
  const backend = new SearchFilter();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext("http://localhost/api/todos/?search=hello");
  const viewset = createMockViewSet() as FilterableViewSet & {
    searchFields?: string[];
  };

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters.length, 0);
});

Deno.test("SearchFilter - returns unfiltered when search param empty", () => {
  const backend = new SearchFilter();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext("http://localhost/api/todos/?search=");
  const viewset = createMockViewSet() as FilterableViewSet & {
    searchFields?: string[];
  };
  viewset.searchFields = ["title"];

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters.length, 0);
});

Deno.test("SearchFilter - returns unfiltered when search param is whitespace only", () => {
  const backend = new SearchFilter();
  const queryset = new QuerySet(TestTodoModel);
  const context = createMockContext(
    "http://localhost/api/todos/?search=%20%20%20",
  );
  const viewset = createMockViewSet() as FilterableViewSet & {
    searchFields?: string[];
  };
  viewset.searchFields = ["title"];

  const filtered = backend.filterQueryset(queryset, context, viewset);

  assertEquals(filtered.state.filters.length, 0);
});
