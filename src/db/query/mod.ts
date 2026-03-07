/**
 * Query module for Alexi ORM
 *
 * This module exports query-related classes and utilities.
 *
 * @module
 */

export { Model } from "../models/model.ts";
export { Field } from "../fields/field.ts";
export { RelatedManager } from "../fields/relations.ts";
export { DatabaseBackend } from "../backends/backend.ts";
export type { ModelOperationOptions } from "../models/model.ts";
export type { FieldOptions } from "../fields/field.ts";
export type { ModelClass } from "../fields/relations.ts";
export type {
  DatabaseConfig,
  SchemaEditor,
  Transaction,
} from "../backends/backend.ts";

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
  AggregateFunction,
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
export type { SaveResult } from "./queryset.ts";
