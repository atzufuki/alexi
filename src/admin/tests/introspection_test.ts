/**
 * Model Introspection tests for Alexi Admin
 *
 * These tests verify the ability to introspect ORM models
 * and extract field information for dynamic form/table generation.
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  AutoField,
  BooleanField,
  CharField,
  DateField,
  DateTimeField,
  IntegerField,
  Manager,
  Model,
  TextField,
} from "@alexi/db";

// Import introspection utilities (to be implemented)
import { getFieldInfo, getModelFields, getModelMeta, getWidgetForField } from "../introspection.ts";

// =============================================================================
// Test Models
// =============================================================================

class TestUser extends Model {
  id = new AutoField({ primaryKey: true });
  email = new CharField({ maxLength: 200, verboseName: "Email" });
  bio = new TextField({ blank: true });
  age = new IntegerField({ default: 0 });
  isActive = new BooleanField({ default: true });
  createdAt = new DateTimeField({ autoNowAdd: true });
  birthDate = new DateField({ null: true });

  static objects = new Manager(TestUser);
  static meta = {
    dbTable: "test_users",
    verboseName: "User",
    verboseNamePlural: "Users",
  };
}

class TestProduct extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  price = new IntegerField({ default: 0, helpText: "Price in cents" });
  description = new TextField({ blank: true, null: true });
  inStock = new BooleanField({ default: true });

  static objects = new Manager(TestProduct);
  static meta = { dbTable: "test_products" };
}

// =============================================================================
// getModelFields Tests
// =============================================================================

Deno.test("getModelFields: returns all field names", () => {
  const fields = getModelFields(TestUser);
  const fieldNames = fields.map((f) => f.name);

  assertEquals(fieldNames.includes("id"), true);
  assertEquals(fieldNames.includes("email"), true);
  assertEquals(fieldNames.includes("bio"), true);
  assertEquals(fieldNames.includes("age"), true);
  assertEquals(fieldNames.includes("isActive"), true);
  assertEquals(fieldNames.includes("createdAt"), true);
  assertEquals(fieldNames.includes("birthDate"), true);
});

Deno.test("getModelFields: returns correct number of fields", () => {
  const fields = getModelFields(TestUser);
  assertEquals(fields.length, 7);
});

Deno.test("getModelFields: returns correct field types", () => {
  const fields = getModelFields(TestUser);

  const emailField = fields.find((f) => f.name === "email");
  assertEquals(emailField?.type, "CharField");

  const ageField = fields.find((f) => f.name === "age");
  assertEquals(ageField?.type, "IntegerField");

  const isActiveField = fields.find((f) => f.name === "isActive");
  assertEquals(isActiveField?.type, "BooleanField");

  const createdAtField = fields.find((f) => f.name === "createdAt");
  assertEquals(createdAtField?.type, "DateTimeField");

  const birthDateField = fields.find((f) => f.name === "birthDate");
  assertEquals(birthDateField?.type, "DateField");

  const bioField = fields.find((f) => f.name === "bio");
  assertEquals(bioField?.type, "TextField");
});

// =============================================================================
// getFieldInfo Tests
// =============================================================================

Deno.test("getFieldInfo: returns field options - maxLength", () => {
  const fields = getModelFields(TestUser);

  const emailField = fields.find((f) => f.name === "email");
  assertEquals(emailField?.options.maxLength, 200);
});

Deno.test("getFieldInfo: returns field options - verboseName", () => {
  const fields = getModelFields(TestUser);

  const emailField = fields.find((f) => f.name === "email");
  assertEquals(emailField?.options.verboseName, "Email");
});

Deno.test("getFieldInfo: returns field options - blank", () => {
  const fields = getModelFields(TestUser);

  const bioField = fields.find((f) => f.name === "bio");
  assertEquals(bioField?.options.blank, true);

  const emailField = fields.find((f) => f.name === "email");
  assertEquals(emailField?.options.blank, false);
});

Deno.test("getFieldInfo: returns field options - null", () => {
  const fields = getModelFields(TestUser);

  const birthDateField = fields.find((f) => f.name === "birthDate");
  assertEquals(birthDateField?.options.null, true);
});

Deno.test("getFieldInfo: returns field options - default", () => {
  const fields = getModelFields(TestUser);

  const ageField = fields.find((f) => f.name === "age");
  assertEquals(ageField?.options.default, 0);

  const isActiveField = fields.find((f) => f.name === "isActive");
  assertEquals(isActiveField?.options.default, true);
});

Deno.test("getFieldInfo: returns field options - helpText", () => {
  const fields = getModelFields(TestProduct);

  const priceField = fields.find((f) => f.name === "price");
  assertEquals(priceField?.options.helpText, "Price in cents");
});

Deno.test("getFieldInfo: identifies primary key", () => {
  const fields = getModelFields(TestUser);

  const idField = fields.find((f) => f.name === "id");
  assertEquals(idField?.isPrimaryKey, true);

  const emailField = fields.find((f) => f.name === "email");
  assertEquals(emailField?.isPrimaryKey, false);
});

Deno.test("getFieldInfo: identifies editable fields", () => {
  const fields = getModelFields(TestUser);

  // AutoField (primary key) should not be editable
  const idField = fields.find((f) => f.name === "id");
  assertEquals(idField?.isEditable, false);

  // Regular fields should be editable
  const emailField = fields.find((f) => f.name === "email");
  assertEquals(emailField?.isEditable, true);
});

Deno.test("getFieldInfo: identifies auto fields", () => {
  const fields = getModelFields(TestUser);

  // createdAt has autoNowAdd
  const createdAtField = fields.find((f) => f.name === "createdAt");
  assertEquals(createdAtField?.isAuto, true);

  // Regular fields are not auto
  const emailField = fields.find((f) => f.name === "email");
  assertEquals(emailField?.isAuto, false);
});

Deno.test("getFieldInfo: identifies required fields", () => {
  const fields = getModelFields(TestUser);

  // email is required (not blank, not null)
  const emailField = fields.find((f) => f.name === "email");
  assertEquals(emailField?.isRequired, true);

  // bio is not required (blank=true)
  const bioField = fields.find((f) => f.name === "bio");
  assertEquals(bioField?.isRequired, false);

  // birthDate is not required (null=true)
  const birthDateField = fields.find((f) => f.name === "birthDate");
  assertEquals(birthDateField?.isRequired, false);
});

// =============================================================================
// getWidgetForField Tests
// =============================================================================

Deno.test("getWidgetForField: CharField -> admin-input", () => {
  const fields = getModelFields(TestUser);
  const emailField = fields.find((f) => f.name === "email")!;
  assertEquals(getWidgetForField(emailField), "admin-input");
});

Deno.test("getWidgetForField: TextField -> admin-textarea", () => {
  const fields = getModelFields(TestUser);
  const bioField = fields.find((f) => f.name === "bio")!;
  assertEquals(getWidgetForField(bioField), "admin-textarea");
});

Deno.test("getWidgetForField: IntegerField -> admin-input[type=number]", () => {
  const fields = getModelFields(TestUser);
  const ageField = fields.find((f) => f.name === "age")!;
  assertEquals(getWidgetForField(ageField), "admin-input[type=number]");
});

Deno.test("getWidgetForField: BooleanField -> admin-checkbox", () => {
  const fields = getModelFields(TestUser);
  const isActiveField = fields.find((f) => f.name === "isActive")!;
  assertEquals(getWidgetForField(isActiveField), "admin-checkbox");
});

Deno.test("getWidgetForField: DateTimeField -> admin-input[type=datetime-local]", () => {
  const fields = getModelFields(TestUser);
  const createdAtField = fields.find((f) => f.name === "createdAt")!;
  assertEquals(
    getWidgetForField(createdAtField),
    "admin-input[type=datetime-local]",
  );
});

Deno.test("getWidgetForField: DateField -> admin-input[type=date]", () => {
  const fields = getModelFields(TestUser);
  const birthDateField = fields.find((f) => f.name === "birthDate")!;
  assertEquals(getWidgetForField(birthDateField), "admin-input[type=date]");
});

Deno.test("getWidgetForField: AutoField -> admin-input[readonly]", () => {
  const fields = getModelFields(TestUser);
  const idField = fields.find((f) => f.name === "id")!;
  assertEquals(getWidgetForField(idField), "admin-input[readonly]");
});

// =============================================================================
// getModelMeta Tests
// =============================================================================

Deno.test("getModelMeta: returns model name", () => {
  const meta = getModelMeta(TestUser);
  assertEquals(meta.name, "TestUser");
});

Deno.test("getModelMeta: returns table name", () => {
  const meta = getModelMeta(TestUser);
  assertEquals(meta.tableName, "test_users");
});

Deno.test("getModelMeta: returns verbose name", () => {
  const meta = getModelMeta(TestUser);
  assertEquals(meta.verboseName, "User");
});

Deno.test("getModelMeta: returns verbose name plural", () => {
  const meta = getModelMeta(TestUser);
  assertEquals(meta.verboseNamePlural, "Users");
});

Deno.test("getModelMeta: generates default verbose name", () => {
  const meta = getModelMeta(TestProduct);
  // Should generate from class name: "TestProduct" -> "Test Product" or similar
  assertExists(meta.verboseName);
});

Deno.test("getModelMeta: generates default verbose name plural", () => {
  const meta = getModelMeta(TestProduct);
  // Should generate plural: "TestProduct" -> "Test Products" or similar
  assertExists(meta.verboseNamePlural);
});

Deno.test("getModelMeta: returns primary key field name", () => {
  const meta = getModelMeta(TestUser);
  assertEquals(meta.primaryKey, "id");
});

// =============================================================================
// Field Info for Specific Field Types
// =============================================================================

Deno.test("getFieldInfo: CharField specific options", () => {
  const fields = getModelFields(TestUser);
  const emailField = fields.find((f) => f.name === "email");

  assertExists(emailField);
  assertEquals(emailField.type, "CharField");
  assertEquals(emailField.options.maxLength, 200);
});

Deno.test("getFieldInfo: IntegerField specific options", () => {
  const fields = getModelFields(TestProduct);
  const priceField = fields.find((f) => f.name === "price");

  assertExists(priceField);
  assertEquals(priceField.type, "IntegerField");
  assertEquals(priceField.options.default, 0);
});

// =============================================================================
// Edge Cases
// =============================================================================

Deno.test("getModelFields: handles model with minimal fields", () => {
  class MinimalModel extends Model {
    id = new AutoField({ primaryKey: true });
    static objects = new Manager(MinimalModel);
    static meta = { dbTable: "minimal" };
  }

  const fields = getModelFields(MinimalModel);
  assertEquals(fields.length, 1);
  assertEquals(fields[0].name, "id");
});

Deno.test("getFieldInfo: field with choices", () => {
  class ModelWithChoices extends Model {
    id = new AutoField({ primaryKey: true });
    status = new CharField({
      maxLength: 20,
      choices: [
        ["draft", "Draft"],
        ["published", "Published"],
        ["archived", "Archived"],
      ] as [string, string][],
    });
    static objects = new Manager(ModelWithChoices);
    static meta = { dbTable: "with_choices" };
  }

  const fields = getModelFields(ModelWithChoices);
  const statusField = fields.find((f) => f.name === "status");

  assertExists(statusField);
  assertExists(statusField.options.choices);
  assertEquals(statusField.options.choices?.length, 3);
  assertEquals(statusField.options.choices?.[0], ["draft", "Draft"]);
});
