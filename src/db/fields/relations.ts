/**
 * Relation field types for Alexi ORM
 * @module
 */

import { Field, FieldOptions } from "./field.ts";

// ============================================================================
// Relation Types
// ============================================================================

/**
 * OnDelete behavior options for foreign keys
 */
export enum OnDelete {
  /** Delete related objects when referenced object is deleted */
  CASCADE = "CASCADE",
  /** Prevent deletion if related objects exist */
  PROTECT = "PROTECT",
  /** Set the foreign key to NULL when referenced object is deleted */
  SET_NULL = "SET_NULL",
  /** Set the foreign key to its default value when referenced object is deleted */
  SET_DEFAULT = "SET_DEFAULT",
  /** Do nothing (let database handle it) */
  DO_NOTHING = "DO_NOTHING",
}

/**
 * Type representing a Model class constructor
 */
// deno-lint-ignore no-explicit-any
export type ModelClass<T = any> = new (...args: any[]) => T;

/**
 * Type representing a lazy model reference (string name or class)
 */
export type LazyModelRef<T> = ModelClass<T> | string;

// ============================================================================
// ForeignKey Field
// ============================================================================

/**
 * ForeignKey field options
 */
export interface ForeignKeyOptions<T> extends FieldOptions<T> {
  /** Behavior when referenced object is deleted */
  onDelete: OnDelete;
  /** Name of the reverse relation on the related model */
  relatedName?: string;
  /** Field on the related model to reference (defaults to primary key) */
  toField?: string;
}

/**
 * ForeignKey - Reference to another model (many-to-one relationship)
 *
 * This field stores a reference to another model. It provides Django-like
 * access patterns for working with related objects.
 *
 * @example
 * ```ts
 * // Define models
 * class Organisation extends Model {
 *   id = new AutoField({ primaryKey: true });
 *   name = new CharField({ maxLength: 100 });
 *   static objects = new Manager(Organisation);
 * }
 *
 * class Project extends Model {
 *   id = new AutoField({ primaryKey: true });
 *   name = new CharField({ maxLength: 100 });
 *   organisation = new ForeignKey<Organisation>(Organisation, { onDelete: OnDelete.CASCADE });
 *   static objects = new Manager(Project);
 * }
 *
 * // Usage
 * const project = await Project.objects.get({ id: 1 });
 *
 * // Get the ID directly (no fetch needed)
 * project.organisation.id; // 42
 *
 * // Fetch the related object (lazy load)
 * await project.organisation.fetch();
 *
 * // Now get() returns the instance
 * project.organisation.get(); // Organisation instance
 * project.organisation.get().name.get(); // "Acme Inc"
 *
 * // Check if loaded
 * project.organisation.isLoaded(); // true
 *
 * // With selectRelated (avoid N+1)
 * const projects = await Project.objects
 *   .selectRelated('organisation')
 *   .fetch();
 *
 * for (const p of projects.array()) {
 *   // No additional fetch needed - already loaded
 *   console.log(p.organisation.get().name.get());
 * }
 * ```
 */
export class ForeignKey<T> extends Field<T> {
  readonly relatedModel: LazyModelRef<T>;
  readonly onDelete: OnDelete;
  readonly relatedName?: string;
  readonly toField: string;

  private _resolvedModel?: ModelClass<T>;
  private _foreignKeyId: unknown = null;
  private _relatedInstance: T | null = null;
  private _isLoaded = false;

  // Reference to backend (set by Model when hydrating)
  // deno-lint-ignore no-explicit-any
  private _backend?: any;

  constructor(model: LazyModelRef<T>, options: ForeignKeyOptions<T>) {
    super(options);
    this.relatedModel = model;
    this.onDelete = options.onDelete;
    this.relatedName = options.relatedName;
    this.toField = options.toField ?? "id";
  }

  /**
   * Get the foreign key ID without fetching the related object
   *
   * @example
   * ```ts
   * const project = await Project.objects.get({ id: 1 });
   * const orgId = project.organisation.id; // 42 (no fetch needed)
   * ```
   */
  get id(): unknown {
    return this._foreignKeyId;
  }

  /**
   * Get the related model instance
   *
   * @throws Error if the related object has not been fetched yet
   *
   * @example
   * ```ts
   * await project.organisation.fetch();
   * const org = project.organisation.get();
   * console.log(org.name.get());
   * ```
   */
  override get(): T {
    if (!this._isLoaded) {
      throw new Error(
        `Related object '${this._name}' not fetched. Call .fetch() first or use selectRelated().`,
      );
    }
    return this._relatedInstance as T;
  }

