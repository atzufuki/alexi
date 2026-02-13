/**
 * Manager class for Alexi ORM
 *
 * Manager provides the interface for database queries on a model.
 * It is accessed via Model.objects and returns QuerySet instances.
 *
 * @module
 */

import { Model, ModelRegistry } from "./model.ts";
import { QuerySet } from "../query/queryset.ts";
import type { DatabaseBackend } from "../backends/backend.ts";
import type { FilterConditions, OrderByField } from "../query/types.ts";
import { getBackend, getBackendByName, isInitialized } from "../setup.ts";

// ============================================================================
// Exceptions
// ============================================================================

/**
 * Exception raised when a query returns no results but one was expected
 */
export class DoesNotExist extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DoesNotExist";
  }
}

/**
 * Exception raised when a query returns multiple results but one was expected
 */
export class MultipleObjectsReturned extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MultipleObjectsReturned";
  }
}

// ============================================================================
// Manager Class
// ============================================================================

/**
 * Manager class for database operations on a model
 *
 * @example
 * ```ts
 * class Article extends Model {
 *   title = new CharField({ maxLength: 200 });
 *   static objects = new Manager(Article);
 * }
 *
 * // Usage
 * const articles = await Article.objects.all().fetch();
 * const article = await Article.objects.get({ id: 1 });
 * ```
 */
export class Manager<T extends Model> {
  private _modelClass: new () => T;
  private _backend?: DatabaseBackend;

  constructor(modelClass: new () => T) {
    this._modelClass = modelClass;

    // Register model at class definition time (Django-style)
    // This ensures reverse relations are available before any instances are created
    // See: https://github.com/atzufuki/alexi/issues/41
    ModelRegistry.instance.register(modelClass);
  }

  /**
   * Get the model class this manager is for
   */
  get modelClass(): new () => T {
    return this._modelClass;
  }

  /**
   * Get the current backend
   */
  get backend(): DatabaseBackend | undefined {
    return this._backend;
  }

  /**
   * Create a new manager instance using a specific database backend
   *
   * Accepts either a backend instance or a string name (if registered via setup()).
   *
   * @example
   * ```ts
   * // With backend instance
   * const pgArticles = Article.objects.using(postgresBackend);
   *
   * // With named backend (requires setup() with databases config)
   * const cached = Article.objects.using('indexeddb');
   * const fresh = Article.objects.using('sync');
   * ```
   */
  using(backend: DatabaseBackend | string): Manager<T> {
    const manager = new Manager(this._modelClass);

    if (typeof backend === "string") {
      const namedBackend = getBackendByName(backend);
      if (!namedBackend) {
        throw new Error(
          `Unknown database backend: '${backend}'. ` +
            `Make sure it's registered in setup({ databases: { ... } }).`,
        );
      }
      manager._backend = namedBackend;
    } else {
      manager._backend = backend;
    }

    return manager;
  }

  /**
   * Set the default backend for this manager
   */
  setBackend(backend: DatabaseBackend): void {
    this._backend = backend;
  }

  /**
   * Get the backend, throwing if not set
   *
   * Falls back to the global backend from setup() if no local backend is configured.
   */
  private _getBackend(): DatabaseBackend {
    if (this._backend) {
      return this._backend;
    }

    // Try to use global backend from setup()
    if (isInitialized()) {
      return getBackend();
    }

    throw new Error(
      `No database backend configured for ${this._modelClass.name}. ` +
        `Use .using(backend) or call setup() to configure a default backend.`,
    );
  }

  // ============================================================================
  // QuerySet Methods (return QuerySet for chaining)
  // ============================================================================

  /**
   * Return a QuerySet containing all objects
   */
  all(): QuerySet<T> {
    // Use local backend, or fall back to global backend from setup()
    let backend = this._backend;
    if (!backend && isInitialized()) {
      backend = getBackend();
    }
    return new QuerySet<T>(this._modelClass, backend);
  }

  /**
   * Return an empty QuerySet that will never return any objects
   *
   * Useful for:
   * - Returning an empty result from a method that normally returns a QuerySet
   * - Providing a base case for union operations
   * - Avoiding database queries when you know the result will be empty
   *
   * @example
   * ```ts
   * // Return empty result for unauthenticated users
   * function getTasks(user: User | null): QuerySet<TaskModel> {
   *   if (!user) {
   *     return TaskModel.objects.none();
   *   }
   *   return TaskModel.objects.filter({ owner: user.id });
   * }
   * ```
   */
  none(): QuerySet<T> {
    return this.all().none();
  }

