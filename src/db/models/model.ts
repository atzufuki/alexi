/**
 * Model base class for Alexi ORM
 * @module
 */

import { Field } from "../fields/field.ts";
import { AutoField, DateField, DateTimeField } from "../fields/types.ts";
import {
  ForeignKey,
  ManyToManyField,
  ManyToManyManager,
} from "../fields/relations.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Index definition for model metadata
 */
export interface IndexDefinition {
  /** Fields to include in the index */
  fields: string[];
  /** Index name (auto-generated if not provided) */
  name?: string;
  /** Whether the index enforces uniqueness */
  unique?: boolean;
}

/**
 * Model metadata options
 */
export interface ModelMeta {
  /** Database table name */
  dbTable?: string;
  /** Default ordering for queries */
  ordering?: string[];
  /** Index definitions */
  indexes?: IndexDefinition[];
  /** Fields that must be unique together */
  uniqueTogether?: string[][];
  /** Whether this is an abstract model (no table created) */
  abstract?: boolean;
  /** Verbose name for the model */
  verboseName?: string;
  /** Verbose plural name for the model */
  verboseNamePlural?: string;
}

/**
 * Type for model data (plain object representation)
 */
export type ModelData<T extends Model> = {
  [K in keyof T as T[K] extends Field<unknown> ? K : never]: T[K] extends
    Field<infer V> ? V | null
    : never;
};

/**
 * Type for partial model data (for create/update operations)
 */
export type PartialModelData<T extends Model> = Partial<ModelData<T>>;

/**
 * Simple create data type - plain object with field values
 */
export type CreateData = Record<string, unknown>;

// ============================================================================
// Model Registry
// ============================================================================

/**
 * Registry for all defined models
 */
export class ModelRegistry {
  private static _instance: ModelRegistry;
  // deno-lint-ignore no-explicit-any
  private _models: Map<string, any> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static get instance(): ModelRegistry {
    if (!ModelRegistry._instance) {
      ModelRegistry._instance = new ModelRegistry();
    }
    return ModelRegistry._instance;
  }

  /**
   * Register a model class
   */
  // deno-lint-ignore no-explicit-any
  register(model: any): void {
    const name = model.name;
    this._models.set(name, model);
    this._resolveRelations(model);
  }

  /**
   * Get a model by name
   */
  // deno-lint-ignore no-explicit-any
  get(name: string): any | undefined {
    return this._models.get(name);
  }

  /**
   * Get all registered models
   */
  // deno-lint-ignore no-explicit-any
  getAll(): Map<string, any> {
    return new Map(this._models);
  }

  /**
   * Resolve string-based model references in relations
   */
  // deno-lint-ignore no-explicit-any
  private _resolveRelations(model: any): void {
    try {
      const instance = new model();
      const fields = instance.getFields();

      for (const [, field] of Object.entries(fields)) {
        if (field instanceof ForeignKey || field instanceof ManyToManyField) {
          // Try to resolve string references
          const relatedModel = field.getRelatedModel();
          if (
            !relatedModel &&
            typeof (field as ForeignKey<unknown>).relatedModel === "string"
          ) {
            const relatedName = (field as ForeignKey<unknown>)
              .relatedModel as string;
            const resolved = this._models.get(relatedName);
            if (resolved) {
              // deno-lint-ignore no-explicit-any
              (field as any).setRelatedModel(resolved);
            }
          }
        }
      }
    } catch {
      // Model might be abstract or have issues, skip resolution
    }
  }
}

// ============================================================================
// Model Class
// ============================================================================

/**
 * Abstract base class for all models
 *
 * @example
 * ```ts
 * class Article extends Model {
 *   title = new CharField({ maxLength: 200 });
 *   content = new TextField();
 *   createdAt = new DateTimeField({ autoNowAdd: true });
 *
 *   static meta = {
 *     dbTable: 'articles',
 *     ordering: ['-createdAt'],
 *   };
 * }
 * ```
 */
export abstract class Model {
  /**
   * Model metadata
   */
  static meta: ModelMeta = {};

  /**
   * Internal storage for field values
   */
  protected _data: Record<string, unknown> = {};

  /**
   * Track which fields have been modified
   */
  protected _dirty: Set<string> = new Set();

  /**
   * Whether this instance has been saved to the database
   */
  protected _persisted = false;

  /**
   * Reference to the database backend (set when loaded from DB)
   */
  // deno-lint-ignore no-explicit-any
  protected _backend?: any;

  /**
   * Flag to track if fields have been initialized
   */
  private _fieldsInitialized = false;

  constructor() {
    // Fields are initialized lazily via _ensureFieldsInitialized()
    // This is needed because class fields are set after super() is called
  }

  /**
   * Ensure fields are initialized (call before any field access)
   */
  protected _ensureFieldsInitialized(): void {
    if (!this._fieldsInitialized) {
      this._initializeFields();
    }
  }

