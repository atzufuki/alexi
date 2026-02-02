/**
 * Query module for Alexi ORM
 *
 * This module exports query-related classes and utilities.
 *
 * @module
 */

// Query types and interfaces
export {
  Avg,
  cloneQueryState,
  Count,
  createQueryState,
  Max,
  Min,
  Sum,
} from "./types.ts";

export type {
  Aggregation,
  Aggregations,
  Annotations,
  CompiledQuery,
  FilterConditions,
  LookupType,
  OrderByField,
  ParsedFilter,
  ParsedOrdering,
  QueryOperation,
  QueryState,
} from "./types.ts";

// Q object for complex queries
export { andQ, orQ, Q, q } from "./q.ts";
export type { QConnector, ResolvedQ } from "./q.ts";

// QuerySet classes
export { QuerySet, ValuesListQuerySet, ValuesQuerySet } from "./queryset.ts";
