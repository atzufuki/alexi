/**
 * Serializer field types for Alexi REST Framework
 *
 * These fields are used for validating and serializing data in API requests/responses.
 *
 * @module @alexi/restframework/serializers/fields
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Validation error with field-specific messages
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Result of field validation
 */
export interface FieldValidationResult {
  valid: boolean;
  value?: unknown;
  errors: string[];
}

/**
 * Base options for all serializer fields
 */
export interface BaseFieldOptions {
  /** Whether this field is required (default: true) */
  required?: boolean;

  /** Whether this field is read-only (default: false) */
  readOnly?: boolean;

  /** Whether this field is write-only (default: false) */
  writeOnly?: boolean;

  /** Default value if not provided */
  default?: unknown;

  /** Whether to allow null values (default: false) */
  allowNull?: boolean;

  /** Custom error messages */
  errorMessages?: Record<string, string>;

  /** Help text for documentation */
  helpText?: string;

  /** Label for documentation */
  label?: string;

  /** Source attribute name on the object (for aliasing field names) */
  source?: string;
}

// ============================================================================
// Base Field Class
// ============================================================================

/**
 * Base class for all serializer fields
 */
export abstract class SerializerField<T = unknown> {
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly writeOnly: boolean;
  readonly defaultValue?: T;
  readonly allowNull: boolean;
  readonly errorMessages: Record<string, string>;
  readonly helpText?: string;
  readonly label?: string;
  readonly source?: string;

  constructor(options: BaseFieldOptions = {}) {
    this.required = options.required ?? true;
    this.readOnly = options.readOnly ?? false;
    this.writeOnly = options.writeOnly ?? false;
    this.defaultValue = options.default as T | undefined;
    this.source = options.source;
    this.allowNull = options.allowNull ?? false;
    this.errorMessages = options.errorMessages ?? {};
    this.helpText = options.helpText;
    this.label = options.label;
  }

  /**
   * Check if field has a default value
   */
  hasDefault(): boolean {
    return this.defaultValue !== undefined;
  }

  /**
   * Get the default value
   */
  getDefault(): T | undefined {
    return this.defaultValue;
  }

  /**
   * Validate and transform input data
   */
  validate(value: unknown): FieldValidationResult {
    const errors: string[] = [];

    // Handle null
    if (value === null) {
      if (this.allowNull) {
        return { valid: true, value: null, errors: [] };
      }
      errors.push(this.getErrorMessage("null", "This field may not be null."));
      return { valid: false, errors };
    }

    // Handle undefined/missing
    if (value === undefined) {
      if (this.hasDefault()) {
        return { valid: true, value: this.getDefault(), errors: [] };
      }
      if (!this.required) {
        // If allowNull is true, convert undefined to null for database consistency
        const resultValue = this.allowNull ? null : undefined;
        return { valid: true, value: resultValue, errors: [] };
      }
      errors.push(this.getErrorMessage("required", "This field is required."));
      return { valid: false, errors };
    }

    // Type-specific validation
    return this.validateType(value);
  }

  /**
   * Type-specific validation (override in subclasses)
   */
  protected abstract validateType(value: unknown): FieldValidationResult;

  /**
   * Serialize value for output
   */
  toRepresentation(value: T): unknown {
    return value;
  }

  /**
   * Transform input value for internal use
   */
  toInternalValue(value: unknown): T {
    return value as T;
  }

  /**
   * Get error message with fallback
   */
  protected getErrorMessage(key: string, defaultMessage: string): string {
    return this.errorMessages[key] ?? defaultMessage;
  }
}

// ============================================================================
// String Fields
// ============================================================================

export interface CharFieldOptions extends BaseFieldOptions {
  /** Maximum length */
  maxLength?: number;

  /** Minimum length */
  minLength?: number;

  /** Whether to allow blank strings (default: false) */
  allowBlank?: boolean;

