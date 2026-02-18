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
  RelatedManager,
} from "../fields/relations.ts";
import type { DatabaseBackend } from "../backends/backend.ts";

// ============================================================================
// Save/Delete Options
// ============================================================================

/**
 * Options for Model.save() and Model.delete() operations
 */
export interface ModelOperationOptions {
  /**
   * Specify which backend to use for this operation.
   *
   * Can be:
   * - A backend instance (e.g., `restBackend`)
   * - A backend name string (e.g., `"rest"`, `"indexeddb"`)
   *
   * If not specified, uses the backend the instance was fetched from,
   * or falls back to the global default backend.
   *
   * @example
   * ```ts
   * // Delete from REST backend
   * await todo.delete({ using: "rest" });
   *
   * // Save to specific backend instance
   * await todo.save({ using: myRestBackend });
   * ```
   */
  using?: DatabaseBackend | string;
}

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
/**
 * Reverse relation definition
 */
export interface ReverseRelationDef {
  /** Name of the reverse relation (relatedName from ForeignKey) */
  relatedName: string;
  /** Name of the model that has the ForeignKey */
  relatedModelName: string;
  /** Name of the ForeignKey field on the related model */
  fieldName: string;
}

export class ModelRegistry {
  private static _instance: ModelRegistry;
  // deno-lint-ignore no-explicit-any
  private _models: Map<string, any> = new Map();
  /**
   * Map of model name -> array of reverse relations pointing to it
   * Key: target model name (e.g., "ProjectRoleModel")
   * Value: array of reverse relation definitions
   */
  private _reverseRelations: Map<string, ReverseRelationDef[]> = new Map();

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
   *
   * If the model is already registered, this is a no-op.
   * This allows safe registration from both Manager constructor
   * and _initializeFields() fallback.
   */
  // deno-lint-ignore no-explicit-any
  register(model: any): void {
    const name = model.name;

    // Skip if already registered (prevents duplicate _resolveRelations calls)
    if (this._models.has(name)) {
      return;
    }

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
   * Get reverse relations for a model
   *
   * @param modelName - Name of the model to get reverse relations for
   * @returns Array of reverse relation definitions
   */
  getReverseRelations(modelName: string): ReverseRelationDef[] {
    return this._reverseRelations.get(modelName) || [];
  }

  /**
   * Register a reverse relation
   *
   * @param targetModelName - Name of the model the FK points to
   * @param def - Reverse relation definition
   */
  private _registerReverseRelation(
    targetModelName: string,
    def: ReverseRelationDef,
  ): void {
    const existing = this._reverseRelations.get(targetModelName) || [];
    // Check if already registered (avoid duplicates)
    const alreadyExists = existing.some(
      (r) =>
        r.relatedName === def.relatedName &&
        r.relatedModelName === def.relatedModelName &&
        r.fieldName === def.fieldName,
    );
    if (!alreadyExists) {
      existing.push(def);
      this._reverseRelations.set(targetModelName, existing);
    }
  }

  /**
   * Resolve string-based model references in relations and register reverse relations
   */
  // deno-lint-ignore no-explicit-any
  private _resolveRelations(model: any): void {
    try {
      const instance = new model();
      const fields = instance.getFields();
      const modelName = model.name;

      for (const [fieldName, field] of Object.entries(fields)) {
        if (field instanceof ForeignKey) {
          // Try to resolve string references
          const relatedModel = field.getRelatedModel();
          let targetModelName: string | undefined;

          if (
            !relatedModel &&
            typeof (field as ForeignKey<unknown>).relatedModel === "string"
          ) {
            targetModelName = (field as ForeignKey<unknown>)
              .relatedModel as string;
            const resolved = this._models.get(targetModelName);
            if (resolved) {
              // deno-lint-ignore no-explicit-any
              (field as any).setRelatedModel(resolved);
            }
          } else if (relatedModel) {
            targetModelName = relatedModel.name;
          }

          // Register reverse relation if relatedName is defined
          if (targetModelName && field.relatedName) {
            this._registerReverseRelation(targetModelName, {
              relatedName: field.relatedName,
              relatedModelName: modelName,
              fieldName: fieldName,
            });
          }
        } else if (field instanceof ManyToManyField) {
          // Try to resolve string references for ManyToMany
          const relatedModel = field.getRelatedModel();
          if (
            !relatedModel &&
            typeof (field as ManyToManyField<unknown>).relatedModel === "string"
          ) {
            const relatedModelName = (field as ManyToManyField<unknown>)
              .relatedModel as string;
            const resolved = this._models.get(relatedModelName);
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

    // Wrap instance in Proxy for dynamic reverse relation access
    // This allows accessing reverse relations even if the related model
    // was registered after this instance was created
    return new Proxy(this, {
      get(target, prop, receiver) {
        // First, try to get the property normally
        const value = Reflect.get(target, prop, receiver);
        if (value !== undefined) {
          return value;
        }

        // If property is a string and not found, check if it's a reverse relation
        if (typeof prop === "string" && !prop.startsWith("_")) {
          const manager = target.getRelatedManager(prop);
          if (manager) {
            return manager;
          }
        }

        return value;
      },
    });
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
   * Cache for RelatedManager instances (created lazily)
   */
  private _relatedManagers: Map<string, RelatedManager<Model>> = new Map();

  /**
   * Get a reverse relation manager by name
   *
   * This is a dynamic lookup that works regardless of model registration order.
   * It's called via Proxy or can be called directly.
   *
   * @param relatedName - The name of the reverse relation (relatedName from ForeignKey)
   * @returns RelatedManager instance or undefined if not found
   */
  getRelatedManager(relatedName: string): RelatedManager<Model> | undefined {
    const constructor = Object.getPrototypeOf(this).constructor;
    const modelName = constructor.name;

    // Check cache first
    if (this._relatedManagers.has(relatedName)) {
      return this._relatedManagers.get(relatedName);
    }

    // Look up the reverse relation definition
    const reverseRelations = ModelRegistry.instance.getReverseRelations(
      modelName,
    );
    const def = reverseRelations.find((r) => r.relatedName === relatedName);

    if (!def) {
      return undefined;
    }

    // Get the related model class
    const relatedModelClass = ModelRegistry.instance.get(def.relatedModelName);
    if (!relatedModelClass) {
      // Related model not yet registered
      return undefined;
    }

    // Create the RelatedManager
    const manager = new RelatedManager(this, relatedModelClass, def.fieldName);

    // Cache it
    this._relatedManagers.set(relatedName, manager);

    return manager;
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
   * @param options - Options including which backend to use
   *
   * @example
   * ```ts
   * const article = new Article();
   * article.title.set('Hello World');
   * await article.save();
   *
   * // Save to a specific backend
   * await article.save({ using: "rest" });
   * await article.save({ using: myRestBackend });
   * ```
   */
  async save(options?: ModelOperationOptions): Promise<this> {
    this._ensureFieldsInitialized();

    const backend = await this._resolveBackend(options?.using);
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
   * @param options - Options including which backend to use
   *
   * @example
   * ```ts
   * await article.delete();
   *
   * // Delete from a specific backend
   * await article.delete({ using: "rest" });
   * await article.delete({ using: myRestBackend });
   * ```
   */
  async delete(options?: ModelOperationOptions): Promise<void> {
    this._ensureFieldsInitialized();

    const pk = this.pk;
    if (pk === null || pk === undefined) {
      throw new Error("Cannot delete an instance without a primary key");
    }

    const backend = await this._resolveBackend(options?.using);
    await backend.delete(this);
  }

  /**
   * Resolve which backend to use for an operation.
   *
   * Priority:
   * 1. Explicit `using` parameter (backend instance or name)
   * 2. Instance's `_backend` (set when fetched from a backend)
   * 3. Global default backend from setup()
   *
   * @param using - Explicit backend to use
   * @returns The resolved DatabaseBackend
   * @throws Error if no backend is available
   */
  private async _resolveBackend(
    using?: DatabaseBackend | string,
  ): Promise<DatabaseBackend> {
    // Import dynamically to avoid circular dependency
    const { getBackend, getBackendByName, isInitialized } = await import(
      "../setup.ts"
    );

    // 1. Explicit using parameter
    if (using) {
      if (typeof using === "string") {
        const namedBackend = getBackendByName(using);
        if (!namedBackend) {
          throw new Error(
            `Unknown database backend: '${using}'. ` +
              `Make sure it's registered in setup({ databases: { ... } }).`,
          );
        }
        return namedBackend;
      }
      // It's a backend instance
      return using;
    }

    // 2. Instance's backend (from fetch)
    if (this._backend) {
      return this._backend;
    }

    // 3. Global default backend
    if (!isInitialized()) {
      throw new Error(
        "Database not initialized. Call setup() before using model operations, " +
          "or pass a backend via { using: backend }.",
      );
    }

    return getBackend();
  }

  /**
   * Refresh this instance from the database
   *
   * Reloads all field values from the database, discarding any local changes.
   *
   * @param options - Options including which backend to use
   *
   * @example
   * ```ts
   * await article.refresh();
   *
   * // Refresh from a specific backend
   * await article.refresh({ using: "rest" });
   * ```
   */
  async refresh(options?: ModelOperationOptions): Promise<this> {
    this._ensureFieldsInitialized();

    const pk = this.pk;
    if (pk === null || pk === undefined) {
      throw new Error("Cannot refresh an instance without a primary key");
    }

    const backend = await this._resolveBackend(options?.using);
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
