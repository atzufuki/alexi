/**
 * Concrete field type implementations for Alexi ORM
 * @module
 */

import {
  Field,
  FieldOptions,
  FieldValidationError,
  ValidationResult,
} from "./field.ts";

export { Field } from "./field.ts";
export type { FieldOptions, ValidationResult } from "./field.ts";
export { FieldValidationError } from "./field.ts";

// ============================================================================
// String Fields
// ============================================================================

/**
 * CharField options
 *
 * Extends base field options with a required maximum string length.
 */
export interface CharFieldOptions extends FieldOptions<string> {
  /** Maximum length of the string */
  maxLength: number;
}

/**
 * CharField - Fixed-length string field
 *
 * Use for bounded text values such as names, titles, and short slugs.
 */
export class CharField extends Field<string> {
  /** Maximum allowed string length. */
  readonly maxLength: number;

  /**
   * Create a bounded string field.
   *
   * @param options Base field options plus the required `maxLength`.
   */
  constructor(options: CharFieldOptions) {
    super(options);
    this.maxLength = options.maxLength;
  }

  /** Validate null/blank rules and enforce `maxLength`. */
  override validate(value: string | null): ValidationResult {
    const baseResult = super.validate(value);
    const errors = [...baseResult.errors];

    if (value !== null && value.length > this.maxLength) {
      errors.push(
        `${this.name} exceeds maximum length of ${this.maxLength} characters`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /** Store the string value as-is. */
  toDB(value: string | null): string | null {
    return value;
  }

  /** Normalize database values to strings. */
  fromDB(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return `VARCHAR(${this.maxLength})`;
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<CharFieldOptions>): CharField {
    return new CharField({
      ...this.options,
      maxLength: this.maxLength,
      ...options,
    } as CharFieldOptions);
  }

  /** Serialize field metadata for schema/introspection output. */
  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      maxLength: this.maxLength,
    };
  }
}

/**
 * TextField - Unlimited length text field
 *
 * Use for long-form text content that should not be constrained by
 * `maxLength`.
 */
export class TextField extends Field<string> {
  /** Create an unconstrained text field. */
  constructor(options?: Partial<FieldOptions<string>>) {
    super(options);
  }

  /** Store the text value as-is. */
  toDB(value: string | null): string | null {
    return value;
  }

  /** Normalize database values to strings. */
  fromDB(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return "TEXT";
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<FieldOptions<string>>): TextField {
    return new TextField({ ...this.options, ...options });
  }
}

// ============================================================================
// Numeric Fields
// ============================================================================

/**
 * IntegerField - Integer number field
 *
 * Accepts whole numbers and rejects fractional input during validation.
 */
export class IntegerField extends Field<number> {
  /** Create an integer field. */
  constructor(options?: Partial<FieldOptions<number>>) {
    super(options);
  }

  /** Validate null/blank rules and ensure the value is an integer. */
  override validate(value: number | null): ValidationResult {
    const baseResult = super.validate(value);
    const errors = [...baseResult.errors];

    if (value !== null && !Number.isInteger(value)) {
      errors.push(`${this.name} must be an integer`);
    }

    return { valid: errors.length === 0, errors };
  }

  /** Store the numeric value as-is. */
  toDB(value: number | null): number | null {
    return value;
  }

  /** Normalize database values to integers. */
  fromDB(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isNaN(num) ? null : Math.floor(num);
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return "INTEGER";
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<FieldOptions<number>>): IntegerField {
    return new IntegerField({ ...this.options, ...options });
  }
}

/**
 * FloatField - Floating-point number field
 *
 * Accepts any finite numeric value and preserves decimal fractions.
 */
export class FloatField extends Field<number> {
  /** Create a floating-point field. */
  constructor(options?: Partial<FieldOptions<number>>) {
    super(options);
  }

  /** Store the numeric value as-is. */
  toDB(value: number | null): number | null {
    return value;
  }