  /** Whether to trim whitespace (default: true) */
  trim?: boolean;
}

/**
 * String field with optional length constraints
 */
export class CharField extends SerializerField<string> {
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly allowBlank: boolean;
  readonly trim: boolean;

  constructor(options: CharFieldOptions = {}) {
    super(options);
    this.maxLength = options.maxLength;
    this.minLength = options.minLength;
    this.allowBlank = options.allowBlank ?? false;
    this.trim = options.trim ?? true;
  }

  protected validateType(value: unknown): FieldValidationResult {
    const errors: string[] = [];

    // Convert to string
    let strValue = String(value);

    // Trim if enabled
    if (this.trim) {
      strValue = strValue.trim();
    }

    // Check blank
    if (strValue === "" && !this.allowBlank) {
      errors.push(
        this.getErrorMessage("blank", "This field may not be blank."),
      );
      return { valid: false, errors };
    }

    // Check max length
    if (this.maxLength !== undefined && strValue.length > this.maxLength) {
      errors.push(
        this.getErrorMessage(
          "maxLength",
          `Ensure this field has no more than ${this.maxLength} characters.`,
        ),
      );
    }

    // Check min length
    if (this.minLength !== undefined && strValue.length < this.minLength) {
      errors.push(
        this.getErrorMessage(
          "minLength",
          `Ensure this field has at least ${this.minLength} characters.`,
        ),
      );
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, value: strValue, errors: [] };
  }
}

/**
 * Text field for longer strings (no max length by default)
 */
export class TextField extends CharField {
  constructor(options: CharFieldOptions = {}) {
    super({ allowBlank: true, ...options });
  }
}

/**
 * Email field with email validation
 */
export class EmailField extends CharField {
  private static readonly EMAIL_REGEX =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  protected override validateType(value: unknown): FieldValidationResult {
    const result = super.validateType(value);
    if (!result.valid) return result;

    const strValue = result.value as string;
    if (strValue && !EmailField.EMAIL_REGEX.test(strValue)) {
      return {
        valid: false,
        errors: [
          this.getErrorMessage("invalid", "Enter a valid email address."),
        ],
      };
    }

    return result;
  }
}

/**
 * URL field with URL validation
 */
export class URLField extends CharField {
  protected override validateType(value: unknown): FieldValidationResult {
    const result = super.validateType(value);
    if (!result.valid) return result;

    const strValue = result.value as string;
    if (strValue) {
      try {
        new URL(strValue);
      } catch {
        return {
          valid: false,
          errors: [this.getErrorMessage("invalid", "Enter a valid URL.")],
        };
      }
    }

    return result;
  }
}

/**
 * UUID field with UUID validation
 */
export class UUIDField extends CharField {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  protected override validateType(value: unknown): FieldValidationResult {
    const result = super.validateType(value);
    if (!result.valid) return result;

    const strValue = result.value as string;
    if (strValue && !UUIDField.UUID_REGEX.test(strValue)) {
      return {
        valid: false,
        errors: [this.getErrorMessage("invalid", "Enter a valid UUID.")],
      };
    }

    return result;
  }
}

// ============================================================================
// Numeric Fields
// ============================================================================

export interface IntegerFieldOptions extends BaseFieldOptions {
  /** Minimum value */
  minValue?: number;

  /** Maximum value */
  maxValue?: number;
}

/**
 * Integer field
 */
export class IntegerField extends SerializerField<number> {
  readonly minValue?: number;
  readonly maxValue?: number;

  constructor(options: IntegerFieldOptions = {}) {
    super(options);
    this.minValue = options.minValue;
    this.maxValue = options.maxValue;
  }

