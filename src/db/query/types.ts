/**
 * Query types and interfaces for Alexi ORM
 * @module
 */

import type { Model } from "../models/model.ts";

// ============================================================================
// Lookup Types
// ============================================================================

/**
 * Available lookup types for filtering
 */
export type LookupType =
  | "exact" // Exact match (default)
  | "iexact" // Case-insensitive exact match
  | "contains" // Contains substring
  | "icontains" // Case-insensitive contains
  | "startswith" // Starts with
  | "istartswith" // Case-insensitive starts with
  | "endswith" // Ends with
  | "iendswith" // Case-insensitive ends with
  | "in" // Value is in list
  | "gt" // Greater than
  | "gte" // Greater than or equal
  | "lt" // Less than
  | "lte" // Less than or equal
  | "range" // Between two values [min, max]
  | "isnull" // Is null (boolean)
  | "regex" // Regular expression match
  | "iregex" // Case-insensitive regex
  | "date" // Date part of datetime
  | "year" // Year of date
  | "month" // Month of date
  | "day" // Day of date
  | "week" // Week of year
  | "weekday"; // Day of week

// ============================================================================
// Filter Conditions
// ============================================================================

/**
 * Helper type to extract field names from a model
 */
export type FieldNames<T extends Model> = {
  [K in keyof T]: T[K] extends { get: () => unknown } ? K : never;
}[keyof T];

/**
 * Filter condition key format: fieldName or fieldName__lookup
 */
export type FilterKey<T extends Model> =
  | FieldNames<T>
  | `${FieldNames<T> & string}__${LookupType}`
  | `${string}__${string}`; // For related field lookups like "author__name"

/**
 * Filter conditions object
 *
 * @example
 * ```ts
 * {
 *   name: 'John',                    // exact match
 *   name__contains: 'oh',            // contains
 *   age__gte: 18,                    // greater than or equal
 *   created_at__year: 2024,          // year lookup
 *   author__name: 'Jane',            // related field lookup
 * }
 * ```
 */
export type FilterConditions<T extends Model> = {
  [key: string]: unknown;
};

/**
 * Parsed filter condition
 */
export interface ParsedFilter {
  /** The field name (may include relation path) */
  field: string;
  /** The lookup type */
  lookup: LookupType;
  /** The value to compare against */
  value: unknown;
  /** Whether this is a negated condition */
  negated: boolean;
}

// ============================================================================
// Ordering
// ============================================================================

/**
 * Order by field specification
 * Prefix with '-' for descending order
 *
 * @example
 * ```ts
 * 'name'       // ascending
 * '-created_at' // descending
 * ```
 */
export type OrderByField<T extends Model> = string;

/**
 * Parsed ordering specification
 */
export interface ParsedOrdering {
  /** The field name */
  field: string;
  /** Sort direction */
  direction: "ASC" | "DESC";
}

// ============================================================================
// Aggregation
// ============================================================================

/**
 * Aggregation function types
 */
export type AggregateFunction = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

/**
 * Aggregation definition
 */
export interface Aggregation {
  /** The aggregation function */
  func: AggregateFunction;
  /** The field to aggregate (use '*' for COUNT) */
  field: string;
  /** Optional alias for the result */
  alias?: string;
  /** Whether to use DISTINCT */
  distinct?: boolean;
}

/**
 * Aggregation factory functions
 */
export function Count(field: string = "*", distinct = false): Aggregation {
  return { func: "COUNT", field, distinct };
}

export function Sum(field: string): Aggregation {
  return { func: "SUM", field };
}

export function Avg(field: string): Aggregation {
  return { func: "AVG", field };
}

export function Min(field: string): Aggregation {
  return { func: "MIN", field };
}

export function Max(field: string): Aggregation {
  return { func: "MAX", field };
}

/**
 * Aggregations object for aggregate() method
 */
export type Aggregations = Record<string, Aggregation>;

// ============================================================================
// Annotations
// ============================================================================

/**
 * Annotation definition (computed field added to query results)
 */
export type Annotations = Record<string, Aggregation>;

// ============================================================================
// Query State
// ============================================================================

/**
 * Internal query state representation
 */
export interface QueryState<T extends Model> {
  /** Model class being queried */
  model: new () => T;
  /** Filter conditions */
  filters: ParsedFilter[];
  /** Ordering specifications */
  ordering: ParsedOrdering[];
  /** Fields to select (empty = all) */
  selectFields: string[];
  /** Fields to defer loading */
  deferFields: string[];
  /** Relations to eagerly load (JOIN) */
  selectRelated: string[];
  /** Relations to prefetch (separate queries) */
  prefetchRelated: string[];
  /** Annotations to add */
  annotations: Annotations;
  /** DISTINCT clause fields (empty = no distinct) */
  distinctFields: string[];
  /** LIMIT value */
  limit: number | null;
  /** OFFSET value */
  offset: number | null;
  /** Whether to reverse the ordering */
  reversed: boolean;
}

/**
 * Create a new empty query state
 */
export function createQueryState<T extends Model>(
  model: new () => T,
): QueryState<T> {
  return {
    model,
    filters: [],
    ordering: [],
    selectFields: [],
    deferFields: [],
    selectRelated: [],
    prefetchRelated: [],
    annotations: {},
    distinctFields: [],
    limit: null,
    offset: null,
    reversed: false,
  };
}

/**
 * Clone a query state
 */
export function cloneQueryState<T extends Model>(
  state: QueryState<T>,
): QueryState<T> {
  return {
    model: state.model,
    filters: [...state.filters],
    ordering: [...state.ordering],
    selectFields: [...state.selectFields],
    deferFields: [...state.deferFields],
    selectRelated: [...state.selectRelated],
    prefetchRelated: [...state.prefetchRelated],
    annotations: { ...state.annotations },
    distinctFields: [...state.distinctFields],
    limit: state.limit,
    offset: state.offset,
    reversed: state.reversed,
  };
}

// ============================================================================
// Compiled Query
// ============================================================================

/**
 * Compiled query ready for execution
 */
export interface CompiledQuery {
  /** SQL query string (for SQL backends) */
  sql?: string;
  /** Operation descriptor (for NoSQL backends) */
  operation?: QueryOperation;
  /** Query parameters */
  params: unknown[];
}

/**
 * Query operation for NoSQL backends
 */
export interface QueryOperation {
  /** Type of operation */
  type: "select" | "insert" | "update" | "delete" | "count";
  /** Table/store name */
  table: string;
  /** Filter conditions */
  filters: ParsedFilter[];
  /** Ordering */
  ordering: ParsedOrdering[];
  /** Fields to return */
  fields: string[];
  /** Limit */
  limit: number | null;
  /** Offset */
  offset: number | null;
  /** Data for insert/update */
  data?: Record<string, unknown>;
  /** Whether this is a bulk operation */
  bulk?: boolean;
}
