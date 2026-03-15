/**
 * SQLite Query Builder
 *
 * Translates Alexi ORM QueryState into parameterized SQL queries using
 * SQLite's `?` positional placeholder syntax.
 *
 * @module
 */

import type { Model } from "../../models/model.ts";
import { ModelRegistry } from "../../models/model.ts";
import type {
  Aggregation,
  CompiledQuery,
  LookupType,
  ParsedFilter,
  QueryState,
} from "../../query/types.ts";

// ============================================================================
// Query Builder
// ============================================================================

/**
 * Builds parameterized SQL queries from a {@link QueryState} for SQLite.
 *
 * Unlike the PostgreSQL builder which uses `$N` placeholders, this builder
 * uses SQLite's `?` positional placeholders throughout.
 *
 * @category Backends
 */
export class SQLiteQueryBuilder<T extends Model> {
  private state: QueryState<T>;
  private params: unknown[] = [];
  private tableName: string;

  /** @param state - The QueryState to compile into SQL. */
  constructor(state: QueryState<T>) {
    this.state = state;
    this.tableName = this.getTableName(state.model);
  }

  /**
   * Get the table name from model metadata.
   */
  private getTableName(model: new () => T): string {
    const instance = new model();
    const meta = (model as unknown as { meta?: { dbTable?: string } }).meta;
    return meta?.dbTable ?? instance.constructor.name.toLowerCase();
  }

  /**
   * Quote an identifier (column or table name) with double quotes.
   */
  private quote(name: string): string {
    return `"${name}"`;
  }

  /**
   * Add a parameter to the list and return its `?` placeholder.
   */
  private addParam(value: unknown): string {
    this.params.push(value);
    return "?";
  }

  /**
   * Build a full SELECT query.
   *
   * @returns A {@link CompiledQuery} with `sql` and `params`.
   */
  buildSelect(): CompiledQuery {
    const parts: string[] = [];

    // SELECT clause
    parts.push("SELECT");

    // DISTINCT
    if (this.state.distinctFields.length > 0) {
      parts.push("DISTINCT");
    }

    // Columns
    parts.push(this.buildSelectColumns());

    // FROM
    parts.push("FROM", this.quote(this.tableName));

    // JOINs for selectRelated
    const joins = this.buildJoins();
    if (joins) {
      parts.push(joins);
    }

    // WHERE
    const where = this.buildWhere();
    if (where) {
      parts.push("WHERE", where);
    }

    // ORDER BY
    const orderBy = this.buildOrderBy();
    if (orderBy) {
      parts.push("ORDER BY", orderBy);
    }

    // LIMIT
    if (this.state.limit !== null) {
      parts.push("LIMIT", this.addParam(this.state.limit));
    }

    // OFFSET
    if (this.state.offset !== null) {
      parts.push("OFFSET", this.addParam(this.state.offset));
    }

    return { sql: parts.join(" "), params: this.params };
  }

  /**
   * Build the column list for SELECT.
   */
  private buildSelectColumns(): string {
    const annotationCols: string[] = [];
    for (const [alias, agg] of Object.entries(this.state.annotations)) {
      annotationCols.push(
        `${this.buildAggregation(agg)} AS ${this.quote(alias)}`,
      );
    }

    if (this.state.selectFields.length > 0) {
      const fieldCols = this.state.selectFields
        .filter((f) => !this.state.deferFields.includes(f))
        .map((f) => `${this.quote(this.tableName)}.${this.quote(f)}`);
      return [...fieldCols, ...annotationCols].join(", ") || "*";
    }

    const base = `${this.quote(this.tableName)}.*`;
    return annotationCols.length > 0
      ? `${base}, ${annotationCols.join(", ")}`
      : base;
  }

  /**
   * Build a single aggregation expression (e.g. `COUNT("id")`).
   */
  private buildAggregation(agg: Aggregation): string {
    const field = agg.field === "*" ? "*" : this.quote(agg.field);
    const distinct = agg.distinct ? "DISTINCT " : "";
    return `${agg.func}(${distinct}${field})`;
  }

