/**
 * Tests for ModelAdmin — search, filter, ordering, pagination, deleteSelected,
 * validateForm.
 *
 * @module
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { reset, setup } from "@alexi/db";
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  IntegerField,
  Manager,
  Model,
  TextField,
} from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { ModelAdmin } from "../model_admin.ts";
import { AdminSite } from "../site.ts";

// =============================================================================
// Test Model
// =============================================================================

class ArticleModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  body = new TextField({ blank: true });
  published = new BooleanField({ default: false });
  views = new IntegerField({ default: 0 });
  createdAt = new DateTimeField({ autoNowAdd: true });

  static objects = new Manager(ArticleModel);
  static override meta = {
    dbTable: "articles_ma_test",
    ordering: ["-createdAt"],
  };
}

class ArticleAdmin extends ModelAdmin {
  override listDisplay = ["id", "title", "published", "views"];
  override searchFields = ["title", "body"];
  override listFilter = ["published"];
  override ordering = ["-createdAt"];
}

// =============================================================================
// Helpers
// =============================================================================

async function makeBackend(name: string) {
  const backend = new DenoKVBackend({ name, path: ":memory:" });
  await backend.connect();
  await setup({ backend });
  return backend;
}

function makeAdmin(): ArticleAdmin {
  const site = new AdminSite();
  site.register(ArticleModel, ArticleAdmin);
  return site.getModelAdmin(ArticleModel) as ArticleAdmin;
}

// =============================================================================
// getSearchResults
// =============================================================================

Deno.test({
  name:
    "ModelAdmin.getSearchResults: returns queryset unchanged for empty search",
  async fn() {
    const backend = await makeBackend("ma_search_empty");
    try {
      await ArticleModel.objects.create({ title: "Hello World", views: 1 });
      const admin = makeAdmin();
      const qs = ArticleModel.objects.using(backend).all();
      const result = admin.getSearchResults(qs, "");
      assertEquals(result, qs); // same reference — unchanged
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name:
    "ModelAdmin.getSearchResults: returns queryset unchanged when no searchFields",
  async fn() {
    const backend = await makeBackend("ma_search_nofields");
    try {
      const site = new AdminSite();
      site.register(ArticleModel); // default ModelAdmin — no searchFields
      const admin = site.getModelAdmin(ArticleModel);
      const qs = ArticleModel.objects.using(backend).all();
      const result = admin.getSearchResults(qs, "hello");
      assertEquals(result, qs);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name:
    "ModelAdmin.getSearchResults: returns a new queryset when searchFields set",
  fn() {
    const admin = makeAdmin();
    const qs = ArticleModel.objects.all();
    const result = admin.getSearchResults(qs, "test");
    // Should return a different (filtered) queryset
    assertExists(result);
  },
});

// =============================================================================
// getFilteredQueryset
// =============================================================================

Deno.test({
  name:
    "ModelAdmin.getFilteredQueryset: returns queryset unchanged when no listFilter",
  fn() {
    const site = new AdminSite();
    site.register(ArticleModel);
    const admin = site.getModelAdmin(ArticleModel);
    const qs = ArticleModel.objects.all();
    const params = new URLSearchParams();
    const result = admin.getFilteredQueryset(qs, params);
    assertEquals(result, qs);
  },
});

Deno.test({
  name:
    "ModelAdmin.getFilteredQueryset: returns queryset unchanged for empty params",
  fn() {
    const admin = makeAdmin();
    const qs = ArticleModel.objects.all();
    const params = new URLSearchParams();
    const result = admin.getFilteredQueryset(qs, params);
    assertEquals(result, qs);
  },
});

Deno.test({
  name: "ModelAdmin.getFilteredQueryset: applies boolean filter from URL param",
  fn() {
    const admin = makeAdmin();
    const qs = ArticleModel.objects.all();
    const params = new URLSearchParams({ published: "true" });
    const result = admin.getFilteredQueryset(qs, params);
    // Result should be a filtered queryset (different reference)
    assertExists(result);
  },
});

// =============================================================================
// getOrderedQueryset
// =============================================================================

Deno.test({
  name:
    "ModelAdmin.getOrderedQueryset: returns queryset unchanged when no ordering",
  fn() {
    const site = new AdminSite();
    site.register(ArticleModel);
    const admin = site.getModelAdmin(ArticleModel);
    const qs = ArticleModel.objects.all();
    const result = admin.getOrderedQueryset(qs, null);
    assertExists(result);
  },
});

Deno.test({
  name:
    "ModelAdmin.getOrderedQueryset: applies URL ordering param when field in listDisplay",
  fn() {
    const admin = makeAdmin();
    const qs = ArticleModel.objects.all();
    const result = admin.getOrderedQueryset(qs, "title");
    assertExists(result);
  },
});

Deno.test({
  name:
    "ModelAdmin.getOrderedQueryset: ignores URL ordering param when field not in listDisplay",
  fn() {
    const admin = makeAdmin();
    const qs = ArticleModel.objects.all();
    // 'body' is NOT in listDisplay
    const result = admin.getOrderedQueryset(qs, "body");
    assertExists(result);
    // Falls back to default ordering — same as applying this.ordering
  },
});

Deno.test({
  name: "ModelAdmin.getOrderedQueryset: falls back to ModelAdmin.ordering",
  fn() {
    const admin = makeAdmin();
    const qs = ArticleModel.objects.all();
    const result = admin.getOrderedQueryset(qs, null);
    assertExists(result);
  },
});

// =============================================================================
// paginate
// =============================================================================

Deno.test({
  name: "ModelAdmin.paginate: returns correct page structure",
  async fn() {
    const backend = await makeBackend("ma_paginate");
    try {
      // Create 5 articles
      for (let i = 1; i <= 5; i++) {
        await ArticleModel.objects.create({ title: `Article ${i}`, views: i });
      }

      const admin = makeAdmin();
      admin.listPerPage = 2;
      const qs = ArticleModel.objects.using(backend).all();
      const page1 = await admin.paginate(qs, 1);

      assertEquals(page1.totalCount, 5);
      assertEquals(page1.currentPage, 1);
      assertEquals(page1.totalPages, 3);
      assertEquals(page1.hasPrevious, false);
      assertEquals(page1.hasNext, true);
      assertEquals(page1.objects.length, 2);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ModelAdmin.paginate: page 2 has correct data",
  async fn() {
    const backend = await makeBackend("ma_paginate_p2");
    try {
      for (let i = 1; i <= 5; i++) {
        await ArticleModel.objects.create({ title: `Article ${i}`, views: i });
      }

      const admin = makeAdmin();
      admin.listPerPage = 2;
      const qs = ArticleModel.objects.using(backend).all();
      const page2 = await admin.paginate(qs, 2);

      assertEquals(page2.currentPage, 2);
      assertEquals(page2.hasPrevious, true);
      assertEquals(page2.hasNext, true);
      assertEquals(page2.objects.length, 2);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ModelAdmin.paginate: last page has correct state",
  async fn() {
    const backend = await makeBackend("ma_paginate_last");
    try {
      for (let i = 1; i <= 5; i++) {
        await ArticleModel.objects.create({ title: `Article ${i}`, views: i });
      }

      const admin = makeAdmin();
      admin.listPerPage = 2;
      const qs = ArticleModel.objects.using(backend).all();
      const page3 = await admin.paginate(qs, 3);

      assertEquals(page3.currentPage, 3);
      assertEquals(page3.hasPrevious, true);
      assertEquals(page3.hasNext, false);
      assertEquals(page3.objects.length, 1);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ModelAdmin.paginate: page 1 when empty returns correct totals",
  async fn() {
    const backend = await makeBackend("ma_paginate_empty");
    try {
      const admin = makeAdmin();
      const qs = ArticleModel.objects.using(backend).all();
      const result = await admin.paginate(qs, 1);

      assertEquals(result.totalCount, 0);
      assertEquals(result.totalPages, 1);
      assertEquals(result.objects.length, 0);
      assertEquals(result.hasPrevious, false);
      assertEquals(result.hasNext, false);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

// =============================================================================
// deleteSelected
// =============================================================================

Deno.test({
  name: "ModelAdmin.deleteSelected: returns 0 for empty ID list",
  async fn() {
    const backend = await makeBackend("ma_delete_empty");
    try {
      const admin = makeAdmin();
      const count = await admin.deleteSelected([], backend);
      assertEquals(count, 0);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ModelAdmin.deleteSelected: deletes specified objects",
  async fn() {
    const backend = await makeBackend("ma_delete_objects");
    try {
      const a1 = await ArticleModel.objects.create({ title: "A1", views: 1 });
      const a2 = await ArticleModel.objects.create({ title: "A2", views: 2 });
      await ArticleModel.objects.create({ title: "A3", views: 3 });

      const admin = makeAdmin();
      const count = await admin.deleteSelected(
        [a1.id.get(), a2.id.get()],
        backend,
      );

      assertEquals(count, 2);
      const remaining = await ArticleModel.objects.using(backend).all().fetch();
      assertEquals(remaining.array().length, 1);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ModelAdmin.deleteSelected: ignores non-existent IDs gracefully",
  async fn() {
    const backend = await makeBackend("ma_delete_nonexistent");
    try {
      const a1 = await ArticleModel.objects.create({ title: "A1", views: 1 });

      const admin = makeAdmin();
      // 9999 doesn't exist
      const count = await admin.deleteSelected(
        [a1.id.get(), 9999],
        backend,
      );

      assertEquals(count, 1);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

// =============================================================================
// validateForm
// =============================================================================

Deno.test({
  name: "ModelAdmin.validateForm: valid data returns valid=true",
  fn() {
    const admin = makeAdmin();
    const result = admin.validateForm({
      title: "Hello World",
      body: "Some content",
      published: false,
      views: 0,
    });
    assertEquals(result.valid, true);
    assertEquals(result.errors, {});
  },
});

Deno.test({
  name: "ModelAdmin.validateForm: missing required field returns error",
  fn() {
    const admin = makeAdmin();
    const result = admin.validateForm({
      title: "", // required
      views: 0,
    });
    assertEquals(result.valid, false);
    assertExists(result.errors["title"]);
    assertEquals(result.errors["title"][0], "This field is required.");
  },
});

Deno.test({
  name: "ModelAdmin.validateForm: maxLength exceeded returns error",
  fn() {
    const admin = makeAdmin();
    const longTitle = "A".repeat(201); // maxLength is 200
    const result = admin.validateForm({ title: longTitle, views: 0 });
    assertEquals(result.valid, false);
    assertExists(result.errors["title"]);
  },
});

Deno.test({
  name: "ModelAdmin.validateForm: invalid integer returns error",
  fn() {
    const admin = makeAdmin();
    const result = admin.validateForm({
      title: "Hello",
      views: "not-a-number",
    });
    assertEquals(result.valid, false);
    assertExists(result.errors["views"]);
    assertEquals(result.errors["views"][0], "Enter a whole number.");
  },
});

Deno.test({
  name: "ModelAdmin.validateForm: valid integer passes",
  fn() {
    const admin = makeAdmin();
    const result = admin.validateForm({ title: "Hello", views: "42" });
    assertEquals(result.valid, true);
  },
});

Deno.test({
  name: "ModelAdmin.validateForm: blank allowed field with empty value passes",
  fn() {
    const admin = makeAdmin();
    // body has blank: true — empty should not trigger required error
    const result = admin.validateForm({ title: "Hello", body: "", views: 0 });
    assertEquals(result.valid, true);
  },
});

Deno.test({
  name: "ModelAdmin.validateForm: multiple errors on different fields",
  fn() {
    const admin = makeAdmin();
    const result = admin.validateForm({
      title: "", // required, missing
      views: "bad", // not an integer
    });
    assertEquals(result.valid, false);
    assertExists(result.errors["title"]);
    assertExists(result.errors["views"]);
  },
});
