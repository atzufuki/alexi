/**
 * Relation field types for Alexi ORM
 * @module
 */

import { Field, FieldOptions } from "./field.ts";
import type { Model } from "../models/model.ts";
import { getBackend, isInitialized } from "../setup.ts";

export { Field } from "./field.ts";
export type { FieldOptions } from "./field.ts";

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
 *
 * String references are resolved lazily through the model registry, which makes
 * it possible to declare circular relations before all models are registered.
 */
export type LazyModelRef<T> = ModelClass<T> | string;

/**
 * Minimal queryset-like contract exposed by {@link RelatedManager}.
 *
 * This keeps the fields module's public API focused on relation usage without
 * requiring consumers to import the entire query-layer type graph just to use
 * reverse relations.
 */
export interface RelatedQuerySetLike<T> extends AsyncIterable<T> {
  /** Fetch all matching related objects into memory. */
  fetch(): Promise<{ array(): T[] }>;
  /** Use a named backend or backend-like object for subsequent operations. */
  using(backend: string | object): RelatedQuerySetLike<T>;
  /** Apply additional filter conditions to the related queryset. */
  filter(filters: Record<string, unknown>): RelatedQuerySetLike<T>;
  /** Exclude objects matching the provided conditions. */
  exclude(filters: Record<string, unknown>): RelatedQuerySetLike<T>;
  /** Return the first related object, if any. */
  first(): Promise<T | null>;
  /** Return the last related object, if any. */
  last(): Promise<T | null>;
  /** Count matching related objects. */
  count(): Promise<number>;
  /** Check whether any related objects exist. */
  exists(): Promise<boolean>;
}

// ============================================================================
// Model Resolver
// ============================================================================

/**
 * Module-level resolver function injected by ModelRegistry to avoid circular imports.
 * Resolves a model class by its string name at call time.
 */
// deno-lint-ignore no-explicit-any
let _modelResolver: ((name: string) => any | undefined) | undefined;

/**
 * Set the model resolver function. Called by ModelRegistry during initialization
 * so that ForeignKey and ManyToManyField can lazily resolve string-based model
 * references without a circular import dependency.
 *
 * @param resolver Function that maps a model name to its constructor.
 */
// deno-lint-ignore no-explicit-any
export function setModelResolver(
  resolver: (name: string) => any | undefined,
): void {
  _modelResolver = resolver;
}

// ============================================================================
// ForeignKey Field
// ============================================================================

