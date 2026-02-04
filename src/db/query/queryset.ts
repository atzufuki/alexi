/**
 * QuerySet class for Alexi ORM
 *
 * QuerySet represents a lazy database query that can be filtered, ordered,
 * and executed. QuerySets are immutable - each operation returns a new QuerySet.
 *
 * @module
 */

import type { Model } from "../models/model.ts";
import type { DatabaseBackend } from "../backends/backend.ts";
import { DoesNotExist, MultipleObjectsReturned } from "../models/manager.ts";
import { getBackend, isInitialized } from "../setup.ts";
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
  ): QuerySet<T> {
    const qs = new QuerySet<T>(state.model, backend);
    qs._state = state;
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
    return QuerySet._fromState(newState, this._backend);
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
   * Filter the QuerySet by the given conditions
   *
   * @example
   * ```ts
   * qs.filter({ name: 'John' })
   * qs.filter({ age__gte: 18 })
   * qs.filter({ author__name__contains: 'Smith' })
   * ```
   */
  filter(conditions: FilterConditions<T> | Q<T>): QuerySet<T> {
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
   * Return the count of objects
   */
  async count(): Promise<number> {
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
   * Execute the query and return all results
   */
  async fetch(): Promise<T[]> {
    if (this._cache !== null) {
      return this._cache;
    }

    const backend = this._getBackend();
    const results = await backend.execute<T>(this._state);

    // Hydrate results into model instances
    const instances = results.map((data) => this._hydrate(data));

    this._cache = instances;
    return instances;
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

    const results = await qs.limit(2).fetch();

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
    const results = await this.limit(1).fetch();
    return results[0] ?? null;
  }

  /**
   * Get the last object, or null if empty
   */
  async last(): Promise<T | null> {
    const results = await this.reverse().limit(1).fetch();
    return results[0] ?? null;
  }

  /**
   * Check if any objects exist
   */
  async exists(): Promise<boolean> {
    const count = await this.limit(1).count();
    return count > 0;
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
    const results = await this.fetch();
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
   */
  using(backend: DatabaseBackend): QuerySet<T> {
    const qs = this._clone();
    // deno-lint-ignore no-explicit-any
    (qs as any)._backend = backend;
    return qs;
  }

  /**
   * Clear the result cache
   */
  clearCache(): void {
    this._cache = null;
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