  /** Normalize database values to numbers. */
  fromDB(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return "REAL";
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<FieldOptions<number>>): FloatField {
    return new FloatField({ ...this.options, ...options });
  }
}

/**
 * DecimalField options
 *
 * Stores decimal values as strings so precision is preserved across backends.
 */
export interface DecimalFieldOptions extends FieldOptions<string> {
  /** Total number of digits */
  maxDigits: number;
  /** Number of decimal places */
  decimalPlaces: number;
}

/**
 * DecimalField - Fixed-precision decimal field (stored as string for precision)
 */
export class DecimalField extends Field<string> {
  /** Total number of digits allowed. */
  readonly maxDigits: number;
  /** Maximum number of digits after the decimal separator. */
  readonly decimalPlaces: number;

  /**
   * Create a fixed-precision decimal field.
   *
   * @param options Precision limits and base field options.
   */
  constructor(options: DecimalFieldOptions) {
    super(options);
    this.maxDigits = options.maxDigits;
    this.decimalPlaces = options.decimalPlaces;
  }

  /** Validate decimal syntax and configured precision limits. */
  override validate(value: string | null): ValidationResult {
    const baseResult = super.validate(value);
    const errors = [...baseResult.errors];

    if (value !== null) {
      const num = parseFloat(value);
      if (Number.isNaN(num)) {
        errors.push(`${this.name} must be a valid decimal number`);
      } else {
        const parts = value.split(".");
        const integerPart = parts[0].replace("-", "");
        const decimalPart = parts[1] || "";

        if (integerPart.length + decimalPart.length > this.maxDigits) {
          errors.push(
            `${this.name} exceeds maximum of ${this.maxDigits} digits`,
          );
        }
        if (decimalPart.length > this.decimalPlaces) {
          errors.push(
            `${this.name} exceeds maximum of ${this.decimalPlaces} decimal places`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /** Store the decimal string as-is. */
  toDB(value: string | null): string | null {
    return value;
  }

  /** Normalize database values to strings. */
  fromDB(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return `DECIMAL(${this.maxDigits}, ${this.decimalPlaces})`;
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<DecimalFieldOptions>): DecimalField {
    return new DecimalField({
      ...this.options,
      maxDigits: this.maxDigits,
      decimalPlaces: this.decimalPlaces,
      ...options,
    } as DecimalFieldOptions);
  }

  /** Serialize field metadata for schema/introspection output. */
  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      maxDigits: this.maxDigits,
      decimalPlaces: this.decimalPlaces,
    };
  }
}

// ============================================================================
// Boolean Field
// ============================================================================

/**
 * BooleanField - Boolean true/false field
 */
export class BooleanField extends Field<boolean> {
  /** Create a boolean field. */
  constructor(options?: Partial<FieldOptions<boolean>>) {
    super(options);
  }

  /** Store the boolean value as-is. */
  toDB(value: boolean | null): boolean | null {
    return value;
  }

  /** Normalize common boolean-like database values. */
  fromDB(value: unknown): boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      return value.toLowerCase() === "true" || value === "1";
    }
    return Boolean(value);
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return "BOOLEAN";
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<FieldOptions<boolean>>): BooleanField {
    return new BooleanField({ ...this.options, ...options });
  }
}

// ============================================================================
// Date/Time Fields
// ============================================================================

/**
 * DateField options
 *
 * Controls auto-managed date behavior for `DateField` and `DateTimeField`.
 */
export interface DateFieldOptions extends FieldOptions<Date> {
  /** Automatically set to current date on every save */
  autoNow?: boolean;
  /** Automatically set to current date on creation only */
  autoNowAdd?: boolean;
}

/**
 * DateField - Date field (without time)
 */
export class DateField extends Field<Date> {
  /** Whether the field updates itself on every save. */
  readonly autoNow: boolean;
  /** Whether the field populates itself only on first save. */
  readonly autoNowAdd: boolean;

  /** Create a date-only field. */
  constructor(options?: Partial<DateFieldOptions>) {
    super(options);
    this.autoNow = options?.autoNow ?? false;
    this.autoNowAdd = options?.autoNowAdd ?? false;
  }

  /** Serialize dates as `YYYY-MM-DD`. */
  toDB(value: Date | null): string | null {
    if (value === null) return null;
    // Store as ISO date string (YYYY-MM-DD)
    return value.toISOString().split("T")[0];
  }

  /** Parse database values into `Date` instances. */
  fromDB(value: unknown): Date | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return "DATE";
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<DateFieldOptions>): DateField {
    return new DateField({
      ...this.options,
      autoNow: this.autoNow,
      autoNowAdd: this.autoNowAdd,
      ...options,
    });
  }