  protected validateType(value: unknown): FieldValidationResult {
    const errors: string[] = [];

    // Parse as integer
    const numValue = typeof value === "number"
      ? value
      : parseInt(String(value), 10);

    if (isNaN(numValue)) {
      errors.push(
        this.getErrorMessage("invalid", "A valid integer is required."),
      );
      return { valid: false, errors };
    }

    if (!Number.isInteger(numValue)) {
      errors.push(
        this.getErrorMessage("invalid", "A valid integer is required."),
      );
      return { valid: false, errors };
    }

    // Check min value
    if (this.minValue !== undefined && numValue < this.minValue) {
      errors.push(
        this.getErrorMessage(
          "minValue",
          `Ensure this value is greater than or equal to ${this.minValue}.`,
        ),
      );
    }

    // Check max value
    if (this.maxValue !== undefined && numValue > this.maxValue) {
      errors.push(
        this.getErrorMessage(
          "maxValue",
          `Ensure this value is less than or equal to ${this.maxValue}.`,
        ),
      );
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, value: numValue, errors: [] };
  }
}

export interface FloatFieldOptions extends BaseFieldOptions {
  /** Minimum value */
  minValue?: number;

  /** Maximum value */
  maxValue?: number;
}

/**
 * Float/decimal field
 */
export class FloatField extends SerializerField<number> {
  readonly minValue?: number;
  readonly maxValue?: number;

  constructor(options: FloatFieldOptions = {}) {
    super(options);
    this.minValue = options.minValue;
    this.maxValue = options.maxValue;
  }

  protected validateType(value: unknown): FieldValidationResult {
    const errors: string[] = [];

    // Parse as float
    const numValue = typeof value === "number"
      ? value
      : parseFloat(String(value));

    if (isNaN(numValue)) {
      errors.push(
        this.getErrorMessage("invalid", "A valid number is required."),
      );
      return { valid: false, errors };
    }

    // Check min value
    if (this.minValue !== undefined && numValue < this.minValue) {
      errors.push(
        this.getErrorMessage(
          "minValue",
          `Ensure this value is greater than or equal to ${this.minValue}.`,
        ),
      );
    }

    // Check max value
    if (this.maxValue !== undefined && numValue > this.maxValue) {
      errors.push(
        this.getErrorMessage(
          "maxValue",
          `Ensure this value is less than or equal to ${this.maxValue}.`,
        ),
      );
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, value: numValue, errors: [] };
  }
}

// ============================================================================
// Boolean Field
// ============================================================================

/**
 * Boolean field
 */
export class BooleanField extends SerializerField<boolean> {
  private static readonly TRUE_VALUES = new Set([
    "true",
    "True",
    "TRUE",
    "1",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
  ]);

  private static readonly FALSE_VALUES = new Set([
    "false",
    "False",
    "FALSE",
    "0",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF",
  ]);

  protected validateType(value: unknown): FieldValidationResult {
    // Already boolean
    if (typeof value === "boolean") {
      return { valid: true, value, errors: [] };
    }

    // Parse string
    const strValue = String(value);
    if (BooleanField.TRUE_VALUES.has(strValue)) {
      return { valid: true, value: true, errors: [] };
    }
    if (BooleanField.FALSE_VALUES.has(strValue)) {
      return { valid: true, value: false, errors: [] };
    }

    return {
      valid: false,
      errors: [this.getErrorMessage("invalid", "Must be a valid boolean.")],
    };
  }
}

// ============================================================================
// Date/Time Fields
// ============================================================================

/**
 * DateTime field
 */
export class DateTimeField extends SerializerField<Date> {
  protected validateType(value: unknown): FieldValidationResult {
    // Already a Date
    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        return {
          valid: false,
          errors: [this.getErrorMessage("invalid", "Invalid datetime.")],
        };
      }
      return { valid: true, value, errors: [] };
    }

    // Parse string or number
    const date = new Date(value as string | number);
    if (isNaN(date.getTime())) {
      return {
        valid: false,
        errors: [
          this.getErrorMessage(
            "invalid",
            "Datetime has wrong format. Use ISO 8601 format.",
          ),
        ],
      };
    }

    return { valid: true, value: date, errors: [] };
  }

  override toRepresentation(value: Date): string {
    return value.toISOString();
  }
}

