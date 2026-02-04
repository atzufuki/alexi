/**
 * Abstract DatabaseBackend base class for Alexi ORM
 *
 * This module defines the interface that all database backends must implement.
 *
 * @module
 */

import type { Model } from "../models/model.ts";
import type {
  Aggregations,
  CompiledQuery,
  ParsedFilter,
  QueryState,
} from "../query/types.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  /** Database engine identifier */
  engine: string;
  /** Database name or path */
  name: string;
  /** Host for network databases */
  host?: string;
  /** Port for network databases */
  port?: number;
  /** Username for authentication */
  user?: string;
  /** Password for authentication */
  password?: string;
  /** Additional backend-specific options */
  options?: Record<string, unknown>;
}

/**
 * Transaction interface
 */
export interface Transaction {
  /** Commit the transaction */
  commit(): Promise<void>;
  /** Rollback the transaction */
  rollback(): Promise<void>;
  /** Whether the transaction is active */
  isActive: boolean;
}

/**
 * Schema editor interface for database migrations
 */
export interface SchemaEditor {
  /** Create a table for a model */
  createTable(model: typeof Model): Promise<void>;
  /** Drop a table for a model */
  dropTable(model: typeof Model): Promise<void>;
  /** Add a field to an existing table */
  addField(model: typeof Model, fieldName: string): Promise<void>;
  /** Remove a field from a table */
  removeField(model: typeof Model, fieldName: string): Promise<void>;
  /** Create an index */
  createIndex(
    model: typeof Model,
    fields: string[],
    options?: { name?: string; unique?: boolean },
  ): Promise<void>;
  /** Drop an index */
  dropIndex(model: typeof Model, indexName: string): Promise<void>;
}

// ============================================================================
// Abstract Backend Class
// ============================================================================

/**
 * Abstract base class for database backends
 *
 * All database backends must extend this class and implement its abstract methods.
 *
 * @example
 * ```ts
 * class PostgreSQLBackend extends DatabaseBackend {
 *   async connect(): Promise<void> {
 *     // Connect to PostgreSQL
 *   }
 *   // ... implement other methods
 * }
 * ```
 */
export abstract class DatabaseBackend {
  protected _config: DatabaseConfig;
  protected _connected = false;

  constructor(config: DatabaseConfig) {
    this._config = config;
  }

  /**
   * Get the configuration
   */
  get config(): DatabaseConfig {
    return this._config;
  }

