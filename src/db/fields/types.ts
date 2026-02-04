/**
 * Concrete field type implementations for Alexi ORM
 * @module
 */

import { Field, FieldOptions, ValidationResult } from "./field.ts";

// ============================================================================
// String Fields
// ============================================================================

/**
 * CharField options
 */
export interface CharFieldOptions extends FieldOptions<string> {
  /** Maximum length of the string */
  maxLength: number;
}

/**
 * CharField - Fixed-length string field
 */
export class CharField extends Field<string> {
  readonly maxLength: number;

  constructor(options: CharFieldOptions) {
    super(options);
    this.maxLength = options.maxLength;
  }

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

  toDB(value: string | null): string | null {
    return value;
  }

  fromDB(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  getDBType(): string {
    return `VARCHAR(${this.maxLength})`;
  }

  clone(options?: Partial<CharFieldOptions>): CharField {
    return new CharField({
      ...this.options,
      maxLength: this.maxLength,
      ...options,
    } as CharFieldOptions);
  }

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      maxLength: this.maxLength,
    };
  }
}

/**
 * TextField - Unlimited length text field
 */
export class TextField extends Field<string> {
  constructor(options?: Partial<FieldOptions<string>>) {
    super(options);
  }

  toDB(value: string | null): string | null {
    return value;
  }

  fromDB(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  getDBType(): string {
    return "TEXT";
  }

  clone(options?: Partial<FieldOptions<string>>): TextField {
    return new TextField({ ...this.options, ...options });
  }
}

// ============================================================================
// Numeric Fields
// ============================================================================

/**
 * IntegerField - Integer number field
 */
export class IntegerField extends Field<number> {
  constructor(options?: Partial<FieldOptions<number>>) {
    super(options);
  }

  override validate(value: number | null): ValidationResult {
    const baseResult = super.validate(value);
    const errors = [...baseResult.errors];

    if (value !== null && !Number.isInteger(value)) {
      errors.push(`${this.name} must be an integer`);
    }

    return { valid: errors.length === 0, errors };
  }

  toDB(value: number | null): number | null {
    return value;
  }

  fromDB(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isNaN(num) ? null : Math.floor(num);
  }

  getDBType(): string {
    return "INTEGER";
  }

  clone(options?: Partial<FieldOptions<number>>): IntegerField {
    return new IntegerField({ ...this.options, ...options });
  }
}

/**
 * FloatField - Floating-point number field
 */
export class FloatField extends Field<number> {
  constructor(options?: Partial<FieldOptions<number>>) {
    super(options);
  }

  toDB(value: number | null): number | null {
    return value;
  }

  fromDB(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }

  getDBType(): string {
    return "REAL";
  }

  clone(options?: Partial<FieldOptions<number>>): FloatField {
    return new FloatField({ ...this.options, ...options });
  }
}

/**
 * DecimalField options
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
  readonly maxDigits: number;
  readonly decimalPlaces: number;

  constructor(options: DecimalFieldOptions) {
    super(options);
    this.maxDigits = options.maxDigits;
    this.decimalPlaces = options.decimalPlaces;
  }

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

  toDB(value: string | null): string | null {
    return value;
  }

  fromDB(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  getDBType(): string {
    return `DECIMAL(${this.maxDigits}, ${this.decimalPlaces})`;
  }

  clone(options?: Partial<DecimalFieldOptions>): DecimalField {
    return new DecimalField({
      ...this.options,
      maxDigits: this.maxDigits,
      decimalPlaces: this.decimalPlaces,
      ...options,
    } as DecimalFieldOptions);
  }

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
  constructor(options?: Partial<FieldOptions<boolean>>) {
    super(options);
  }

  toDB(value: boolean | null): boolean | null {
    return value;
  }

  fromDB(value: unknown): boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      return value.toLowerCase() === "true" || value === "1";
    }
    return Boolean(value);
  }

  getDBType(): string {
    return "BOOLEAN";
  }

  clone(options?: Partial<FieldOptions<boolean>>): BooleanField {
    return new BooleanField({ ...this.options, ...options });
  }
}

// ============================================================================
// Date/Time Fields
// ============================================================================

/**
 * DateField options
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
  readonly autoNow: boolean;
  readonly autoNowAdd: boolean;

  constructor(options?: Partial<DateFieldOptions>) {
    super(options);
    this.autoNow = options?.autoNow ?? false;
    this.autoNowAdd = options?.autoNowAdd ?? false;
  }

  toDB(value: Date | null): string | null {
    if (value === null) return null;
    // Store as ISO date string (YYYY-MM-DD)
    return value.toISOString().split("T")[0];
  }

  fromDB(value: unknown): Date | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  getDBType(): string {
    return "DATE";
  }

  clone(options?: Partial<DateFieldOptions>): DateField {
    return new DateField({
      ...this.options,
      autoNow: this.autoNow,
      autoNowAdd: this.autoNowAdd,
      ...options,
    });
  }

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
  readonly autoNow: boolean;
  readonly autoNowAdd: boolean;

  constructor(options?: Partial<DateFieldOptions>) {
    super(options);
    this.autoNow = options?.autoNow ?? false;
    this.autoNowAdd = options?.autoNowAdd ?? false;
  }

  toDB(value: Date | null): string | null {
    if (value === null) return null;
    // Store as ISO datetime string
    return value.toISOString();
  }

  fromDB(value: unknown): Date | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  getDBType(): string {
    return "DATETIME";
  }

  clone(options?: Partial<DateFieldOptions>): DateTimeField {
    return new DateTimeField({
      ...this.options,
      autoNow: this.autoNow,
      autoNowAdd: this.autoNowAdd,
      ...options,
    });
  }

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
  constructor(options?: Partial<FieldOptions<number>>) {
    super({
      ...options,
      primaryKey: true,
      editable: false,
    });
  }

  toDB(value: number | null): number | null {
    return value;
  }

  fromDB(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }

  getDBType(): string {
    return "INTEGER PRIMARY KEY AUTOINCREMENT";
  }

  clone(options?: Partial<FieldOptions<number>>): AutoField {
    return new AutoField({ ...this.options, ...options });
  }
}

/**
 * UUIDField - UUID string field
 */
export class UUIDField extends Field<string> {
  constructor(options?: Partial<FieldOptions<string>>) {
    super(options);
  }

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

  toDB(value: string | null): string | null {
    return value;
  }

  fromDB(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  getDBType(): string {
    return "UUID";
  }

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
  constructor(options?: Partial<FieldOptions<T>>) {
    super(options);
  }

  toDB(value: T | null): string | null {
    if (value === null) return null;
    return JSON.stringify(value);
  }

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

  getDBType(): string {
    return "JSON";
  }

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
  constructor(options?: Partial<FieldOptions<Uint8Array>>) {
    super(options);
  }

  toDB(value: Uint8Array | null): Uint8Array | null {
    return value;
  }

  fromDB(value: unknown): Uint8Array | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return null;
  }

  getDBType(): string {
    return "BLOB";
  }

  clone(options?: Partial<FieldOptions<Uint8Array>>): BinaryField {
    return new BinaryField({ ...this.options, ...options });
  }
}