  /**
   * Return a QuerySet filtered by the given conditions
   *
   * @example
   * ```ts
   * Article.objects.filter({ title__contains: 'TypeScript' })
   * Article.objects.filter({ createdAt__gte: new Date('2024-01-01') })
   * ```
   */
  filter(conditions: FilterConditions<T>): QuerySet<T> {
    return this.all().filter(conditions);
  }

  /**
   * Return a QuerySet excluding objects matching the given conditions
   *
   * @example
   * ```ts
   * Article.objects.exclude({ status: 'draft' })
   * ```
   */
  exclude(conditions: FilterConditions<T>): QuerySet<T> {
    return this.all().exclude(conditions);
  }

  /**
   * Return a QuerySet ordered by the given fields
   *
   * @example
   * ```ts
   * Article.objects.orderBy('-createdAt', 'title')
   * ```
   */
  orderBy(...fields: OrderByField<T>[]): QuerySet<T> {
    return this.all().orderBy(...fields);
  }

  /**
   * Return a QuerySet with only the specified fields
   */
  only(...fields: (keyof T)[]): QuerySet<T> {
    return this.all().only(...fields);
  }

  /**
   * Return a QuerySet with the specified fields deferred (not loaded)
   */
  defer(...fields: (keyof T)[]): QuerySet<T> {
    return this.all().defer(...fields);
  }

  /**
   * Return a QuerySet with related objects pre-fetched (for ForeignKey)
   */
  selectRelated(...relations: string[]): QuerySet<T> {
    return this.all().selectRelated(...relations);
  }

  /**
   * Return a QuerySet with related objects pre-fetched (for ManyToMany/reverse FK)
   */
  prefetchRelated(...relations: string[]): QuerySet<T> {
    return this.all().prefetchRelated(...relations);
  }

  // ============================================================================
  // Direct Query Methods (execute immediately)
  // ============================================================================

  /**
   * Get a single object matching the given conditions
   *
   * @throws DoesNotExist if no object matches
   * @throws MultipleObjectsReturned if more than one object matches
   *
   * @example
   * ```ts
   * const article = await Article.objects.get({ id: 1 });
   * const article = await Article.objects.get({ slug: 'my-article' });
   * ```
   */
  async get(conditions: FilterConditions<T>): Promise<T> {
    return this.all().get(conditions);
  }

  /**
   * Get the first object in the QuerySet, or null if empty
   */
  async first(): Promise<T | null> {
    return this.all().first();
  }

  /**
   * Get the last object in the QuerySet, or null if empty
   */
  async last(): Promise<T | null> {
    return this.all().last();
  }

  /**
   * Return the count of objects in the QuerySet
   */
  async count(): Promise<number> {
    return this.all().count();
  }

  /**
   * Return true if the QuerySet contains any objects
   */
  async exists(): Promise<boolean> {
    return this.all().exists();
  }

  // ============================================================================
  // Create/Update Methods
  // ============================================================================

  /**
   * Create and save a new model instance
   *
   * @example
   * ```ts
   * const article = await Article.objects.create({
   *   title: 'Hello World',
   *   content: 'This is my first article.',
   * });
   * ```
   */
  async create(data: Record<string, unknown>): Promise<T> {
    const backend = this._getBackend();
    const instance = new this._modelClass();

    // Ensure fields are initialized before setting values
    instance.getFields();

    // Set field values from data
    for (const [key, value] of Object.entries(data)) {
      const field = (instance as Record<string, unknown>)[key];
      if (field && typeof field === "object" && "set" in field) {
        (field as { set: (v: unknown) => void }).set(value);
      }
    }

    // Insert into database
    const savedData = await backend.insert(instance);

    // Update instance with saved data (including auto-generated ID)
    instance.fromDB(savedData);

    return instance;
  }

  /**
   * Get an existing object or create a new one
   *
   * @returns Tuple of [instance, created] where created is true if a new object was created
   *
   * @example
   * ```ts
   * const [article, created] = await Article.objects.getOrCreate(
   *   { slug: 'my-article' },  // lookup conditions
   *   { title: 'My Article', content: '...' }  // defaults for creation
   * );
   * ```
   */
  async getOrCreate(
    conditions: FilterConditions<T>,
    defaults?: Record<string, unknown>,
  ): Promise<[T, boolean]> {
    try {
      const instance = await this.get(conditions);
      return [instance, false];
    } catch (error) {
      if (error instanceof DoesNotExist) {
        // Create new instance with conditions and defaults
        const createData = {
          ...defaults,
          ...conditions,
        } as Record<string, unknown>;
        const instance = await this.create(createData);
        return [instance, true];
      }
      throw error;
    }
  }

