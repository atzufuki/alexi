/**
 * Alexi Admin - Filter Tests
 *
 * TDD tests for Phase 4: Filters
 *
 * @module
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  Manager,
  Model,
} from "@alexi/db";

// =============================================================================
// Test Model
// =============================================================================

class TestArticleModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  status = new CharField({
    maxLength: 20,
    choices: [
      ["draft", "Draft"],
      ["published", "Published"],
      ["archived", "Archived"],
    ],
  });
  isActive = new BooleanField({ default: true });
  isFeatured = new BooleanField({ default: false });
  category = new CharField({
    maxLength: 50,
    choices: [
      ["news", "News"],
      ["blog", "Blog"],
      ["tutorial", "Tutorial"],
    ],
  });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(TestArticleModel);
  static meta = {
    dbTable: "test_articles",
  };
}

// =============================================================================
// Import filter utilities (to be implemented)
// =============================================================================

import {
  type DateRangeValue,
  type FilterConfig,
  type FilterValue,
  getFilterChoices,
  getFiltersForFields,
  parseFilterParams,
  serializeFilterParams,
} from "../filters.ts";
import { type FieldInfo, getModelFields } from "../introspection.ts";

// =============================================================================
// Filter Configuration Tests
// =============================================================================

Deno.test("getFiltersForFields: returns empty array for empty field list", () => {
  const filters = getFiltersForFields([], []);
  assertEquals(filters, []);
});

Deno.test("getFiltersForFields: creates BooleanFilter for BooleanField", () => {
  const fields = getModelFields(TestArticleModel);
  const filters = getFiltersForFields(fields, ["isActive"]);

  assertEquals(filters.length, 1);
  assertEquals(filters[0].field, "isActive");
  assertEquals(filters[0].type, "boolean");
  assertEquals(filters[0].label, "Is Active");
});

Deno.test("getFiltersForFields: creates ChoiceFilter for CharField with choices", () => {
  const fields = getModelFields(TestArticleModel);
  const filters = getFiltersForFields(fields, ["status"]);

  assertEquals(filters.length, 1);
  assertEquals(filters[0].field, "status");
  assertEquals(filters[0].type, "choice");
  assertEquals(filters[0].label, "Status");
  assertExists(filters[0].choices);
  assertEquals(filters[0].choices?.length, 3);
});

Deno.test("getFiltersForFields: creates DateRangeFilter for DateTimeField", () => {
  const fields = getModelFields(TestArticleModel);
  const filters = getFiltersForFields(fields, ["createdAt"]);

  assertEquals(filters.length, 1);
  assertEquals(filters[0].field, "createdAt");
  assertEquals(filters[0].type, "date_range");
  assertEquals(filters[0].label, "Created At");
});

Deno.test("getFiltersForFields: handles multiple filter fields", () => {
  const fields = getModelFields(TestArticleModel);
  const filters = getFiltersForFields(fields, [
    "status",
    "isActive",
    "category",
  ]);

  assertEquals(filters.length, 3);
  assertEquals(filters[0].field, "status");
  assertEquals(filters[1].field, "isActive");
  assertEquals(filters[2].field, "category");
});

Deno.test("getFiltersForFields: ignores non-existent fields", () => {
  const fields = getModelFields(TestArticleModel);
  const filters = getFiltersForFields(fields, ["nonExistent", "status"]);

  assertEquals(filters.length, 1);
  assertEquals(filters[0].field, "status");
});

Deno.test("getFiltersForFields: uses verboseName from field options", () => {
  const mockFields: FieldInfo[] = [
    {
      name: "myField",
      type: "BooleanField",
      options: { verboseName: "My Custom Label" },
      isPrimaryKey: false,
      isEditable: true,
      isAuto: false,
      isRequired: false,
    },
  ];

  const filters = getFiltersForFields(mockFields, ["myField"]);

  assertEquals(filters.length, 1);
  assertEquals(filters[0].label, "My Custom Label");
});

// =============================================================================
// URL Parameter Parsing Tests
// =============================================================================

Deno.test("parseFilterParams: returns empty object for empty URL params", () => {
  const params = new URLSearchParams();
  const result = parseFilterParams(params, []);

  assertEquals(result, {});
});

Deno.test("parseFilterParams: parses boolean filter from URL", () => {
  const params = new URLSearchParams("isActive=true");
  const filters: FilterConfig[] = [
    { field: "isActive", type: "boolean", label: "Is Active" },
  ];

  const result = parseFilterParams(params, filters);

  assertEquals(result.isActive, true);
});

Deno.test("parseFilterParams: parses boolean false from URL", () => {
  const params = new URLSearchParams("isActive=false");
  const filters: FilterConfig[] = [
    { field: "isActive", type: "boolean", label: "Is Active" },
  ];

  const result = parseFilterParams(params, filters);

  assertEquals(result.isActive, false);
});

Deno.test("parseFilterParams: parses choice filter from URL", () => {
  const params = new URLSearchParams("status=published");
  const filters: FilterConfig[] = [
    {
      field: "status",
      type: "choice",
      label: "Status",
      choices: [["draft", "Draft"], ["published", "Published"]],
    },
  ];

  const result = parseFilterParams(params, filters);

  assertEquals(result.status, "published");
});

Deno.test("parseFilterParams: parses date range filter from URL", () => {
  const params = new URLSearchParams(
    "createdAt__gte=2024-01-01&createdAt__lte=2024-12-31",
  );
  const filters: FilterConfig[] = [
    { field: "createdAt", type: "date_range", label: "Created At" },
  ];

  const result = parseFilterParams(params, filters);

  const dateRange = result.createdAt as DateRangeValue;
  assertEquals(dateRange.gte, "2024-01-01");
  assertEquals(dateRange.lte, "2024-12-31");
});

Deno.test("parseFilterParams: parses partial date range (only gte)", () => {
  const params = new URLSearchParams("createdAt__gte=2024-01-01");
  const filters: FilterConfig[] = [
    { field: "createdAt", type: "date_range", label: "Created At" },
  ];

  const result = parseFilterParams(params, filters);

  const dateRange = result.createdAt as DateRangeValue;
  assertEquals(dateRange.gte, "2024-01-01");
  assertEquals(dateRange.lte, undefined);
});

Deno.test("parseFilterParams: parses partial date range (only lte)", () => {
  const params = new URLSearchParams("createdAt__lte=2024-12-31");
  const filters: FilterConfig[] = [
    { field: "createdAt", type: "date_range", label: "Created At" },
  ];

  const result = parseFilterParams(params, filters);

  const dateRange = result.createdAt as DateRangeValue;
  assertEquals(dateRange.gte, undefined);
  assertEquals(dateRange.lte, "2024-12-31");
});

Deno.test("parseFilterParams: ignores unknown filter params", () => {
  const params = new URLSearchParams("unknown=value&status=draft");
  const filters: FilterConfig[] = [
    { field: "status", type: "choice", label: "Status", choices: [] },
  ];

  const result = parseFilterParams(params, filters);

  assertEquals(result.status, "draft");
  assertEquals(result.unknown, undefined);
});

Deno.test("parseFilterParams: handles multiple filters", () => {
  const params = new URLSearchParams("status=published&isActive=true");
  const filters: FilterConfig[] = [
    { field: "status", type: "choice", label: "Status", choices: [] },
    { field: "isActive", type: "boolean", label: "Is Active" },
  ];

  const result = parseFilterParams(params, filters);

  assertEquals(result.status, "published");
  assertEquals(result.isActive, true);
});

// =============================================================================
// URL Parameter Serialization Tests
// =============================================================================

Deno.test("serializeFilterParams: returns empty URLSearchParams for empty values", () => {
  const result = serializeFilterParams({});

  assertEquals(result.toString(), "");
});

Deno.test("serializeFilterParams: serializes boolean true", () => {
  const result = serializeFilterParams({ isActive: true });

  assertEquals(result.get("isActive"), "true");
});

Deno.test("serializeFilterParams: serializes boolean false", () => {
  const result = serializeFilterParams({ isActive: false });

  assertEquals(result.get("isActive"), "false");
});

Deno.test("serializeFilterParams: serializes string value", () => {
  const result = serializeFilterParams({ status: "published" });

  assertEquals(result.get("status"), "published");
});

Deno.test("serializeFilterParams: serializes date range", () => {
  const result = serializeFilterParams({
    createdAt: { gte: "2024-01-01", lte: "2024-12-31" },
  });

  assertEquals(result.get("createdAt__gte"), "2024-01-01");
  assertEquals(result.get("createdAt__lte"), "2024-12-31");
});

Deno.test("serializeFilterParams: serializes partial date range (only gte)", () => {
  const result = serializeFilterParams({
    createdAt: { gte: "2024-01-01" },
  });

  assertEquals(result.get("createdAt__gte"), "2024-01-01");
  assertEquals(result.get("createdAt__lte"), null);
});

Deno.test("serializeFilterParams: skips null and undefined values", () => {
  const result = serializeFilterParams({
    status: null as unknown as string,
    category: undefined as unknown as string,
    isActive: true,
  });

  assertEquals(result.get("status"), null);
  assertEquals(result.get("category"), null);
  assertEquals(result.get("isActive"), "true");
});

Deno.test("serializeFilterParams: handles multiple filter values", () => {
  const result = serializeFilterParams({
    status: "published",
    isActive: true,
    category: "blog",
  });

  assertEquals(result.get("status"), "published");
  assertEquals(result.get("isActive"), "true");
  assertEquals(result.get("category"), "blog");
});

// =============================================================================
// Round-trip Tests (parse -> serialize -> parse)
// =============================================================================

Deno.test("parseFilterParams + serializeFilterParams: round-trip for boolean", () => {
  const filters: FilterConfig[] = [
    { field: "isActive", type: "boolean", label: "Is Active" },
  ];

  const original = new URLSearchParams("isActive=true");
  const parsed = parseFilterParams(original, filters);
  const serialized = serializeFilterParams(parsed);
  const reparsed = parseFilterParams(serialized, filters);

  assertEquals(reparsed.isActive, true);
});

Deno.test("parseFilterParams + serializeFilterParams: round-trip for choice", () => {
  const filters: FilterConfig[] = [
    { field: "status", type: "choice", label: "Status", choices: [] },
  ];

  const original = new URLSearchParams("status=published");
  const parsed = parseFilterParams(original, filters);
  const serialized = serializeFilterParams(parsed);
  const reparsed = parseFilterParams(serialized, filters);

  assertEquals(reparsed.status, "published");
});

Deno.test("parseFilterParams + serializeFilterParams: round-trip for date range", () => {
  const filters: FilterConfig[] = [
    { field: "createdAt", type: "date_range", label: "Created At" },
  ];

  const original = new URLSearchParams(
    "createdAt__gte=2024-01-01&createdAt__lte=2024-12-31",
  );
  const parsed = parseFilterParams(original, filters);
  const serialized = serializeFilterParams(parsed);
  const reparsed = parseFilterParams(serialized, filters);

  const dateRange = reparsed.createdAt as DateRangeValue;
  assertEquals(dateRange.gte, "2024-01-01");
  assertEquals(dateRange.lte, "2024-12-31");
});

// =============================================================================
// Filter Choices Helper Tests
// =============================================================================

Deno.test("getFilterChoices: returns choices from field options", () => {
  const fields = getModelFields(TestArticleModel);
  const statusField = fields.find((f) => f.name === "status");
  assertExists(statusField);

  const choices = getFilterChoices(statusField);

  assertEquals(choices?.length, 3);
  assertEquals(choices?.[0], ["draft", "Draft"]);
  assertEquals(choices?.[1], ["published", "Published"]);
  assertEquals(choices?.[2], ["archived", "Archived"]);
});

Deno.test("getFilterChoices: returns undefined for field without choices", () => {
  const fields = getModelFields(TestArticleModel);
  const titleField = fields.find((f) => f.name === "title");
  assertExists(titleField);

  const choices = getFilterChoices(titleField);

  assertEquals(choices, undefined);
});

Deno.test("getFilterChoices: returns boolean choices for BooleanField", () => {
  const fields = getModelFields(TestArticleModel);
  const isActiveField = fields.find((f) => f.name === "isActive");
  assertExists(isActiveField);

  const choices = getFilterChoices(isActiveField);

  assertEquals(choices?.length, 2);
  assertEquals(choices?.[0], [true, "Yes"]);
  assertEquals(choices?.[1], [false, "No"]);
});

// =============================================================================
// Filter Type Detection Tests
// =============================================================================

Deno.test("getFiltersForFields: detects correct filter type for each field type", () => {
  const fields = getModelFields(TestArticleModel);

  // Test all filterable fields
  const allFilterFields = [
    "status",
    "isActive",
    "isFeatured",
    "category",
    "createdAt",
  ];
  const filters = getFiltersForFields(fields, allFilterFields);

  const statusFilter = filters.find((f) => f.field === "status");
  const isActiveFilter = filters.find((f) => f.field === "isActive");
  const categoryFilter = filters.find((f) => f.field === "category");
  const createdAtFilter = filters.find((f) => f.field === "createdAt");

  assertEquals(statusFilter?.type, "choice");
  assertEquals(isActiveFilter?.type, "boolean");
  assertEquals(categoryFilter?.type, "choice");
  assertEquals(createdAtFilter?.type, "date_range");
});

// =============================================================================
// Edge Cases
// =============================================================================

Deno.test("parseFilterParams: handles empty string values", () => {
  const params = new URLSearchParams("status=");
  const filters: FilterConfig[] = [
    { field: "status", type: "choice", label: "Status", choices: [] },
  ];

  const result = parseFilterParams(params, filters);

  // Empty string should be treated as no filter
  assertEquals(result.status, undefined);
});

Deno.test("serializeFilterParams: handles empty string values", () => {
  const result = serializeFilterParams({ status: "" });

  // Empty string should not be serialized
  assertEquals(result.get("status"), null);
});

Deno.test("parseFilterParams: handles special characters in values", () => {
  const params = new URLSearchParams("status=hello%20world");
  const filters: FilterConfig[] = [
    { field: "status", type: "choice", label: "Status", choices: [] },
  ];

  const result = parseFilterParams(params, filters);

  assertEquals(result.status, "hello world");
});

Deno.test("serializeFilterParams: properly encodes special characters", () => {
  const result = serializeFilterParams({ status: "hello world" });

  // URLSearchParams handles encoding
  assertEquals(result.get("status"), "hello world");
  // When converted to string, it should be encoded
  assertEquals(result.toString().includes("hello"), true);
});

// =============================================================================
// Filter Label Generation Tests
// =============================================================================

Deno.test("getFiltersForFields: generates human-readable labels from field names", () => {
  const mockFields: FieldInfo[] = [
    {
      name: "isActive",
      type: "BooleanField",
      options: {},
      isPrimaryKey: false,
      isEditable: true,
      isAuto: false,
      isRequired: false,
    },
    {
      name: "createdAt",
      type: "DateTimeField",
      options: {},
      isPrimaryKey: false,
      isEditable: false,
      isAuto: true,
      isRequired: false,
    },
    {
      name: "subscriptionPlan",
      type: "CharField",
      options: {
        choices: [["free", "Free"], ["premium", "Premium"]],
      },
      isPrimaryKey: false,
      isEditable: true,
      isAuto: false,
      isRequired: false,
    },
  ];

  const filters = getFiltersForFields(mockFields, [
    "isActive",
    "createdAt",
    "subscriptionPlan",
  ]);

  assertEquals(filters[0].label, "Is Active");
  assertEquals(filters[1].label, "Created At");
  assertEquals(filters[2].label, "Subscription Plan");
});

// =============================================================================
// Search Parameter Preservation Tests
// =============================================================================

Deno.test("parseFilterParams: preserves search query parameter", () => {
  const params = new URLSearchParams("q=search+term&status=published");
  const filters: FilterConfig[] = [
    { field: "status", type: "choice", label: "Status", choices: [] },
  ];

  const result = parseFilterParams(params, filters);

  // Search query should not be parsed as filter
  assertEquals(result.q, undefined);
  assertEquals(result.status, "published");
});

Deno.test("serializeFilterParams: does not include search in filter params", () => {
  const result = serializeFilterParams({
    status: "published",
  });

  // Only filter params should be included
  assertEquals(result.get("status"), "published");
  assertEquals(result.get("q"), null);
});

// =============================================================================
// Pagination Parameter Preservation Tests
// =============================================================================

Deno.test("parseFilterParams: ignores pagination parameters", () => {
  const params = new URLSearchParams("page=2&per_page=25&status=published");
  const filters: FilterConfig[] = [
    { field: "status", type: "choice", label: "Status", choices: [] },
  ];

  const result = parseFilterParams(params, filters);

  assertEquals(result.page, undefined);
  assertEquals(result.per_page, undefined);
  assertEquals(result.status, "published");
});

// =============================================================================
// Additional Utility Function Tests
// =============================================================================

import {
  clearFilterParams,
  countActiveFilters,
  hasActiveFilters,
  mergeFilterParams,
} from "../filters.ts";

Deno.test("hasActiveFilters: returns false for empty values", () => {
  const result = hasActiveFilters({});
  assertEquals(result, false);
});

Deno.test("hasActiveFilters: returns false for undefined values", () => {
  const result = hasActiveFilters({ status: undefined, isActive: undefined });
  assertEquals(result, false);
});

Deno.test("hasActiveFilters: returns true for boolean value", () => {
  const result = hasActiveFilters({ isActive: true });
  assertEquals(result, true);
});

Deno.test("hasActiveFilters: returns true for boolean false value", () => {
  const result = hasActiveFilters({ isActive: false });
  assertEquals(result, true);
});

Deno.test("hasActiveFilters: returns true for string value", () => {
  const result = hasActiveFilters({ status: "published" });
  assertEquals(result, true);
});

Deno.test("hasActiveFilters: returns false for empty string value", () => {
  const result = hasActiveFilters({ status: "" });
  assertEquals(result, false);
});

Deno.test("hasActiveFilters: returns true for date range with gte", () => {
  const result = hasActiveFilters({ createdAt: { gte: "2024-01-01" } });
  assertEquals(result, true);
});

Deno.test("hasActiveFilters: returns true for date range with lte", () => {
  const result = hasActiveFilters({ createdAt: { lte: "2024-12-31" } });
  assertEquals(result, true);
});

Deno.test("hasActiveFilters: returns false for empty date range", () => {
  const result = hasActiveFilters({ createdAt: {} });
  assertEquals(result, false);
});

Deno.test("countActiveFilters: returns 0 for empty values", () => {
  const result = countActiveFilters({});
  assertEquals(result, 0);
});

Deno.test("countActiveFilters: counts boolean filters", () => {
  const result = countActiveFilters({ isActive: true, isFeatured: false });
  assertEquals(result, 2);
});

Deno.test("countActiveFilters: counts string filters", () => {
  const result = countActiveFilters({ status: "published", category: "blog" });
  assertEquals(result, 2);
});

Deno.test("countActiveFilters: counts date range as one filter", () => {
  const result = countActiveFilters({
    createdAt: { gte: "2024-01-01", lte: "2024-12-31" },
  });
  assertEquals(result, 1);
});

Deno.test("countActiveFilters: ignores undefined and empty values", () => {
  const result = countActiveFilters({
    status: "published",
    category: undefined,
    tag: "",
  });
  assertEquals(result, 1);
});

Deno.test("countActiveFilters: counts mixed filter types", () => {
  const result = countActiveFilters({
    status: "published",
    isActive: true,
    createdAt: { gte: "2024-01-01" },
  });
  assertEquals(result, 3);
});

Deno.test("mergeFilterParams: preserves non-filter params", () => {
  const current = new URLSearchParams("q=search&page=2");
  const filters: FilterConfig[] = [
    { field: "status", type: "choice", label: "Status", choices: [] },
  ];

  const result = mergeFilterParams(current, { status: "published" }, filters);

  assertEquals(result.get("q"), "search");
  assertEquals(result.get("page"), "2");
  assertEquals(result.get("status"), "published");
});

Deno.test("mergeFilterParams: replaces existing filter values", () => {
  const current = new URLSearchParams("status=draft");
  const filters: FilterConfig[] = [
    { field: "status", type: "choice", label: "Status", choices: [] },
  ];

  const result = mergeFilterParams(current, { status: "published" }, filters);

  assertEquals(result.get("status"), "published");
});

Deno.test("mergeFilterParams: removes filter when value is undefined", () => {
  const current = new URLSearchParams("status=draft");
  const filters: FilterConfig[] = [
    { field: "status", type: "choice", label: "Status", choices: [] },
  ];

  const result = mergeFilterParams(current, {}, filters);

  assertEquals(result.get("status"), null);
});

Deno.test("mergeFilterParams: handles date range params correctly", () => {
  const current = new URLSearchParams(
    "createdAt__gte=2024-01-01&createdAt__lte=2024-06-30",
  );
  const filters: FilterConfig[] = [
    { field: "createdAt", type: "date_range", label: "Created At" },
  ];

  const result = mergeFilterParams(
    current,
    { createdAt: { gte: "2024-07-01", lte: "2024-12-31" } },
    filters,
  );

  assertEquals(result.get("createdAt__gte"), "2024-07-01");
  assertEquals(result.get("createdAt__lte"), "2024-12-31");
});

Deno.test("clearFilterParams: removes all filter params", () => {
  const current = new URLSearchParams("status=draft&isActive=true&q=search");
  const filters: FilterConfig[] = [
    { field: "status", type: "choice", label: "Status", choices: [] },
    { field: "isActive", type: "boolean", label: "Is Active" },
  ];

  const result = clearFilterParams(current, filters);

  assertEquals(result.get("status"), null);
  assertEquals(result.get("isActive"), null);
  assertEquals(result.get("q"), "search"); // Preserved
});

Deno.test("clearFilterParams: removes date range params", () => {
  const current = new URLSearchParams(
    "createdAt__gte=2024-01-01&createdAt__lte=2024-12-31&q=test",
  );
  const filters: FilterConfig[] = [
    { field: "createdAt", type: "date_range", label: "Created At" },
  ];

  const result = clearFilterParams(current, filters);

  assertEquals(result.get("createdAt__gte"), null);
  assertEquals(result.get("createdAt__lte"), null);
  assertEquals(result.get("q"), "test"); // Preserved
});