/**
 * Date field (date only, no time)
 */
export class DateField extends SerializerField<Date> {
  private static readonly DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  protected validateType(value: unknown): FieldValidationResult {
    // Already a Date
    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        return {
          valid: false,
          errors: [this.getErrorMessage("invalid", "Invalid date.")],
        };
      }
      return { valid: true, value, errors: [] };
    }

    // Parse string
    const strValue = String(value);
    if (!DateField.DATE_REGEX.test(strValue)) {
      return {
        valid: false,
        errors: [
          this.getErrorMessage(
            "invalid",
            "Date has wrong format. Use YYYY-MM-DD.",
          ),
        ],
      };
    }

    const date = new Date(strValue + "T00:00:00Z");
    if (isNaN(date.getTime())) {
      return {
        valid: false,
        errors: [this.getErrorMessage("invalid", "Invalid date.")],
      };
    }

    return { valid: true, value: date, errors: [] };
  }

  override toRepresentation(value: Date): string {
    return value.toISOString().split("T")[0];
  }
}

// ============================================================================
// Choice Field
// ============================================================================

export interface ChoiceFieldOptions extends BaseFieldOptions {
  /** Allowed choices */
  choices: readonly (string | number)[];
}

/**
 * Choice field with predefined options
 */
export class ChoiceField extends SerializerField<string | number> {
  readonly choices: readonly (string | number)[];

  constructor(options: ChoiceFieldOptions) {
    super(options);
    this.choices = options.choices;
  }

  protected validateType(value: unknown): FieldValidationResult {
    const val = typeof value === "number" ? value : String(value);

    if (!this.choices.includes(val)) {
      return {
        valid: false,
        errors: [
          this.getErrorMessage(
            "invalid",
            `"${val}" is not a valid choice. Valid choices: ${
              this.choices.join(", ")
            }.`,
          ),
        ],
      };
    }

    return { valid: true, value: val, errors: [] };
  }
}

// ============================================================================
// Composite Fields
// ============================================================================

export interface ListFieldOptions extends BaseFieldOptions {
  /** Child field for list items */
  child: SerializerField;

  /** Minimum number of items */
  minLength?: number;

  /** Maximum number of items */
  maxLength?: number;

  /** Whether to allow empty list (default: true) */
  allowEmpty?: boolean;
}

/**
 * List field for arrays
 */
export class ListField extends SerializerField<unknown[]> {
  readonly child: SerializerField;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly allowEmpty: boolean;

  constructor(options: ListFieldOptions) {
    super(options);
    this.child = options.child;
    this.minLength = options.minLength;
    this.maxLength = options.maxLength;
    this.allowEmpty = options.allowEmpty ?? true;
  }