  /**
   * Update an existing object or create a new one
   *
   * @returns Tuple of [instance, created] where created is true if a new object was created
   *
   * @example
   * ```ts
   * const [article, created] = await Article.objects.updateOrCreate(
   *   { slug: 'my-article' },  // lookup conditions
   *   { title: 'Updated Title' }  // fields to update or set on creation
   * );
   * ```
   */
  async updateOrCreate(
    conditions: FilterConditions<T>,
    defaults?: Record<string, unknown>,
  ): Promise<[T, boolean]> {
    const backend = this._getBackend();

    try {
      const instance = await this.get(conditions);

      // Update instance with defaults
      if (defaults) {
        for (const [key, value] of Object.entries(defaults)) {
          const field = (instance as Record<string, unknown>)[key];
          if (field && typeof field === "object" && "set" in field) {
            (field as { set: (v: unknown) => void }).set(value);
            (instance as Model).markDirty(key);
          }
        }

        // Save changes
        await backend.update(instance);
      }

      return [instance, false];
    } catch (error) {
      if (error instanceof DoesNotExist) {
        const createData = {
          ...defaults,
          ...conditions,
        } as Record<string, unknown>;
        const instance = await this.create(createData);
        return [instance, true];
      }
      throw error;
    }
  }

  // ============================================================================
  // Single Object Update/Delete Methods
  // ============================================================================

  /**
   * Update an existing model instance in the database
   *
   * @example
   * ```ts
   * article.title.set('New Title');
   * article.markDirty('title');
   * await Article.objects.update(article);
   * ```
   */
  async update(instance: T): Promise<T> {
    const backend = this._getBackend();
    await backend.update(instance);
    instance.clearDirty();
    return instance;
  }

  /**
   * Delete a model instance from the database
   *
   * @example
   * ```ts
   * await Article.objects.delete(article);
   * ```
   */
  async delete(instance: T): Promise<void> {
    const backend = this._getBackend();
    const pk = instance.pk;
    if (pk === null || pk === undefined) {
      throw new Error("Cannot delete an instance without a primary key");
    }
    await backend.delete(instance);
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Create multiple objects in a single operation
   *
   * @example
   * ```ts
   * const articles = await Article.objects.bulkCreate([
   *   { title: 'Article 1', content: '...' },
   *   { title: 'Article 2', content: '...' },
   *   { title: 'Article 3', content: '...' },
   * ]);
   * ```
   */
  async bulkCreate(items: Record<string, unknown>[]): Promise<T[]> {
    const backend = this._getBackend();
    const instances: T[] = [];

    for (const data of items) {
      const instance = new this._modelClass();

      // Ensure fields are initialized before setting values
      instance.getFields();

      for (const [key, value] of Object.entries(data)) {
        const field = (instance as Record<string, unknown>)[key];
        if (field && typeof field === "object" && "set" in field) {
          (field as { set: (v: unknown) => void }).set(value);
        }
      }

      instances.push(instance);
    }

    const savedDataArray = await backend.bulkInsert(instances);

    for (let i = 0; i < instances.length; i++) {
      instances[i].fromDB(savedDataArray[i]);
    }

    return instances;
  }

  /**
   * Update multiple objects in a single operation
   *
   * @returns Number of objects updated
   *
   * @example
   * ```ts
   * const count = await Article.objects.bulkUpdate(
   *   articles,
   *   ['title', 'content']  // fields to update
   * );
   * ```
   */
  async bulkUpdate(
    instances: T[],
    fields: string[],
  ): Promise<number> {
    const backend = this._getBackend();
    return backend.bulkUpdate(instances, fields as string[]);
  }

  /**
   * Delete multiple objects matching the QuerySet
   *
   * @returns Number of objects deleted
   */
  async bulkDelete(conditions?: FilterConditions<T>): Promise<number> {
    let qs = this.all();
    if (conditions) {
      qs = qs.filter(conditions);
    }
    return qs.delete();
  }
}