  /**
   * Build LEFT JOIN clauses for `selectRelated` paths.
   */
  private buildJoins(): string | null {
    if (this.state.selectRelated.length === 0) {
      return null;
    }

    const joins: string[] = [];
    const registry = ModelRegistry.instance;

    for (const relatedPath of this.state.selectRelated) {
      const parts = relatedPath.split("__");
      let currentModel = this.state.model;
      let currentAlias = this.tableName;

      for (const part of parts) {
        const instance = new currentModel();
        const field = (instance as Record<string, unknown>)[part];

        if (field && typeof field === "object" && "relatedModel" in field) {
          const relatedModelName =
            (field as { relatedModel: string }).relatedModel;
          const relatedModel = registry.get(relatedModelName);

          if (relatedModel) {
            const relatedTable = this.getRelatedTableName(relatedModel);
            const joinAlias = `${currentAlias}_${part}`;
            const fkColumn = `${part}_id`;

            joins.push(
              `LEFT JOIN ${this.quote(relatedTable)} AS ${
                this.quote(joinAlias)
              } ` +
                `ON ${this.quote(currentAlias)}.${this.quote(fkColumn)} = ${
                  this.quote(joinAlias)
                }."id"`,
            );

            currentModel = relatedModel as new () => T;
            currentAlias = joinAlias;
          }
        }
      }
    }

    return joins.length > 0 ? joins.join(" ") : null;
  }

  /**
   * Get the table name from a related model class.
   */
  private getRelatedTableName(model: new () => Model): string {
    const meta = (model as unknown as { meta?: { dbTable?: string } }).meta;
    return meta?.dbTable ?? model.name.toLowerCase() + "s";
  }

  /**
   * Build the WHERE clause from all active filters.
   */
  private buildWhere(): string | null {
    if (this.state.filters.length === 0) {
      return null;
    }

    const conditions = this.state.filters.map((filter) =>
      this.buildCondition(filter)
    );
    return conditions.join(" AND ");
  }

  /**
   * Build a single filter condition, optionally negated.
   */
  private buildCondition(filter: ParsedFilter): string {
    const column = this.buildColumnRef(filter.field);
    const condition = this.buildLookup(column, filter.lookup, filter.value);

    if (filter.negated) {
      return `NOT (${condition})`;
    }
    return condition;
  }

  /**
   * Build a qualified column reference, handling related field paths.
   */
  private buildColumnRef(field: string): string {
    if (field.includes("__")) {
      const parts = field.split("__");
      const column = parts.pop()!;
      const path = parts.join("_");
      return `${this.quote(`${this.tableName}_${path}`)}.${this.quote(column)}`;
    }
    return `${this.quote(this.tableName)}.${this.quote(field)}`;
  }

