/**
 * Tests for Alexi REST Framework Serializers
 *
 * @module @alexi/restframework/tests/serializers_test
 */

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

import {
  BooleanField,
  CharField,
  ChoiceField,
  DateField,
  DateTimeField,
  EmailField,
  FloatField,
  IntegerField,
  JSONField,
  ListField,
  SerializerField,
  TextField,
  URLField,
  UUIDField,
} from "../serializers/fields.ts";

import {
  FieldValidationError,
  Serializer,
  SerializerValidationError,
  ValidationError,
} from "../serializers/serializer.ts";

// ============================================================================
// CharField Tests
// ============================================================================

describe("CharField", () => {
  it("should validate a valid string", () => {
    const field = new CharField();
    const result = field.validate("hello");

    assertEquals(result.valid, true);
    assertEquals(result.value, "hello");
  });

  it("should trim whitespace by default", () => {
    const field = new CharField();
    const result = field.validate("  hello  ");

    assertEquals(result.valid, true);
    assertEquals(result.value, "hello");
  });

  it("should not trim whitespace when disabled", () => {
    const field = new CharField({ trim: false });
    const result = field.validate("  hello  ");

    assertEquals(result.valid, true);
    assertEquals(result.value, "  hello  ");
  });

  it("should reject blank strings by default", () => {
    const field = new CharField();
    const result = field.validate("");

    assertEquals(result.valid, false);
    assertEquals(result.errors.length, 1);
  });

  it("should allow blank strings when configured", () => {
    const field = new CharField({ allowBlank: true });
    const result = field.validate("");

    assertEquals(result.valid, true);
    assertEquals(result.value, "");
  });

  it("should enforce maxLength", () => {
    const field = new CharField({ maxLength: 5 });
    const result = field.validate("toolong");

    assertEquals(result.valid, false);
    assertEquals(result.errors.length, 1);
  });

  it("should enforce minLength", () => {
    const field = new CharField({ minLength: 5 });
    const result = field.validate("hi");

    assertEquals(result.valid, false);
    assertEquals(result.errors.length, 1);
  });

  it("should handle required field", () => {
    const field = new CharField({ required: true });
    const result = field.validate(undefined);

    assertEquals(result.valid, false);
  });

  it("should handle optional field", () => {
    const field = new CharField({ required: false });
    const result = field.validate(undefined);

    assertEquals(result.valid, true);
  });

  it("should use default value when not provided", () => {
    const field = new CharField({ default: "default_value" });
    const result = field.validate(undefined);

    assertEquals(result.valid, true);
    assertEquals(result.value, "default_value");
  });
});

// ============================================================================
// TextField Tests
// ============================================================================

describe("TextField", () => {
  it("should allow blank strings by default", () => {
    const field = new TextField();
    const result = field.validate("");

    assertEquals(result.valid, true);
  });
});

// ============================================================================
// EmailField Tests
// ============================================================================

describe("EmailField", () => {
  it("should validate a valid email", () => {
    const field = new EmailField();
    const result = field.validate("test@example.com");

    assertEquals(result.valid, true);
    assertEquals(result.value, "test@example.com");
  });

  it("should reject invalid emails", () => {
    const field = new EmailField();
    const result = field.validate("not-an-email");

    assertEquals(result.valid, false);
    assertEquals(result.errors.length, 1);
  });

  it("should reject emails without domain", () => {
    const field = new EmailField();
    const result = field.validate("test@");

    assertEquals(result.valid, false);
  });
});

// ============================================================================
// URLField Tests
// ============================================================================

describe("URLField", () => {
  it("should validate a valid URL", () => {
    const field = new URLField();
    const result = field.validate("https://example.com");

    assertEquals(result.valid, true);
  });

  it("should reject invalid URLs", () => {
    const field = new URLField();
    const result = field.validate("not-a-url");

    assertEquals(result.valid, false);
  });
});

// ============================================================================
// UUIDField Tests
// ============================================================================

describe("UUIDField", () => {
  it("should validate a valid UUID", () => {
    const field = new UUIDField();
    const result = field.validate("123e4567-e89b-12d3-a456-426614174000");

    assertEquals(result.valid, true);
  });

  it("should reject invalid UUIDs", () => {
    const field = new UUIDField();
    const result = field.validate("not-a-uuid");

    assertEquals(result.valid, false);
  });
});

// ============================================================================
// IntegerField Tests
// ============================================================================

describe("IntegerField", () => {
  it("should validate a valid integer", () => {
    const field = new IntegerField();
    const result = field.validate(42);

    assertEquals(result.valid, true);
    assertEquals(result.value, 42);
  });

  it("should parse string to integer", () => {
    const field = new IntegerField();
    const result = field.validate("42");

    assertEquals(result.valid, true);
    assertEquals(result.value, 42);
  });

  it("should reject floats", () => {
    const field = new IntegerField();
    const result = field.validate(3.14);

    assertEquals(result.valid, false);
  });

  it("should enforce minValue", () => {
    const field = new IntegerField({ minValue: 10 });
    const result = field.validate(5);

    assertEquals(result.valid, false);
  });

  it("should enforce maxValue", () => {
    const field = new IntegerField({ maxValue: 10 });
    const result = field.validate(15);

    assertEquals(result.valid, false);
  });

  it("should reject non-numeric strings", () => {
    const field = new IntegerField();
    const result = field.validate("not-a-number");

    assertEquals(result.valid, false);
  });
});

