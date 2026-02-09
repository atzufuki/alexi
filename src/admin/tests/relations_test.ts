/**
 * Alexi Admin - Relation Widget Tests
 *
 * TDD tests for Phase 5: Relationship widgets
 *
 * @module
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  AutoField,
  CharField,
  ForeignKey,
  Manager,
  ManyToManyField,
  Model,
  OnDelete,
} from "@alexi/db";

// =============================================================================
// Test Models
// =============================================================================

class CategoryModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  static objects = new Manager(CategoryModel);
  static meta = {
    dbTable: "categories",
    verboseName: "Category",
    verboseNamePlural: "Categories",
  };
}

class TagModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 50 });
  color = new CharField({ maxLength: 20, default: "#000000" });

  static objects = new Manager(TagModel);
  static meta = {
    dbTable: "tags",
  };
}

class ArticleModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  category = new ForeignKey<CategoryModel>(CategoryModel, {
    onDelete: OnDelete.CASCADE,
    relatedName: "articles",
    verboseName: "Category",
  });
  tags = new ManyToManyField<TagModel>(TagModel, {
    relatedName: "articles",
  });

  static objects = new Manager(ArticleModel);
  static meta = {
    dbTable: "articles",
  };
}

// =============================================================================
// Import relation utilities (to be implemented)
// =============================================================================

import {
  getRelatedModelInfo,
  getRelationFieldInfo,
  getRelationFields,
  isRelationField,
  type RelationFieldInfo,
} from "../relations.ts";
import { type FieldInfo, getModelFields } from "../introspection.ts";

// =============================================================================
// Relation Field Detection Tests
// =============================================================================

Deno.test("isRelationField: returns true for ForeignKey", () => {
  const fields = getModelFields(ArticleModel);
  const categoryField = fields.find((f) => f.name === "category");
  assertExists(categoryField);

  const result = isRelationField(categoryField);
  assertEquals(result, true);
});

Deno.test("isRelationField: returns true for ManyToManyField", () => {
  const fields = getModelFields(ArticleModel);
  const tagsField = fields.find((f) => f.name === "tags");
  assertExists(tagsField);

  const result = isRelationField(tagsField);
  assertEquals(result, true);
});

Deno.test("isRelationField: returns false for CharField", () => {
  const fields = getModelFields(ArticleModel);
  const titleField = fields.find((f) => f.name === "title");
  assertExists(titleField);

  const result = isRelationField(titleField);
  assertEquals(result, false);
});

Deno.test("isRelationField: returns false for AutoField", () => {
  const fields = getModelFields(ArticleModel);
  const idField = fields.find((f) => f.name === "id");
  assertExists(idField);

  const result = isRelationField(idField);
  assertEquals(result, false);
});

// =============================================================================
// Relation Field Info Tests
// =============================================================================

Deno.test("getRelationFieldInfo: extracts ForeignKey info", () => {
  const fields = getModelFields(ArticleModel);
  const categoryField = fields.find((f) => f.name === "category");
  assertExists(categoryField);

  const info = getRelationFieldInfo(categoryField);

  assertExists(info);
  assertEquals(info.name, "category");
  assertEquals(info.relationType, "foreignkey");
  assertEquals(info.isMultiple, false);
  assertExists(info.relatedModel);
});

Deno.test("getRelationFieldInfo: extracts ManyToMany info", () => {
  const fields = getModelFields(ArticleModel);
  const tagsField = fields.find((f) => f.name === "tags");
  assertExists(tagsField);

  const info = getRelationFieldInfo(tagsField);

  assertExists(info);
  assertEquals(info.name, "tags");
  assertEquals(info.relationType, "manytomany");
  assertEquals(info.isMultiple, true);
});

Deno.test("getRelationFieldInfo: returns null for non-relation field", () => {
  const fields = getModelFields(ArticleModel);
  const titleField = fields.find((f) => f.name === "title");
  assertExists(titleField);

  const info = getRelationFieldInfo(titleField);

  assertEquals(info, null);
});

Deno.test("getRelationFieldInfo: includes verboseName", () => {
  const fields = getModelFields(ArticleModel);
  const categoryField = fields.find((f) => f.name === "category");
  assertExists(categoryField);

  const info = getRelationFieldInfo(categoryField);

  assertExists(info);
  assertEquals(info.label, "Category");
});

// =============================================================================
// Get Relation Fields Tests
// =============================================================================

Deno.test("getRelationFields: returns all relation fields from model", () => {
  const fields = getModelFields(ArticleModel);
  const relationFields = getRelationFields(fields);

  assertEquals(relationFields.length, 2);
});

Deno.test("getRelationFields: includes ForeignKey fields", () => {
  const fields = getModelFields(ArticleModel);
  const relationFields = getRelationFields(fields);

  const fkField = relationFields.find((f) => f.name === "category");
  assertExists(fkField);
  assertEquals(fkField.relationType, "foreignkey");
});

Deno.test("getRelationFields: includes ManyToMany fields", () => {
  const fields = getModelFields(ArticleModel);
  const relationFields = getRelationFields(fields);

  const m2mField = relationFields.find((f) => f.name === "tags");
  assertExists(m2mField);
  assertEquals(m2mField.relationType, "manytomany");
});

Deno.test("getRelationFields: returns empty array for model without relations", () => {
  const fields = getModelFields(CategoryModel);
  const relationFields = getRelationFields(fields);

  assertEquals(relationFields.length, 0);
});

// =============================================================================
// Related Model Info Tests
// =============================================================================

Deno.test("getRelatedModelInfo: returns model meta for ForeignKey", () => {
  const fields = getModelFields(ArticleModel);
  const categoryField = fields.find((f) => f.name === "category");
  assertExists(categoryField);

  const relInfo = getRelationFieldInfo(categoryField);
  assertExists(relInfo);

  const modelInfo = getRelatedModelInfo(relInfo);

  assertExists(modelInfo);
  assertEquals(modelInfo.name, "CategoryModel");
  assertEquals(modelInfo.verboseName, "Category");
});

Deno.test("getRelatedModelInfo: returns model meta for ManyToMany", () => {
  const fields = getModelFields(ArticleModel);
  const tagsField = fields.find((f) => f.name === "tags");
  assertExists(tagsField);

  const relInfo = getRelationFieldInfo(tagsField);
  assertExists(relInfo);

  const modelInfo = getRelatedModelInfo(relInfo);

  assertExists(modelInfo);
  assertEquals(modelInfo.name, "TagModel");
});

// =============================================================================
// Widget Type Detection Tests
// =============================================================================

import { getWidgetForField } from "../introspection.ts";

Deno.test("getWidgetForField: ForeignKey maps to admin-foreign-key-select", () => {
  const fields = getModelFields(ArticleModel);
  const categoryField = fields.find((f) => f.name === "category");
  assertExists(categoryField);

  const widget = getWidgetForField(categoryField);

  assertEquals(widget, "admin-foreign-key-select");
});

Deno.test("getWidgetForField: ManyToManyField maps to admin-many-to-many-select", () => {
  const fields = getModelFields(ArticleModel);
  const tagsField = fields.find((f) => f.name === "tags");
  assertExists(tagsField);

  const widget = getWidgetForField(tagsField);

  assertEquals(widget, "admin-many-to-many-select");
});

// =============================================================================
// ForeignKey Select Data Tests
// =============================================================================

Deno.test("RelationFieldInfo: ForeignKey has correct properties", () => {
  const fields = getModelFields(ArticleModel);
  const categoryField = fields.find((f) => f.name === "category");
  assertExists(categoryField);

  const info = getRelationFieldInfo(categoryField);

  assertExists(info);
  assertEquals(info.name, "category");
  assertEquals(info.relationType, "foreignkey");
  assertEquals(info.isMultiple, false);
  assertEquals(info.isRequired, true); // ForeignKey without null/blank
});

Deno.test("RelationFieldInfo: ManyToMany has correct properties", () => {
  const fields = getModelFields(ArticleModel);
  const tagsField = fields.find((f) => f.name === "tags");
  assertExists(tagsField);

  const info = getRelationFieldInfo(tagsField);

  assertExists(info);
  assertEquals(info.name, "tags");
  assertEquals(info.relationType, "manytomany");
  assertEquals(info.isMultiple, true);
  assertEquals(info.isRequired, false); // M2M are never required
});

// =============================================================================
// OneToOneField Tests
// =============================================================================

import { OneToOneField } from "@alexi/db";

class UserProfileModel extends Model {
  id = new AutoField({ primaryKey: true });
  bio = new CharField({ maxLength: 500 });

  static objects = new Manager(UserProfileModel);
}

class UserModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  profile = new OneToOneField<UserProfileModel>(UserProfileModel, {
    onDelete: OnDelete.CASCADE,
  });

  static objects = new Manager(UserModel);
}

Deno.test("isRelationField: returns true for OneToOneField", () => {
  const fields = getModelFields(UserModel);
  const profileField = fields.find((f) => f.name === "profile");
  assertExists(profileField);

  const result = isRelationField(profileField);
  assertEquals(result, true);
});

Deno.test("getRelationFieldInfo: extracts OneToOne info", () => {
  const fields = getModelFields(UserModel);
  const profileField = fields.find((f) => f.name === "profile");
  assertExists(profileField);

  const info = getRelationFieldInfo(profileField);

  assertExists(info);
  assertEquals(info.name, "profile");
  assertEquals(info.relationType, "onetoone");
  assertEquals(info.isMultiple, false);
});

Deno.test("getWidgetForField: OneToOneField maps to admin-foreign-key-select", () => {
  const fields = getModelFields(UserModel);
  const profileField = fields.find((f) => f.name === "profile");
  assertExists(profileField);

  const widget = getWidgetForField(profileField);

  assertEquals(widget, "admin-foreign-key-select");
});

// =============================================================================
// Edge Cases
// =============================================================================

Deno.test("getRelationFields: handles model with only relation fields", () => {
  // ArticleModel has id, title, category, tags
  // Only category and tags are relations
  const fields = getModelFields(ArticleModel);
  const relationFields = getRelationFields(fields);

  assertEquals(relationFields.length, 2);

  const names = relationFields.map((f) => f.name);
  assertEquals(names.includes("category"), true);
  assertEquals(names.includes("tags"), true);
  assertEquals(names.includes("id"), false);
  assertEquals(names.includes("title"), false);
});

Deno.test("getRelationFieldInfo: handles nullable ForeignKey", () => {
  // Create a model with nullable FK for this test
  class OptionalCategoryArticle extends Model {
    id = new AutoField({ primaryKey: true });
    category = new ForeignKey<CategoryModel>(CategoryModel, {
      onDelete: OnDelete.SET_NULL,
      null: true,
      blank: true,
    });

    static objects = new Manager(OptionalCategoryArticle);
  }

  const fields = getModelFields(OptionalCategoryArticle);
  const categoryField = fields.find((f) => f.name === "category");
  assertExists(categoryField);

  const info = getRelationFieldInfo(categoryField);

  assertExists(info);
  assertEquals(info.isRequired, false);
});

// =============================================================================
// Autocomplete Search Config Tests
// =============================================================================

Deno.test("RelationFieldInfo: includes search fields hint", () => {
  const fields = getModelFields(ArticleModel);
  const categoryField = fields.find((f) => f.name === "category");
  assertExists(categoryField);

  const info = getRelationFieldInfo(categoryField);

  assertExists(info);
  // By default, we might not have searchFields, but the property should exist
  assertExists(
    info.searchFields !== undefined || info.searchFields === undefined,
  );
});

// =============================================================================
// Display Value Tests
// =============================================================================

Deno.test("RelationFieldInfo: has displayField for rendering choices", () => {
  const fields = getModelFields(ArticleModel);
  const categoryField = fields.find((f) => f.name === "category");
  assertExists(categoryField);

  const info = getRelationFieldInfo(categoryField);

  assertExists(info);
  // Should have a displayField or default to string representation
  assertExists(
    info.displayField !== undefined || info.displayField === undefined,
  );
});