  /**
   * Initialize all fields on the model instance
   */
  private _initializeFields(): void {
    if (this._fieldsInitialized) return;
    this._fieldsInitialized = true;

    const prototype = Object.getPrototypeOf(this);
    const constructor = prototype.constructor;

    // Get all own property names (including non-enumerable)
    const propertyNames = Object.getOwnPropertyNames(this);

    for (const key of propertyNames) {
      // Skip internal properties
      if (key.startsWith("_")) continue;

      const value = (this as Record<string, unknown>)[key];
      if (value instanceof Field) {
        // Set the field name
        value.setName(key);

        // Set default value if available
        if (value.hasDefault()) {
          const defaultValue = value.getDefault();
          this._data[key] = defaultValue;
          value.set(defaultValue as never);
        }

        // Handle ManyToMany fields specially
        if (value instanceof ManyToManyField) {
          // Create a ManyToManyManager for this field
          const manager = new ManyToManyManager(this, value);
          Object.defineProperty(this, `${key}_set`, {
            value: manager,
            writable: false,
            enumerable: false,
          });
        }
      }
    }

    // Register the model if not already registered
    if (constructor !== Model) {
      ModelRegistry.instance.register(constructor);
    }
  }

  /**
   * Get all field instances on this model
   */
  getFields(): Record<string, Field<unknown>> {
    this._ensureFieldsInitialized();
    const fields: Record<string, Field<unknown>> = {};

    for (const key of Object.getOwnPropertyNames(this)) {
      if (key.startsWith("_")) continue;
      const value = (this as Record<string, unknown>)[key];
      if (value instanceof Field) {
        fields[key] = value;
      }
    }

    return fields;
  }

  /**
   * Get only fields that contribute to database columns
   */
  getColumnFields(): Record<string, Field<unknown>> {
    this._ensureFieldsInitialized();
    const fields = this.getFields();
    const columnFields: Record<string, Field<unknown>> = {};

    for (const [key, field] of Object.entries(fields)) {
      if (field.contributesToColumns()) {
        columnFields[key] = field;
      }
    }

    return columnFields;
  }

  /**
   * Get the primary key field
   */
  getPrimaryKeyField(): Field<unknown> | null {
    this._ensureFieldsInitialized();
    const fields = this.getFields();
    for (const field of Object.values(fields)) {
      if (field.options.primaryKey) {
        return field;
      }
    }
    return null;
  }

  /**
   * Get the primary key value
   */
  get pk(): unknown {
    this._ensureFieldsInitialized();
    const pkField = this.getPrimaryKeyField();
    return pkField?.get() ?? null;
  }

  /**
   * Set the primary key value
   */
  set pk(value: unknown) {
    this._ensureFieldsInitialized();
    const pkField = this.getPrimaryKeyField();
    if (pkField) {
      pkField.set(value as never);
      this._data[pkField.name] = value;
    }
  }

  /**
   * Get the database table name for this model
   */
  static getTableName(): string {
    return this.meta.dbTable ?? this.name.toLowerCase() + "s";
  }

  /**
   * Get the table name for an instance
   */
  getTableName(): string {
    return (this.constructor as typeof Model).getTableName();
  }

  /**
   * Convert model instance to a plain object for database storage
   */
  toDB(): Record<string, unknown> {
    this._ensureFieldsInitialized();
    const data: Record<string, unknown> = {};
    const fields = this.getColumnFields();

    for (const [, field] of Object.entries(fields)) {
      // Handle auto timestamps
      if (field instanceof DateField || field instanceof DateTimeField) {
        const dateField = field as DateField | DateTimeField;
        if (dateField.autoNow) {
          field.set(new Date() as never);
        } else if (dateField.autoNowAdd && !this._persisted) {
          field.set(new Date() as never);
        }
      }

      const columnName = field.getColumnName();

      // ForeignKey fields handle their own value extraction in toDB()
      // Don't call get() as it throws if the related object isn't loaded
      if (field instanceof ForeignKey) {
        data[columnName] = field.toDB(null);
      } else {
        const value = field.get();
        data[columnName] = field.toDB(value as never);
      }
    }

    return data;
  }

  /**
   * Populate model instance from database data
   */
  fromDB(data: Record<string, unknown>): void {
    this._ensureFieldsInitialized();
    const fields = this.getColumnFields();

    for (const [key, field] of Object.entries(fields)) {
      const columnName = field.getColumnName();

      let value: unknown;
      let found = false;

      // Primary: look for column name (e.g., employee_id)
      if (columnName in data) {
        value = field.fromDB(data[columnName]);
        found = true;
      } // Fallback: look for field name (e.g., employee)
      // This handles REST API responses that use field names instead of column names
      // (Django REST Framework convention)
      else if (columnName !== key && key in data) {
        value = field.fromDB(data[key]);
        found = true;
      }

      if (found) {
        field.set(value as never);
        this._data[key] = value;
      }

      // Set backend on ForeignKey fields for lazy loading
      if (field instanceof ForeignKey && this._backend) {
        field.setBackend(this._backend);
      }
    }

    this._persisted = true;
    this._dirty.clear();
  }

