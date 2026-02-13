/**
 * QuerySet class for Alexi ORM
 *
 * QuerySet represents a lazy database query that can be filtered, ordered,
 * and executed. QuerySets are immutable - each operation returns a new QuerySet.
 *
 * After calling fetch(), the QuerySet contains loaded data in memory.
 * Subsequent filter() calls will apply in-memory filtering instead of
 * building database queries.
 *
 * @module
 */

import type { Model } from "../models/model.ts";
import type { DatabaseBackend } from "../backends/backend.ts";
import { DoesNotExist, MultipleObjectsReturned } from "../models/manager.ts";
import { getBackend, getBackendByName, isInitialized } from "../setup.ts";
import { Q, type ResolvedQ } from "./q.ts";
import {
  type Aggregation,
  type Aggregations,
  type Annotations,
  cloneQueryState,
  type CompiledQuery,
  createQueryState,
  type FilterConditions,
  type LookupType,
  type OrderByField,
  type ParsedFilter,
  type ParsedOrdering,
  type QueryState,
} from "./types.ts";
import { ForeignKey } from "../fields/relations.ts";

// ============================================================================
// QuerySet Class
// ============================================================================

/**
 * QuerySet - Lazy database query builder
 *
 * QuerySets are lazy - they don't hit the database until evaluated.
 * Evaluation happens when:
 * - Iterating (for await...of)
 * - Calling terminal methods: fetch(), get(), first(), last(), count(), exists()
 * - Converting to array
 *
 * @example
 * ```ts
 * // Build a query (no database hit yet)
 * const qs = Article.objects
 *   .filter({ status: 'published' })
 *   .orderBy('-createdAt')
 *   .limit(10);
 *
 * // Execute the query
 * const articles = await qs.fetch();
 * ```
 */
export class QuerySet<T extends Model> implements AsyncIterable<T> {
  private _state: QueryState<T>;
  private _backend?: DatabaseBackend;
  private _cache: T[] | null = null;
  private _isFetched = false;
  private _isEmpty = false; // True for none() QuerySets - avoids all database queries

  constructor(model: new () => T, backend?: DatabaseBackend) {
    this._state = createQueryState(model);
    this._backend = backend;
  }

  /**
   * Create a QuerySet from an existing state
   */
  private static _fromState<T extends Model>(
    state: QueryState<T>,
    backend?: DatabaseBackend,
    cache?: T[] | null,
    isFetched?: boolean,
    isEmpty?: boolean,
  ): QuerySet<T> {
    const qs = new QuerySet<T>(state.model, backend);
    qs._state = state;
    if (cache !== undefined) {
      qs._cache = cache;
    }
    if (isFetched !== undefined) {
      qs._isFetched = isFetched;
    }
    if (isEmpty !== undefined) {
      qs._isEmpty = isEmpty;
    }
    return qs;
  }

  /**
   * Clone this QuerySet with a modified state
   */
  private _clone(modifier?: (state: QueryState<T>) => void): QuerySet<T> {
    const newState = cloneQueryState(this._state);
    if (modifier) {
      modifier(newState);
    }
    // Clone preserves fetched state, cache, and isEmpty flag
    return QuerySet._fromState(
      newState,
      this._backend,
      this._cache,
      this._isFetched,
      this._isEmpty,
    );
  }

  /**
   * Check if this QuerySet has been fetched (data loaded into memory)
   */
  isFetched(): boolean {
    return this._isFetched;
  }

  /**
   * Get the query state (for backend use)
   */
  get state(): QueryState<T> {
    return this._state;
  }

  /**
   * Get the model class
   */
  get model(): new () => T {
    return this._state.model;
  }

  /**
   * Get the backend
   */
  get backend(): DatabaseBackend | undefined {
    return this._backend;
  }