  /**
   * Check if connected to the database
   */
  get isConnected(): boolean {
    return this._connected;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to the database
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  abstract disconnect(): Promise<void>;

  /**
   * Ensure the backend is connected, throwing if not
   */
  protected ensureConnected(): void {
    if (!this._connected) {
      throw new Error(
        `Database backend '${this._config.engine}' is not connected. ` +
          `Call connect() first.`,
      );
    }
  }

  // ============================================================================
  // Query Execution
  // ============================================================================

  /**
   * Execute a query and return results
   */
  abstract execute<T extends Model>(
    state: QueryState<T>,
  ): Promise<Record<string, unknown>[]>;

  /**
   * Execute a raw query (for SQL backends)
   */
  abstract executeRaw<R = unknown>(
    query: string,
    params?: unknown[],
  ): Promise<R[]>;

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Insert a new record
   */
  abstract insert<T extends Model>(
    instance: T,
  ): Promise<Record<string, unknown>>;

  /**
   * Update an existing record
   */
  abstract update<T extends Model>(instance: T): Promise<void>;

  /**
   * Delete a record
   */
  abstract delete<T extends Model>(instance: T): Promise<void>;

  /**
   * Delete a record by table name and primary key
   */
  abstract deleteById(tableName: string, id: unknown): Promise<void>;

  /**
   * Get a record by ID directly
   *
   * @param model - The model class
   * @param id - The primary key value
   * @returns The record data or null if not found
   */
  abstract getById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<Record<string, unknown> | null>;

  /**
   * Check if a record exists by ID
   *
   * @param model - The model class
   * @param id - The primary key value
   * @returns True if the record exists
   */
  abstract existsById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<boolean>;

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Insert multiple records
   */
  abstract bulkInsert<T extends Model>(
    instances: T[],
  ): Promise<Record<string, unknown>[]>;

  /**
   * Update multiple records
   */
  abstract bulkUpdate<T extends Model>(
    instances: T[],
    fields: string[],
  ): Promise<number>;

  /**
   * Update records matching a query
   */
  abstract updateMany<T extends Model>(
    state: QueryState<T>,
    values: Record<string, unknown>,
  ): Promise<number>;

  /**
   * Delete records matching a query
   */
  abstract deleteMany<T extends Model>(state: QueryState<T>): Promise<number>;

  // ============================================================================
  // Aggregation
  // ============================================================================

  /**
   * Count records matching a query
   */
  abstract count<T extends Model>(state: QueryState<T>): Promise<number>;

  /**
   * Perform aggregations on a query
   */
  abstract aggregate<T extends Model>(
    state: QueryState<T>,
    aggregations: Aggregations,
  ): Promise<Record<string, number>>;

  // ============================================================================
  // Transactions
  // ============================================================================

  /**
   * Begin a new transaction
   */
  abstract beginTransaction(): Promise<Transaction>;

  /**
   * Execute a function within a transaction
   * Automatically commits on success, rolls back on error
   */
  async atomic<R>(fn: () => Promise<R>): Promise<R> {
    const transaction = await this.beginTransaction();

    try {
      const result = await fn();
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // ============================================================================
  // Schema Operations
  // ============================================================================

  /**
   * Get a schema editor for this backend
   */
  abstract getSchemaEditor(): SchemaEditor;

  /**
   * Check if a table exists
   */
  abstract tableExists(tableName: string): Promise<boolean>;

  // ============================================================================
  // Query Compilation
  // ============================================================================

  /**
   * Compile a query state into a backend-specific format
   */
  abstract compile<T extends Model>(state: QueryState<T>): CompiledQuery;

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Apply filter conditions to check if a record matches
   * Used by NoSQL backends that filter in memory
   */
  protected matchesFilters(
    record: Record<string, unknown>,
    filters: ParsedFilter[],
  ): boolean {
    for (const filter of filters) {
      const fieldValue = this.getNestedValue(record, filter.field);
      const matches = this.evaluateLookup(
        fieldValue,
        filter.lookup,
        filter.value,
      );

      // If filter is negated, invert the match result
      const result = filter.negated ? !matches : matches;

      if (!result) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get a nested value from an object using dot notation
   */
  protected getNestedValue(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split("__");
    let value: unknown = obj;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  }

  /**
   * Evaluate a lookup operation
   */
  protected evaluateLookup(
    fieldValue: unknown,
    lookup: string,
    compareValue: unknown,
  ): boolean {
    switch (lookup) {
      case "exact":
        return fieldValue === compareValue;

      case "iexact":
        return String(fieldValue).toLowerCase() ===
          String(compareValue).toLowerCase();

      case "contains":
        return String(fieldValue).includes(String(compareValue));

      case "icontains":
        return String(fieldValue).toLowerCase().includes(
          String(compareValue).toLowerCase(),
        );

      case "startswith":
        return String(fieldValue).startsWith(String(compareValue));

      case "istartswith":
        return String(fieldValue).toLowerCase().startsWith(
          String(compareValue).toLowerCase(),
        );

      case "endswith":
        return String(fieldValue).endsWith(String(compareValue));

      case "iendswith":
        return String(fieldValue).toLowerCase().endsWith(
          String(compareValue).toLowerCase(),
        );

      case "in":
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);

      case "gt":
        return (fieldValue as number) > (compareValue as number);

      case "gte":
        return (fieldValue as number) >= (compareValue as number);

      case "lt":
        return (fieldValue as number) < (compareValue as number);

      case "lte":
        return (fieldValue as number) <= (compareValue as number);

      case "range": {
        const [min, max] = compareValue as [number, number];
        const val = fieldValue as number;
        return val >= min && val <= max;
      }

      case "isnull":
        return (fieldValue === null || fieldValue === undefined) ===
          compareValue;

      case "regex":
        return new RegExp(String(compareValue)).test(String(fieldValue));

      case "iregex":
        return new RegExp(String(compareValue), "i").test(String(fieldValue));

      case "year":
        return fieldValue instanceof Date &&
          fieldValue.getFullYear() === compareValue;

      case "month":
        return fieldValue instanceof Date &&
          fieldValue.getMonth() + 1 === compareValue;

      case "day":
        return fieldValue instanceof Date &&
          fieldValue.getDate() === compareValue;

      case "week": {
        if (!(fieldValue instanceof Date)) return false;
        const startOfYear = new Date(fieldValue.getFullYear(), 0, 1);
        const days = Math.floor(
          (fieldValue.getTime() - startOfYear.getTime()) /
            (24 * 60 * 60 * 1000),
        );
        const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        return weekNumber === compareValue;
      }

      case "weekday":
        return fieldValue instanceof Date &&
          fieldValue.getDay() === compareValue;

      default:
        console.warn(`Unknown lookup type: ${lookup}`);
        return false;
    }
  }

  /**
   * Sort records by ordering specifications
   */
  protected sortRecords(
    records: Record<string, unknown>[],
    ordering: { field: string; direction: "ASC" | "DESC" }[],
  ): Record<string, unknown>[] {
    if (ordering.length === 0) {
      return records;
    }

    return [...records].sort((a, b) => {
      for (const { field, direction } of ordering) {
        const aValue = this.getNestedValue(a, field);
        const bValue = this.getNestedValue(b, field);

        let comparison = 0;

        if (aValue === bValue) {
          comparison = 0;
        } else if (aValue === null || aValue === undefined) {
          comparison = 1;
        } else if (bValue === null || bValue === undefined) {
          comparison = -1;
        } else if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          comparison = (aValue as number) - (bValue as number);
        }

        if (comparison !== 0) {
          return direction === "DESC" ? -comparison : comparison;
        }
      }

      return 0;
    });
  }

  /**
   * Apply limit and offset to records
   */
  protected applyLimitOffset(
    records: Record<string, unknown>[],
    limit: number | null,
    offset: number | null,
  ): Record<string, unknown>[] {
    let result = records;

    if (offset !== null && offset > 0) {
      result = result.slice(offset);
    }

    if (limit !== null && limit > 0) {
      result = result.slice(0, limit);
    }

    return result;
  }
}