  /**
   * Validate all fields on the model
   */
  validate(): { valid: boolean; errors: Record<string, string[]> } {
    this._ensureFieldsInitialized();
    const errors: Record<string, string[]> = {};
    const fields = this.getFields();

    for (const [key, field] of Object.entries(fields)) {
      const result = field.validate(field.get());
      if (!result.valid) {
        errors[key] = result.errors;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Check if the model instance has been persisted
   */
  get isPersisted(): boolean {
    return this._persisted;
  }

  /**
   * Check if any fields have been modified
   */
  get isDirty(): boolean {
    return this._dirty.size > 0;
  }

  /**
   * Get the names of modified fields
   */
  get dirtyFields(): string[] {
    return Array.from(this._dirty);
  }

  /**
   * Mark a field as modified
   */
  markDirty(fieldName: string): void {
    this._dirty.add(fieldName);
  }

  /**
   * Clear the dirty state
   */
  clearDirty(): void {
    this._dirty.clear();
  }

  /**
   * Create a new instance with the given data
   */
  static create<T extends Model>(
    this: new () => T,
    data: Partial<Record<string, unknown>>,
  ): T {
    const instance = new this();

    for (const [key, value] of Object.entries(data)) {
      const field = (instance as Record<string, unknown>)[key];
      if (field instanceof Field) {
        field.set(value as never);
        (instance as Model)._data[key] = value;
        (instance as Model)._dirty.add(key);
      }
    }

    return instance;
  }

  /**
   * Clone this model instance
   */
  clone(): this {
    this._ensureFieldsInitialized();
    const Constructor = this.constructor as new () => this;
    const instance = new Constructor();

    const fields = this.getFields();
    for (const [key, field] of Object.entries(fields)) {
      const clonedField = (instance as Record<string, unknown>)[key] as Field<
        unknown
      >;
      clonedField.set(field.get());
      (instance as Model)._data[key] = field.get();
    }

    return instance;
  }

  /**
   * Convert to a plain object
   */
  toObject(): Record<string, unknown> {
    this._ensureFieldsInitialized();
    const obj: Record<string, unknown> = {};
    const fields = this.getFields();

    for (const [key, field] of Object.entries(fields)) {
      if (field.contributesToColumns()) {
        obj[key] = field.get();
      }
    }

    return obj;
  }

  /**
   * String representation
   */
  toString(): string {
    this._ensureFieldsInitialized();
    const name = this.constructor.name;
    const pk = this.pk;
    return `<${name}: ${pk ?? "unsaved"}>`;
  }

  /**
   * JSON representation
   */
  toJSON(): Record<string, unknown> {
    return this.toObject();
  }

  /**
   * Save this model instance to the database
   *
   * Creates a new record if the instance has no primary key,
   * otherwise updates the existing record.
   *
   * @example
   * ```ts
   * const article = new Article();
   * article.title.set('Hello World');
   * await article.save();
   * ```
   */
  async save(): Promise<this> {
    this._ensureFieldsInitialized();

    // Import dynamically to avoid circular dependency
    const { getBackend, isInitialized } = await import("../setup.ts");

    if (!isInitialized()) {
      throw new Error(
        "Database not initialized. Call setup() before saving models.",
      );
    }

    const backend = getBackend();
    const pk = this.pk;

    if (pk === null || pk === undefined) {
      // Create new record
      const savedData = await backend.insert(this);
      this.fromDB(savedData);
    } else {
      // Update existing record
      await backend.update(this);
    }

    this.clearDirty();
    return this;
  }

  /**
   * Delete this model instance from the database
   *
   * @example
   * ```ts
   * await article.delete();
   * ```
   */
  async delete(): Promise<void> {
    this._ensureFieldsInitialized();

    const pk = this.pk;
    if (pk === null || pk === undefined) {
      throw new Error("Cannot delete an instance without a primary key");
    }

    // Import dynamically to avoid circular dependency
    const { getBackend, isInitialized } = await import("../setup.ts");

    if (!isInitialized()) {
      throw new Error(
        "Database not initialized. Call setup() before deleting models.",
      );
    }

    const backend = getBackend();
    await backend.delete(this);
  }

  /**
   * Refresh this instance from the database
   *
   * Reloads all field values from the database, discarding any local changes.
   *
   * @example
   * ```ts
   * await article.refresh();
   * ```
   */
  async refresh(): Promise<this> {
    this._ensureFieldsInitialized();

    const pk = this.pk;
    if (pk === null || pk === undefined) {
      throw new Error("Cannot refresh an instance without a primary key");
    }

    // Import dynamically to avoid circular dependency
    const { getBackend, isInitialized } = await import("../setup.ts");

    if (!isInitialized()) {
      throw new Error(
        "Database not initialized. Call setup() before refreshing models.",
      );
    }

    const backend = getBackend();
    const ModelClass = this.constructor as new () => this;
    const data = await backend.getById(ModelClass, pk);

    if (!data) {
      throw new Error(`${this.constructor.name} with pk=${pk} does not exist`);
    }

    this.fromDB(data);
    this.clearDirty();
    return this;
  }
}