  // ============================================================================
  // Filter Methods
  // ============================================================================

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
   *
   * // Empty QuerySet behavior
   * const empty = TaskModel.objects.none();
   * await empty.fetch();  // Returns QuerySet with empty array
   * await empty.count();  // Returns 0
   * await empty.first();  // Returns null
   * empty.length();       // Returns 0
   * ```
   */
  none(): QuerySet<T> {
    // Create a new QuerySet that is already "fetched" with an empty cache
    // This avoids any database queries
    return QuerySet._fromState(
      cloneQueryState(this._state),
      this._backend,
      [], // Empty cache
      true, // Mark as fetched
      true, // Mark as empty - prevents all database queries
    );
  }

  /**
   * Filter the QuerySet by the given conditions
   *
   * If the QuerySet has been fetched, filtering is done in-memory.
   * Otherwise, filters are added to the query state for database execution.
   *
   * @example
   * ```ts
   * // Database filtering (before fetch)
   * qs.filter({ name: 'John' })
   * qs.filter({ age__gte: 18 })
   *
   * // In-memory filtering (after fetch)
   * const fetched = await qs.fetch();
   * const filtered = fetched.filter({ status: 'active' }); // No DB call
   * ```
   */
  filter(conditions: FilterConditions<T> | Q<T>): QuerySet<T> {
    // If we have fetched data, apply in-memory filtering
    if (this._isFetched && this._cache !== null) {
      const filters = this._parseConditions(conditions);
      const filteredCache = this._applyInMemoryFilters(this._cache, filters);
      return QuerySet._fromState(
        cloneQueryState(this._state),
        this._backend,
        filteredCache,
        true,
      );
    }

    // Otherwise, add to query state for database execution
    return this._clone((state) => {
      const filters = this._parseConditions(conditions);
      state.filters.push(...filters);
    });
  }

  /**
   * Exclude objects matching the given conditions
   *
   * @example
   * ```ts
   * qs.exclude({ status: 'draft' })
   * ```
   */
  exclude(conditions: FilterConditions<T> | Q<T>): QuerySet<T> {
    return this._clone((state) => {
      const filters = this._parseConditions(conditions);
      // Mark all filters as negated
      for (const filter of filters) {
        filter.negated = true;
      }
      state.filters.push(...filters);
    });
  }

  /**
   * Parse filter conditions into ParsedFilter objects
   */
  private _parseConditions(
    conditions: FilterConditions<T> | Q<T>,
  ): ParsedFilter[] {
    if (conditions instanceof Q) {
      return conditions.toParsedFilters();
    }

    const filters: ParsedFilter[] = [];

    for (const [key, value] of Object.entries(conditions)) {
      const parsed = this._parseConditionKey(key, value);
      filters.push(parsed);
    }

    return filters;
  }

  /**
   * Parse a condition key into field and lookup
   */
  private _parseConditionKey(key: string, value: unknown): ParsedFilter {
    const parts = key.split("__");
    let field: string;
    let lookup: LookupType = "exact";

    if (parts.length === 1) {
      field = parts[0];
    } else {
      const possibleLookup = parts[parts.length - 1] as LookupType;
      if (this._isValidLookup(possibleLookup)) {
        lookup = possibleLookup;
        field = parts.slice(0, -1).join("__");
      } else {
        field = key;
        lookup = "exact";
      }
    }

    return {
      field,
      lookup,
      value,
      negated: false,
    };
  }

  /**
   * Apply filters to an in-memory array of model instances
   */
  private _applyInMemoryFilters(items: T[], filters: ParsedFilter[]): T[] {
    return items.filter((item) => {
      for (const filter of filters) {
        const matches = this._matchesFilter(item, filter);
        if (filter.negated ? matches : !matches) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Check if a model instance matches a single filter
   */
  private _matchesFilter(item: T, filter: ParsedFilter): boolean {
    const fieldValue = this._getFieldValue(item, filter.field);
    const filterValue = filter.value;

    switch (filter.lookup) {
      case "exact":
        return fieldValue === filterValue;
      case "iexact":
        return String(fieldValue).toLowerCase() ===
          String(filterValue).toLowerCase();
      case "contains":
        return String(fieldValue).includes(String(filterValue));
      case "icontains":
        return String(fieldValue).toLowerCase().includes(
          String(filterValue).toLowerCase(),
        );
      case "startswith":
        return String(fieldValue).startsWith(String(filterValue));
      case "istartswith":
        return String(fieldValue).toLowerCase().startsWith(
          String(filterValue).toLowerCase(),
        );
      case "endswith":
        return String(fieldValue).endsWith(String(filterValue));
      case "iendswith":
        return String(fieldValue).toLowerCase().endsWith(
          String(filterValue).toLowerCase(),
        );
      case "gt":
        return fieldValue !== null && fieldValue !== undefined &&
          filterValue !== null && filterValue !== undefined &&
          (fieldValue as number) > (filterValue as number);
      case "gte":
        return fieldValue !== null && fieldValue !== undefined &&
          filterValue !== null && filterValue !== undefined &&
          (fieldValue as number) >= (filterValue as number);
      case "lt":
        return fieldValue !== null && fieldValue !== undefined &&
          filterValue !== null && filterValue !== undefined &&
          (fieldValue as number) < (filterValue as number);
      case "lte":
        return fieldValue !== null && fieldValue !== undefined &&
          filterValue !== null && filterValue !== undefined &&
          (fieldValue as number) <= (filterValue as number);
      case "in":
        return Array.isArray(filterValue) && filterValue.includes(fieldValue);
      case "isnull":
        return filterValue ? fieldValue === null : fieldValue !== null;
      case "regex":
        return new RegExp(String(filterValue)).test(String(fieldValue));
      case "iregex":
        return new RegExp(String(filterValue), "i").test(String(fieldValue));
      case "range":
        if (Array.isArray(filterValue) && filterValue.length === 2) {
          return fieldValue !== null && fieldValue !== undefined &&
            (fieldValue as number) >= filterValue[0] &&
            (fieldValue as number) <= filterValue[1];
        }
        return false;
      default:
        // Unknown lookup - default to exact match
        return fieldValue === filterValue;
    }
  }

  /**
   * Get the value of a field from a model instance
   * Supports nested field access (e.g., "author__name")
   */
  private _getFieldValue(item: T, fieldPath: string): unknown {
    const parts = fieldPath.split("__");
    // deno-lint-ignore no-explicit-any
    let current: any = item;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }

      // Check if it's a Field instance
      if (current[part] && typeof current[part].get === "function") {
        current = current[part].get();
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Check if a string is a valid lookup type
   */
  private _isValidLookup(lookup: string): lookup is LookupType {
    const validLookups: LookupType[] = [
      "exact",
      "iexact",
      "contains",
      "icontains",
      "startswith",
      "istartswith",
      "endswith",
      "iendswith",
      "in",
      "gt",
      "gte",
      "lt",
      "lte",
      "range",
      "isnull",
      "regex",
      "iregex",
      "date",
      "year",
      "month",
      "day",
      "week",
      "weekday",
    ];
    return validLookups.includes(lookup as LookupType);
  }

  // ============================================================================
  // Ordering Methods
  // ============================================================================

  /**
   * Order the QuerySet by the given fields
   *
   * @example
   * ```ts
   * qs.orderBy('name')           // ascending
   * qs.orderBy('-createdAt')     // descending
   * qs.orderBy('-createdAt', 'name')  // multiple fields
   * ```
   */
  orderBy(...fields: OrderByField<T>[]): QuerySet<T> {
    return this._clone((state) => {
      state.ordering = fields.map((field) => this._parseOrdering(field));
    });
  }

  /**
   * Parse an ordering field string
   */
  private _parseOrdering(field: string): ParsedOrdering {
    if (field.startsWith("-")) {
      return {
        field: field.slice(1),
        direction: "DESC",
      };
    }
    return {
      field,
      direction: "ASC",
    };
  }

  /**
   * Reverse the ordering of the QuerySet
   */
  reverse(): QuerySet<T> {
    return this._clone((state) => {
      state.reversed = !state.reversed;
      // Also reverse existing orderings
      state.ordering = state.ordering.map((o) => ({
        field: o.field,
        direction: o.direction === "ASC" ? "DESC" : "ASC",
      }));
    });
  }

  // ============================================================================
  // Limiting Methods
  // ============================================================================

  /**
   * Limit the number of results
   */
  limit(count: number): QuerySet<T> {
    return this._clone((state) => {
      state.limit = count;
    });
  }

  /**
   * Skip the first N results
   */
  offset(count: number): QuerySet<T> {
    return this._clone((state) => {
      state.offset = count;
    });
  }

  /**
   * Python-style slicing
   *
   * @example
   * ```ts
   * qs.slice(10, 20)  // skip 10, take 10
   * qs.slice(5)       // skip 5, take all remaining
   * ```
   */
  slice(start: number, end?: number): QuerySet<T> {
    return this._clone((state) => {
      state.offset = start;
      if (end !== undefined) {
        state.limit = end - start;
      }
    });
  }

  // ============================================================================
  // Field Selection Methods
  // ============================================================================

  /**
   * Only load the specified fields
   */
  only(...fields: (keyof T | string)[]): QuerySet<T> {
    return this._clone((state) => {
      state.selectFields = fields as string[];
    });
  }

  /**
   * Defer loading of the specified fields
   */
  defer(...fields: (keyof T | string)[]): QuerySet<T> {
    return this._clone((state) => {
      state.deferFields = fields as string[];
    });
  }

  /**
   * Return only distinct results
   *
   * @example
   * ```ts
   * qs.distinct()              // all fields
   * qs.distinct('category')    // distinct on specific field
   * ```
   */
  distinct(...fields: (keyof T | string)[]): QuerySet<T> {
    return this._clone((state) => {
      state.distinctFields = fields as string[];
    });
  }

  // ============================================================================
  // Related Object Methods
  // ============================================================================

  /**
   * Eagerly load related objects (JOIN)
   *
   * Use for ForeignKey relationships where you want to load
   * the related object in the same query.
   *
   * @example
   * ```ts
   * Article.objects.selectRelated('author', 'category')
   * ```
   */
  selectRelated(...relations: string[]): QuerySet<T> {
    return this._clone((state) => {
      state.selectRelated.push(...relations);
    });
  }

  /**
   * Prefetch related objects (separate queries)
   *
   * Use for ManyToMany or reverse ForeignKey relationships.
   *
   * @example
   * ```ts
   * Article.objects.prefetchRelated('tags', 'comments')
   * ```
   */
  prefetchRelated(...relations: string[]): QuerySet<T> {
    return this._clone((state) => {
      state.prefetchRelated.push(...relations);
    });
  }

  // ============================================================================
  // Aggregation Methods
  // ============================================================================

  /**
   * Add computed annotations to each result
   *
   * @example
   * ```ts
   * Article.objects.annotate({
   *   commentCount: Count('comments'),
   *   avgRating: Avg('ratings__value'),
   * })
   * ```
   */
  annotate(annotations: Annotations): QuerySet<T> {
    return this._clone((state) => {
      state.annotations = { ...state.annotations, ...annotations };
    });
  }

  /**
   * Return aggregate values
   *
   * @example
   * ```ts
   * const stats = await Article.objects.aggregate({
   *   total: Count('*'),
   *   avgViews: Avg('views'),
   * });
   * // { total: 100, avgViews: 1500 }
   * ```
   */
  async aggregate(aggregations: Aggregations): Promise<Record<string, number>> {
    const backend = this._getBackend();
    return backend.aggregate(this._state, aggregations);
  }

  /**
   * Return the count of objects from the database
   *
   * Always executes a count query against the database to get the current count.
   * Use length() for the in-memory count of already fetched objects.
   *
   * For none() QuerySets, returns 0 without hitting the database.
   */
  async count(): Promise<number> {
    // Empty QuerySet (from none()) - no database query needed
    if (this._isEmpty) {
      return 0;
    }
    const backend = this._getBackend();
    return backend.count(this._state);
  }

  // ============================================================================
  // Values Methods
  // ============================================================================

  /**
   * Return plain objects instead of model instances
   *
   * @example
   * ```ts
   * const values = await Article.objects.values('id', 'title').fetch();
   * // [{ id: 1, title: 'Hello' }, { id: 2, title: 'World' }]
   * ```
   */
  values<K extends keyof T>(...fields: K[]): ValuesQuerySet<Pick<T, K>> {
    return new ValuesQuerySet<Pick<T, K>>(
      this._state as unknown as QueryState<Model>,
      this._backend,
      fields as string[],
    );
  }

  /**
   * Return arrays of values instead of model instances
   *
   * @example
   * ```ts
   * const values = await Article.objects.valuesList('id', 'title').fetch();
   * // [[1, 'Hello'], [2, 'World']]
   * ```
   */
  valuesList<K extends keyof T>(...fields: K[]): ValuesListQuerySet<T[K]> {
    return new ValuesListQuerySet<T[K]>(
      this._state as unknown as QueryState<Model>,
      this._backend,
      fields as string[],
    );
  }

  // ============================================================================
  // Terminal Methods (execute the query)
  // ============================================================================

  /**
   * Execute the query and return this QuerySet with loaded data
   *
   * After fetch(), the QuerySet contains data in memory. Subsequent
   * filter() calls will apply in-memory filtering instead of hitting
   * the database.
   *
   * @example
   * ```ts
   * // Fetch from database
   * const projects = await Project.objects
   *   .filter({ organisation: myOrg })
   *   .fetch();
   *
   * // Further filtering is done in-memory (no DB call)
   * const published = projects.filter({ isPublished: true });
   *
   * // Get the array when needed
   * const arr = published.array();
   * ```
   */
  async fetch(): Promise<this> {
    if (this._isFetched && this._cache !== null) {
      return this;
    }

    const backend = this._getBackend();
    const results = await backend.execute<T>(this._state);

    // Hydrate results into model instances
    const instances = results.map((data) => this._hydrate(data));

    // Handle selectRelated
    if (this._state.selectRelated.length > 0) {
      await this._loadRelatedObjects(instances);
    }

    this._cache = instances;
    this._isFetched = true;
    return this;
  }

  /**
   * Load related objects for selectRelated fields
   */
  private async _loadRelatedObjects(instances: T[]): Promise<void> {
    const backend = this._getBackend();

    for (const relation of this._state.selectRelated) {
      // Collect all foreign key IDs for this relation
      const ids = new Set<unknown>();
      const fieldsByInstance = new Map<T, ForeignKey<Model>>();

      for (const instance of instances) {
        // deno-lint-ignore no-explicit-any
        const field = (instance as any)[relation];
        if (field instanceof ForeignKey) {
          const fkId = field.id;
          if (fkId !== null && fkId !== undefined) {
            ids.add(fkId);
          }
          fieldsByInstance.set(instance, field);
        }
      }

      if (ids.size === 0) continue;

      // Get the related model class from the first ForeignKey field
      const firstField = fieldsByInstance.values().next().value;
      if (!firstField) continue;

      const relatedModelClass = firstField.getRelatedModel();
      if (!relatedModelClass) continue;

      // Fetch all related objects in one query
      const relatedData = await backend.execute({
        model: relatedModelClass,
        filters: [
          { field: "id", lookup: "in", value: Array.from(ids), negated: false },
        ],
        ordering: [],
        limit: null,
        offset: null,
        distinctFields: [],
        selectRelated: [],
        prefetchRelated: [],
        annotations: {},
        selectFields: [],
        deferFields: [],
        reversed: false,
      });

      // Create a map of ID to related instance
      const relatedMap = new Map<unknown, Model>();
      for (const data of relatedData) {
        const relatedInstance = new relatedModelClass();
        // deno-lint-ignore no-explicit-any
        (relatedInstance as any).fromDB(data);
        // deno-lint-ignore no-explicit-any
        (relatedInstance as any)._backend = backend;
        const pk = relatedInstance.pk;
        if (pk !== null && pk !== undefined) {
          relatedMap.set(pk, relatedInstance);
        }
      }

      // Set the related instances on each ForeignKey field
      for (const [instance, field] of fieldsByInstance) {
        const fkId = field.id;
        if (fkId !== null && fkId !== undefined) {
          const relatedInstance = relatedMap.get(fkId);
          if (relatedInstance) {
            // deno-lint-ignore no-explicit-any
            field.setRelatedInstance(relatedInstance as any);
          }
        }
      }
    }
  }

  /**
   * Get the loaded data as an array
   *
   * @throws Error if fetch() has not been called
   *
   * @example
   * ```ts
   * const projects = await Project.objects.filter({ active: true }).fetch();
   * const arr = projects.array(); // T[]
   * ```
   */
  array(): T[] {
    if (!this._isFetched) {
      throw new Error(
        "QuerySet not fetched. Call fetch() before array(). " +
          "If you want to get results directly, use: const arr = (await qs.fetch()).array()",
      );
    }
    return this._cache ?? [];
  }

  /**
   * Get a single object matching the conditions
   *
   * @throws DoesNotExist if no object matches
   * @throws MultipleObjectsReturned if more than one object matches
   */
  async get(conditions?: FilterConditions<T>): Promise<T> {
    let qs: QuerySet<T> = this;

    if (conditions) {
      qs = qs.filter(conditions);
    }

    // If already fetched, use in-memory data
    if (qs._isFetched && qs._cache !== null) {
      const results = qs._cache;
      if (results.length === 0) {
        throw new DoesNotExist(
          `${this._state.model.name} matching query does not exist.`,
        );
      }
      if (results.length > 1) {
        throw new MultipleObjectsReturned(
          `get() returned more than one ${this._state.model.name}.`,
        );
      }
      return results[0];
    }

    const limitedQs = await qs.limit(2).fetch();
    const results = limitedQs.array();

    if (results.length === 0) {
      throw new DoesNotExist(
        `${this._state.model.name} matching query does not exist.`,
      );
    }

    if (results.length > 1) {
      throw new MultipleObjectsReturned(
        `get() returned more than one ${this._state.model.name}.`,
      );
    }

    return results[0];
  }

  /**
   * Get the first object, or null if empty
   */
  async first(): Promise<T | null> {
    // If already fetched, use in-memory data
    if (this._isFetched && this._cache !== null) {
      return this._cache[0] ?? null;
    }

    const qs = this.limit(1);
    await qs.fetch();
    return qs.array()[0] ?? null;
  }

  /**
   * Get the last object, or null if empty
   */
  async last(): Promise<T | null> {
    // If already fetched, use in-memory data
    if (this._isFetched && this._cache !== null) {
      return this._cache[this._cache.length - 1] ?? null;
    }

    const qs = this.reverse().limit(1);
    await qs.fetch();
    return qs.array()[0] ?? null;
  }

  /**
   * Check if any objects exist
   */
  async exists(): Promise<boolean> {
    // If already fetched, use in-memory data
    if (this._isFetched && this._cache !== null) {
      return this._cache.length > 0;
    }

    const count = await this.limit(1).count();
    return count > 0;
  }

  /**
   * Get the count of objects
   *
   * If the QuerySet has been fetched, returns the length of the cached array.
   * Otherwise, executes a count query against the database.
   */
  async length(): Promise<number> {
    if (this._isFetched && this._cache !== null) {
      return this._cache.length;
    }
    return this.count();
  }

  // ============================================================================
  // Modification Methods
  // ============================================================================

  /**
   * Update all objects matching the query
   *
   * @returns Number of objects updated
   *
   * @example
   * ```ts
   * const count = await Article.objects
   *   .filter({ status: 'draft' })
   *   .update({ status: 'published' });
   * ```
   */
  async update(values: Partial<Record<string, unknown>>): Promise<number> {
    const backend = this._getBackend();
    return backend.updateMany(this._state, values);
  }

  /**
   * Delete all objects matching the query
   *
   * @returns Number of objects deleted
   *
   * @example
   * ```ts
   * const count = await Article.objects
   *   .filter({ status: 'trash' })
   *   .delete();
   * ```
   */
  async delete(): Promise<number> {
    const backend = this._getBackend();
    return backend.deleteMany(this._state);
  }

  // ============================================================================
  // Bulk Persistence
  // ============================================================================

  /**
   * Result of a save() operation
   */
  // Note: SaveResult interface is defined below the class

  /**
   * Save all loaded model instances to the backend
   *
   * For each object in the QuerySet:
   * - If object exists in target backend (by PK) → update
   * - If object doesn't exist → insert
   *
   * This enables a "unit of work" pattern and cross-backend sync:
   *
   * @example Basic usage - save modified objects
   * ```ts
   * const projects = await ProjectModel.objects
   *   .filter({ status: 'draft' })
   *   .fetch();
   *
   * // Modify multiple objects
   * for (const project of projects.array()) {
   *   project.status.set('published');
   * }
   *
   * // Save all changes
   * const result = await projects.save();
   * console.log(`Updated: ${result.updated}, Inserted: ${result.inserted}`);
   * ```
   *
   * @example Cross-backend sync
   * ```ts
   * // Fetch from REST API
   * const orgs = await OrganisationModel.objects
   *   .using('rest')
   *   .filter({ current: true })
   *   .fetch();
   *
   * // Save to IndexedDB (cache remote data locally)
   * await orgs.using('indexeddb').save();
   * ```
   *
   * @param options.force - Save all objects even if not modified (default: false)
   * @returns SaveResult with counts of inserted, updated, and failed objects
   */
  async save(options?: { force?: boolean }): Promise<SaveResult> {
    if (!this._isFetched || this._cache === null) {
      throw new Error(
        "QuerySet not fetched. Call fetch() before save(). " +
          "Example: const qs = await Model.objects.filter({...}).fetch(); await qs.save();",
      );
    }

    const backend = this._getBackend();
    const instances = this._cache;

    const result: SaveResult = {
      inserted: 0,
      updated: 0,
      failed: 0,
      total: instances.length,
      errors: [],
    };

    for (const instance of instances) {
      try {
        const pk = instance.pk;

        if (pk !== null && pk !== undefined) {
          // Check if exists in target backend
          const exists = await backend.existsById(
            this._state.model,
            pk,
          );

          if (exists) {
            // Update existing record
            await backend.update(instance);
            result.updated++;
          } else {
            // Insert new record (preserving PK)
            await backend.insert(instance);
            result.inserted++;
          }
        } else {
          // No PK - insert as new record
          await backend.insert(instance);
          result.inserted++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          instance,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    return result;
  }

  // ============================================================================
  // Async Iterator
  // ============================================================================

  /**
   * Async iterator for streaming results
   *
   * @example
   * ```ts
   * for await (const article of Article.objects.all()) {
   *   console.log(article.title);
   * }
   * ```
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    await this.fetch();
    const results = this.array();
    for (const item of results) {
      yield item;
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Get the backend, throwing if not configured
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
      `No database backend configured for ${this._state.model.name}. ` +
        `Use .using(backend) or call setup() to configure a default backend.`,
    );
  }

  /**
   * Hydrate database data into a model instance
   */
  private _hydrate(data: Record<string, unknown>): T {
    const instance = new this._state.model();
    instance.fromDB(data);
    (instance as unknown as { _backend: DatabaseBackend })._backend = this
      ._backend!;
    return instance;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Create a copy of this QuerySet using a different backend
   *
   * Accepts either a backend instance or a string name (if registered via setup()).
   *
   * @example
   * ```ts
   * // With backend instance
   * const articles = await Article.objects.all().using(backend).fetch();
   *
   * // With named backend (requires setup() with databases config)
   * const cached = await Article.objects.all().using('indexeddb').fetch();
   * const fresh = await Article.objects.all().using('sync').fetch();
   * ```
   */
  using(backend: DatabaseBackend | string): QuerySet<T> {
    const qs = this._clone();

    if (typeof backend === "string") {
      const namedBackend = getBackendByName(backend);
      if (!namedBackend) {
        throw new Error(
          `Unknown database backend: '${backend}'. ` +
            `Make sure it's registered in setup({ databases: { ... } }).`,
        );
      }
      // deno-lint-ignore no-explicit-any
      (qs as any)._backend = namedBackend;
    } else {
      // deno-lint-ignore no-explicit-any
      (qs as any)._backend = backend;
    }

    return qs;
  }

  /**
   * Clear the result cache and reset fetched state
   */
  clearCache(): void {
    this._cache = null;
    this._isFetched = false;
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    const parts: string[] = [`QuerySet<${this._state.model.name}>`];

    if (this._state.filters.length > 0) {
      parts.push(`filters: ${this._state.filters.length}`);
    }

    if (this._state.ordering.length > 0) {
      parts.push(
        `ordering: ${
          this._state.ordering.map((o) =>
            (o.direction === "DESC" ? "-" : "") + o.field
          ).join(", ")
        }`,
      );
    }

    if (this._state.limit !== null) {
      parts.push(`limit: ${this._state.limit}`);
    }

    if (this._state.offset !== null) {
      parts.push(`offset: ${this._state.offset}`);
    }

    return parts.join(" | ");
  }
}

