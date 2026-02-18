/**
 * PostgreSQL Database Backend for Alexi ORM
 *
 * Provides full SQL database support using the npm:pg driver.
 * Supports connection pooling, transactions, and Deno Deploy's managed PostgreSQL.
 *
 * @module
 */

import type { Model } from "../../models/model.ts";
import type {
  Aggregations,
  CompiledQuery,
  ParsedFilter,
  QueryState,
} from "../../query/types.ts";
import {
  DatabaseBackend,
  type SchemaEditor,
  type Transaction,
} from "../backend.ts";
import type { PostgresConfig } from "./types.ts";
import {
  fromPostgresValue,
  PostgresQueryBuilder,
  toPostgresValue,
} from "./query_builder.ts";
import { PostgresSchemaEditor } from "./schema_editor.ts";

// Import pg driver
import pg from "npm:pg@8";
const { Pool } = pg;
type Pool = InstanceType<typeof Pool>;
type PoolClient = Awaited<ReturnType<Pool["connect"]>>;

// ============================================================================
// PostgreSQL Transaction
// ============================================================================

/**
 * Transaction implementation for PostgreSQL
 */
class PostgresTransaction implements Transaction {
  private _client: PoolClient;
  private _active = true;

  constructor(client: PoolClient) {
    this._client = client;
  }

  get isActive(): boolean {
    return this._active;
  }

  get client(): PoolClient {
    return this._client;
  }

  async commit(): Promise<void> {
    if (!this._active) {
      throw new Error("Transaction is no longer active");
    }

    try {
      await this._client.query("COMMIT");
    } finally {
      this._active = false;
      this._client.release();
    }
  }

  async rollback(): Promise<void> {
    if (!this._active) {
      throw new Error("Transaction is no longer active");
    }

    try {
      await this._client.query("ROLLBACK");
    } finally {
      this._active = false;
      this._client.release();
    }
  }
}

// ============================================================================
// PostgreSQL Backend
// ============================================================================

/**
 * PostgreSQL database backend
 *
 * Uses connection pooling via npm:pg for optimal performance.
 * Supports both connection strings and individual connection parameters.
 *
 * @example
 * ```ts
 * // Using connection string
 * const backend = new PostgresBackend({
 *   engine: 'postgres',
 *   name: 'mydb',
 *   connectionString: 'postgresql://user:pass@localhost:5432/mydb'
 * });
 *
 * // Using individual parameters
 * const backend = new PostgresBackend({
 *   engine: 'postgres',
 *   name: 'mydb',
 *   host: 'localhost',
 *   port: 5432,
 *   user: 'myuser',
 *   password: 'mypass'
 * });
 *
 * await backend.connect();
 *
 * // Use with models
 * const articles = await Article.objects.using(backend).all().fetch();
 * ```
 */
export class PostgresBackend extends DatabaseBackend {
  private _pool: Pool | null = null;
  private _schema: string;
  private _debug: boolean;

  constructor(config: PostgresConfig) {
    super({
      engine: "postgres",
      name: config.name,
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      options: {
        connectionString: config.connectionString,
        ssl: config.ssl,
        pool: config.pool,
        schema: config.schema,
      },
    });
    this._schema = config.schema ?? "public";
    this._debug = config.debug ?? false;
  }

  /**
   * Get the connection pool
   */
  get pool(): Pool {
    if (!this._pool) {
      throw new Error("PostgreSQL backend is not connected");
    }
    return this._pool;
  }