  /** Serialize field metadata for schema/introspection output. */
  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      autoNow: this.autoNow,
      autoNowAdd: this.autoNowAdd,
    };
  }
}

/**
 * DateTimeField - Date and time field
 */
export class DateTimeField extends Field<Date> {
  /** Whether the field updates itself on every save. */
  readonly autoNow: boolean;
  /** Whether the field populates itself only on first save. */
  readonly autoNowAdd: boolean;

  /** Create a date-time field. */
  constructor(options?: Partial<DateFieldOptions>) {
    super(options);
    this.autoNow = options?.autoNow ?? false;
    this.autoNowAdd = options?.autoNowAdd ?? false;
  }

  /** Serialize dates as ISO 8601 strings. */
  toDB(value: Date | null): string | null {
    if (value === null) return null;
    // Store as ISO datetime string
    return value.toISOString();
  }

  /** Parse database values into `Date` instances. */
  fromDB(value: unknown): Date | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return "DATETIME";
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<DateFieldOptions>): DateTimeField {
    return new DateTimeField({
      ...this.options,
      autoNow: this.autoNow,
      autoNowAdd: this.autoNowAdd,
      ...options,
    });
  }

  /** Serialize field metadata for schema/introspection output. */
  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      autoNow: this.autoNow,
      autoNowAdd: this.autoNowAdd,
    };
  }
}

// ============================================================================
// Auto/ID Fields
// ============================================================================

/**
 * AutoField - Auto-incrementing integer primary key
 */
export class AutoField extends Field<number> {
  /** Create an auto-incrementing primary key field. */
  constructor(options?: Partial<FieldOptions<number>>) {
    super({
      ...options,
      primaryKey: true,
      editable: false,
    });
  }

  /** Store the numeric value as-is. */
  toDB(value: number | null): number | null {
    return value;
  }

  /** Normalize database values to numbers. */
  fromDB(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return "INTEGER PRIMARY KEY AUTOINCREMENT";
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<FieldOptions<number>>): AutoField {
    return new AutoField({ ...this.options, ...options });
  }
}

/**
 * UUIDField - UUID string field
 */
export class UUIDField extends Field<string> {
  /** Create a UUID field. */
  constructor(options?: Partial<FieldOptions<string>>) {
    super(options);
  }

  /** Validate UUID syntax in addition to base string rules. */
  override validate(value: string | null): ValidationResult {
    const baseResult = super.validate(value);
    const errors = [...baseResult.errors];

    if (value !== null) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        errors.push(`${this.name} must be a valid UUID`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /** Store the UUID string as-is. */
  toDB(value: string | null): string | null {
    return value;
  }

  /** Normalize database values to strings. */
  fromDB(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return "UUID";
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<FieldOptions<string>>): UUIDField {
    return new UUIDField({ ...this.options, ...options });
  }

  /**
   * Generate a new UUID v4
   */
  static generateUUID(): string {
    return crypto.randomUUID();
  }
}

// ============================================================================
// JSON Field
// ============================================================================

/**
 * JSONField - JSON object field
 */
export class JSONField<T = unknown> extends Field<T> {
  /** Create a JSON field. */
  constructor(options?: Partial<FieldOptions<T>>) {
    super(options);
  }

  /** Serialize the value to JSON when needed by the backend. */
  toDB(value: T | null): string | null {
    if (value === null) return null;
    return JSON.stringify(value);
  }

  /** Parse JSON strings or pass through native object values. */
  fromDB(value: unknown): T | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }
    // DenoKV stores objects directly
    return value as T;
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return "JSON";
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<FieldOptions<T>>): JSONField<T> {
    return new JSONField<T>({ ...this.options, ...options });
  }
}

// ============================================================================
// Binary Field
// ============================================================================

/**
 * BinaryField - Binary data field
 */
export class BinaryField extends Field<Uint8Array> {
  /** Create a binary/blob field. */
  constructor(options?: Partial<FieldOptions<Uint8Array>>) {
    super(options);
  }

  /** Store binary data as-is. */
  toDB(value: Uint8Array | null): Uint8Array | null {
    return value;
  }