  /**
   * Set the related object or foreign key ID
   *
   * Can accept either:
   * - A model instance (extracts the ID and caches the instance)
   * - A raw ID value (clears any cached instance)
   *
   * @example
   * ```ts
   * // Set with instance
   * const org = await Organisation.objects.get({ id: 1 });
   * project.organisation.set(org);
   *
   * // Set with ID
   * project.organisation.set(42);
   * ```
   */
  override set(value: T | null): void {
    if (value === null) {
      this._foreignKeyId = null;
      this._relatedInstance = null;
      this._isLoaded = false;
      this._value = null;
      return;
    }

    // Check if value is a model instance
    // deno-lint-ignore no-explicit-any
    const instance = value as any;
    if (instance && typeof instance === "object" && this.toField in instance) {
      const field = instance[this.toField];
      // If it's a Field instance, get its value
      if (field && typeof field.get === "function") {
        this._foreignKeyId = field.get();
      } else {
        this._foreignKeyId = field;
      }
      this._relatedInstance = value;
      this._isLoaded = true;
    } else {
      // Value is a raw ID
      this._foreignKeyId = value;
      this._relatedInstance = null;
      this._isLoaded = false;
    }

    // Store the ID in _value for compatibility
    this._value = this._foreignKeyId as T | null;
  }

  /**
   * Check if the related object has been loaded
   *
   * @example
   * ```ts
   * project.organisation.isLoaded(); // false
   * await project.organisation.fetch();
   * project.organisation.isLoaded(); // true
   * ```
   */
  isLoaded(): boolean {
    return this._isLoaded;
  }

  /**
   * Fetch and cache the related object
   *
   * This is a lazy-loading method that fetches the related object
   * from the database if it hasn't been loaded yet.
   *
   * @returns The related object, or null if the foreign key is null
   *
   * @example
   * ```ts
   * const org = await project.organisation.fetch();
   * console.log(org?.name.get());
   * ```
   */
  async fetch(): Promise<T | null> {
    if (this._foreignKeyId === null || this._foreignKeyId === undefined) {
      return null;
    }

    if (this._isLoaded && this._relatedInstance !== null) {
      return this._relatedInstance;
    }

    const modelClass = this.getRelatedModel();
    if (!modelClass) {
      throw new Error(
        `Related model for '${this._name}' could not be resolved. ` +
          `Make sure the model is registered.`,
      );
    }

    // Get the backend - try instance backend first, then global
    let backend = this._backend;
    if (!backend) {
      // Import dynamically to avoid circular dependency
      const { getBackend, isInitialized } = await import("../setup.ts");
      if (!isInitialized()) {
        throw new Error(
          `Database not initialized. Call setup() before fetching related objects.`,
        );
      }
      backend = getBackend();
    }

    // Fetch the related object
    const data = await backend.getById(modelClass, this._foreignKeyId);
    if (data) {
      const instance = new modelClass();
      // deno-lint-ignore no-explicit-any
      (instance as any).fromDB(data);
      // deno-lint-ignore no-explicit-any
      (instance as any)._backend = backend;
      this._relatedInstance = instance;
      this._isLoaded = true;
      return instance;
    }

    return null;
  }

  /**
   * Set the related instance directly (used by selectRelated)
   *
   * This is an internal method used by QuerySet.selectRelated()
   * to populate the related object without an additional fetch.
   */
  setRelatedInstance(instance: T | null): void {
    this._relatedInstance = instance;
    this._isLoaded = instance !== null;
    if (instance !== null) {
      // deno-lint-ignore no-explicit-any
      const inst = instance as any;
      if (inst && typeof inst === "object" && this.toField in inst) {
        const field = inst[this.toField];
        if (field && typeof field.get === "function") {
          this._foreignKeyId = field.get();
        } else {
          this._foreignKeyId = field;
        }
      }
    }
  }

  /**
   * Set the backend reference (called by Model when hydrating)
   */
  // deno-lint-ignore no-explicit-any
  setBackend(backend: any): void {
    this._backend = backend;
  }

  /**
   * Get the resolved model class
   */
  getRelatedModel(): ModelClass<T> | undefined {
    if (this._resolvedModel) {
      return this._resolvedModel;
    }
    if (typeof this.relatedModel !== "string") {
      this._resolvedModel = this.relatedModel;
      return this._resolvedModel;
    }
    // String references need to be resolved by the model registry
    return undefined;
  }