  protected validateType(value: unknown): FieldValidationResult {
    const errors: string[] = [];

    if (!Array.isArray(value)) {
      return {
        valid: false,
        errors: [this.getErrorMessage("invalid", "Expected a list of items.")],
      };
    }

    // Check empty
    if (value.length === 0 && !this.allowEmpty) {
      errors.push(this.getErrorMessage("empty", "This list may not be empty."));
      return { valid: false, errors };
    }

    // Check min length
    if (this.minLength !== undefined && value.length < this.minLength) {
      errors.push(
        this.getErrorMessage(
          "minLength",
          `Ensure this list has at least ${this.minLength} items.`,
        ),
      );
    }

    // Check max length
    if (this.maxLength !== undefined && value.length > this.maxLength) {
      errors.push(
        this.getErrorMessage(
          "maxLength",
          `Ensure this list has no more than ${this.maxLength} items.`,
        ),
      );
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Validate each item
    const validatedItems: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      const result = this.child.validate(value[i]);
      if (!result.valid) {
        for (const error of result.errors) {
          errors.push(`Item ${i}: ${error}`);
        }
      } else {
        validatedItems.push(result.value);
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, value: validatedItems, errors: [] };
  }
}

/**
 * JSON field for arbitrary JSON data
 */
export class JSONField extends SerializerField<unknown> {
  protected validateType(value: unknown): FieldValidationResult {
    // Accept any JSON-serializable value
    try {
      // Test if it's serializable
      JSON.stringify(value);
      return { valid: true, value, errors: [] };
    } catch {
      return {
        valid: false,
        errors: [
          this.getErrorMessage("invalid", "Value is not JSON serializable."),
        ],
      };
    }
  }
}

// ============================================================================
// SerializerMethodField
// ============================================================================

/**
 * Options for SerializerMethodField
 */
export interface SerializerMethodFieldOptions extends BaseFieldOptions {
  /** Method name to call on the serializer (default: get_{field_name}) */
  methodName?: string;
}

/**
 * A read-only field that gets its value by calling a method on the serializer.
 * Similar to Django REST Framework's SerializerMethodField.
 *
 * @example
 * ```ts
 * class UserSerializer extends Serializer {
 *   fullName = new SerializerMethodField();
 *
 *   getFullName(user: User): string {
 *     return `${user.firstName} ${user.lastName}`;
 *   }
 * }
 * ```
 */
export class SerializerMethodField extends SerializerField<unknown> {
  readonly methodName?: string;

  constructor(options: SerializerMethodFieldOptions = {}) {
    super({ ...options, readOnly: true, required: false });
    this.methodName = options.methodName;
  }

  protected validateType(_value: unknown): FieldValidationResult {
    // SerializerMethodField is always read-only, no validation needed
    return { valid: true, value: undefined, errors: [] };
  }
}

// ============================================================================
// PrimaryKeyRelatedField
// ============================================================================

/**
 * Options for PrimaryKeyRelatedField
 */
export interface PrimaryKeyRelatedFieldOptions extends BaseFieldOptions {
  /** The queryset to use for looking up the related object */
  queryset?: unknown;

  /** Whether to allow multiple selections */
  many?: boolean;

  /** The field name to use as the primary key (default: "id") */
  pkField?: string;
}

/**
 * A field that represents a relationship using the primary key.
 * Similar to Django REST Framework's PrimaryKeyRelatedField.
 *
 * @example
 * ```ts
 * class ProjectAssignmentSerializer extends Serializer {
 *   employee = new PrimaryKeyRelatedField({ required: true });
 *   project = new PrimaryKeyRelatedField({ required: true });
 * }
 * ```
 */
export class PrimaryKeyRelatedField extends SerializerField<
  number | string | null
> {
  readonly many: boolean;
  readonly pkField: string;

  constructor(options: PrimaryKeyRelatedFieldOptions = {}) {
    super(options);
    this.many = options.many ?? false;
    this.pkField = options.pkField ?? "id";
  }

  protected validateType(value: unknown): FieldValidationResult {
    if (this.many) {
      if (!Array.isArray(value)) {
        return {
          valid: false,
          errors: [
            this.getErrorMessage(
              "invalid",
              "Expected a list of primary keys.",
            ),
          ],
        };
      }
      // Validate each item is a valid primary key
      for (const item of value) {
        if (typeof item !== "number" && typeof item !== "string") {
          return {
            valid: false,
            errors: [
              this.getErrorMessage(
                "invalid",
                "Each item must be a valid primary key.",
              ),
            ],
          };
        }
      }
      return { valid: true, value, errors: [] };
    }

    // Single value
    if (typeof value !== "number" && typeof value !== "string") {
      return {
        valid: false,
        errors: [
          this.getErrorMessage(
            "invalid",
            "Invalid primary key. Expected a number or string.",
          ),
        ],
      };
    }

    return { valid: true, value, errors: [] };
  }

  override toRepresentation(value: number | string | null): unknown {
    return value;
  }
}