  /** Normalize database values to `Uint8Array`. */
  fromDB(value: unknown): Uint8Array | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return null;
  }

  /** Return the SQL-ish column type for this field. */
  getDBType(): string {
    return "BLOB";
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<FieldOptions<Uint8Array>>): BinaryField {
    return new BinaryField({ ...this.options, ...options });
  }
}

// ============================================================================
// File Field
// ============================================================================

/**
 * FileField options
 */
export interface FileFieldOptions extends FieldOptions<string> {
  /**
   * Directory path where files will be uploaded
   * Can be a string or a function that returns a string
   *
   * @example
   * ```ts
   * uploadTo: "documents/"
   * uploadTo: (instance, filename) => `users/${instance.userId}/${filename}`
   * ```
   */
  uploadTo?: string | ((instance: unknown, filename: string) => string);

  /**
   * Maximum file size in bytes (optional)
   */
  maxSize?: number;

  /**
   * Allowed file extensions (optional)
   * e.g., [".pdf", ".doc", ".docx"]
   */
  allowedExtensions?: string[];

  /**
   * Allowed MIME types (optional)
   * e.g., ["application/pdf", "image/jpeg"]
   */
  allowedMimeTypes?: string[];
}

/**
 * FileField - File upload field
 *
 * Stores the file path/name in the database. The actual file is stored
 * in the configured Storage backend.
 *
 * @example
 * ```ts
 * import { FileField } from "@alexi/db";
 *
 * class DocumentModel extends Model {
 *   id = new AutoField({ primaryKey: true });
 *   name = new CharField({ maxLength: 255 });
 *   file = new FileField({ uploadTo: "documents/" });
 * }
 *
 * // Usage with storage
 * const storage = getStorage();
 * const savedName = await storage.save(
 *   document.file.getUploadPath(file.name),
 *   file
 * );
 * document.file.set(savedName);
 * await document.save();
 *
 * // Get URL
 * const url = await storage.url(document.file.get());
 * ```
 */
export class FileField extends Field<string> {
  /** Base upload directory or callback used to build the final file path. */
  readonly uploadTo: string | ((instance: unknown, filename: string) => string);
  /** Maximum accepted file size in bytes. */
  readonly maxSize?: number;
  /** Allowed file extensions, including the leading dot. */
  readonly allowedExtensions?: string[];
  /** Allowed MIME types such as `image/png` or `application/pdf`. */
  readonly allowedMimeTypes?: string[];

  /**
   * Create a file field.
   *
   * File fields default to `blank: true` because the stored value is typically
   * populated after upload.
   */
  constructor(options?: Partial<FileFieldOptions>) {
    super({ blank: true, ...options });
    this.uploadTo = options?.uploadTo ?? "";
    this.maxSize = options?.maxSize;
    this.allowedExtensions = options?.allowedExtensions;
    this.allowedMimeTypes = options?.allowedMimeTypes;
  }

  /**
   * Get the upload path for a file
   *
   * @param filename - Original filename
   * @param instance - Model instance (optional, for dynamic paths)
   * @returns Full path where file should be uploaded
   */
  getUploadPath(filename: string, instance?: unknown): string {
    let basePath: string;

    if (typeof this.uploadTo === "function") {
      basePath = this.uploadTo(instance, filename);
    } else {
      basePath = this.uploadTo;
    }

    // Ensure path ends with slash if not empty
    if (basePath && !basePath.endsWith("/")) {
      basePath += "/";
    }

    return `${basePath}${filename}`;
  }

