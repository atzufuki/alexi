/**
 * Base Serializer class for Alexi REST Framework
 *
 * Provides validation, serialization, and deserialization of data.
 *
 * @module @alexi/restframework/serializers/serializer
 */

import {
  type BaseFieldOptions,
  type FieldValidationResult,
  type SerializerField,
  SerializerMethodField,
} from "./fields.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Validation errors by field name
 */
export type ValidationErrors = Record<string, string[]>;

/**
 * Serializer options
 */
export interface SerializerOptions {
  /** Input data to validate/deserialize */
  data?: Record<string, unknown>;

  /** Instance for serialization (e.g., model instance) */
  instance?: unknown;

  /** Whether this is a partial update (allows missing required fields) */
  partial?: boolean;

  /** Additional context (e.g., request, user) */
  context?: Record<string, unknown>;

  /** Whether to process many instances */
  many?: boolean;
}

/**
 * Field definition for declarative serializers
 */
export interface FieldDefinition {
  field: SerializerField;
  source?: string;
}

// ============================================================================
// Serializer Class
// ============================================================================

/**
 * Base Serializer class
 *
 * Provides a framework for validating input data and serializing output data.
 * Supports both declarative field definitions (as class properties) and
 * the getFieldDefinitions() method.
 *
 * @example Declarative serializer (recommended)
 * ```ts
 * class AssetSerializer extends Serializer {
 *   id = new IntegerField({ readOnly: true });
 *   name = new CharField({ maxLength: 200 });
 *   description = new TextField({ required: false });
 *   ownerName = new SerializerMethodField();
 *
 *   getOwnerName(asset: Asset): string {
 *     return asset.owner?.name ?? "Unknown";
 *   }
 * }
 * ```
 *
 * @example Manual serializer
 * ```ts
 * class AssetSerializer extends Serializer {
 *   protected getFieldDefinitions(): Record<string, SerializerField> {
 *     return {
 *       id: new IntegerField({ readOnly: true }),
 *       name: new CharField({ maxLength: 200 }),
 *       description: new TextField({ required: false }),
 *     };
 *   }
 * }
 * ```
 */
export class Serializer {
  protected readonly initialData?: Record<string, unknown>;
  protected readonly instance?: unknown;
  protected readonly partial: boolean;
  protected readonly context: Record<string, unknown>;
  protected readonly many: boolean;

  private _validatedData?: Record<string, unknown>;
  private _errors?: ValidationErrors;
  private _isValidated = false;
  private _fields?: Record<string, SerializerField>;

  constructor(options: SerializerOptions = {}) {
    this.initialData = options.data;
    this.instance = options.instance;
    this.partial = options.partial ?? false;
    this.context = options.context ?? {};
    this.many = options.many ?? false;
  }

  // ==========================================================================
  // Field Definition Methods
  // ==========================================================================

  /**
   * Define the fields for this serializer
   *
   * Override this method to define fields programmatically.
   * If not overridden, fields are collected from class properties.
   */
  protected getFieldDefinitions(): Record<string, SerializerField> {
    return {};
  }

  /**
   * Collect fields defined as class properties
   */
  private collectDeclarativeFields(): Record<string, SerializerField> {
    const fields: Record<string, SerializerField> = {};

    // Get all property names from the instance
    const propertyNames = Object.getOwnPropertyNames(this);

    for (const name of propertyNames) {
      const value = (this as Record<string, unknown>)[name];

      // Check if it's a SerializerField instance
      if (
        value && typeof value === "object" && "validate" in value &&
        "toRepresentation" in value
      ) {
        fields[name] = value as SerializerField;
      }
    }

    return fields;
  }

  // ==========================================================================
  // Field Access
  // ==========================================================================