// ============================================================================
// SaveResult Type
// ============================================================================

/**
 * Result of a QuerySet save() operation
 */
export interface SaveResult {
  /** Number of records inserted (new records) */
  inserted: number;
  /** Number of records updated (existing records) */
  updated: number;
  /** Number of records that failed to save */
  failed: number;
  /** Total number of records processed */
  total: number;
  /** Details of any errors that occurred */
  errors: Array<{
    instance: Model;
    error: Error;
  }>;
}

// ============================================================================
// ValuesQuerySet
// ============================================================================

/**
 * QuerySet that returns plain objects instead of model instances
 */
export class ValuesQuerySet<T> implements AsyncIterable<T> {
  private _state: QueryState<Model>;
  private _backend?: DatabaseBackend;
  private _fields: string[];

  constructor(
    state: QueryState<Model>,
    backend: DatabaseBackend | undefined,
    fields: string[],
  ) {
    this._state = cloneQueryState(state);
    this._state.selectFields = fields;
    this._backend = backend;
    this._fields = fields;
  }

  /**
   * Execute the query and return results
   */
  async fetch(): Promise<T[]> {
    if (!this._backend) {
      throw new Error("No database backend configured.");
    }

    // deno-lint-ignore no-explicit-any
    const results = await this._backend.execute<any>(
      this._state,
    );

    // Return only requested fields
    return results.map((row) => {
      const obj: Record<string, unknown> = {};
      for (const field of this._fields) {
        obj[field] = row[field];
      }
      return obj as T;
    });
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    const results = await this.fetch();
    for (const item of results) {
      yield item;
    }
  }
}

