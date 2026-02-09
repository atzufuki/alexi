/**
 * Registry & ModelAdmin tests for Alexi Admin
 *
 * These tests verify the core registration functionality of the admin system.
 */

import { assertEquals, assertExists, assertThrows } from "jsr:@std/assert@1";
import { AutoField, CharField, Manager, Model } from "@alexi/db";

// Import admin classes (to be implemented)
import { AdminSite, ModelAdmin, register } from "../mod.ts";

// =============================================================================
// Test Models
// =============================================================================

class TestArticle extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  content = new CharField({ maxLength: 1000 });

  static objects = new Manager(TestArticle);
  static meta = { dbTable: "test_articles" };
}

class TestCategory extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  static objects = new Manager(TestCategory);
  static meta = { dbTable: "test_categories" };
}

// =============================================================================
// AdminSite Registration Tests
// =============================================================================

Deno.test("AdminSite: can register model with default ModelAdmin", () => {
  const site = new AdminSite();
  site.register(TestArticle);

  const admin = site.getModelAdmin(TestArticle);
  assertExists(admin);
  assertEquals(admin.model, TestArticle);
});

Deno.test("AdminSite: can register model with custom ModelAdmin", () => {
  class ArticleAdmin extends ModelAdmin {
    listDisplay = ["id", "title"];
    searchFields = ["title"];
  }

  const site = new AdminSite();
  site.register(TestArticle, ArticleAdmin);

  const admin = site.getModelAdmin(TestArticle);
  assertEquals(admin.listDisplay, ["id", "title"]);
  assertEquals(admin.searchFields, ["title"]);
});

Deno.test("AdminSite: throws error when registering same model twice", () => {
  const site = new AdminSite();
  site.register(TestArticle);

  assertThrows(
    () => site.register(TestArticle),
    Error,
    "already registered",
  );
});

Deno.test("AdminSite: can unregister model", () => {
  const site = new AdminSite();
  site.register(TestArticle);
  site.unregister(TestArticle);

  assertEquals(site.isRegistered(TestArticle), false);
});

Deno.test("AdminSite: getRegisteredModels returns all models", () => {
  const site = new AdminSite();
  site.register(TestArticle);
  site.register(TestCategory);

  const models = site.getRegisteredModels();
  assertEquals(models.length, 2);
  assertEquals(models.includes(TestArticle), true);
  assertEquals(models.includes(TestCategory), true);
});

Deno.test("AdminSite: isRegistered returns correct status", () => {
  const site = new AdminSite();

  assertEquals(site.isRegistered(TestArticle), false);
  site.register(TestArticle);
  assertEquals(site.isRegistered(TestArticle), true);
});

// =============================================================================
// ModelAdmin Configuration Tests
// =============================================================================

Deno.test("ModelAdmin: default configuration", () => {
  const site = new AdminSite();
  site.register(TestArticle);

  const admin = site.getModelAdmin(TestArticle);

  // Default listDisplay should be empty (show all)
  assertEquals(admin.listDisplay, []);

  // Default searchFields should be empty
  assertEquals(admin.searchFields, []);

  // Default listFilter should be empty
  assertEquals(admin.listFilter, []);

  // Default ordering should be empty
  assertEquals(admin.ordering, []);

  // Default fields should be empty (show all)
  assertEquals(admin.fields, []);

  // Default readonlyFields should be empty
  assertEquals(admin.readonlyFields, []);
});

Deno.test("ModelAdmin: custom configuration preserved", () => {
  class CustomAdmin extends ModelAdmin {
    listDisplay = ["id", "title", "content"];
    searchFields = ["title", "content"];
    listFilter = ["status"];
    ordering = ["-id"];
    fields = ["title", "content"];
    readonlyFields = ["id"];
    fieldsets = [
      { name: "Basic", fields: ["title"] },
      { name: "Content", fields: ["content"], collapsed: true },
    ];
  }

  const site = new AdminSite();
  site.register(TestArticle, CustomAdmin);

  const admin = site.getModelAdmin(TestArticle);

  assertEquals(admin.listDisplay, ["id", "title", "content"]);
  assertEquals(admin.searchFields, ["title", "content"]);
  assertEquals(admin.listFilter, ["status"]);
  assertEquals(admin.ordering, ["-id"]);
  assertEquals(admin.fields, ["title", "content"]);
  assertEquals(admin.readonlyFields, ["id"]);
  assertEquals(admin.fieldsets.length, 2);
  assertEquals(admin.fieldsets[0].name, "Basic");
  assertEquals(admin.fieldsets[1].collapsed, true);
});

// =============================================================================
// AdminSite Options Tests
// =============================================================================

Deno.test("AdminSite: accepts site options", () => {
  const site = new AdminSite({
    title: "CoMachine Admin",
    header: "CoMachine Administration",
    urlPrefix: "/admin",
  });

  assertEquals(site.title, "CoMachine Admin");
  assertEquals(site.header, "CoMachine Administration");
  assertEquals(site.urlPrefix, "/admin");
});

Deno.test("AdminSite: default options", () => {
  const site = new AdminSite();

  assertEquals(site.title, "Admin");
  assertEquals(site.header, "Administration");
  assertEquals(site.urlPrefix, "/admin");
});

// =============================================================================
// Decorator Tests
// =============================================================================

Deno.test("@register decorator works", () => {
  const site = new AdminSite();

  @register(TestArticle, site)
  class DecoratedAdmin extends ModelAdmin {
    listDisplay = ["title"];
  }

  const admin = site.getModelAdmin(TestArticle);
  assertEquals(admin.listDisplay, ["title"]);
  assertEquals(admin instanceof DecoratedAdmin, true);
});

// =============================================================================
// Model Name Resolution Tests
// =============================================================================

Deno.test("AdminSite: getModelAdmin by name works", () => {
  const site = new AdminSite();
  site.register(TestArticle);

  const admin = site.getModelAdminByName("TestArticle");
  assertExists(admin);
  assertEquals(admin.model, TestArticle);
});

Deno.test("AdminSite: getModelAdminByName returns null for unknown model", () => {
  const site = new AdminSite();

  const admin = site.getModelAdminByName("UnknownModel");
  assertEquals(admin, null);
});

// =============================================================================
// URL Generation Tests
// =============================================================================

Deno.test("ModelAdmin: getListUrl returns correct URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const admin = site.getModelAdmin(TestArticle);
  assertEquals(admin.getListUrl(), "/admin/testarticle/");
});

Deno.test("ModelAdmin: getAddUrl returns correct URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const admin = site.getModelAdmin(TestArticle);
  assertEquals(admin.getAddUrl(), "/admin/testarticle/add/");
});

Deno.test("ModelAdmin: getDetailUrl returns correct URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const admin = site.getModelAdmin(TestArticle);
  assertEquals(admin.getDetailUrl("123"), "/admin/testarticle/123/");
});

Deno.test("ModelAdmin: getDeleteUrl returns correct URL", () => {
  const site = new AdminSite({ urlPrefix: "/admin" });
  site.register(TestArticle);

  const admin = site.getModelAdmin(TestArticle);
  assertEquals(admin.getDeleteUrl("123"), "/admin/testarticle/123/delete/");
});