  /**
   * Get the fields for this serializer
   *
   * Combines fields from getFieldDefinitions() and declarative class properties.
   */
  get fields(): Record<string, SerializerField> {
    if (!this._fields) {
      // First get fields from getFieldDefinitions (for backwards compatibility)
      const definedFields = this.getFieldDefinitions();

      // Then collect declarative fields from class properties
      const declarativeFields = this.collectDeclarativeFields();

      // Merge them (declarative fields take precedence)
      this._fields = { ...definedFields, ...declarativeFields };
    }
    return this._fields;
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Check if the input data is valid
   *
   * @param raiseException - If true, throws an error on validation failure
   * @returns true if valid, false otherwise
   */
  isValid(raiseException = false): boolean {
    if (!this._isValidated) {
      this.runValidation();
    }

    if (
      raiseException && this._errors && Object.keys(this._errors).length > 0
    ) {
      throw new SerializerValidationError(this._errors);
    }

    return !this._errors || Object.keys(this._errors).length === 0;
  }

  /**
   * Run validation on the input data
   */
  private runValidation(): void {
    this._isValidated = true;
    this._errors = {};
    this._validatedData = {};

    if (!this.initialData) {
      if (!this.partial) {
        // Check for required fields
        for (const [fieldName, field] of Object.entries(this.fields)) {
          if (field.required && !field.readOnly && !field.hasDefault()) {
            this._errors[fieldName] = ["This field is required."];
          }
        }
      }
      return;
    }

    // Validate each field
    for (const [fieldName, field] of Object.entries(this.fields)) {
      // Skip read-only fields during validation
      if (field.readOnly) {
        continue;
      }

      const value = this.initialData[fieldName];

      // Handle partial updates - skip missing fields
      if (this.partial && value === undefined) {
        continue;
      }

      // Validate the field
      const result = field.validate(value);

      if (!result.valid) {
        this._errors[fieldName] = result.errors;
      } else {
        // Run field-specific validation method if exists
        const validateMethod = this.getFieldValidator(fieldName);
        if (validateMethod) {
          try {
            const validatedValue = validateMethod.call(this, result.value);
            this._validatedData![fieldName] = validatedValue;
          } catch (error) {
            if (error instanceof FieldValidationError) {
              this._errors[fieldName] = [error.message];
            } else {
              throw error;
            }
          }
        } else {
          this._validatedData![fieldName] = result.value;
        }
      }
    }

    // Run object-level validation
    if (Object.keys(this._errors).length === 0) {
      try {
        this._validatedData = this.validate(this._validatedData!);
      } catch (error) {
        if (error instanceof ValidationError) {
          if (error.fieldErrors) {
            this._errors = { ...this._errors, ...error.fieldErrors };
          } else {
            this._errors["nonFieldErrors"] = [error.message];
          }
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Get a field-specific validation method if it exists
   *
   * Looks for a method named `validate_<fieldName>`
   */
  private getFieldValidator(
    fieldName: string,
  ): ((value: unknown) => unknown) | null {
    const methodName = `validate_${fieldName}`;
    const method = (this as unknown as Record<string, unknown>)[methodName];
    if (typeof method === "function") {
      return method as (value: unknown) => unknown;
    }
    return null;
  }

  /**
   * Object-level validation
   *
   * Override this method to add cross-field validation.
   *
   * @param data - The validated data
   * @returns The validated data (possibly modified)
   * @throws ValidationError if validation fails
   */
  protected validate(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    return data;
  }

  /**
   * Get validation errors
   */
  get errors(): ValidationErrors {
    if (!this._isValidated) {
      this.runValidation();
    }
    return this._errors ?? {};
  }

  /**
   * Get validated data
   *
   * @throws Error if data is not valid
   */
  get validatedData(): Record<string, unknown> {
    if (!this._isValidated) {
      this.isValid(true);
    }
    if (!this._validatedData || Object.keys(this._errors ?? {}).length > 0) {
      throw new Error("Cannot access validatedData when validation failed.");
    }
    return this._validatedData;
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Get serialized data for output (sync version for simple cases)
   *
   * Note: For SerializerMethodField support, use toRepresentation() instead.
   * This getter is kept for backwards compatibility but may not work
   * correctly with async SerializerMethodField methods.
   */
  get data(): Record<string, unknown> {
    if (this.many && Array.isArray(this.instance)) {
      return this.instance.map((item) =>
        this.serializeInstanceSync(item)
      ) as unknown as Record<
        string,
        unknown
      >;
    }

    if (this.instance) {
      return this.serializeInstanceSync(this.instance);
    }

    // If no instance, return validated data
    if (this._validatedData) {
      return this._validatedData;
    }

    return {};
  }

  /**
   * Serialize a single instance (sync version - for backwards compatibility)
   *
   * Note: Does not support async SerializerMethodField methods.
   */
  protected serializeInstanceSync(instance: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const obj = instance as Record<string, unknown>;

    for (const [fieldName, field] of Object.entries(this.fields)) {
      // Skip write-only fields during serialization
      if (field.writeOnly) {
        continue;
      }

      let value: unknown;

      // Handle SerializerMethodField (sync only - will not work with async methods)
      if (field instanceof SerializerMethodField) {
        const defaultMethodName = `get${fieldName.charAt(0).toUpperCase()}${
          fieldName.slice(1)
        }`;
        const methodName = field.methodName ?? defaultMethodName;
        const method = (this as unknown as Record<string, unknown>)[methodName];
        if (typeof method === "function") {
          value = method.call(this, instance);
        }
      } else {
        // Get source attribute name
        const sourceName = field.source ?? fieldName;
        value = this.getAttributeValue(obj, sourceName);

        // Transform for output
        if (value !== undefined && value !== null) {
          value = field.toRepresentation(value);
        }
      }

      result[fieldName] = value ?? null;
    }

    return result;
  }

  /**
   * Serialize an instance to a representation (output format)
   *
   * This method can be called directly with an instance to serialize it.
   *
   * @param instance - The instance to serialize
   * @returns Serialized data as a plain object
   */
  async toRepresentation(instance: unknown): Promise<Record<string, unknown>> {
    return this.serializeInstanceAsync(instance);
  }

  /**
   * Serialize a single instance (async version)
   */
  protected async serializeInstanceAsync(
    instance: unknown,
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    const obj = instance as Record<string, unknown>;

    for (const [fieldName, field] of Object.entries(this.fields)) {
      // Skip write-only fields during serialization
      if (field.writeOnly) {
        continue;
      }

      let value: unknown;

      // Handle SerializerMethodField
      if (field instanceof SerializerMethodField) {
        value = await this.getMethodFieldValueAsync(fieldName, field, instance);
      } else {
        // Get source attribute name (supports field aliasing via 'source' option)
        const sourceName = field.source ?? fieldName;

        // Get value from instance
        value = this.getAttributeValue(obj, sourceName);

        // Transform for output
        if (value !== undefined && value !== null) {
          value = field.toRepresentation(value);
        }
      }

      result[fieldName] = value ?? null;
    }

    return result;
  }

  /**
   * Get value for a SerializerMethodField (async version)
   *
   * Supports both sync and async methods on the serializer.
   */
  private async getMethodFieldValueAsync(
    fieldName: string,
    field: SerializerMethodField,
    instance: unknown,
  ): Promise<unknown> {
    // Determine method name: use field.methodName or default to get{FieldName}
    const defaultMethodName = `get${fieldName.charAt(0).toUpperCase()}${
      fieldName.slice(1)
    }`;
    const methodName = field.methodName ?? defaultMethodName;

    const method = (this as unknown as Record<string, unknown>)[methodName];

    if (typeof method !== "function") {
      throw new Error(
        `SerializerMethodField "${fieldName}" requires method "${methodName}" on the serializer.`,
      );
    }

    // Call the method and await if it returns a promise
    const result = method.call(this, instance);
    return result instanceof Promise ? await result : result;
  }

  /**
   * Get an attribute value from an object
   *
   * Handles nested attributes (dot notation), alexi/db Fields, and special cases.
   */
  protected getAttributeValue(
    obj: Record<string, unknown>,
    attrName: string,
  ): unknown {
    // Handle nested attributes (e.g., "user.email")
    if (attrName.includes(".")) {
      const parts = attrName.split(".");
      let current: unknown = obj;

      for (const part of parts) {
        if (current === null || current === undefined) {
          return undefined;
        }

        const currentObj = current as Record<string, unknown>;
        let value = currentObj[part];

        // Handle alexi/db Field
        if (value && typeof value === "object" && "get" in value) {
          value = (value as { get: () => unknown }).get();
        }

        current = value;
      }

      return current;
    }

    // Simple attribute access
    const value = obj[attrName];

    // Check if it's a Field instance (from alexi/db Model)
    if (value && typeof value === "object" && "get" in value) {
      // It's an alexi/db Field, get its value
      return (value as { get: () => unknown }).get();
    }

    return value;
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create and save a new instance
   *
   * Override this method to implement creation logic.
   */
  async create(
    _validatedData: Record<string, unknown>,
  ): Promise<unknown> {
    throw new Error("create() must be implemented in subclass.");
  }

  /**
   * Update an existing instance
   *
   * Override this method to implement update logic.
   */
  async update(
    _instance: unknown,
    _validatedData: Record<string, unknown>,
  ): Promise<unknown> {
    throw new Error("update() must be implemented in subclass.");
  }

  /**
   * Save the serializer (create or update)
   */
  async save(): Promise<unknown> {
    if (!this.isValid()) {
      throw new SerializerValidationError(this.errors);
    }

    if (this.instance) {
      return this.update(this.instance, this.validatedData);
    }

    return this.create(this.validatedData);
  }
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error thrown when field validation fails
 */
export class FieldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FieldValidationError";
  }
}

/**
 * Error thrown when object-level validation fails
 */
export class ValidationError extends Error {
  readonly fieldErrors?: ValidationErrors;

  constructor(message: string, fieldErrors?: ValidationErrors) {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }

  /**
   * Create a ValidationError from field errors
   */
  static fromFieldErrors(errors: ValidationErrors): ValidationError {
    return new ValidationError("Validation error", errors);
  }
}

/**
 * Error thrown when serializer validation fails
 */
export class SerializerValidationError extends Error {
  readonly errors: ValidationErrors;

  constructor(errors: ValidationErrors) {
    super(JSON.stringify(errors));
    this.name = "SerializerValidationError";
    this.errors = errors;
  }
}
