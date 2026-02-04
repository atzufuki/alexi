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
 */
export class ForeignKey<T> extends Field<T> {
  readonly relatedModel: LazyModelRef<T>;
  readonly onDelete: OnDelete;
  readonly relatedName?: string;
  readonly toField: string;

  private _resolvedModel?: ModelClass<T>;

  constructor(model: LazyModelRef<T>, options: ForeignKeyOptions<T>) {
    super(options);
    this.relatedModel = model;
    this.onDelete = options.onDelete;
    this.relatedName = options.relatedName;
    this.toField = options.toField ?? "id";
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

  toDB(value: T | null): unknown {
    if (value === null) return null;

    // If value is a model instance, extract the referenced field value
    // deno-lint-ignore no-explicit-any
    const instance = value as any;
    if (instance && typeof instance === "object" && this.toField in instance) {
      const field = instance[this.toField];
      // If it's a Field instance, get its value
      if (field && typeof field.get === "function") {
        return field.get();
      }
      return field;
    }

    // If value is already the ID, return it directly
    return value;
  }

  fromDB(value: unknown): T | null {
    // ForeignKey fromDB returns the raw ID value
    // The actual model instance is loaded lazily or via select_related
    return value as T | null;
  }

  getDBType(): string {
    // FK type depends on the primary key type of the related model
    // For now, assume integer
    return "INTEGER";
  }

  clone(options?: Partial<ForeignKeyOptions<T>>): ForeignKey<T> {
    return new ForeignKey<T>(this.relatedModel, {
      ...this.options,
      onDelete: this.onDelete,
      relatedName: this.relatedName,
      toField: this.toField,
      ...options,
    } as ForeignKeyOptions<T>);
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
    return new OneToOneField<T>(this.relatedModel, {
      ...this.options,
      onDelete: this.onDelete,
      relatedName: this.relatedName,
      toField: this.toField,
      ...options,
    } as ForeignKeyOptions<T>);
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
