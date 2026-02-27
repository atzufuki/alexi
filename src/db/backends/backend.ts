/**
 * Abstract DatabaseBackend base class for Alexi ORM
 *
 * This module defines the interface that all database backends must implement.
 *
 * @module
 */

import type { Model } from "../models/model.ts";
import { ModelRegistry } from "../models/model.ts";
import { ForeignKey } from "../fields/relations.ts";
import type {
  Aggregations,
  CompiledQuery,
  LookupType,
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
   * Get a nested value from an object using double-underscore notation
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

  // ============================================================================
  // Nested Lookup Resolution (for NoSQL backends)
  // ============================================================================

  /**
   * Check if a filter field contains a nested lookup (FK chain)
   *
   * A nested lookup is a field like "projectRole__project" where:
   * - "projectRole" is a ForeignKey field on the current model
   * - "project" is a field on the related model (or another FK for deeper nesting)
   *
   * @param modelClass - The model class to check against
   * @param field - The filter field string (e.g., "projectRole__project")
   * @returns True if this is a nested FK lookup
   */
  protected isNestedForeignKeyLookup<T extends Model>(
    modelClass: new () => T,
    field: string,
  ): boolean {
    if (!field.includes("__")) {
      return false;
    }

    const parts = field.split("__");
    const firstPart = parts[0];

    // Check if the first part is a ForeignKey field
    const instance = new modelClass();
    const fields = instance.getFields();
    const fieldObj = fields[firstPart];

    return fieldObj instanceof ForeignKey;
  }

  /**
   * Parse a nested FK lookup into its components
   *
   * @param field - The filter field (e.g., "projectRole__project__id")
   * @returns Object with fkFieldName, remainingPath, and finalField
   */
  protected parseNestedLookup(field: string): {
    fkFieldName: string;
    remainingPath: string;
    finalField: string;
  } {
    const parts = field.split("__");
    const fkFieldName = parts[0];
    const remainingPath = parts.slice(1).join("__");
    const finalField = parts[parts.length - 1];

    return { fkFieldName, remainingPath, finalField };
  }

  /**
   * Resolve nested FK lookups in filters by fetching related IDs
   *
   * This transforms filters like `{ projectRole__project: 123 }` into
   * `{ projectRole: [1, 2, 3] }` where [1,2,3] are the projectRole IDs
   * that match the condition.
   *
   * @param modelClass - The model class for the query
   * @param filters - Original filters that may contain nested lookups
   * @returns Resolved filters with nested lookups replaced by ID-based filters
   */
  protected async resolveNestedFilters<T extends Model>(
    modelClass: new () => T,
    filters: ParsedFilter[],
  ): Promise<ParsedFilter[]> {
    const resolvedFilters: ParsedFilter[] = [];

    for (const filter of filters) {
      if (this.isNestedForeignKeyLookup(modelClass, filter.field)) {
        // Resolve the nested lookup
        const resolved = await this.resolveNestedForeignKeyFilter(
          modelClass,
          filter,
        );
        if (resolved) {
          resolvedFilters.push(resolved);
        } else {
          // No matching IDs found - add impossible filter
          resolvedFilters.push({
            field: filter.field.split("__")[0],
            lookup: "in",
            value: [],
            negated: filter.negated,
          });
        }
      } else {
        // Regular filter, keep as-is
        resolvedFilters.push(filter);
      }
    }

    return resolvedFilters;
  }

  /**
   * Resolve a single nested FK filter by traversing the FK chain
   *
   * For a filter like `{ projectRole__project: 123 }`:
   * 1. Find the ForeignKey field "projectRole" and its related model
   * 2. Query the related model for records where "project" = 123
   * 3. Collect the IDs of matching related records
   * 4. Return a filter `{ projectRole__in: [matching_ids] }`
   *
   * @param modelClass - The model class for the query
   * @param filter - The nested filter to resolve
   * @returns Resolved filter or null if no matches
   */
  protected async resolveNestedForeignKeyFilter<T extends Model>(
    modelClass: new () => T,
    filter: ParsedFilter,
  ): Promise<ParsedFilter | null> {
    const { fkFieldName, remainingPath } = this.parseNestedLookup(filter.field);

    // Get the FK field and its related model
    const instance = new modelClass();
    const fields = instance.getFields();
    const fkField = fields[fkFieldName] as ForeignKey<Model>;

    if (!fkField) {
      throw new Error(
        `Field '${fkFieldName}' not found on model '${modelClass.name}'`,
      );
    }

    // Get the related model class
    let relatedModelClass = fkField.getRelatedModel();
    if (!relatedModelClass && typeof fkField.relatedModel === "string") {
      relatedModelClass = ModelRegistry.instance.get(fkField.relatedModel);
    }

    if (!relatedModelClass) {
      throw new Error(
        `Could not resolve related model for FK field '${fkFieldName}'`,
      );
    }

    // Determine if this is a simple lookup (e.g., "project") or deeper nesting
    const remainingParts = remainingPath.split("__").filter((p) => p);

    if (remainingParts.length === 1) {
      // Simple case: projectRole__project = 123
      // Query related model for records where `project` = 123
      // and collect their IDs
      const targetField = remainingParts[0];
      const matchingIds = await this.fetchMatchingForeignKeyIds(
        relatedModelClass,
        targetField,
        filter.lookup,
        filter.value,
      );

      if (matchingIds.length === 0) {
        return null;
      }

      // Get the column name for the FK field (e.g., projectRole -> projectRole_id)
      const fkColumnName = fkField.getColumnName();

      return {
        field: fkColumnName,
        lookup: "in",
        value: matchingIds,
        negated: filter.negated,
      };
    } else {
      // Deeper nesting: projectRole__project__organisation = 123
      // Recursively resolve the next level
      const nestedFilter: ParsedFilter = {
        field: remainingPath,
        lookup: filter.lookup,
        value: filter.value,
        negated: false, // Handle negation at the top level
      };

      // Recursively resolve on the related model
      const resolvedNestedFilters = await this.resolveNestedFilters(
        relatedModelClass as new () => Model,
        [nestedFilter],
      );

      if (resolvedNestedFilters.length === 0) {
        return null;
      }

      // Now fetch IDs from the related model that match the resolved filter
      const matchingIds = await this.fetchIdsMatchingFilters(
        relatedModelClass,
        resolvedNestedFilters,
      );

      if (matchingIds.length === 0) {
        return null;
      }

      // Get the column name for the FK field (e.g., projectRole -> projectRole_id)
      const fkColumnName = fkField.getColumnName();

      return {
        field: fkColumnName,
        lookup: "in",
        value: matchingIds,
        negated: filter.negated,
      };
    }
  }

  /**
   * Fetch IDs from a related model where a field matches a condition
   *
   * @param modelClass - The related model class
   * @param targetField - The field to filter on (field name, not column name)
   * @param lookup - The lookup type
   * @param value - The value to match
   * @returns Array of matching primary key values
   */
  protected async fetchMatchingForeignKeyIds<T extends Model>(
    modelClass: new () => T,
    targetField: string,
    lookup: LookupType,
    value: unknown,
  ): Promise<unknown[]> {
    const instance = new modelClass();
    const tableName = instance.getTableName();

    // Translate field name to column name (handles ForeignKey -> _id suffix)
    const columnName = this.getColumnNameForField(instance, targetField);

    // Create a minimal query state for the related model
    const filter: ParsedFilter = {
      field: columnName,
      lookup,
      value,
      negated: false,
    };

    // Use the backend's own execute method with a simple filter
    const records = await this.executeSimpleFilter(tableName, [filter]);

    // Extract primary keys
    const pkField = instance.getPrimaryKeyField();
    const pkName = pkField?.name ?? "id";

    return records.map((r) => r[pkName]);
  }

  /**
   * Get the column name for a field (handles ForeignKey translation)
   *
   * For ForeignKey fields, this returns the column name (e.g., "project_id")
   * instead of the field name (e.g., "project").
   *
   * @param instance - A model instance to get fields from
   * @param fieldName - The field name to translate
   * @returns The database column name
   */
  protected getColumnNameForField<T extends Model>(
    instance: T,
    fieldName: string,
  ): string {
    const fields = instance.getFields();
    const field = fields[fieldName];

    if (field instanceof ForeignKey) {
      return field.getColumnName();
    }

    return fieldName;
  }

  /**
   * Fetch IDs from a model that match a set of filters
   *
   * @param modelClass - The model class
   * @param filters - Filters to apply
   * @returns Array of matching primary key values
   */
  protected async fetchIdsMatchingFilters<T extends Model>(
    modelClass: new () => T,
    filters: ParsedFilter[],
  ): Promise<unknown[]> {
    const instance = new modelClass();
    const tableName = instance.getTableName();

    const records = await this.executeSimpleFilter(tableName, filters);

    const pkField = instance.getPrimaryKeyField();
    const pkName = pkField?.name ?? "id";

    return records.map((r) => r[pkName]);
  }

  /**
   * Execute a simple filter query on a table
   *
   * This is an abstract method that NoSQL backends should implement
   * to support nested lookup resolution. It performs a basic filter
   * operation without the full QueryState machinery.
   *
   * @param tableName - The table/collection name
   * @param filters - Filters to apply
   * @returns Matching records
   */
  protected abstract executeSimpleFilter(
    tableName: string,
    filters: ParsedFilter[],
  ): Promise<Record<string, unknown>[]>;

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
        return (
          Array.isArray(compareValue) &&
          compareValue.some((v) => String(v) === String(fieldValue))
        );

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
