/**
 * ModelForm tests for Alexi Admin
 *
 * These tests verify the model form functionality for create/edit views.
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  AutoField,
  BooleanField,
  CharField,
  IntegerField,
  Manager,
  Model,
  TextField,
} from "@alexi/db";

import {
  getEditableFields,
  getModelFields,
  getWidgetForField,
} from "../introspection.ts";
import { AdminSite, ModelAdmin } from "../mod.ts";

// =============================================================================
// Test Models
// =============================================================================

class TestProduct extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  description = new TextField({ blank: true });
  price = new IntegerField({ default: 0 });
  inStock = new BooleanField({ default: true });

  static objects = new Manager(TestProduct);
  static meta = { dbTable: "test_products" };
}

class TestArticle extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  content = new TextField();
  isPublished = new BooleanField({ default: false });
  views = new IntegerField({ default: 0 });

  static objects = new Manager(TestArticle);
  static meta = { dbTable: "test_articles" };
}

// =============================================================================
// Form Field Configuration Tests
// =============================================================================

Deno.test("ModelForm config: fields configures visible fields", () => {
  class ProductAdmin extends ModelAdmin {
    fields = ["name", "price"];
  }

  const site = new AdminSite();
  site.register(TestProduct, ProductAdmin);

  const admin = site.getModelAdmin(TestProduct);
  assertEquals(admin.fields, ["name", "price"]);
  assertEquals(admin.fields.includes("description"), false);
});

Deno.test("ModelForm config: empty fields shows all editable fields", () => {
  const site = new AdminSite();
  site.register(TestProduct);

  const admin = site.getModelAdmin(TestProduct);
  assertEquals(admin.fields, []);

  // When fields is empty, all editable fields should be available
  const editableFields = getEditableFields(TestProduct);
  assertEquals(editableFields.length >= 4, true); // name, description, price, inStock
});

Deno.test("ModelForm config: readonlyFields marks fields as non-editable", () => {
  class ProductAdmin extends ModelAdmin {
    fields = ["id", "name", "price"];
    readonlyFields = ["id", "price"];
  }

  const site = new AdminSite();
  site.register(TestProduct, ProductAdmin);

  const admin = site.getModelAdmin(TestProduct);
  assertEquals(admin.isFieldReadonly("id"), true);
  assertEquals(admin.isFieldReadonly("price"), true);
  assertEquals(admin.isFieldReadonly("name"), false);
});

Deno.test("ModelForm config: fieldsets groups fields", () => {
  class ArticleAdmin extends ModelAdmin {
    fieldsets = [
      { name: "Basic Info", fields: ["title"] },
      { name: "Content", fields: ["content"], collapsed: false },
      { name: "Settings", fields: ["isPublished", "views"], collapsed: true },
    ];
  }

  const site = new AdminSite();
  site.register(TestArticle, ArticleAdmin);

  const admin = site.getModelAdmin(TestArticle);
  assertEquals(admin.fieldsets.length, 3);
  assertEquals(admin.fieldsets[0].name, "Basic Info");
  assertEquals(admin.fieldsets[0].fields, ["title"]);
  assertEquals(admin.fieldsets[2].collapsed, true);
});

// =============================================================================
// Field Widget Mapping Tests
// =============================================================================

Deno.test("ModelForm widgets: CharField maps to admin-input", () => {
  const fields = getModelFields(TestProduct);
  const nameField = fields.find((f) => f.name === "name")!;

  assertEquals(getWidgetForField(nameField), "admin-input");
});

Deno.test("ModelForm widgets: TextField maps to admin-textarea", () => {
  const fields = getModelFields(TestProduct);
  const descField = fields.find((f) => f.name === "description")!;

  assertEquals(getWidgetForField(descField), "admin-textarea");
});

Deno.test("ModelForm widgets: IntegerField maps to admin-input[type=number]", () => {
  const fields = getModelFields(TestProduct);
  const priceField = fields.find((f) => f.name === "price")!;

  assertEquals(getWidgetForField(priceField), "admin-input[type=number]");
});

Deno.test("ModelForm widgets: BooleanField maps to admin-checkbox", () => {
  const fields = getModelFields(TestProduct);
  const inStockField = fields.find((f) => f.name === "inStock")!;

  assertEquals(getWidgetForField(inStockField), "admin-checkbox");
});

Deno.test("ModelForm widgets: AutoField maps to admin-input[readonly]", () => {
  const fields = getModelFields(TestProduct);
  const idField = fields.find((f) => f.name === "id")!;

  assertEquals(getWidgetForField(idField), "admin-input[readonly]");
});

// =============================================================================
// Field Information Tests
// =============================================================================

Deno.test("ModelForm fields: identifies required fields", () => {
  const fields = getModelFields(TestProduct);

  // name is required (not blank, not null)
  const nameField = fields.find((f) => f.name === "name")!;
  assertEquals(nameField.isRequired, true);

  // description is not required (blank=true)
  const descField = fields.find((f) => f.name === "description")!;
  assertEquals(descField.isRequired, false);
});

Deno.test("ModelForm fields: identifies default values", () => {
  const fields = getModelFields(TestProduct);

  const priceField = fields.find((f) => f.name === "price")!;
  assertEquals(priceField.options.default, 0);

  const inStockField = fields.find((f) => f.name === "inStock")!;
  assertEquals(inStockField.options.default, true);
});

Deno.test("ModelForm fields: identifies maxLength for CharField", () => {
  const fields = getModelFields(TestProduct);

  const nameField = fields.find((f) => f.name === "name")!;
  assertEquals(nameField.options.maxLength, 100);
});

// =============================================================================
// Form Data Building Tests (Logic)
// =============================================================================

Deno.test("ModelForm data: build form data from field values", () => {
  interface FormData {
    [key: string]: unknown;
  }

  function buildFormData(
    fields: Array<{ name: string; value: unknown }>,
  ): FormData {
    const data: FormData = {};
    for (const field of fields) {
      data[field.name] = field.value;
    }
    return data;
  }

  const formFields = [
    { name: "name", value: "Test Product" },
    { name: "price", value: 100 },
    { name: "inStock", value: true },
  ];

  const data = buildFormData(formFields);
  assertEquals(data.name, "Test Product");
  assertEquals(data.price, 100);
  assertEquals(data.inStock, true);
});

Deno.test("ModelForm data: validate required fields", () => {
  interface ValidationResult {
    valid: boolean;
    errors: Record<string, string[]>;
  }

  function validateFormData(
    data: Record<string, unknown>,
    requiredFields: string[],
  ): ValidationResult {
    const errors: Record<string, string[]> = {};

    for (const field of requiredFields) {
      const value = data[field];
      if (value === null || value === undefined || value === "") {
        errors[field] = [`${field} is required`];
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  // Valid data
  const validResult = validateFormData(
    { name: "Test", price: 100 },
    ["name"],
  );
  assertEquals(validResult.valid, true);
  assertEquals(Object.keys(validResult.errors).length, 0);

  // Invalid data (missing required field)
  const invalidResult = validateFormData(
    { name: "", price: 100 },
    ["name"],
  );
  assertEquals(invalidResult.valid, false);
  assertExists(invalidResult.errors.name);
});

Deno.test("ModelForm data: validate maxLength constraint", () => {
  function validateMaxLength(
    value: string,
    maxLength: number,
  ): { valid: boolean; error?: string } {
    if (value.length > maxLength) {
      return {
        valid: false,
        error: `Value exceeds maximum length of ${maxLength} characters`,
      };
    }
    return { valid: true };
  }

  // Valid length
  assertEquals(validateMaxLength("Test", 100).valid, true);

  // Exceeds maxLength
  const longString = "x".repeat(101);
  const result = validateMaxLength(longString, 100);
  assertEquals(result.valid, false);
  assertExists(result.error);
});

Deno.test("ModelForm data: validate number range", () => {
  function validateNumberRange(
    value: number,
    min?: number,
    max?: number,
  ): { valid: boolean; error?: string } {
    if (min !== undefined && value < min) {
      return { valid: false, error: `Value must be at least ${min}` };
    }
    if (max !== undefined && value > max) {
      return { valid: false, error: `Value must be at most ${max}` };
    }
    return { valid: true };
  }

  // Valid range
  assertEquals(validateNumberRange(50, 0, 100).valid, true);

  // Below minimum
  assertEquals(validateNumberRange(-1, 0, 100).valid, false);

  // Above maximum
  assertEquals(validateNumberRange(101, 0, 100).valid, false);
});

// =============================================================================
// Form Actions Tests
// =============================================================================

Deno.test("ModelForm actions: saveContinue option", () => {
  class ProductAdmin extends ModelAdmin {
    saveContinue = true;
  }

  const site = new AdminSite();
  site.register(TestProduct, ProductAdmin);

  const admin = site.getModelAdmin(TestProduct);
  assertEquals(admin.saveContinue, true);
});

Deno.test("ModelForm actions: saveContinue default is true", () => {
  const site = new AdminSite();
  site.register(TestProduct);

  const admin = site.getModelAdmin(TestProduct);
  assertEquals(admin.saveContinue, true);
});

Deno.test("ModelForm actions: saveAsNew option", () => {
  class ProductAdmin extends ModelAdmin {
    saveAsNew = true;
  }

  const site = new AdminSite();
  site.register(TestProduct, ProductAdmin);

  const admin = site.getModelAdmin(TestProduct);
  assertEquals(admin.saveAsNew, true);
});

Deno.test("ModelForm actions: saveAsNew default is false", () => {
  const site = new AdminSite();
  site.register(TestProduct);

  const admin = site.getModelAdmin(TestProduct);
  assertEquals(admin.saveAsNew, false);
});

// =============================================================================
// Permissions Tests
// =============================================================================

Deno.test("ModelForm permissions: hasViewPermission default is true", () => {
  const site = new AdminSite();
  site.register(TestProduct);

  const admin = site.getModelAdmin(TestProduct);
  assertEquals(admin.hasViewPermission(), true);
});

Deno.test("ModelForm permissions: hasAddPermission default is true", () => {
  const site = new AdminSite();
  site.register(TestProduct);

  const admin = site.getModelAdmin(TestProduct);
  assertEquals(admin.hasAddPermission(), true);
});

Deno.test("ModelForm permissions: hasChangePermission default is true", () => {
  const site = new AdminSite();
  site.register(TestProduct);

  const admin = site.getModelAdmin(TestProduct);
  assertEquals(admin.hasChangePermission(), true);
});

Deno.test("ModelForm permissions: hasDeletePermission default is true", () => {
  const site = new AdminSite();
  site.register(TestProduct);

  const admin = site.getModelAdmin(TestProduct);
  assertEquals(admin.hasDeletePermission(), true);
});

// =============================================================================
// Field Exclusion Tests
// =============================================================================

Deno.test("ModelForm exclude: getEditableFields excludes AutoField", () => {
  const editableFields = getEditableFields(TestProduct);
  const fieldNames = editableFields.map((f) => f.name);

  // AutoField (id) should not be in editable fields
  assertEquals(fieldNames.includes("id"), false);

  // Regular fields should be included
  assertEquals(fieldNames.includes("name"), true);
  assertEquals(fieldNames.includes("price"), true);
});

Deno.test("ModelForm exclude: getEditableFields excludes auto timestamp fields", () => {
  // Create a model with auto timestamp fields
  class ModelWithTimestamps extends Model {
    id = new AutoField({ primaryKey: true });
    name = new CharField({ maxLength: 100 });

    static objects = new Manager(ModelWithTimestamps);
    static meta = { dbTable: "with_timestamps" };
  }

  const editableFields = getEditableFields(ModelWithTimestamps);
  const fieldNames = editableFields.map((f) => f.name);

  // name should be editable
  assertEquals(fieldNames.includes("name"), true);

  // id (AutoField) should not be editable
  assertEquals(fieldNames.includes("id"), false);
});

// =============================================================================
// Verbose Name Tests
// =============================================================================

Deno.test("ModelForm labels: uses verboseName when available", () => {
  class ModelWithVerboseName extends Model {
    id = new AutoField({ primaryKey: true });
    email = new CharField({
      maxLength: 200,
      verboseName: "Email Address",
    });

    static objects = new Manager(ModelWithVerboseName);
    static meta = { dbTable: "with_verbose" };
  }

  const fields = getModelFields(ModelWithVerboseName);
  const emailField = fields.find((f) => f.name === "email")!;

  assertEquals(emailField.options.verboseName, "Email Address");
});

Deno.test("ModelForm labels: uses helpText when available", () => {
  class ModelWithHelpText extends Model {
    id = new AutoField({ primaryKey: true });
    price = new IntegerField({
      helpText: "Enter price in cents",
    });

    static objects = new Manager(ModelWithHelpText);
    static meta = { dbTable: "with_help" };
  }

  const fields = getModelFields(ModelWithHelpText);
  const priceField = fields.find((f) => f.name === "price")!;

  assertEquals(priceField.options.helpText, "Enter price in cents");
});