// ============================================================================
// FloatField Tests
// ============================================================================

describe("FloatField", () => {
  it("should validate a valid float", () => {
    const field = new FloatField();
    const result = field.validate(3.14);

    assertEquals(result.valid, true);
    assertEquals(result.value, 3.14);
  });

  it("should parse string to float", () => {
    const field = new FloatField();
    const result = field.validate("3.14");

    assertEquals(result.valid, true);
    assertEquals(result.value, 3.14);
  });

  it("should accept integers", () => {
    const field = new FloatField();
    const result = field.validate(42);

    assertEquals(result.valid, true);
    assertEquals(result.value, 42);
  });

  it("should enforce minValue", () => {
    const field = new FloatField({ minValue: 0 });
    const result = field.validate(-5.5);

    assertEquals(result.valid, false);
  });

  it("should enforce maxValue", () => {
    const field = new FloatField({ maxValue: 100 });
    const result = field.validate(150.5);

    assertEquals(result.valid, false);
  });
});

// ============================================================================
// BooleanField Tests
// ============================================================================

describe("BooleanField", () => {
  it("should validate boolean true", () => {
    const field = new BooleanField();
    const result = field.validate(true);

    assertEquals(result.valid, true);
    assertEquals(result.value, true);
  });

  it("should validate boolean false", () => {
    const field = new BooleanField();
    const result = field.validate(false);

    assertEquals(result.valid, true);
    assertEquals(result.value, false);
  });

  it("should parse 'true' string", () => {
    const field = new BooleanField();
    const result = field.validate("true");

    assertEquals(result.valid, true);
    assertEquals(result.value, true);
  });

  it("should parse 'false' string", () => {
    const field = new BooleanField();
    const result = field.validate("false");

    assertEquals(result.valid, true);
    assertEquals(result.value, false);
  });

  it("should parse '1' and '0'", () => {
    const field = new BooleanField();

    assertEquals(field.validate("1").value, true);
    assertEquals(field.validate("0").value, false);
  });

  it("should parse 'yes' and 'no'", () => {
    const field = new BooleanField();

    assertEquals(field.validate("yes").value, true);
    assertEquals(field.validate("no").value, false);
  });

  it("should reject invalid values", () => {
    const field = new BooleanField();
    const result = field.validate("maybe");

    assertEquals(result.valid, false);
  });
});

// ============================================================================
// DateTimeField Tests
// ============================================================================

describe("DateTimeField", () => {
  it("should validate a Date object", () => {
    const field = new DateTimeField();
    const date = new Date("2024-01-15T10:30:00Z");
    const result = field.validate(date);

    assertEquals(result.valid, true);
    assertEquals(result.value, date);
  });

  it("should parse ISO string", () => {
    const field = new DateTimeField();
    const result = field.validate("2024-01-15T10:30:00Z");

    assertEquals(result.valid, true);
    assertEquals(
      (result.value as Date).toISOString(),
      "2024-01-15T10:30:00.000Z",
    );
  });

  it("should reject invalid date strings", () => {
    const field = new DateTimeField();
    const result = field.validate("not-a-date");

    assertEquals(result.valid, false);
  });

  it("should serialize to ISO string", () => {
    const field = new DateTimeField();
    const date = new Date("2024-01-15T10:30:00Z");

    assertEquals(field.toRepresentation(date), "2024-01-15T10:30:00.000Z");
  });
});

// ============================================================================
// DateField Tests
// ============================================================================

describe("DateField", () => {
  it("should validate a Date object", () => {
    const field = new DateField();
    const date = new Date("2024-01-15");
    const result = field.validate(date);

    assertEquals(result.valid, true);
  });

  it("should parse YYYY-MM-DD string", () => {
    const field = new DateField();
    const result = field.validate("2024-01-15");

    assertEquals(result.valid, true);
  });

  it("should reject invalid date format", () => {
    const field = new DateField();
    const result = field.validate("01/15/2024");

    assertEquals(result.valid, false);
  });

  it("should serialize to YYYY-MM-DD", () => {
    const field = new DateField();
    const date = new Date("2024-01-15T00:00:00Z");

    assertEquals(field.toRepresentation(date), "2024-01-15");
  });
});

// ============================================================================
// ChoiceField Tests
// ============================================================================

describe("ChoiceField", () => {
  it("should validate a valid choice", () => {
    const field = new ChoiceField({
      choices: ["draft", "published", "archived"],
    });
    const result = field.validate("draft");

    assertEquals(result.valid, true);
    assertEquals(result.value, "draft");
  });

  it("should reject invalid choice", () => {
    const field = new ChoiceField({
      choices: ["draft", "published", "archived"],
    });
    const result = field.validate("unknown");

    assertEquals(result.valid, false);
  });

  it("should work with numeric choices", () => {
    const field = new ChoiceField({ choices: [1, 2, 3] });
    const result = field.validate(2);

    assertEquals(result.valid, true);
    assertEquals(result.value, 2);
  });
});

