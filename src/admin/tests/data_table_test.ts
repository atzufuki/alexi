/**
 * AdminDataTable component tests for Alexi Admin
 *
 * These tests verify the data table component functionality.
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";

// Note: These tests would run in a browser environment with DOM access.
// For now, we test the data table logic separately.

import { AutoField, CharField, Manager, Model } from "@alexi/db";
import { getModelFields, getModelMeta } from "../introspection.ts";
import { AdminSite, ModelAdmin } from "../mod.ts";

// =============================================================================
// Test Models
// =============================================================================

class TestItem extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  status = new CharField({ maxLength: 20, default: "active" });

  static objects = new Manager(TestItem);
  static meta = { dbTable: "test_items" };
}

// =============================================================================
// DataTable Configuration Tests
// =============================================================================

Deno.test("DataTable config: listDisplay configures visible columns", () => {
  class ItemAdmin extends ModelAdmin {
    listDisplay = ["id", "name"];
  }

  const site = new AdminSite();
  site.register(TestItem, ItemAdmin);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.listDisplay, ["id", "name"]);
  assertEquals(admin.listDisplay.includes("status"), false);
});

Deno.test("DataTable config: empty listDisplay shows all fields", () => {
  const site = new AdminSite();
  site.register(TestItem);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.listDisplay, []);

  // When listDisplay is empty, all fields should be shown
  const fields = getModelFields(TestItem);
  assertEquals(fields.length >= 3, true);
});

Deno.test("DataTable config: listDisplayLinks configures clickable columns", () => {
  class ItemAdmin extends ModelAdmin {
    listDisplay = ["id", "name", "status"];
    listDisplayLinks = ["name"];
  }

  const site = new AdminSite();
  site.register(TestItem, ItemAdmin);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.listDisplayLinks, ["name"]);
});

Deno.test("DataTable config: getListDisplayLinks defaults to first column", () => {
  class ItemAdmin extends ModelAdmin {
    listDisplay = ["id", "name", "status"];
  }

  const site = new AdminSite();
  site.register(TestItem, ItemAdmin);

  const admin = site.getModelAdmin(TestItem);
  const links = admin.getListDisplayLinks();
  assertEquals(links, ["id"]);
});

Deno.test("DataTable config: ordering configures default sort", () => {
  class ItemAdmin extends ModelAdmin {
    ordering = ["-id", "name"];
  }

  const site = new AdminSite();
  site.register(TestItem, ItemAdmin);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.ordering, ["-id", "name"]);
});

Deno.test("DataTable config: listPerPage configures pagination", () => {
  class ItemAdmin extends ModelAdmin {
    listPerPage = 25;
  }

  const site = new AdminSite();
  site.register(TestItem, ItemAdmin);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.listPerPage, 25);
});

Deno.test("DataTable config: default listPerPage is 100", () => {
  const site = new AdminSite();
  site.register(TestItem);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.listPerPage, 100);
});

Deno.test("DataTable config: searchFields configures searchable columns", () => {
  class ItemAdmin extends ModelAdmin {
    searchFields = ["name", "status"];
  }

  const site = new AdminSite();
  site.register(TestItem, ItemAdmin);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.searchFields, ["name", "status"]);
});

Deno.test("DataTable config: listFilter configures filter sidebar", () => {
  class ItemAdmin extends ModelAdmin {
    listFilter = ["status"];
  }

  const site = new AdminSite();
  site.register(TestItem, ItemAdmin);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.listFilter, ["status"]);
});

// =============================================================================
// Column Information Tests
// =============================================================================

Deno.test("DataTable columns: getModelMeta returns correct table info", () => {
  const meta = getModelMeta(TestItem);

  assertEquals(meta.name, "TestItem");
  assertEquals(meta.tableName, "test_items");
  assertEquals(meta.primaryKey, "id");
});

Deno.test("DataTable columns: fields have correct types for rendering", () => {
  const fields = getModelFields(TestItem);

  const idField = fields.find((f) => f.name === "id");
  assertEquals(idField?.type, "AutoField");
  assertEquals(idField?.isPrimaryKey, true);

  const nameField = fields.find((f) => f.name === "name");
  assertEquals(nameField?.type, "CharField");
  assertEquals(nameField?.isEditable, true);
});

// =============================================================================
// Row Selection Tests (Logic)
// =============================================================================

Deno.test("DataTable selection: can track selected IDs", () => {
  const selectedIds = new Set<string>();

  // Select an item
  selectedIds.add("1");
  assertEquals(selectedIds.has("1"), true);
  assertEquals(selectedIds.size, 1);

  // Select another item
  selectedIds.add("2");
  assertEquals(selectedIds.size, 2);

  // Deselect an item
  selectedIds.delete("1");
  assertEquals(selectedIds.has("1"), false);
  assertEquals(selectedIds.size, 1);
});

Deno.test("DataTable selection: select all adds all IDs", () => {
  const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const selectedIds = new Set<string>();

  // Select all
  for (const row of data) {
    selectedIds.add(String(row.id));
  }

  assertEquals(selectedIds.size, 3);
  assertEquals(selectedIds.has("1"), true);
  assertEquals(selectedIds.has("2"), true);
  assertEquals(selectedIds.has("3"), true);
});

Deno.test("DataTable selection: clear removes all IDs", () => {
  const selectedIds = new Set<string>(["1", "2", "3"]);
  assertEquals(selectedIds.size, 3);

  selectedIds.clear();
  assertEquals(selectedIds.size, 0);
});

// =============================================================================
// Sorting Tests (Logic)
// =============================================================================

Deno.test("DataTable sorting: parse ordering string", () => {
  function parseOrdering(
    ordering: string,
  ): { field: string; direction: "asc" | "desc" } {
    if (ordering.startsWith("-")) {
      return { field: ordering.slice(1), direction: "desc" };
    }
    return { field: ordering, direction: "asc" };
  }

  assertEquals(parseOrdering("name"), { field: "name", direction: "asc" });
  assertEquals(parseOrdering("-name"), { field: "name", direction: "desc" });
  assertEquals(parseOrdering("-createdAt"), {
    field: "createdAt",
    direction: "desc",
  });
});

Deno.test("DataTable sorting: toggle sort direction", () => {
  function toggleSort(
    currentField: string,
    currentDirection: "asc" | "desc" | null,
    clickedField: string,
  ): { field: string; direction: "asc" | "desc" } {
    if (currentField !== clickedField) {
      // New field, start with ascending
      return { field: clickedField, direction: "asc" };
    }
    // Same field, toggle direction
    return {
      field: clickedField,
      direction: currentDirection === "asc" ? "desc" : "asc",
    };
  }

  // Click new field
  const result1 = toggleSort("id", "asc", "name");
  assertEquals(result1, { field: "name", direction: "asc" });

  // Click same field - toggle to desc
  const result2 = toggleSort("name", "asc", "name");
  assertEquals(result2, { field: "name", direction: "desc" });

  // Click same field again - toggle to asc
  const result3 = toggleSort("name", "desc", "name");
  assertEquals(result3, { field: "name", direction: "asc" });
});

// =============================================================================
// Pagination Tests (Logic)
// =============================================================================

Deno.test("DataTable pagination: calculate page info", () => {
  function calculatePageInfo(
    totalCount: number,
    page: number,
    perPage: number,
  ): {
    totalPages: number;
    startIndex: number;
    endIndex: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const totalPages = Math.ceil(totalCount / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, totalCount);

    return {
      totalPages,
      startIndex,
      endIndex,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  // First page of 100 items with 25 per page
  const result1 = calculatePageInfo(100, 1, 25);
  assertEquals(result1.totalPages, 4);
  assertEquals(result1.startIndex, 0);
  assertEquals(result1.endIndex, 25);
  assertEquals(result1.hasNext, true);
  assertEquals(result1.hasPrev, false);

  // Second page
  const result2 = calculatePageInfo(100, 2, 25);
  assertEquals(result2.startIndex, 25);
  assertEquals(result2.endIndex, 50);
  assertEquals(result2.hasNext, true);
  assertEquals(result2.hasPrev, true);

  // Last page
  const result3 = calculatePageInfo(100, 4, 25);
  assertEquals(result3.startIndex, 75);
  assertEquals(result3.endIndex, 100);
  assertEquals(result3.hasNext, false);
  assertEquals(result3.hasPrev, true);

  // Partial last page
  const result4 = calculatePageInfo(95, 4, 25);
  assertEquals(result4.endIndex, 95);
});

Deno.test("DataTable pagination: generate page numbers", () => {
  function generatePageNumbers(
    currentPage: number,
    totalPages: number,
    maxVisible: number = 7,
  ): (number | "...")[] {
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "...")[] = [];
    const half = Math.floor((maxVisible - 3) / 2);

    // Always show first page
    pages.push(1);

    const start = Math.max(2, currentPage - half);
    const end = Math.min(totalPages - 1, currentPage + half);

    if (start > 2) {
      pages.push("...");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push("...");
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  }

  // Small number of pages - show all
  assertEquals(generatePageNumbers(1, 5), [1, 2, 3, 4, 5]);

  // Large number of pages - at start
  const result1 = generatePageNumbers(1, 20);
  assertEquals(result1[0], 1);
  assertEquals(result1.includes("..."), true);
  assertEquals(result1[result1.length - 1], 20);

  // Large number of pages - in middle
  const result2 = generatePageNumbers(10, 20);
  assertEquals(result2[0], 1);
  assertEquals(result2[result2.length - 1], 20);
  // Should have ellipsis on both sides
  assertEquals(result2.filter((p) => p === "...").length, 2);
});

// =============================================================================
// Search Tests (Logic)
// =============================================================================

Deno.test("DataTable search: build search URL params", () => {
  function buildSearchParams(
    baseUrl: string,
    search: string,
    page?: number,
    ordering?: string,
  ): string {
    const url = new URL(baseUrl, "http://localhost");

    if (search) {
      url.searchParams.set("q", search);
    }
    if (page && page > 1) {
      url.searchParams.set("page", String(page));
    }
    if (ordering) {
      url.searchParams.set("o", ordering);
    }

    return url.pathname + url.search;
  }

  assertEquals(
    buildSearchParams("/admin/users/", "john"),
    "/admin/users/?q=john",
  );

  assertEquals(
    buildSearchParams("/admin/users/", "john", 2),
    "/admin/users/?q=john&page=2",
  );

  assertEquals(
    buildSearchParams("/admin/users/", "", 1, "-createdAt"),
    "/admin/users/?o=-createdAt",
  );

  assertEquals(
    buildSearchParams("/admin/users/", "john", 3, "email"),
    "/admin/users/?q=john&page=3&o=email",
  );
});

// =============================================================================
// Empty State Tests
// =============================================================================

Deno.test("DataTable empty: emptyValueDisplay configuration", () => {
  class ItemAdmin extends ModelAdmin {
    emptyValueDisplay = "N/A";
  }

  const site = new AdminSite();
  site.register(TestItem, ItemAdmin);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.emptyValueDisplay, "N/A");
});

Deno.test("DataTable empty: default emptyValueDisplay is dash", () => {
  const site = new AdminSite();
  site.register(TestItem);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.emptyValueDisplay, "-");
});

// =============================================================================
// Actions Tests (Logic)
// =============================================================================

Deno.test("DataTable actions: default actions include delete", () => {
  const site = new AdminSite();
  site.register(TestItem);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.actions.includes("delete_selected"), true);
});

Deno.test("DataTable actions: custom actions configuration", () => {
  class ItemAdmin extends ModelAdmin {
    actions = ["delete_selected", "export_csv", "mark_active"];
  }

  const site = new AdminSite();
  site.register(TestItem, ItemAdmin);

  const admin = site.getModelAdmin(TestItem);
  assertEquals(admin.actions.length, 3);
  assertEquals(admin.actions.includes("export_csv"), true);
  assertEquals(admin.actions.includes("mark_active"), true);
});

Deno.test("DataTable actions: getActions returns labeled actions", () => {
  class ItemAdmin extends ModelAdmin {
    actions = ["delete_selected", "mark_active"];
  }

  const site = new AdminSite();
  site.register(TestItem, ItemAdmin);

  const admin = site.getModelAdmin(TestItem);
  const actions = admin.getActions();

  assertEquals(actions.length, 2);
  assertEquals(actions[0].name, "delete_selected");
  assertEquals(actions[1].name, "mark_active");
  // Labels should be humanized
  assertExists(actions[0].label);
  assertExists(actions[1].label);
});