  /**
   * Build a SQL lookup expression for the given column, lookup type, and value.
   */
  private buildLookup(
    column: string,
    lookup: LookupType,
    value: unknown,
  ): string {
    switch (lookup) {
      case "exact":
        if (value === null) {
          return `${column} IS NULL`;
        }
        return `${column} = ${this.addParam(value)}`;

      case "iexact":
        return `LOWER(${column}) = LOWER(${this.addParam(value)})`;

      case "contains":
        return `${column} LIKE ${this.addParam(`%${value}%`)}`;

      case "icontains":
        return `${column} LIKE ${this.addParam(`%${value}%`)} COLLATE NOCASE`;

      case "startswith":
        return `${column} LIKE ${this.addParam(`${value}%`)}`;

      case "istartswith":
        return `${column} LIKE ${this.addParam(`${value}%`)} COLLATE NOCASE`;

      case "endswith":
        return `${column} LIKE ${this.addParam(`%${value}`)}`;

      case "iendswith":
        return `${column} LIKE ${this.addParam(`%${value}`)} COLLATE NOCASE`;

      case "gt":
        return `${column} > ${this.addParam(value)}`;

      case "gte":
        return `${column} >= ${this.addParam(value)}`;

      case "lt":
        return `${column} < ${this.addParam(value)}`;

      case "lte":
        return `${column} <= ${this.addParam(value)}`;

      case "in":
        if (Array.isArray(value) && value.length === 0) {
          return "FALSE";
        }
        if (Array.isArray(value)) {
          const placeholders = value.map((v) => this.addParam(v)).join(", ");
          return `${column} IN (${placeholders})`;
        }
        return `${column} IN (${this.addParam(value)})`;

      case "range": {
        const [min, max] = value as [unknown, unknown];
        return `${column} BETWEEN ${this.addParam(min)} AND ${
          this.addParam(max)
        }`;
      }

      case "isnull":
        return value ? `${column} IS NULL` : `${column} IS NOT NULL`;

      case "regex":
        // Requires a custom REGEXP function registered at connection time.
        return `${column} REGEXP ${this.addParam(value)}`;

      case "iregex":
        return `${column} REGEXP ${this.addParam(value)}`;

      case "date":
        return `DATE(${column}) = ${this.addParam(value)}`;

      case "year":
        return `CAST(strftime('%Y', ${column}) AS INTEGER) = ${
          this.addParam(value)
        }`;

      case "month":
        return `CAST(strftime('%m', ${column}) AS INTEGER) = ${
          this.addParam(value)
        }`;

      case "day":
        return `CAST(strftime('%d', ${column}) AS INTEGER) = ${
          this.addParam(value)
        }`;

      case "week":
        return `CAST(strftime('%W', ${column}) AS INTEGER) = ${
          this.addParam(value)
        }`;

      case "weekday":
        // strftime('%w') returns 0=Sunday … 6=Saturday (same as Django).
        return `CAST(strftime('%w', ${column}) AS INTEGER) = ${
          this.addParam(value)
        }`;

      default:
        return `${column} = ${this.addParam(value)}`;
    }
  }

  /**
   * Build the ORDER BY clause from the state's ordering list.
   */
  private buildOrderBy(): string | null {
    const ordering = this.state.ordering;

    if (ordering.length === 0) {
      return null;
    }

    return ordering
      .map((o) => {
        // QueryState uses `descending: boolean`; reversed flips the direction.
        const descending = this.state.reversed ? !o.descending : o.descending;
        return `${this.quote(o.field)} ${descending ? "DESC" : "ASC"}`;
      })
      .join(", ");
  }

  /**
   * Build a `SELECT COUNT(*)` query.
   */
  buildCount(): CompiledQuery {
    const parts: string[] = ["SELECT COUNT(*)"];
    parts.push("FROM", this.quote(this.tableName));

    const joins = this.buildJoins();
    if (joins) parts.push(joins);

    const where = this.buildWhere();
    if (where) parts.push("WHERE", where);

    return { sql: parts.join(" "), params: this.params };
  }

  /**
   * Build an aggregate query (e.g. `SUM`, `AVG`).
   */
  buildAggregate(
    aggregations: Record<string, Aggregation>,
  ): CompiledQuery {
    const aggCols = Object.entries(aggregations).map(
      ([alias, agg]) => `${this.buildAggregation(agg)} AS ${this.quote(alias)}`,
    );

    const parts: string[] = ["SELECT", aggCols.join(", ")];
    parts.push("FROM", this.quote(this.tableName));

    const joins = this.buildJoins();
    if (joins) parts.push(joins);

    const where = this.buildWhere();
    if (where) parts.push("WHERE", where);

    return { sql: parts.join(" "), params: this.params };
  }