  /**
   * Set the resolved model class (called by model registry)
   */
  setRelatedModel(model: ModelClass<T>): void {
    this._resolvedModel = model;
  }

  /**
   * Get the column name for the foreign key
   * By convention, FK columns are named `{fieldName}_id`
   */
  override getColumnName(): string {
    return this.options.dbColumn ?? `${this.name}_id`;
  }

  toDB(_value: T | null): unknown {
    // If we have a cached instance, use its ID
    if (this._isLoaded && this._relatedInstance !== null) {
      // deno-lint-ignore no-explicit-any
      const instance = this._relatedInstance as any;
      if (
        instance && typeof instance === "object" && this.toField in instance
      ) {
        const field = instance[this.toField];
        if (field && typeof field.get === "function") {
          return field.get();
        }
        return field;
      }
    }

    // Use the stored foreign key ID (this is the primary source)
    // This handles both raw ID values and IDs extracted from instances via set()
    return this._foreignKeyId;
  }

  fromDB(value: unknown): T | null {
    // ForeignKey fromDB stores the raw ID value
    // The actual model instance is loaded lazily or via selectRelated
    this._foreignKeyId = value;
    this._relatedInstance = null;
    this._isLoaded = false;
    return value as T | null;
  }

  getDBType(): string {
    // FK type depends on the primary key type of the related model
    // For now, assume integer
    return "INTEGER";
  }

  clone(options?: Partial<ForeignKeyOptions<T>>): ForeignKey<T> {
    const cloned = new ForeignKey<T>(this.relatedModel, {
      ...this.options,
      onDelete: this.onDelete,
      relatedName: this.relatedName,
      toField: this.toField,
      ...options,
    } as ForeignKeyOptions<T>);

    // Copy state
    cloned._foreignKeyId = this._foreignKeyId;
    cloned._relatedInstance = this._relatedInstance;
    cloned._isLoaded = this._isLoaded;
    cloned._backend = this._backend;
    cloned._resolvedModel = this._resolvedModel;

    return cloned;
  }

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      relatedModel: typeof this.relatedModel === "string"
        ? this.relatedModel
        : this.relatedModel.name,
      onDelete: this.onDelete,
      relatedName: this.relatedName,
      toField: this.toField,
    };
  }
}

// ============================================================================
// OneToOneField
// ============================================================================

/**
 * OneToOneField - Unique reference to another model (one-to-one relationship)
 */
export class OneToOneField<T> extends ForeignKey<T> {
  constructor(model: LazyModelRef<T>, options: ForeignKeyOptions<T>) {
    super(model, {
      ...options,
      unique: true,
    });
  }

  override clone(options?: Partial<ForeignKeyOptions<T>>): OneToOneField<T> {
    const cloned = new OneToOneField<T>(this.relatedModel, {
      ...this.options,
      onDelete: this.onDelete,
      relatedName: this.relatedName,
      toField: this.toField,
      ...options,
    } as ForeignKeyOptions<T>);

    // Copy state from parent
    // deno-lint-ignore no-explicit-any
    (cloned as any)._foreignKeyId = (this as any)._foreignKeyId;
    // deno-lint-ignore no-explicit-any
    (cloned as any)._relatedInstance = (this as any)._relatedInstance;
    // deno-lint-ignore no-explicit-any
    (cloned as any)._isLoaded = (this as any)._isLoaded;
    // deno-lint-ignore no-explicit-any
    (cloned as any)._backend = (this as any)._backend;
    // deno-lint-ignore no-explicit-any
    (cloned as any)._resolvedModel = (this as any)._resolvedModel;

    return cloned;
  }
}

// ============================================================================
// ManyToManyField
// ============================================================================

/**
 * ManyToManyField options
 */
export interface ManyToManyFieldOptions<T> extends FieldOptions<T[]> {
  /** Custom through/junction table model */
  through?: LazyModelRef<unknown>;
  /** Name of the reverse relation on the related model */
  relatedName?: string;
  /** Whether to create a default through table if not specified */
  autoCreated?: boolean;
}

/**
 * ManyToManyField - Many-to-many relationship to another model
 */
export class ManyToManyField<T> extends Field<T[]> {
  readonly relatedModel: LazyModelRef<T>;
  readonly through?: LazyModelRef<unknown>;
  readonly relatedName?: string;
  readonly autoCreated: boolean;

  private _resolvedModel?: ModelClass<T>;
  private _resolvedThrough?: ModelClass<unknown>;

