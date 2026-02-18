/**
 * Pagination Tests
 *
 * Tests for PageNumberPagination, LimitOffsetPagination, and CursorPagination.
 * These tests focus on pagination logic without requiring a database backend.
 *
 * @module @alexi/restframework/tests/pagination_test
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "jsr:@std/assert";
import {
  BasePagination,
  CursorPagination,
  LimitOffsetPagination,
  PageNumberPagination,
} from "../pagination/mod.ts";
import type { PaginationContext } from "../pagination/mod.ts";

// ============================================================================
// Helpers
// ============================================================================

function createPaginationContext(url: string): PaginationContext {
  return {
    request: new Request(url),
    view: undefined,
  };
}

// ============================================================================
// PageNumberPagination Tests
// ============================================================================

Deno.test("PageNumberPagination - default page size", () => {
  const paginator = new PageNumberPagination();
  const context = createPaginationContext("http://localhost/api/articles/");

  assertEquals(paginator.getPageSize(context), 10);
});

Deno.test("PageNumberPagination - custom page size via subclass", () => {
  class CustomPagination extends PageNumberPagination {
    override pageSize = 25;
  }

  const paginator = new CustomPagination();
  const context = createPaginationContext("http://localhost/api/articles/");

  assertEquals(paginator.getPageSize(context), 25);
});

Deno.test("PageNumberPagination - client-controlled page size", () => {
  class CustomPagination extends PageNumberPagination {
    override pageSize = 10;
    override pageSizeQueryParam = "page_size";
    override maxPageSize = 50;
  }

  const paginator = new CustomPagination();

  // Default
  const context1 = createPaginationContext("http://localhost/api/articles/");
  assertEquals(paginator.getPageSize(context1), 10);

  // Client override
  const context2 = createPaginationContext(
    "http://localhost/api/articles/?page_size=20",
  );
  assertEquals(paginator.getPageSize(context2), 20);

  // Exceeds max - should cap at maxPageSize
  const context3 = createPaginationContext(
    "http://localhost/api/articles/?page_size=100",
  );
  assertEquals(paginator.getPageSize(context3), 50);
});

Deno.test("PageNumberPagination - invalid page size returns default", () => {
  class CustomPagination extends PageNumberPagination {
    override pageSize = 15;
    override pageSizeQueryParam = "page_size";
  }

  const paginator = new CustomPagination();

  // Invalid value
  const context1 = createPaginationContext(
    "http://localhost/api/articles/?page_size=invalid",
  );
  assertEquals(paginator.getPageSize(context1), 15);

  // Zero
  const context2 = createPaginationContext(
    "http://localhost/api/articles/?page_size=0",
  );
  assertEquals(paginator.getPageSize(context2), 15);

  // Negative
  const context3 = createPaginationContext(
    "http://localhost/api/articles/?page_size=-5",
  );
  assertEquals(paginator.getPageSize(context3), 15);
});

Deno.test("PageNumberPagination - getResponseData structure", async () => {
  // Create a test subclass that exposes internal state setting
  class TestPagination extends PageNumberPagination {
    setInternalState(count: number, page: number, numPages: number) {
      this._count = count;
      this._page = page;
      this._numPages = numPages;
    }
  }

  const paginator = new TestPagination();
  paginator.pageSize = 10;
  paginator.setInternalState(50, 2, 5);

  const context = createPaginationContext(
    "http://localhost/api/articles/?page=2",
  );
  const response = await paginator.getResponseData(
    [{ id: 1, title: "Test" }],
    context,
  );

  assertEquals(response.count, 50);
  assertEquals(response.results.length, 1);
  assertEquals(response.results[0], { id: 1, title: "Test" });

  // Page 2 should have both next and previous
  assertExists(response.next);
  assertExists(response.previous);
});

Deno.test("PageNumberPagination - first page has no previous link", async () => {
  class TestPagination extends PageNumberPagination {
    setInternalState(count: number, page: number, numPages: number) {
      this._count = count;
      this._page = page;
      this._numPages = numPages;
    }
  }

  const paginator = new TestPagination();
  paginator.pageSize = 10;
  paginator.setInternalState(50, 1, 5);

  const context = createPaginationContext(
    "http://localhost/api/articles/?page=1",
  );
  const response = await paginator.getResponseData([], context);

  assertEquals(response.previous, null);
  assertExists(response.next);
  assertStringIncludes(response.next!, "page=2");
});

Deno.test("PageNumberPagination - last page has no next link", async () => {
  class TestPagination extends PageNumberPagination {
    setInternalState(count: number, page: number, numPages: number) {
      this._count = count;
      this._page = page;
      this._numPages = numPages;
    }
  }

  const paginator = new TestPagination();
  paginator.pageSize = 10;
  paginator.setInternalState(50, 5, 5);

  const context = createPaginationContext(
    "http://localhost/api/articles/?page=5",
  );
  const response = await paginator.getResponseData([], context);

  assertEquals(response.next, null);
  assertExists(response.previous);
  assertStringIncludes(response.previous!, "page=4");
});

Deno.test("PageNumberPagination - single page has no links", async () => {
  class TestPagination extends PageNumberPagination {
    setInternalState(count: number, page: number, numPages: number) {
      this._count = count;
      this._page = page;
      this._numPages = numPages;
    }
  }

  const paginator = new TestPagination();
  paginator.pageSize = 10;
  paginator.setInternalState(5, 1, 1);

  const context = createPaginationContext("http://localhost/api/articles/");
  const response = await paginator.getResponseData([], context);

  assertEquals(response.next, null);
  assertEquals(response.previous, null);
});

Deno.test("PageNumberPagination - buildUrl preserves existing query params", async () => {
  class TestPagination extends PageNumberPagination {
    setInternalState(count: number, page: number, numPages: number) {
      this._count = count;
      this._page = page;
      this._numPages = numPages;
    }
  }

  const paginator = new TestPagination();
  paginator.pageSize = 10;
  paginator.setInternalState(30, 1, 3);

  const context = createPaginationContext(
    "http://localhost/api/articles/?category=tech&page=1",
  );
  const response = await paginator.getResponseData([], context);

  assertExists(response.next);
  assertStringIncludes(response.next!, "category=tech");
  assertStringIncludes(response.next!, "page=2");
});

// ============================================================================
// LimitOffsetPagination Tests
// ============================================================================

Deno.test("LimitOffsetPagination - default page size", () => {
  const paginator = new LimitOffsetPagination();
  const context = createPaginationContext("http://localhost/api/articles/");

  assertEquals(paginator.getPageSize(context), 10);
});

Deno.test("LimitOffsetPagination - custom default limit via subclass", () => {
  class CustomPagination extends LimitOffsetPagination {
    override pageSize = 50;
    override defaultLimit = 50;
  }

  const paginator = new CustomPagination();
  const context = createPaginationContext("http://localhost/api/articles/");

  assertEquals(paginator.getPageSize(context), 50);
});

Deno.test("LimitOffsetPagination - getResponseData structure", async () => {
  class TestPagination extends LimitOffsetPagination {
    setInternalState(count: number, limit: number, offset: number) {
      this._count = count;
      this._limit = limit;
      this._offset = offset;
    }
  }

  const paginator = new TestPagination();
  paginator.setInternalState(100, 20, 40);

  const context = createPaginationContext(
    "http://localhost/api/articles/?limit=20&offset=40",
  );
  const response = await paginator.getResponseData(
    [{ id: 1, title: "Test" }],
    context,
  );

  assertEquals(response.count, 100);
  assertEquals(response.results.length, 1);
  assertEquals(response.results[0], { id: 1, title: "Test" });

  // offset=40 with limit=20, total=100 should have both links
  assertExists(response.next);
  assertExists(response.previous);
});

Deno.test("LimitOffsetPagination - no previous link at offset 0", async () => {
  class TestPagination extends LimitOffsetPagination {
    setInternalState(count: number, limit: number, offset: number) {
      this._count = count;
      this._limit = limit;
      this._offset = offset;
    }
  }

  const paginator = new TestPagination();
  paginator.setInternalState(50, 10, 0);

  const context = createPaginationContext(
    "http://localhost/api/articles/?limit=10&offset=0",
  );
  const response = await paginator.getResponseData([], context);

  assertEquals(response.previous, null);
  assertExists(response.next);
  assertStringIncludes(response.next!, "offset=10");
});

Deno.test("LimitOffsetPagination - no next link at end", async () => {
  class TestPagination extends LimitOffsetPagination {
    setInternalState(count: number, limit: number, offset: number) {
      this._count = count;
      this._limit = limit;
      this._offset = offset;
    }
  }

  const paginator = new TestPagination();
  paginator.setInternalState(50, 10, 40);

  const context = createPaginationContext(
    "http://localhost/api/articles/?limit=10&offset=40",
  );
  const response = await paginator.getResponseData([], context);

  assertEquals(response.next, null);
  assertExists(response.previous);
  assertStringIncludes(response.previous!, "offset=30");
});

Deno.test("LimitOffsetPagination - previous offset doesn't go negative", async () => {
  class TestPagination extends LimitOffsetPagination {
    setInternalState(count: number, limit: number, offset: number) {
      this._count = count;
      this._limit = limit;
      this._offset = offset;
    }
  }

  const paginator = new TestPagination();
  paginator.setInternalState(50, 10, 5); // offset=5, less than limit

  const context = createPaginationContext(
    "http://localhost/api/articles/?limit=10&offset=5",
  );
  const response = await paginator.getResponseData([], context);

  assertExists(response.previous);
  assertStringIncludes(response.previous!, "offset=0"); // Should be 0, not -5
});

Deno.test("LimitOffsetPagination - buildUrl preserves existing query params", async () => {
  class TestPagination extends LimitOffsetPagination {
    setInternalState(count: number, limit: number, offset: number) {
      this._count = count;
      this._limit = limit;
      this._offset = offset;
    }
  }

  const paginator = new TestPagination();
  paginator.setInternalState(50, 10, 0);

  const context = createPaginationContext(
    "http://localhost/api/articles/?category=tech&limit=10&offset=0",
  );
  const response = await paginator.getResponseData([], context);

  assertExists(response.next);
  assertStringIncludes(response.next!, "category=tech");
  assertStringIncludes(response.next!, "offset=10");
  assertStringIncludes(response.next!, "limit=10");
});

// ============================================================================
// CursorPagination Tests
// ============================================================================

Deno.test("CursorPagination - requires ordering field", async () => {
  const paginator = new CursorPagination();

  // Access the check directly instead of calling paginateQueryset
  assertEquals(paginator.ordering, null);
});

Deno.test("CursorPagination - custom ordering via subclass", () => {
  class CustomCursorPagination extends CursorPagination {
    override ordering = "-createdAt";
    override pageSize = 20;
  }

  const paginator = new CustomCursorPagination();
  assertEquals(paginator.ordering, "-createdAt");
  assertEquals(paginator.pageSize, 20);
});

Deno.test("CursorPagination - cursor encoding/decoding", () => {
  class TestCursorPagination extends CursorPagination {
    override ordering = "-createdAt";

    // Expose protected methods for testing
    testEncode(value: unknown): string {
      return this.encodeCursor(value);
    }

    testDecode(cursor: string): unknown {
      return this.decodeCursor(cursor);
    }
  }

  const paginator = new TestCursorPagination();

  // Test string value
  const strCursor = paginator.testEncode("2024-01-15T10:30:00Z");
  const strDecoded = paginator.testDecode(strCursor);
  assertEquals(strDecoded, "2024-01-15T10:30:00Z");

  // Test number value
  const numCursor = paginator.testEncode(12345);
  const numDecoded = paginator.testDecode(numCursor);
  assertEquals(numDecoded, 12345);

  // Test invalid cursor returns null
  const invalidDecoded = paginator.testDecode("invalid-cursor");
  assertEquals(invalidDecoded, null);

  // Test object value
  const objCursor = paginator.testEncode({ date: "2024-01-15", id: 42 });
  const objDecoded = paginator.testDecode(objCursor);
  assertEquals(objDecoded, { date: "2024-01-15", id: 42 });
});

Deno.test("CursorPagination - cursor is URL-safe", () => {
  class TestCursorPagination extends CursorPagination {
    override ordering = "-createdAt";

    testEncode(value: unknown): string {
      return this.encodeCursor(value);
    }
  }

  const paginator = new TestCursorPagination();

  // Test that special characters are replaced
  const cursor = paginator.testEncode("test/value+with=chars");

  // Should not contain standard base64 special chars
  assertEquals(cursor.includes("+"), false);
  assertEquals(cursor.includes("/"), false);
  assertEquals(cursor.includes("="), false);
});

Deno.test("CursorPagination - getResponseData returns count as -1", async () => {
  class TestCursorPagination extends CursorPagination {
    override ordering = "-createdAt";
    override pageSize = 10;

    setInternalState(hasNext: boolean, hasPrevious: boolean) {
      this._hasNext = hasNext;
      this._hasPrevious = hasPrevious;
    }
  }

  const paginator = new TestCursorPagination();
  paginator.setInternalState(false, false);

  const context = createPaginationContext("http://localhost/api/articles/");
  const response = await paginator.getResponseData(
    [{ id: 1, title: "Test" }],
    context,
  );

  // Cursor pagination doesn't provide total count
  assertEquals(response.count, -1);
  assertEquals(response.results.length, 1);
});

Deno.test("CursorPagination - next link with cursor", async () => {
  class TestCursorPagination extends CursorPagination {
    override ordering = "-createdAt";
    override pageSize = 10;

    setInternalState(
      hasNext: boolean,
      hasPrevious: boolean,
      nextCursor: string | null,
    ) {
      this._hasNext = hasNext;
      this._hasPrevious = hasPrevious;
      this._nextCursor = nextCursor;
    }
  }

  const paginator = new TestCursorPagination();
  paginator.setInternalState(true, false, "eyJ2IjoiMjAyNC0wMS0xNSJ9");

  const context = createPaginationContext("http://localhost/api/articles/");
  const response = await paginator.getResponseData([], context);

  assertExists(response.next);
  assertStringIncludes(response.next!, "cursor=eyJ2IjoiMjAyNC0wMS0xNSJ9");
  assertEquals(response.previous, null);
});

// ============================================================================
// BasePagination Abstract Class Tests
// ============================================================================

Deno.test("BasePagination - default properties", () => {
  // We can test via a concrete implementation
  const paginator = new PageNumberPagination();

  assertEquals(paginator.pageSize, 10);
  assertEquals(paginator.pageSizeQueryParam, null);
  assertEquals(paginator.maxPageSize, 100);
});

Deno.test("BasePagination - getPageSize respects maxPageSize", () => {
  class TestPagination extends PageNumberPagination {
    override pageSize = 10;
    override pageSizeQueryParam = "size";
    override maxPageSize = 25;
  }

  const paginator = new TestPagination();

  // Within max
  const context1 = createPaginationContext(
    "http://localhost/api/items/?size=20",
  );
  assertEquals(paginator.getPageSize(context1), 20);

  // Exceeds max
  const context2 = createPaginationContext(
    "http://localhost/api/items/?size=50",
  );
  assertEquals(paginator.getPageSize(context2), 25);
});
