/**
 * PostgreSQL Backend Types
 *
 * Type definitions for the PostgreSQL database backend.
 *
 * @module
 */

import type { DatabaseConfig } from "../backend.ts";

/**
 * PostgreSQL-specific configuration
 *
 * Supports both connection string (DATABASE_URL) and individual parameters.
 * The npm:pg driver automatically reads PG* environment variables.
 */
export interface PostgresConfig extends DatabaseConfig {
  engine: "postgres";

  /**
   * Connection string (e.g., postgresql://user:pass@host:5432/dbname)
   * If provided, takes precedence over individual parameters.
   */
  connectionString?: string;

  /**
   * Database host (default: localhost or PGHOST env var)
   */
  host?: string;

  /**
   * Database port (default: 5432 or PGPORT env var)
   */
  port?: number;

  /**
   * Database user (default: PGUSER env var)
   */
  user?: string;

  /**
   * Database password (default: PGPASSWORD env var)
   */
  password?: string;

  /**
   * Database name (required, or PGDATABASE env var)
   */
  name: string;

  /**
   * SSL mode configuration
   * - false: No SSL
   * - true: Require SSL
   * - object: SSL options (rejectUnauthorized, ca, etc.)
   */
  ssl?: boolean | {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };

  /**
   * Connection pool settings
   */
  pool?: {
    /** Minimum number of connections (default: 0) */
    min?: number;
    /** Maximum number of connections (default: 10) */
    max?: number;
    /** Idle timeout in milliseconds (default: 10000) */
    idleTimeoutMillis?: number;
    /** Connection timeout in milliseconds (default: 0 = no timeout) */
    connectionTimeoutMillis?: number;
  };

  /**
   * Schema to use (default: public)
   */
  schema?: string;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Result from a PostgreSQL query
 */
export interface PostgresQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  fields: PostgresFieldInfo[];
}

/**
 * Field information from query result
 */
export interface PostgresFieldInfo {
  name: string;
  dataTypeID: number;
  tableID: number;
  columnID: number;
}

/**
 * PostgreSQL data type OIDs (common ones)
 */
export const PG_TYPES = {
  BOOL: 16,
  BYTEA: 17,
  INT8: 20,
  INT2: 21,
  INT4: 23,
  TEXT: 25,
  OID: 26,
  JSON: 114,
  FLOAT4: 700,
  FLOAT8: 701,
  VARCHAR: 1043,
  DATE: 1082,
  TIME: 1083,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
  NUMERIC: 1700,
  UUID: 2950,
  JSONB: 3802,
} as const;

/**
 * Map Alexi field types to PostgreSQL column types
 */
export const FIELD_TYPE_MAP: Record<string, string> = {
  AutoField: "SERIAL PRIMARY KEY",
  BigAutoField: "BIGSERIAL PRIMARY KEY",
  CharField: "VARCHAR",
  TextField: "TEXT",
  IntegerField: "INTEGER",
  BigIntegerField: "BIGINT",
  SmallIntegerField: "SMALLINT",
  PositiveIntegerField: "INTEGER CHECK ({column} >= 0)",
  PositiveBigIntegerField: "BIGINT CHECK ({column} >= 0)",
  PositiveSmallIntegerField: "SMALLINT CHECK ({column} >= 0)",
  FloatField: "DOUBLE PRECISION",
  DecimalField: "NUMERIC",
  BooleanField: "BOOLEAN",
  DateField: "DATE",
  DateTimeField: "TIMESTAMP WITH TIME ZONE",
  TimeField: "TIME",
  DurationField: "INTERVAL",
  UUIDField: "UUID",
  JSONField: "JSONB",
  BinaryField: "BYTEA",
  ForeignKey: "INTEGER REFERENCES {table}({column})",
  OneToOneField: "INTEGER UNIQUE REFERENCES {table}({column})",
  // EmailField, URLField, SlugField use CharField's VARCHAR
};

/**
 * Map PostgreSQL operators to SQL
 */
export const LOOKUP_OPERATORS: Record<string, string> = {
  exact: "= $%d",
  iexact: "ILIKE $%d",
  contains: "LIKE $%d",
  icontains: "ILIKE $%d",
  startswith: "LIKE $%d",
  istartswith: "ILIKE $%d",
  endswith: "LIKE $%d",
  iendswith: "ILIKE $%d",
  gt: "> $%d",
  gte: ">= $%d",
  lt: "< $%d",
  lte: "<= $%d",
  in: "= ANY($%d)",
  range: "BETWEEN $%d AND $%d",
  isnull: "IS NULL",
  regex: "~ $%d",
  iregex: "~* $%d",
};
