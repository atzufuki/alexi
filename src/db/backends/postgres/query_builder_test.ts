/**
 * PostgreSQL Query Builder Tests
 *
 * Tests SQL generation without requiring a PostgreSQL database.
 *
 * @module
 */

import { assertEquals } from "jsr:@std/assert";
import {
  AutoField,
  CharField,
  IntegerField,
  Manager,
  Model,
} from "../../mod.ts";
import { createQueryState } from "../../query/types.ts";
import type {
  ParsedFilter,
  ParsedOrdering,
  QueryState,
} from "../../query/types.ts";
import {
  escapeLikePattern,
  fromPostgresValue,
  PostgresQueryBuilder,
  toPostgresValue,
} from "../postgres/query_builder.ts";

// ============================================================================
// Test Model
// ============================================================================

class TestArticle extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  status = new CharField({ maxLength: 20 });
  views = new IntegerField({ default: 0 });

  static objects = new Manager(TestArticle);
  static override meta = {
    dbTable: "test_articles",
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function createTestState(
  overrides: Partial<QueryState<TestArticle>> = {},
): QueryState<TestArticle> {
  const state = createQueryState(TestArticle);
  return { ...state, ...overrides };
}

// ============================================================================
// SELECT Query Tests
// ============================================================================

Deno.test("PostgresQueryBuilder - simple SELECT", () => {
  const state = createTestState();
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles"',
  );
  assertEquals(compiled.params, []);
});

Deno.test("PostgresQueryBuilder - SELECT with LIMIT", () => {
  const state = createTestState({ limit: 10 });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" LIMIT $1',
  );
  assertEquals(compiled.params, [10]);
});

Deno.test("PostgresQueryBuilder - SELECT with LIMIT and OFFSET", () => {
  const state = createTestState({ limit: 10, offset: 20 });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" LIMIT $1 OFFSET $2',
  );
  assertEquals(compiled.params, [10, 20]);
});

Deno.test("PostgresQueryBuilder - SELECT with ORDER BY", () => {
  const ordering: ParsedOrdering[] = [
    { field: "title", direction: "ASC" },
    { field: "views", direction: "DESC" },
  ];
  const state = createTestState({ ordering });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" ORDER BY "title" ASC, "views" DESC',
  );
});

Deno.test("PostgresQueryBuilder - SELECT with reversed ordering", () => {
  const ordering: ParsedOrdering[] = [
    { field: "title", direction: "ASC" },
  ];
  const state = createTestState({ ordering, reversed: true });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" ORDER BY "title" DESC',
  );
});

// ============================================================================
// Filter Tests
// ============================================================================