  /**
   * Get the schema name
   */
  get schema(): string {
    return this._schema;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    if (this._connected) {
      return;
    }

    const config = this._config;
    const options = config.options as {
      connectionString?: string;
      ssl?: boolean | object;
      pool?: {
        min?: number;
        max?: number;
        idleTimeoutMillis?: number;
        connectionTimeoutMillis?: number;
      };
    };

    // Build pool configuration
    const poolConfig: Record<string, unknown> = {};

    // Use connection string if provided
    if (options?.connectionString) {
      poolConfig.connectionString = options.connectionString;
    } else {
      // Use individual parameters
      poolConfig.host = config.host ?? "localhost";
      poolConfig.port = config.port ?? 5432;
      poolConfig.user = config.user;
      poolConfig.password = config.password;
      poolConfig.database = config.name;
    }

    // SSL configuration
    if (options?.ssl !== undefined) {
      poolConfig.ssl = options.ssl;
    }

    // Pool settings
    if (options?.pool) {
      poolConfig.min = options.pool.min ?? 0;
      poolConfig.max = options.pool.max ?? 10;
      poolConfig.idleTimeoutMillis = options.pool.idleTimeoutMillis ?? 10000;
      poolConfig.connectionTimeoutMillis =
        options.pool.connectionTimeoutMillis ?? 0;
    }

    this._pool = new Pool(poolConfig);

    // Test connection
    const client = await this._pool.connect();
    try {
      // Set search path to specified schema
      await client.query(`SET search_path TO "${this._schema}"`);
    } finally {
      client.release();
    }

    this._connected = true;

    if (this._debug) {
      console.log(`[PostgresBackend] Connected to ${config.name}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this._pool) {
      await this._pool.end();
      this._pool = null;
    }
    this._connected = false;

    if (this._debug) {
      console.log("[PostgresBackend] Disconnected");
    }
  }

  // ============================================================================
  // Query Execution
  // ============================================================================

  async execute<T extends Model>(
    state: QueryState<T>,
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();

    const builder = new PostgresQueryBuilder(state, this._schema);
    const compiled = builder.buildSelect();

    if (this._debug) {
      console.log("[PostgresBackend] Execute:", compiled.sql, compiled.params);
    }

    const result = await this._pool!.query(compiled.sql!, compiled.params);
    return result.rows.map((row: Record<string, unknown>) =>
      this.processRow(row, state.model)
    );
  }

  async executeRaw<R = unknown>(
    query: string,
    params?: unknown[],
  ): Promise<R[]> {
    this.ensureConnected();

    if (this._debug) {
      console.log("[PostgresBackend] ExecuteRaw:", query, params);
    }

    const result = await this._pool!.query(query, params ?? []);
    return result.rows as R[];
  }

  /**
   * Process a database row, converting types as needed
   */
  private processRow<T extends Model>(
    row: Record<string, unknown>,
    model: new () => T,
  ): Record<string, unknown> {
    const instance = new model();
    const fields = instance.getFields();
    const processed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      // Get field type if known
      const field = fields[key];
      const fieldType = field?.constructor?.name;
      processed[key] = fromPostgresValue(value, fieldType);
    }

    return processed;
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  async insert<T extends Model>(
    instance: T,
  ): Promise<Record<string, unknown>> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    const data = this.prepareData(instance.toDB());

    // Remove null id to let PostgreSQL generate it
    if (data.id === null || data.id === undefined) {
      delete data.id;
    }

    const compiled = PostgresQueryBuilder.buildInsert(
      tableName,
      data,
      this._schema,
    );

    if (this._debug) {
      console.log("[PostgresBackend] Insert:", compiled.sql, compiled.params);
    }

    const result = await this._pool!.query(compiled.sql!, compiled.params);
    return result.rows[0];
  }

  async update<T extends Model>(instance: T): Promise<void> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    const data = this.prepareData(instance.toDB());
    const id = data.id;

    if (id === null || id === undefined) {
      throw new Error("Cannot update a record without an ID");
    }

    // Remove id from update data
    delete data.id;

    const compiled = PostgresQueryBuilder.buildUpdate(
      tableName,
      id,
      data,
      this._schema,
    );

    if (this._debug) {
      console.log("[PostgresBackend] Update:", compiled.sql, compiled.params);
    }

    await this._pool!.query(compiled.sql!, compiled.params);
  }

  async delete<T extends Model>(instance: T): Promise<void> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    const id = instance.pk;

    if (id === null || id === undefined) {
      throw new Error("Cannot delete a record without an ID");
    }

    const compiled = PostgresQueryBuilder.buildDelete(
      tableName,
      id,
      this._schema,
    );

    if (this._debug) {
      console.log("[PostgresBackend] Delete:", compiled.sql, compiled.params);
    }

    await this._pool!.query(compiled.sql!, compiled.params);
  }

  async deleteById(tableName: string, id: unknown): Promise<void> {
    this.ensureConnected();

    if (id === null || id === undefined) {
      throw new Error("Cannot delete a record without an ID");
    }

    const compiled = PostgresQueryBuilder.buildDelete(
      tableName,
      id,
      this._schema,
    );

    if (this._debug) {
      console.log(
        "[PostgresBackend] DeleteById:",
        compiled.sql,
        compiled.params,
      );
    }

    await this._pool!.query(compiled.sql!, compiled.params);
  }

  /**
   * Prepare data for insertion/update
   */
  private prepareData(data: Record<string, unknown>): Record<string, unknown> {
    const prepared: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      prepared[key] = toPostgresValue(value);
    }
    return prepared;
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  async bulkInsert<T extends Model>(
    instances: T[],
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();

    if (instances.length === 0) {
      return [];
    }

    // Use a transaction for bulk insert
    const client = await this._pool!.connect();
    const results: Record<string, unknown>[] = [];

    try {
      await client.query("BEGIN");

      for (const instance of instances) {
        const tableName = instance.getTableName();
        const data = this.prepareData(instance.toDB());

        if (data.id === null || data.id === undefined) {
          delete data.id;
        }

        const compiled = PostgresQueryBuilder.buildInsert(
          tableName,
          data,
          this._schema,
        );
        const result = await client.query(compiled.sql!, compiled.params);
        results.push(result.rows[0]);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return results;
  }

  async bulkUpdate<T extends Model>(
    instances: T[],
    _fields: string[],
  ): Promise<number> {
    this.ensureConnected();

    if (instances.length === 0) {
      return 0;
    }

    const client = await this._pool!.connect();
    let count = 0;

    try {
      await client.query("BEGIN");

      for (const instance of instances) {
        const tableName = instance.getTableName();
        const data = this.prepareData(instance.toDB());
        const id = data.id;

        if (id !== null && id !== undefined) {
          delete data.id;
          const compiled = PostgresQueryBuilder.buildUpdate(
            tableName,
            id,
            data,
            this._schema,
          );
          await client.query(compiled.sql!, compiled.params);
          count++;
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return count;
  }

  async updateMany<T extends Model>(
    state: QueryState<T>,
    values: Record<string, unknown>,
  ): Promise<number> {
    this.ensureConnected();

    const preparedValues = this.prepareData(values);
    const builder = new PostgresQueryBuilder(state, this._schema);
    const compiled = builder.buildUpdateMany(preparedValues);

    if (this._debug) {
      console.log(
        "[PostgresBackend] UpdateMany:",
        compiled.sql,
        compiled.params,
      );
    }

    const result = await this._pool!.query(compiled.sql!, compiled.params);
    return result.rowCount ?? 0;
  }

  async deleteMany<T extends Model>(state: QueryState<T>): Promise<number> {
    this.ensureConnected();

    const builder = new PostgresQueryBuilder(state, this._schema);
    const compiled = builder.buildDeleteMany();

    if (this._debug) {
      console.log(
        "[PostgresBackend] DeleteMany:",
        compiled.sql,
        compiled.params,
      );
    }

    const result = await this._pool!.query(compiled.sql!, compiled.params);
    return result.rowCount ?? 0;
  }

  // ============================================================================
  // Aggregation
  // ============================================================================

  async count<T extends Model>(state: QueryState<T>): Promise<number> {
    this.ensureConnected();

    const builder = new PostgresQueryBuilder(state, this._schema);
    const compiled = builder.buildCount();

    if (this._debug) {
      console.log("[PostgresBackend] Count:", compiled.sql, compiled.params);
    }

    const result = await this._pool!.query(compiled.sql!, compiled.params);
    return parseInt(result.rows[0].count, 10);
  }

  async aggregate<T extends Model>(
    state: QueryState<T>,
    aggregations: Aggregations,
  ): Promise<Record<string, number>> {
    this.ensureConnected();

    const builder = new PostgresQueryBuilder(state, this._schema);
    const compiled = builder.buildAggregate(aggregations);

    if (this._debug) {
      console.log(
        "[PostgresBackend] Aggregate:",
        compiled.sql,
        compiled.params,
      );
    }

    const result = await this._pool!.query(compiled.sql!, compiled.params);
    const row = result.rows[0] ?? {};

    // Convert all values to numbers
    const results: Record<string, number> = {};
    for (const [key, value] of Object.entries(row)) {
      results[key] = typeof value === "number"
        ? value
        : parseFloat(value as string) || 0;
    }

    return results;
  }

  // ============================================================================
  // Transactions
  // ============================================================================

  async beginTransaction(): Promise<Transaction> {
    this.ensureConnected();

    const client = await this._pool!.connect();
    await client.query("BEGIN");

    return new PostgresTransaction(client);
  }

  // ============================================================================
  // Schema Operations
  // ============================================================================

  getSchemaEditor(): SchemaEditor {
    this.ensureConnected();
    return new PostgresSchemaEditor(this._pool!, this._schema);
  }

  async tableExists(tableName: string): Promise<boolean> {
    this.ensureConnected();

    const result = await this._pool!.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      )`,
      [this._schema, tableName],
    );

    return result.rows[0]?.exists === true;
  }

  // ============================================================================
  // Query Compilation
  // ============================================================================

  compile<T extends Model>(state: QueryState<T>): CompiledQuery {
    const builder = new PostgresQueryBuilder(state, this._schema);
    return builder.buildSelect();
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get a record by ID directly
   */
  async getById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<Record<string, unknown> | null> {
    this.ensureConnected();

    const instance = new model();
    const tableName = instance.getTableName();

    const result = await this._pool!.query(
      `SELECT * FROM "${this._schema}"."${tableName}" WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.processRow(result.rows[0], model);
  }

  /**
   * Check if a record exists by ID
   */
  async existsById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<boolean> {
    this.ensureConnected();

    const instance = new model();
    const tableName = instance.getTableName();

    const result = await this._pool!.query(
      `SELECT EXISTS (SELECT 1 FROM "${this._schema}"."${tableName}" WHERE id = $1)`,
      [id],
    );

    return result.rows[0]?.exists === true;
  }

  /**
   * Execute a simple filter query on a table
   * Used by nested lookup resolution to query related tables.
   */
  protected async executeSimpleFilter(
    tableName: string,
    filters: ParsedFilter[],
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();

    // Build a simple WHERE clause
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const filter of filters) {
      if (filter.lookup === "exact") {
        if (filter.value === null) {
          conditions.push(`"${filter.field}" IS NULL`);
        } else {
          conditions.push(`"${filter.field}" = $${paramIndex++}`);
          params.push(filter.value);
        }
      } else if (filter.lookup === "in") {
        conditions.push(`"${filter.field}" = ANY($${paramIndex++})`);
        params.push(filter.value);
      }
      // Add more lookups as needed
    }

    let sql = `SELECT * FROM "${this._schema}"."${tableName}"`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    const result = await this._pool!.query(sql, params);
    return result.rows;
  }
}
