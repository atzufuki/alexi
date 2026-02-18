/**
 * PostgreSQL Backend module for Alexi ORM
 *
 * This module exports the PostgreSQL database backend implementation.
 *
 * @module
 */

export { PostgresBackend } from "./backend.ts";
export type { PostgresConfig } from "./types.ts";
export { PostgresSchemaEditor } from "./schema_editor.ts";
export {
  escapeLikePattern,
  fromPostgresValue,
  PostgresQueryBuilder,
  toPostgresValue,
} from "./query_builder.ts";
export { FIELD_TYPE_MAP, LOOKUP_OPERATORS, PG_TYPES } from "./types.ts";