Deno.test("PostgresQueryBuilder - WHERE exact match", () => {
  const filters: ParsedFilter[] = [
    { field: "status", lookup: "exact", value: "published", negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."status" = $1',
  );
  assertEquals(compiled.params, ["published"]);
});

Deno.test("PostgresQueryBuilder - WHERE null", () => {
  const filters: ParsedFilter[] = [
    { field: "title", lookup: "exact", value: null, negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."title" IS NULL',
  );
  assertEquals(compiled.params, []);
});

Deno.test("PostgresQueryBuilder - WHERE isnull true", () => {
  const filters: ParsedFilter[] = [
    { field: "title", lookup: "isnull", value: true, negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."title" IS NULL',
  );
});

Deno.test("PostgresQueryBuilder - WHERE isnull false", () => {
  const filters: ParsedFilter[] = [
    { field: "title", lookup: "isnull", value: false, negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."title" IS NOT NULL',
  );
});

Deno.test("PostgresQueryBuilder - WHERE contains", () => {
  const filters: ParsedFilter[] = [
    { field: "title", lookup: "contains", value: "hello", negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."title" LIKE $1',
  );
  assertEquals(compiled.params, ["%hello%"]);
});

Deno.test("PostgresQueryBuilder - WHERE icontains", () => {
  const filters: ParsedFilter[] = [
    { field: "title", lookup: "icontains", value: "hello", negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."title" ILIKE $1',
  );
  assertEquals(compiled.params, ["%hello%"]);
});

Deno.test("PostgresQueryBuilder - WHERE startswith", () => {
  const filters: ParsedFilter[] = [
    { field: "title", lookup: "startswith", value: "hello", negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."title" LIKE $1',
  );
  assertEquals(compiled.params, ["hello%"]);
});

Deno.test("PostgresQueryBuilder - WHERE endswith", () => {
  const filters: ParsedFilter[] = [
    { field: "title", lookup: "endswith", value: "world", negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."title" LIKE $1',
  );
  assertEquals(compiled.params, ["%world"]);
});

Deno.test("PostgresQueryBuilder - WHERE gt/gte/lt/lte", () => {
  const filters: ParsedFilter[] = [
    { field: "views", lookup: "gte", value: 100, negated: false },
    { field: "views", lookup: "lt", value: 1000, negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."views" >= $1 AND "public"."test_articles"."views" < $2',
  );
  assertEquals(compiled.params, [100, 1000]);
});

Deno.test("PostgresQueryBuilder - WHERE in", () => {
  const filters: ParsedFilter[] = [
    {
      field: "status",
      lookup: "in",
      value: ["draft", "published"],
      negated: false,
    },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."status" = ANY($1)',
  );
  assertEquals(compiled.params, [["draft", "published"]]);
});

Deno.test("PostgresQueryBuilder - WHERE empty in array", () => {
  const filters: ParsedFilter[] = [
    { field: "status", lookup: "in", value: [], negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE FALSE',
  );
});

Deno.test("PostgresQueryBuilder - WHERE range", () => {
  const filters: ParsedFilter[] = [
    { field: "views", lookup: "range", value: [100, 500], negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."views" BETWEEN $1 AND $2',
  );
  assertEquals(compiled.params, [100, 500]);
});

Deno.test("PostgresQueryBuilder - WHERE negated", () => {
  const filters: ParsedFilter[] = [
    { field: "status", lookup: "exact", value: "draft", negated: true },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE NOT ("public"."test_articles"."status" = $1)',
  );
  assertEquals(compiled.params, ["draft"]);
});

Deno.test("PostgresQueryBuilder - WHERE regex", () => {
  const filters: ParsedFilter[] = [
    {
      field: "title",
      lookup: "regex",
      value: "^Hello.*World$",
      negated: false,
    },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."title" ~ $1',
  );
  assertEquals(compiled.params, ["^Hello.*World$"]);
});

Deno.test("PostgresQueryBuilder - WHERE iregex", () => {
  const filters: ParsedFilter[] = [
    { field: "title", lookup: "iregex", value: "hello", negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE "public"."test_articles"."title" ~* $1',
  );
  assertEquals(compiled.params, ["hello"]);
});

// ============================================================================
// Date Lookup Tests
// ============================================================================

Deno.test("PostgresQueryBuilder - WHERE year", () => {
  const filters: ParsedFilter[] = [
    { field: "created_at", lookup: "year", value: 2024, negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE EXTRACT(YEAR FROM "public"."test_articles"."created_at") = $1',
  );
  assertEquals(compiled.params, [2024]);
});

Deno.test("PostgresQueryBuilder - WHERE month", () => {
  const filters: ParsedFilter[] = [
    { field: "created_at", lookup: "month", value: 6, negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT "public"."test_articles".* FROM "public"."test_articles" WHERE EXTRACT(MONTH FROM "public"."test_articles"."created_at") = $1',
  );
  assertEquals(compiled.params, [6]);
});

// ============================================================================
// COUNT Query Tests
// ============================================================================

Deno.test("PostgresQueryBuilder - COUNT", () => {
  const state = createTestState();
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildCount();

  assertEquals(
    compiled.sql,
    'SELECT COUNT(*) FROM "public"."test_articles"',
  );
});

Deno.test("PostgresQueryBuilder - COUNT with filter", () => {
  const filters: ParsedFilter[] = [
    { field: "status", lookup: "exact", value: "published", negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildCount();

  assertEquals(
    compiled.sql,
    'SELECT COUNT(*) FROM "public"."test_articles" WHERE "public"."test_articles"."status" = $1',
  );
  assertEquals(compiled.params, ["published"]);
});

Deno.test("PostgresQueryBuilder - COUNT DISTINCT", () => {
  const state = createTestState({ distinctFields: ["status"] });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildCount();

  assertEquals(
    compiled.sql,
    'SELECT COUNT(DISTINCT ("status")) FROM "public"."test_articles"',
  );
});

// ============================================================================
// Aggregate Query Tests
// ============================================================================

Deno.test("PostgresQueryBuilder - aggregate SUM", () => {
  const state = createTestState();
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildAggregate({
    total_views: { func: "SUM", field: "views" },
  });

  assertEquals(
    compiled.sql,
    'SELECT SUM("views") AS "total_views" FROM "public"."test_articles"',
  );
});

Deno.test("PostgresQueryBuilder - aggregate multiple", () => {
  const state = createTestState();
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildAggregate({
    total_views: { func: "SUM", field: "views" },
    avg_views: { func: "AVG", field: "views" },
    max_views: { func: "MAX", field: "views" },
  });

  // Note: object order may vary, so we check components
  assertEquals(compiled.sql!.includes('SUM("views") AS "total_views"'), true);
  assertEquals(compiled.sql!.includes('AVG("views") AS "avg_views"'), true);
  assertEquals(compiled.sql!.includes('MAX("views") AS "max_views"'), true);
});

Deno.test("PostgresQueryBuilder - aggregate COUNT DISTINCT", () => {
  const state = createTestState();
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildAggregate({
    unique_statuses: { func: "COUNT", field: "status", distinct: true },
  });

  assertEquals(
    compiled.sql,
    'SELECT COUNT(DISTINCT "status") AS "unique_statuses" FROM "public"."test_articles"',
  );
});

// ============================================================================
// INSERT/UPDATE/DELETE Query Tests
// ============================================================================

Deno.test("PostgresQueryBuilder - INSERT", () => {
  const compiled = PostgresQueryBuilder.buildInsert(
    "test_articles",
    { title: "Hello", status: "draft", views: 0 },
    "public",
  );

  assertEquals(
    compiled.sql,
    'INSERT INTO "public"."test_articles" ("title", "status", "views") VALUES ($1, $2, $3) RETURNING *',
  );
  assertEquals(compiled.params, ["Hello", "draft", 0]);
});

Deno.test("PostgresQueryBuilder - UPDATE", () => {
  const compiled = PostgresQueryBuilder.buildUpdate(
    "test_articles",
    42,
    { title: "Updated", views: 100 },
    "public",
  );

  assertEquals(
    compiled.sql,
    'UPDATE "public"."test_articles" SET "title" = $1, "views" = $2 WHERE "id" = $3 RETURNING *',
  );
  assertEquals(compiled.params, ["Updated", 100, 42]);
});

Deno.test("PostgresQueryBuilder - DELETE", () => {
  const compiled = PostgresQueryBuilder.buildDelete(
    "test_articles",
    42,
    "public",
  );

  assertEquals(
    compiled.sql,
    'DELETE FROM "public"."test_articles" WHERE "id" = $1',
  );
  assertEquals(compiled.params, [42]);
});

Deno.test("PostgresQueryBuilder - deleteMany", () => {
  const filters: ParsedFilter[] = [
    { field: "status", lookup: "exact", value: "archived", negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildDeleteMany();

  assertEquals(
    compiled.sql,
    'DELETE FROM "public"."test_articles" WHERE "public"."test_articles"."status" = $1',
  );
  assertEquals(compiled.params, ["archived"]);
});

Deno.test("PostgresQueryBuilder - updateMany", () => {
  const filters: ParsedFilter[] = [
    { field: "status", lookup: "exact", value: "draft", negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildUpdateMany({ status: "published", views: 0 });

  assertEquals(
    compiled.sql,
    'UPDATE "public"."test_articles" SET "status" = $1, "views" = $2 WHERE "public"."test_articles"."status" = $3',
  );
  assertEquals(compiled.params, ["published", 0, "draft"]);
});

// ============================================================================
// Helper Function Tests
// ============================================================================

Deno.test("escapeLikePattern - escapes special characters", () => {
  assertEquals(escapeLikePattern("hello%world"), "hello\\%world");
  assertEquals(escapeLikePattern("hello_world"), "hello\\_world");
  assertEquals(escapeLikePattern("hello\\world"), "hello\\\\world");
  assertEquals(escapeLikePattern("100% done_now"), "100\\% done\\_now");
});

Deno.test("toPostgresValue - converts values", () => {
  // undefined -> null
  assertEquals(toPostgresValue(undefined), null);

  // Date -> ISO string
  const date = new Date("2024-06-15T12:00:00.000Z");
  assertEquals(toPostgresValue(date), "2024-06-15T12:00:00.000Z");

  // Object -> JSON string
  assertEquals(toPostgresValue({ foo: "bar" }), '{"foo":"bar"}');

  // Arrays pass through
  assertEquals(toPostgresValue([1, 2, 3]), [1, 2, 3]);

  // Primitives pass through
  assertEquals(toPostgresValue("hello"), "hello");
  assertEquals(toPostgresValue(123), 123);
  assertEquals(toPostgresValue(true), true);
  assertEquals(toPostgresValue(null), null);
});

Deno.test("fromPostgresValue - converts values", () => {
  // null passes through
  assertEquals(fromPostgresValue(null), null);
  assertEquals(fromPostgresValue(undefined), null);

  // DateTimeField string -> Date
  const result = fromPostgresValue("2024-06-15T12:00:00.000Z", "DateTimeField");
  assertEquals(result instanceof Date, true);
  assertEquals((result as Date).toISOString(), "2024-06-15T12:00:00.000Z");

  // JSONField string -> parsed object
  assertEquals(fromPostgresValue('{"foo":"bar"}', "JSONField"), { foo: "bar" });

  // Regular values pass through
  assertEquals(fromPostgresValue("hello"), "hello");
  assertEquals(fromPostgresValue(123), 123);
});

// ============================================================================
// DISTINCT Tests
// ============================================================================

Deno.test("PostgresQueryBuilder - SELECT DISTINCT", () => {
  const state = createTestState({ distinctFields: ["*"] });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT DISTINCT "public"."test_articles".* FROM "public"."test_articles"',
  );
});

Deno.test("PostgresQueryBuilder - SELECT DISTINCT ON fields", () => {
  const state = createTestState({ distinctFields: ["status", "title"] });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildSelect();

  assertEquals(
    compiled.sql,
    'SELECT DISTINCT ON ("status", "title") "public"."test_articles".* FROM "public"."test_articles"',
  );
});

// ============================================================================
// EXISTS Tests
// ============================================================================

Deno.test("PostgresQueryBuilder - EXISTS", () => {
  const state = createTestState();
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildExists();

  assertEquals(
    compiled.sql,
    'SELECT EXISTS(SELECT 1 FROM "public"."test_articles" )',
  );
});

Deno.test("PostgresQueryBuilder - EXISTS with filter", () => {
  const filters: ParsedFilter[] = [
    { field: "status", lookup: "exact", value: "published", negated: false },
  ];
  const state = createTestState({ filters });
  const builder = new PostgresQueryBuilder(state, "public");
  const compiled = builder.buildExists();

  assertEquals(
    compiled.sql,
    'SELECT EXISTS(SELECT 1 FROM "public"."test_articles" WHERE "public"."test_articles"."status" = $1 )',
  );
  assertEquals(compiled.params, ["published"]);
});