  constructor(
    model: LazyModelRef<T>,
    options?: Partial<ManyToManyFieldOptions<T>>,
  ) {
    super(options);
    this.relatedModel = model;
    this.through = options?.through;
    this.relatedName = options?.relatedName;
    this.autoCreated = options?.autoCreated ?? !options?.through;
  }

  /**
   * Get the resolved model class
   */
  getRelatedModel(): ModelClass<T> | undefined {
    if (this._resolvedModel) {
      return this._resolvedModel;
    }
    if (typeof this.relatedModel !== "string") {
      this._resolvedModel = this.relatedModel;
      return this._resolvedModel;
    }
    return undefined;
  }

  /**
   * Set the resolved model class (called by model registry)
   */
  setRelatedModel(model: ModelClass<T>): void {
    this._resolvedModel = model;
  }

  /**
   * Get the resolved through model class
   */
  getThroughModel(): ModelClass<unknown> | undefined {
    if (this._resolvedThrough) {
      return this._resolvedThrough;
    }
    if (this.through && typeof this.through !== "string") {
      this._resolvedThrough = this.through;
      return this._resolvedThrough;
    }
    return undefined;
  }

  /**
   * Set the resolved through model class (called by model registry)
   */
  setThroughModel(model: ModelClass<unknown>): void {
    this._resolvedThrough = model;
  }

  /**
   * ManyToMany fields don't create columns on the model's table
   */
  override contributesToColumns(): boolean {
    return false;
  }

  toDB(_value: T[] | null): null {
    // M2M relationships are stored in junction tables, not as columns
    return null;
  }

  fromDB(_value: unknown): T[] | null {
    // M2M values are loaded separately via prefetch_related
    return null;
  }

  getDBType(): string {
    // M2M doesn't have a direct DB type
    return "M2M";
  }

  clone(options?: Partial<ManyToManyFieldOptions<T>>): ManyToManyField<T> {
    return new ManyToManyField<T>(this.relatedModel, {
      ...this.options,
      through: this.through,
      relatedName: this.relatedName,
      autoCreated: this.autoCreated,
      ...options,
    });
  }

  override serialize(): Record<string, unknown> {
    const throughName = this.through
      ? typeof this.through === "string" ? this.through : this.through.name
      : undefined;

    return {
      ...super.serialize(),
      relatedModel: typeof this.relatedModel === "string"
        ? this.relatedModel
        : this.relatedModel.name,
      through: throughName,
      relatedName: this.relatedName,
      autoCreated: this.autoCreated,
    };
  }
}

// ============================================================================
// ManyToManyManager (for accessing related objects)
// ============================================================================

/**
 * Manager for ManyToMany relationships
 * Provides methods like add(), remove(), clear(), set()
 */
export class ManyToManyManager<T> {
  private _sourceModel: unknown;
  private _field: ManyToManyField<T>;
  private _cachedItems: T[] | null = null;

  constructor(sourceModel: unknown, field: ManyToManyField<T>) {
    this._sourceModel = sourceModel;
    this._field = field;
  }

  /**
   * Get all related objects
   */
  async all(): Promise<T[]> {
    if (this._cachedItems !== null) {
      return this._cachedItems;
    }
    // This will be implemented with the backend
    throw new Error("ManyToManyManager.all() requires a database backend");
  }

  /**
   * Add objects to the relationship
   */
  async add(..._objects: T[]): Promise<void> {
    // This will be implemented with the backend
    throw new Error("ManyToManyManager.add() requires a database backend");
  }

  /**
   * Remove objects from the relationship
   */
  async remove(..._objects: T[]): Promise<void> {
    // This will be implemented with the backend
    throw new Error("ManyToManyManager.remove() requires a database backend");
  }

  /**
   * Clear all objects from the relationship
   */
  async clear(): Promise<void> {
    // This will be implemented with the backend
    throw new Error("ManyToManyManager.clear() requires a database backend");
  }

  /**
   * Set the related objects (replaces existing)
   */
  async set(objects: T[]): Promise<void> {
    await this.clear();
    if (objects.length > 0) {
      await this.add(...objects);
    }
  }

  /**
   * Set cached items (used by prefetch_related)
   */
  setCachedItems(items: T[]): void {
    this._cachedItems = items;
  }

  /**
   * Get the source model
   */
  get sourceModel(): unknown {
    return this._sourceModel;
  }

  /**
   * Get the field
   */
  get field(): ManyToManyField<T> {
    return this._field;
  }
}