// ============================================================================
// ValuesListQuerySet
// ============================================================================

/**
 * QuerySet that returns arrays of values instead of model instances
 */
export class ValuesListQuerySet<T> implements AsyncIterable<T[]> {
  private _state: QueryState<Model>;
  private _backend?: DatabaseBackend;
  private _fields: string[];

  constructor(
    state: QueryState<Model>,
    backend: DatabaseBackend | undefined,
    fields: string[],
  ) {
    this._state = cloneQueryState(state);
    this._state.selectFields = fields;
    this._backend = backend;
    this._fields = fields;
  }

  /**
   * Execute the query and return results
   */
  async fetch(): Promise<T[][]> {
    if (!this._backend) {
      throw new Error("No database backend configured.");
    }

    // deno-lint-ignore no-explicit-any
    const results = await this._backend.execute<any>(
      this._state,
    );

    // Return arrays of values in field order
    return results.map((row) => {
      return this._fields.map((field) => row[field] as T);
    });
  }

  /**
   * If only one field, return flat array
   */
  async flat(): Promise<T[]> {
    if (this._fields.length !== 1) {
      throw new Error("flat() can only be used with a single field");
    }

    const results = await this.fetch();
    return results.map((row) => row[0]);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T[]> {
    const results = await this.fetch();
    for (const item of results) {
      yield item;
    }
  }
}