/**
 * ForeignKey field options
 *
 * Extends base {@link FieldOptions} with relation-specific behavior such as
 * delete cascades and reverse-relation naming.
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
  /** Related model reference, either as a class or lazy string name. */
  readonly relatedModel: LazyModelRef<T>;
  /** How deletes on the target model affect this relation. */
  readonly onDelete: OnDelete;
  /** Optional reverse relation name exposed on the target model. */
  readonly relatedName?: string;
  /** Target field name on the related model, defaults to `id`. */
  readonly toField: string;

  private _resolvedModel?: ModelClass<T>;
  private _foreignKeyId: unknown = null;
  private _relatedInstance: T | null = null;
  private _isLoaded = false;

  // Reference to backend (set by Model when hydrating)
  // deno-lint-ignore no-explicit-any
  private _backend?: any;

  /**
   * Create a foreign-key field.
   *
   * @param model Related model class or lazy model name.
   * @param options Delete behavior and reverse-relation options.
   */
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
    if (this._foreignKeyId === null || this._foreignKeyId === undefined) {
      return null as T;
    }
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
    // String references: resolve lazily from the registry to handle cases where
    // setRelatedModel() was only called on the prototype instance's field but not
    // on fields of new model instances created during QuerySet hydration.
    if (_modelResolver) {
      const resolved = _modelResolver(this.relatedModel) as
        | ModelClass<T>
        | undefined;
      if (resolved) {
        this._resolvedModel = resolved; // cache for future calls
        return resolved;
      }
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
   * Get the column name for the foreign key
   * By convention, FK columns are named `{fieldName}_id`
   */
  override getColumnName(): string {
    return this.options.dbColumn ?? `${this.name}_id`;
  }

  /**
   * Serialize the relation to its foreign-key identifier for database storage.
   *
   * If a related instance is loaded, its referenced field value is used.
   */
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

  /**
   * Hydrate the relation from a raw foreign-key identifier.
   *
   * This does not fetch the related instance; it only stores the ID.
   */
  fromDB(value: unknown): T | null {
    // ForeignKey fromDB stores the raw ID value
    // The actual model instance is loaded lazily or via selectRelated
    this._foreignKeyId = value;
    this._relatedInstance = null;
    this._isLoaded = false;
    return value as T | null;
  }

  /**
   * Return the database column type used for foreign-key storage.
   *
   * Currently assumes integer primary keys.
   */
  getDBType(): string {
    // FK type depends on the primary key type of the related model
    // For now, assume integer
    return "INTEGER";
  }

  /**
   * Clone the field definition and preserve runtime relation state.
   *
   * @param options Field option overrides for the clone.
   */
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

  /**
   * Serialize field metadata for schema and introspection output.
   */
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
  /**
   * Create a one-to-one field.
   *
   * This behaves like {@link ForeignKey} with `unique: true` enforced.
   */
  constructor(model: LazyModelRef<T>, options: ForeignKeyOptions<T>) {
    super(model, {
      ...options,
      unique: true,
    });
  }

  /**
   * Clone the one-to-one field definition and preserve runtime relation state.
   *
   * @param options Field option overrides for the clone.
   */
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
 *
 * Extends base {@link FieldOptions} with through-model and reverse-relation
 * configuration.
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
 *
 * Many-to-many fields do not store data in the source model's table. Instead,
 * the relationship is represented through a junction model or auto-created
 * through table managed by the backend.
 */
export class ManyToManyField<T> extends Field<T[]> {
  /** Related model reference, either as a class or lazy string name. */
  readonly relatedModel: LazyModelRef<T>;
  /** Optional explicit through model. */
  readonly through?: LazyModelRef<unknown>;
  /** Reverse relation name exposed on the related model. */
  readonly relatedName?: string;
  /** Whether the backend should auto-create a junction model. */
  readonly autoCreated: boolean;

  private _resolvedModel?: ModelClass<T>;
  private _resolvedThrough?: ModelClass<unknown>;

  /**
   * Create a many-to-many field.
   *
   * @param model Related model class or lazy model name.
   * @param options Through-model and reverse-relation options.
   */
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
    // String references: resolve lazily from the registry to handle cases where
    // setRelatedModel() was only called on the prototype instance's field but not
    // on fields of new model instances created during QuerySet hydration.
    if (_modelResolver) {
      const resolved = _modelResolver(this.relatedModel) as
        | ModelClass<T>
        | undefined;
      if (resolved) {
        this._resolvedModel = resolved; // cache for future calls
        return resolved;
      }
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
    // String references: resolve lazily from the registry
    if (_modelResolver && typeof this.through === "string") {
      const resolved = _modelResolver(this.through) as
        | ModelClass<unknown>
        | undefined;
      if (resolved) {
        this._resolvedThrough = resolved;
        return resolved;
      }
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

  /**
   * Serialize many-to-many fields for storage in the owning model row.
   *
   * Many-to-many relations are stored in a separate junction table, so this
   * always returns `null`.
   */
  toDB(_value: T[] | null): null {
    // M2M relationships are stored in junction tables, not as columns
    return null;
  }

  /**
   * Hydrate many-to-many values from a database row.
   *
   * Relationship values are loaded separately, so this always returns `null`.
   */
  fromDB(_value: unknown): T[] | null {
    // M2M values are loaded separately via prefetch_related
    return null;
  }

  /**
   * Return a placeholder database type label for many-to-many relations.
   */
  getDBType(): string {
    // M2M doesn't have a direct DB type
    return "M2M";
  }

  /**
   * Clone the many-to-many field definition.
   *
   * @param options Field option overrides for the clone.
   */
  clone(options?: Partial<ManyToManyFieldOptions<T>>): ManyToManyField<T> {
    return new ManyToManyField<T>(this.relatedModel, {
      ...this.options,
      through: this.through,
      relatedName: this.relatedName,
      autoCreated: this.autoCreated,
      ...options,
    });
  }

  /**
   * Serialize field metadata for schema and introspection output.
   */
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

  /**
   * Create a manager bound to one source instance and one many-to-many field.
   *
   * @param sourceModel Model instance owning the relation.
   * @param field Relation definition used for backend operations.
   */
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

// ============================================================================
// RelatedManager (for ForeignKey reverse relations)
// ============================================================================

/**
 * Manager for ForeignKey reverse relationships (Django-style)
 *
 * This manager is automatically created on the target model when a ForeignKey
 * defines a `relatedName`. It provides a QuerySet-like interface for accessing
 * related objects.
 *
 * @example
 * ```ts
 * // Define models with reverse relation
 * class ProjectRole extends Model {
 *   id = new AutoField({ primaryKey: true });
 *   name = new CharField({ maxLength: 255 });
 *
 *   // TypeScript type declaration (runtime populates this)
 *   declare roleCompetences: RelatedManager<ProjectRoleCompetence>;
 *
 *   static objects = new Manager(ProjectRole);
 * }
 *
 * class ProjectRoleCompetence extends Model {
 *   projectRole = new ForeignKey<ProjectRole>(ProjectRole, {
 *     onDelete: OnDelete.CASCADE,
 *     relatedName: "roleCompetences",  // Creates reverse relation
 *   });
 *   competence = new ForeignKey<Competence>(Competence, {
 *     onDelete: OnDelete.CASCADE,
 *   });
 * }
 *
 * // Usage
 * const role = await ProjectRole.objects.get({ id: 1 });
 * const competences = await role.roleCompetences.all().fetch();
 * const filtered = await role.roleCompetences.filter({ competence: 5 }).fetch();
 * await role.roleCompetences.create({ competence: 10 });
 * ```
 *
 * @category Relations
 */
export class RelatedManager<T extends Model = Model> {
  private _sourceInstance: unknown;
  private _relatedModel: ModelClass<T>;
  private _fieldName: string;

  /**
   * Create a new RelatedManager
   *
   * @param sourceInstance - The model instance that owns this relation
   * @param relatedModel - The related model class
   * @param fieldName - The ForeignKey field name on the related model
   */
  constructor(
    sourceInstance: unknown,
    relatedModel: ModelClass<T>,
    fieldName: string,
  ) {
    this._sourceInstance = sourceInstance;
    this._relatedModel = relatedModel;
    this._fieldName = fieldName;
  }

  /**
   * Get the backend from the source instance (lazy)
   */
  // deno-lint-ignore no-explicit-any
  private _getBackend(): any {
    // deno-lint-ignore no-explicit-any
    return (this._sourceInstance as any)._backend;
  }

  /**
   * Set the backend for this manager (for backwards compatibility)
   * @deprecated Backend is now retrieved lazily from source instance
   */
  // deno-lint-ignore no-explicit-any
  setBackend(_backend: any): void {
    // No-op: backend is now retrieved lazily from source instance
  }

  /**
   * Get all related objects as a QuerySet
   *
   * @returns QuerySet filtered to objects related to the source instance
   *
   * @example
   * ```ts
   * const role = await ProjectRole.objects.get({ id: 1 });
   * const competences = await role.roleCompetences.all().fetch();
   * ```
   */
  all(): RelatedQuerySetLike<T> {
    // deno-lint-ignore no-explicit-any
    const sourcePk = (this._sourceInstance as any).pk;
    const filter = { [this._fieldName]: sourcePk };
    // deno-lint-ignore no-explicit-any
    let qs = (this._relatedModel as any).objects.filter(filter);
    const backend = this._getBackend();
    if (backend) {
      qs = qs.using(backend);
    }
    return qs;
  }

  /**
   * Use a specific backend for related object queries
   *
   * This allows querying related objects from a different backend
   * than the source instance's backend.
   *
   * @param backend - Backend instance or registered backend name
   * @returns QuerySet using the specified backend
   *
   * @example
   * ```ts
   * // Fetch from REST API instead of source instance's backend
   * const competences = await role.roleCompetences.using("rest").fetch();
   *
   * // Fetch from IndexedDB
   * const cached = await role.roleCompetences.using("indexeddb").fetch();
   *
   * // Use backend instance directly
   * const data = await role.roleCompetences.using(myBackend).fetch();
   * ```
   */
  using(backend: string | object): RelatedQuerySetLike<T> {
    // deno-lint-ignore no-explicit-any
    const sourcePk = (this._sourceInstance as any).pk;
    const filter = { [this._fieldName]: sourcePk };
    // deno-lint-ignore no-explicit-any
    const qs = (this._relatedModel as any).objects.filter(filter);
    return qs.using(backend) as RelatedQuerySetLike<T>;
  }

  /**
   * Filter related objects
   *
   * @param filters - Filter conditions
   * @returns Filtered QuerySet
   *
   * @example
   * ```ts
   * const filtered = await role.roleCompetences.filter({ level: 3 }).fetch();
   * ```
   */
  filter(filters: Record<string, unknown>): RelatedQuerySetLike<T> {
    return this.all().filter(filters);
  }

  /**
   * Exclude related objects matching conditions
   *
   * @param filters - Exclusion conditions
   * @returns Filtered QuerySet
   */
  exclude(filters: Record<string, unknown>): RelatedQuerySetLike<T> {
    return this.all().exclude(filters);
  }

  /**
   * Get the first related object
   *
   * @returns First related object or null
   */
  async first(): Promise<T | null> {
    return this.all().first();
  }

  /**
   * Get the last related object
   *
   * @returns Last related object or null
   */
  async last(): Promise<T | null> {
    return this.all().last();
  }

  /**
   * Create a new related object
   *
   * The foreign key is automatically set to the source instance.
   *
   * @param data - Data for the new object (FK field is set automatically)
   * @returns The created object
   *
   * @example
   * ```ts
   * const newCompetence = await role.roleCompetences.create({
   *   competence: 10,
   *   level: 3,
   * });
   * ```
   */
  async create(data: Partial<Record<string, unknown>>): Promise<T> {
    const sourcePk = (this._sourceInstance as any).pk;
    const createData = {
      ...data,
      [this._fieldName]: sourcePk,
    };
    // deno-lint-ignore no-explicit-any
    let manager = (this._relatedModel as any).objects;
    const backend = this._getBackend();
    if (backend) {
      manager = manager.using(backend);
    }
    return manager.create(createData);
  }

  /**
   * Get or create a related object
   *
   * @param lookup - Lookup conditions (FK is added automatically)
   * @param defaults - Default values for creation
   * @returns Tuple of [instance, created]
   *
   * @example
   * ```ts
   * const [comp, created] = await role.roleCompetences.getOrCreate(
   *   { competenceId: 10 },  // lookup conditions
   *   { level: 3 }  // defaults for creation
   * );
   * ```
   */
  async getOrCreate(
    lookup: Record<string, unknown>,
    defaults?: Partial<Record<string, unknown>>,
  ): Promise<[T, boolean]> {
    // deno-lint-ignore no-explicit-any
    const sourcePk = (this._sourceInstance as any).pk;
    const lookupWithFk = {
      ...lookup,
      [this._fieldName]: sourcePk,
    };
    const defaultsWithFk = {
      ...defaults,
      [this._fieldName]: sourcePk,
    };
    // deno-lint-ignore no-explicit-any
    let manager = (this._relatedModel as any).objects;
    const backend = this._getBackend();
    if (backend) {
      manager = manager.using(backend);
    }
    return manager.getOrCreate(lookupWithFk, defaultsWithFk);
  }

  /**
   * Update or create a related object
   *
   * @param lookup - Lookup conditions (FK is added automatically)
   * @param defaults - Fields to update or set on creation
   * @returns Tuple of [instance, created]
   *
   * @example
   * ```ts
   * const [comp, created] = await role.roleCompetences.updateOrCreate(
   *   { competenceId: 10 },  // lookup conditions
   *   { level: 5 }  // fields to update or set
   * );
   * ```
   */
  async updateOrCreate(
    lookup: Record<string, unknown>,
    defaults?: Partial<Record<string, unknown>>,
  ): Promise<[T, boolean]> {
    // deno-lint-ignore no-explicit-any
    const sourcePk = (this._sourceInstance as any).pk;
    const lookupWithFk = {
      ...lookup,
      [this._fieldName]: sourcePk,
    };
    const defaultsWithFk = {
      ...defaults,
      [this._fieldName]: sourcePk,
    };
    // deno-lint-ignore no-explicit-any
    let manager = (this._relatedModel as any).objects;
    const backend = this._getBackend();
    if (backend) {
      manager = manager.using(backend);
    }
    return manager.updateOrCreate(lookupWithFk, defaultsWithFk);
  }

  /**
   * Count related objects
   *
   * @returns Number of related objects
   *
   * @example
   * ```ts
   * const count = await role.roleCompetences.count();
   * ```
   */
  async count(): Promise<number> {
    return this.all().count();
  }

  /**
   * Check if any related objects exist
   *
   * @returns true if at least one related object exists
   */
  async exists(): Promise<boolean> {
    return this.all().exists();
  }

  /**
   * Get the source model instance
   */
  get sourceInstance(): unknown {
    return this._sourceInstance;
  }

  /**
   * Get the related model class
   */
  get relatedModel(): new (...args: unknown[]) => T {
    return this._relatedModel;
  }

  /**
   * Get the foreign key field name
   */
  get fieldName(): string {
    return this._fieldName;
  }
}
