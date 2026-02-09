/**
 * Field base class and field options for Alexi ORM
 * @module
 */

/**
 * Validation result from field validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validator function type
 */
export type Validator<T> = (value: T | null) => ValidationResult;

/**
 * Field options interface
 */
export interface FieldOptions<T> {
  /** Allow NULL values in database */
  null?: boolean;
  /** Allow blank/empty values (validation only) */
  blank?: boolean;
  /** Default value or factory function */
  default?: T | (() => T);
  /** Is this field the primary key */
  primaryKey?: boolean;
  /** Must be unique across all records */
  unique?: boolean;
  /** Custom column name in database */
  dbColumn?: string;
  /** Create an index for this field */
  dbIndex?: boolean;
  /** Allowed choices as [value, displayName] pairs */
  choices?: [T, string][];
  /** Custom validators */
  validators?: Validator<T>[];
  /** Human-readable field name */
  verboseName?: string;
  /** Help text for the field */
  helpText?: string;
  /** Is this field editable */
  editable?: boolean;
}

/**
 * Default field options
 */
const DEFAULT_FIELD_OPTIONS: FieldOptions<unknown> = {
  null: false,
  blank: false,
  primaryKey: false,
  unique: false,
  dbIndex: false,
  editable: true,
};

/**
 * Abstract base class for all field types
 */
export abstract class Field<T> {
  protected _value: T | null = null;
  protected _name: string = "";
  readonly options: FieldOptions<T>;

  constructor(options?: Partial<FieldOptions<T>>) {
    this.options = { ...DEFAULT_FIELD_OPTIONS, ...options } as FieldOptions<T>;
  }

  /**
   * Get the field value
   */
  get(): T | null {
    return this._value;
  }

  /**
   * Set the field value
   */
  set(value: T | null): void {
    this._value = value;
  }

  /**
   * Get the field name (set by Model)
   */
  get name(): string {
    return this._name;
  }

  /**
   * Set the field name (called by Model during initialization)
   */
  setName(name: string): void {
    this._name = name;
  }

  /**
   * Get the database column name
   */
  getColumnName(): string {
    return this.options.dbColumn ?? this._name;
  }

  /**
   * Check if the field has a default value
   */
  hasDefault(): boolean {
    return this.options.default !== undefined;
  }

  /**
   * Get the default value
   */
  getDefault(): T | null {
    if (this.options.default === undefined) {
      return null;
    }
    if (typeof this.options.default === "function") {
      return (this.options.default as () => T)();
    }
    return this.options.default;
  }

  /**
   * Validate the field value
   */
  validate(value: T | null): ValidationResult {
    const errors: string[] = [];

    // Check null constraint
    if (value === null && !this.options.null) {
      errors.push(`${this._name} cannot be null`);
    }

    // Check blank constraint (for string-like values)
    if (
      !this.options.blank &&
      value !== null &&
      typeof value === "string" &&
      value.trim() === ""
    ) {
      errors.push(`${this._name} cannot be blank`);
    }

    // Check choices constraint
    if (value !== null && this.options.choices) {
      const validValues = this.options.choices.map(([v]) => v);
      if (!validValues.includes(value)) {
        errors.push(
          `${this._name} must be one of: ${validValues.join(", ")}`,
        );
      }
    }

    // Run custom validators
    if (this.options.validators) {
      for (const validator of this.options.validators) {
        const result = validator(value);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert value for database storage
   */
  abstract toDB(value: T | null): unknown;

  /**
   * Convert value from database storage
   */
  abstract fromDB(value: unknown): T | null;

  /**
   * Get the database type string for this field
   * This is backend-specific and used during schema creation
   */
  abstract getDBType(): string;

  /**
   * Clone this field with optional new options
   */
  abstract clone(options?: Partial<FieldOptions<T>>): Field<T>;

  /**
   * Check if this field contributes to the model's columns
   * (ManyToMany fields don't create columns)
   */
  contributesToColumns(): boolean {
    return true;
  }

  /**
   * Serialize field definition for migrations
   */
  serialize(): Record<string, unknown> {
    return {
      type: this.constructor.name,
      options: { ...this.options },
    };
  }
}