  /**
   * Build an `INSERT INTO … VALUES (…)` query.
   *
   * SQLite does not support `RETURNING *` in older versions; the caller should
   * use `last_insert_rowid()` to retrieve the generated ID after insertion.
   *
   * @param tableName - The target table.
   * @param data - Column → value map.
   */
  static buildInsert(
    tableName: string,
    data: Record<string, unknown>,
  ): CompiledQuery {
    const columns = Object.keys(data);
    const params = Object.values(data);
    const placeholders = columns.map(() => "?");

    const sql =
      `INSERT INTO "${tableName}" (${
        columns.map((c) => `"${c}"`).join(", ")
      }) ` +
      `VALUES (${placeholders.join(", ")})`;

    return { sql, params };
  }

  /**
   * Build an `UPDATE … SET … WHERE id = ?` query.
   *
   * @param tableName - The target table.
   * @param id - The primary key value.
   * @param data - Column → value map (must not include `id`).
   * @param idColumn - Name of the primary key column. Defaults to `"id"`.
   */
  static buildUpdate(
    tableName: string,
    id: unknown,
    data: Record<string, unknown>,
    idColumn = "id",
  ): CompiledQuery {
    const columns = Object.keys(data);
    const params = [...Object.values(data), id];
    const setClauses = columns.map((col) => `"${col}" = ?`);

    const sql = `UPDATE "${tableName}" SET ${
      setClauses.join(", ")
    } WHERE "${idColumn}" = ?`;

    return { sql, params };
  }

  /**
   * Build a `DELETE FROM … WHERE id = ?` query.
   *
   * @param tableName - The target table.
   * @param id - The primary key value.
   * @param idColumn - Name of the primary key column. Defaults to `"id"`.
   */
  static buildDelete(
    tableName: string,
    id: unknown,
    idColumn = "id",
  ): CompiledQuery {
    return {
      sql: `DELETE FROM "${tableName}" WHERE "${idColumn}" = ?`,
      params: [id],
    };
  }

  /**
   * Build a `DELETE FROM …` query filtered by the current QueryState.
   */
  buildDeleteMany(): CompiledQuery {
    const parts: string[] = [`DELETE FROM ${this.quote(this.tableName)}`];

    const where = this.buildWhere();
    if (where) parts.push("WHERE", where);

    return { sql: parts.join(" "), params: this.params };
  }

  /**
   * Build an `UPDATE … SET … WHERE …` query filtered by the current QueryState.
   *
   * @param data - Column → value map of fields to update.
   */
  buildUpdateMany(data: Record<string, unknown>): CompiledQuery {
    const columns = Object.keys(data);
    const values = Object.values(data);

    const setClauses = columns.map((col, i) => {
      this.params.push(values[i]);
      return `"${col}" = ?`;
    });

    const parts: string[] = [
      `UPDATE ${this.quote(this.tableName)}`,
      "SET",
      setClauses.join(", "),
    ];

    const where = this.buildWhere();
    if (where) parts.push("WHERE", where);

    return { sql: parts.join(" "), params: this.params };
  }
}

// ============================================================================
// Value Conversion Helpers
// ============================================================================

/**
 * Convert a JavaScript value to its SQLite storage representation.
 *
 * - `Date` → ISO 8601 string
 * - `boolean` → `1` or `0`
 * - Plain objects → JSON string
 * - `undefined` → `null`
 *
 * @param value - The JavaScript value to convert.
 * @returns The SQLite-compatible representation.
 */
export function toSQLiteValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Convert a SQLite storage value back to a JavaScript representation.
 *
 * - `DateTimeField` / `DateField` strings → `Date` objects
 * - `BooleanField` integers → `boolean`
 * - `JSONField` strings → parsed objects
 *
 * @param value - The raw SQLite value.
 * @param fieldType - Optional Alexi field type name for type-aware coercion.
 * @returns The JavaScript-native representation.
 */
export function fromSQLiteValue(value: unknown, fieldType?: string): unknown {
  if (value === null || value === undefined) return null;

  if (fieldType === "DateTimeField" || fieldType === "DateField") {
    if (typeof value === "string") return new Date(value);
  }

  if (fieldType === "BooleanField") {
    return value === 1 || value === true;
  }

  if (fieldType === "JSONField") {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
  }

  return value;
}