  /**
   * Validate a file before upload
   *
   * @param file - File to validate
   * @returns Validation result
   */
  validateFile(file: File): ValidationResult {
    const errors: string[] = [];

    // Check file size
    if (this.maxSize !== undefined && file.size > this.maxSize) {
      const maxSizeMB = (this.maxSize / 1024 / 1024).toFixed(2);
      errors.push(
        `${this.name}: File size exceeds maximum of ${maxSizeMB} MB`,
      );
    }

    // Check extension
    if (this.allowedExtensions !== undefined) {
      const ext = this.getExtension(file.name);
      if (!this.allowedExtensions.includes(ext)) {
        errors.push(
          `${this.name}: File extension '${ext}' is not allowed. Allowed: ${
            this.allowedExtensions.join(", ")
          }`,
        );
      }
    }

    // Check MIME type
    if (this.allowedMimeTypes !== undefined && file.type) {
      if (!this.allowedMimeTypes.includes(file.type)) {
        errors.push(
          `${this.name}: File type '${file.type}' is not allowed. Allowed: ${
            this.allowedMimeTypes.join(", ")
          }`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get file extension from filename
   */
  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return "";
    return filename.slice(lastDot).toLowerCase();
  }

  /**
   * Validate the field value before saving.
   *
   * - If the current value is a `File` instance, delegates to
   *   {@link validateFile} and throws {@link FieldValidationError} on failure.
   * - If the value is a non-empty string (an already-persisted path), validation
   *   is skipped — the file was validated when it was first uploaded.
   * - If the value is `null` / `undefined` / empty and the field is not
   *   `blank`, throws {@link FieldValidationError}.
   *
   * This override is called automatically by {@link Model.save} so that
   * developers do not need to call {@link validateFile} manually.
   *
   * @param value - The current field value (may be a `File`, string path, or `null`).
   * @returns `ValidationResult` — always `valid: true` on success.
   * @throws {FieldValidationError} When the file fails validation constraints.
   */
  override validate(value: string | null): ValidationResult {
    // Check if the stored value is actually a File object (set via .set(file as never))
    const rawValue: unknown = value;

    if (rawValue instanceof File) {
      const result = this.validateFile(rawValue);
      if (!result.valid) {
        throw new FieldValidationError(this.name, result.errors.join("; "));
      }
      return { valid: true, errors: [] };
    }

    // Already-persisted string path — skip file validation
    if (typeof rawValue === "string" && rawValue.length > 0) {
      return { valid: true, errors: [] };
    }

    // null / undefined / empty — check blank constraint
    if (
      !this.options.blank &&
      (rawValue === null || rawValue === undefined || rawValue === "")
    ) {
      throw new FieldValidationError(
        this.name,
        `${this.name} may not be blank.`,
      );
    }

    return { valid: true, errors: [] };
  }

  /** Store the file path/name as-is. */
  toDB(value: string | null): string | null {
    return value;
  }

  /** Normalize database values to file-path strings. */
  fromDB(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  /** Return the SQL-ish column type for persisted file paths. */
  getDBType(): string {
    return "VARCHAR(500)";
  }

  /** Clone the field definition with optional overrides. */
  clone(options?: Partial<FileFieldOptions>): FileField {
    return new FileField({
      ...this.options,
      uploadTo: this.uploadTo,
      maxSize: this.maxSize,
      allowedExtensions: this.allowedExtensions,
      allowedMimeTypes: this.allowedMimeTypes,
      ...options,
    });
  }

  /** Serialize field metadata for schema/introspection output. */
  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      uploadTo: typeof this.uploadTo === "string"
        ? this.uploadTo
        : "[function]",
      maxSize: this.maxSize,
      allowedExtensions: this.allowedExtensions,
      allowedMimeTypes: this.allowedMimeTypes,
    };
  }
}

/**
 * ImageField - Image file field with image-specific validations
 *
 * Extends FileField with common image file types pre-configured.
 *
 * @example
 * ```ts
 * class ProfileModel extends Model {
 *   id = new AutoField({ primaryKey: true });
 *   avatar = new ImageField({
 *     uploadTo: "avatars/",
 *     maxSize: 5 * 1024 * 1024, // 5 MB
 *   });
 * }
 * ```
 */
export class ImageField extends FileField {
  /**
   * Create an image field with common image extensions and MIME types.
   */
  constructor(options?: Partial<FileFieldOptions>) {
    // Default to common image extensions and MIME types
    const defaultExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".svg",
    ];
    const defaultMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];

    super({
      allowedExtensions: defaultExtensions,
      allowedMimeTypes: defaultMimeTypes,
      ...options,
    });
  }

  /** Clone the field definition with optional overrides. */
  override clone(options?: Partial<FileFieldOptions>): ImageField {
    return new ImageField({
      ...this.options,
      uploadTo: this.uploadTo,
      maxSize: this.maxSize,
      allowedExtensions: this.allowedExtensions,
      allowedMimeTypes: this.allowedMimeTypes,
      ...options,
    });
  }
}