// ============================================================================
// ListField Tests
// ============================================================================

describe("ListField", () => {
  it("should validate a list of valid items", () => {
    const field = new ListField({
      child: new IntegerField(),
    });
    const result = field.validate([1, 2, 3]);

    assertEquals(result.valid, true);
    assertEquals(result.value, [1, 2, 3]);
  });

  it("should reject non-array values", () => {
    const field = new ListField({
      child: new IntegerField(),
    });
    const result = field.validate("not an array");

    assertEquals(result.valid, false);
  });

  it("should validate each item", () => {
    const field = new ListField({
      child: new IntegerField(),
    });
    const result = field.validate([1, "not-a-number", 3]);

    assertEquals(result.valid, false);
  });

  it("should enforce minLength", () => {
    const field = new ListField({
      child: new IntegerField(),
      minLength: 2,
    });
    const result = field.validate([1]);

    assertEquals(result.valid, false);
  });

  it("should enforce maxLength", () => {
    const field = new ListField({
      child: new IntegerField(),
      maxLength: 2,
    });
    const result = field.validate([1, 2, 3]);

    assertEquals(result.valid, false);
  });

  it("should reject empty list when allowEmpty is false", () => {
    const field = new ListField({
      child: new IntegerField(),
      allowEmpty: false,
    });
    const result = field.validate([]);

    assertEquals(result.valid, false);
  });
});

// ============================================================================
// JSONField Tests
// ============================================================================

describe("JSONField", () => {
  it("should validate JSON objects", () => {
    const field = new JSONField();
    const result = field.validate({ key: "value" });

    assertEquals(result.valid, true);
  });

  it("should validate JSON arrays", () => {
    const field = new JSONField();
    const result = field.validate([1, 2, 3]);

    assertEquals(result.valid, true);
  });

  it("should validate primitive values", () => {
    const field = new JSONField();
    const nullableField = new JSONField({ allowNull: true });

    assertEquals(field.validate("string").valid, true);
    assertEquals(field.validate(42).valid, true);
    assertEquals(field.validate(true).valid, true);
    assertEquals(nullableField.validate(null).valid, true); // with allowNull
  });
});

// ============================================================================
// Serializer Tests
// ============================================================================

class TestSerializer extends Serializer {
  protected override getFieldDefinitions(): Record<string, SerializerField> {
    return {
      id: new IntegerField({ readOnly: true }),
      name: new CharField({ maxLength: 100 }),
      email: new EmailField({ required: false }),
      age: new IntegerField({ minValue: 0 }),
    };
  }

  // Custom field validator
  validate_name(value: string): string {
    if (value.toLowerCase() === "admin") {
      throw new FieldValidationError("Name cannot be 'admin'");
    }
    return value;
  }
}

describe("Serializer", () => {
  it("should validate valid data", () => {
    const serializer = new TestSerializer({
      data: {
        name: "John",
        age: 30,
      },
    });

    assertEquals(serializer.isValid(), true);
    assertEquals(serializer.validatedData.name, "John");
    assertEquals(serializer.validatedData.age, 30);
  });

  it("should skip read-only fields during validation", () => {
    const serializer = new TestSerializer({
      data: {
        id: 999, // Should be ignored
        name: "John",
        age: 30,
      },
    });

    assertEquals(serializer.isValid(), true);
    // id should not be in validated data
    assertEquals(serializer.validatedData.id, undefined);
  });

  it("should return errors for invalid data", () => {
    const serializer = new TestSerializer({
      data: {
        name: "", // blank
        age: -5, // negative
      },
    });

    assertEquals(serializer.isValid(), false);
    assertNotEquals(serializer.errors.name, undefined);
    assertNotEquals(serializer.errors.age, undefined);
  });

  it("should run custom field validators", () => {
    const serializer = new TestSerializer({
      data: {
        name: "admin",
        age: 30,
      },
    });

    assertEquals(serializer.isValid(), false);
    assertNotEquals(serializer.errors.name, undefined);
  });

  it("should handle partial updates", () => {
    const serializer = new TestSerializer({
      data: {
        name: "Updated Name",
        // age is missing but should be OK because partial=true
      },
      partial: true,
    });

    assertEquals(serializer.isValid(), true);
    assertEquals(serializer.validatedData.name, "Updated Name");
  });

  it("should serialize instance to data", () => {
    const instance = {
      id: 1,
      name: "John",
      email: "john@example.com",
      age: 30,
    };

    const serializer = new TestSerializer({ instance });
    const data = serializer.data;

    assertEquals(data.id, 1);
    assertEquals(data.name, "John");
    assertEquals(data.email, "john@example.com");
    assertEquals(data.age, 30);
  });
});
