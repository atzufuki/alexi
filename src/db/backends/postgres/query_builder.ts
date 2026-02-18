/**
 * PostgreSQL Query Builder
 *
 * Translates Alexi ORM QueryState into parameterized SQL queries.
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
  ParsedOrdering,
  QueryState,
} from "../../query/types.ts";
import { LOOKUP_OPERATORS } from "./types.ts";

// ============================================================================
// Query Builder
// ============================================================================

/**
 * Build a parameterized SQL query from QueryState
 */
export class PostgresQueryBuilder<T extends Model> {
  private state: QueryState<T>;
  private params: unknown[] = [];
  private paramIndex = 1;
  private tableName: string;
  private schema: string;

  constructor(state: QueryState<T>, schema = "public") {
    this.state = state;
    this.schema = schema;
    this.tableName = this.getTableName(state.model);
  }

  /**
   * Get table name from model metadata
   */
  private getTableName(model: new () => T): string {
    const instance = new model();
    const meta = (model as unknown as { meta?: { dbTable?: string } }).meta;
    return meta?.dbTable ?? instance.constructor.name.toLowerCase();
  }

  /**
   * Get fully qualified table name with schema
   */
  private qualifiedTable(): string {
    return `"${this.schema}"."${this.tableName}"`;
  }

  /**
   * Quote an identifier (column or table name)
   */
  private quote(name: string): string {
    return `"${name}"`;
  }

  /**
   * Add a parameter and return its placeholder
   */
  private addParam(value: unknown): string {
    this.params.push(value);
    return `$${this.paramIndex++}`;
  }

  /**
   * Build SELECT query
   */
  buildSelect(): CompiledQuery {
    const parts: string[] = [];

    // SELECT clause
    parts.push("SELECT");

    // DISTINCT
    if (this.state.distinctFields.length > 0) {
      if (
        this.state.distinctFields.length === 1 &&
        this.state.distinctFields[0] === "*"
      ) {
        parts.push("DISTINCT");
      } else {
        const distinctCols = this.state.distinctFields.map((f) => this.quote(f))
          .join(", ");
        parts.push(`DISTINCT ON (${distinctCols})`);
      }
    }

    // Columns
    const columns = this.buildSelectColumns();
    parts.push(columns);

    // FROM
    parts.push("FROM", this.qualifiedTable());

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

    return {
      sql: parts.join(" "),
      params: this.params,
    };
  }

  /**
   * Build column selection
   */
  private buildSelectColumns(): string {
    // Handle annotations
    const annotationCols: string[] = [];
    for (const [alias, agg] of Object.entries(this.state.annotations)) {
      annotationCols.push(
        `${this.buildAggregation(agg)} AS ${this.quote(alias)}`,
      );
    }

    // If only selecting specific fields
    if (this.state.selectFields.length > 0) {
      const fieldCols = this.state.selectFields
        .filter((f) => !this.state.deferFields.includes(f))
        .map((f) => `${this.qualifiedTable()}.${this.quote(f)}`);
      return [...fieldCols, ...annotationCols].join(", ") || "*";
    }

    // Defer fields: select all except deferred
    if (this.state.deferFields.length > 0) {
      // We'd need model introspection to list all fields
      // For now, use * and rely on application-level filtering
      const base = `${this.qualifiedTable()}.*`;
      return annotationCols.length > 0
        ? `${base}, ${annotationCols.join(", ")}`
        : base;
    }

    // Default: select all from main table
    const base = `${this.qualifiedTable()}.*`;
    return annotationCols.length > 0
      ? `${base}, ${annotationCols.join(", ")}`
      : base;
  }

  /**
   * Build aggregation expression
   */
  private buildAggregation(agg: Aggregation): string {
    const field = agg.field === "*" ? "*" : this.quote(agg.field);
    const distinct = agg.distinct ? "DISTINCT " : "";
    return `${agg.func}(${distinct}${field})`;
  }

  /**
   * Build JOIN clauses for selectRelated
   */
  private buildJoins(): string | null {
    if (this.state.selectRelated.length === 0) {
      return null;
    }

    const joins: string[] = [];
    const registry = ModelRegistry.instance;

    for (const relatedPath of this.state.selectRelated) {
      // Handle nested relations (e.g., "author__company")
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
              `LEFT JOIN "${this.schema}"."${relatedTable}" AS "${joinAlias}" ` +
                `ON "${currentAlias}"."${fkColumn}" = "${joinAlias}"."id"`,
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
   * Get table name from a model class
   */
  private getRelatedTableName(model: new () => Model): string {
    const meta = (model as unknown as { meta?: { dbTable?: string } }).meta;
    return meta?.dbTable ?? model.name.toLowerCase();
  }

  /**
   * Build WHERE clause from filters
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
   * Build a single filter condition
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
   * Build column reference (handles related fields)
   */
  private buildColumnRef(field: string): string {
    if (field.includes("__")) {
      // Related field lookup - would need join alias mapping
      // For now, convert to simple column reference
      const parts = field.split("__");
      const column = parts.pop()!;
      const path = parts.join("_");
      return `"${this.tableName}_${path}"."${column}"`;
    }
    return `${this.qualifiedTable()}.${this.quote(field)}`;
  }

  /**
   * Build lookup expression
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
        return `${column} ILIKE ${this.addParam(`%${value}%`)}`;

      case "startswith":
        return `${column} LIKE ${this.addParam(`${value}%`)}`;

      case "istartswith":
        return `${column} ILIKE ${this.addParam(`${value}%`)}`;

      case "endswith":
        return `${column} LIKE ${this.addParam(`%${value}`)}`;

      case "iendswith":
        return `${column} ILIKE ${this.addParam(`%${value}`)}`;

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
          return "FALSE"; // Empty IN clause
        }
        return `${column} = ANY(${this.addParam(value)})`;

      case "range": {
        const [min, max] = value as [unknown, unknown];
        return `${column} BETWEEN ${this.addParam(min)} AND ${
          this.addParam(max)
        }`;
      }

      case "isnull":
        return value ? `${column} IS NULL` : `${column} IS NOT NULL`;

      case "regex":
        return `${column} ~ ${this.addParam(value)}`;

      case "iregex":
        return `${column} ~* ${this.addParam(value)}`;

      case "date":
        return `DATE(${column}) = ${this.addParam(value)}`;

      case "year":
        return `EXTRACT(YEAR FROM ${column}) = ${this.addParam(value)}`;

      case "month":
        return `EXTRACT(MONTH FROM ${column}) = ${this.addParam(value)}`;

      case "day":
        return `EXTRACT(DAY FROM ${column}) = ${this.addParam(value)}`;

      case "week":
        return `EXTRACT(WEEK FROM ${column}) = ${this.addParam(value)}`;

      case "weekday":
        // PostgreSQL: 0 = Sunday, 6 = Saturday (same as Django)
        return `EXTRACT(DOW FROM ${column}) = ${this.addParam(value)}`;

      default:
        // Fallback to exact match
        return `${column} = ${this.addParam(value)}`;
    }
  }

  /**
   * Build ORDER BY clause
   */
  private buildOrderBy(): string | null {
    let ordering = this.state.ordering;

    if (ordering.length === 0) {
      return null;
    }

    // Handle reversed
    if (this.state.reversed) {
      ordering = ordering.map((o) => ({
        field: o.field,
        direction: o.direction === "ASC" ? "DESC" : "ASC",
      }));
    }

    return ordering.map((o) => `${this.quote(o.field)} ${o.direction}`).join(
      ", ",
    );
  }

  /**
   * Build COUNT query
   */
  buildCount(): CompiledQuery {
    const parts: string[] = ["SELECT COUNT(*)"];

    // Handle distinct
    if (
      this.state.distinctFields.length > 0 &&
      this.state.distinctFields[0] !== "*"
    ) {
      const distinctCols = this.state.distinctFields.map((f) => this.quote(f))
        .join(", ");
      parts[0] = `SELECT COUNT(DISTINCT (${distinctCols}))`;
    }

    parts.push("FROM", this.qualifiedTable());

    // JOINs
    const joins = this.buildJoins();
    if (joins) {
      parts.push(joins);
    }

    // WHERE
    const where = this.buildWhere();
    if (where) {
      parts.push("WHERE", where);
    }

    return {
      sql: parts.join(" "),
      params: this.params,
    };
  }

  /**
   * Build aggregate query
   */
  buildAggregate(aggregations: Record<string, Aggregation>): CompiledQuery {
    const aggCols = Object.entries(aggregations).map(
      ([alias, agg]) => `${this.buildAggregation(agg)} AS ${this.quote(alias)}`,
    );

    const parts: string[] = ["SELECT", aggCols.join(", ")];
    parts.push("FROM", this.qualifiedTable());

    // JOINs
    const joins = this.buildJoins();
    if (joins) {
      parts.push(joins);
    }

    // WHERE
    const where = this.buildWhere();
    if (where) {
      parts.push("WHERE", where);
    }

    return {
      sql: parts.join(" "),
      params: this.params,
    };
  }

  /**
   * Build INSERT query
   */
  static buildInsert(
    tableName: string,
    data: Record<string, unknown>,
    schema = "public",
  ): CompiledQuery {
    const columns = Object.keys(data);
    const params = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO "${schema}"."${tableName}" ` +
      `(${columns.map((c) => `"${c}"`).join(", ")}) ` +
      `VALUES (${placeholders.join(", ")}) ` +
      `RETURNING *`;

    return { sql, params };
  }

  /**
   * Build UPDATE query for a single record
   */
  static buildUpdate(
    tableName: string,
    id: unknown,
    data: Record<string, unknown>,
    schema = "public",
    idColumn = "id",
  ): CompiledQuery {
    const columns = Object.keys(data);
    const params = Object.values(data);
    let paramIndex = 1;

    const setClauses = columns.map((col) => `"${col}" = $${paramIndex++}`);
    params.push(id);

    const sql = `UPDATE "${schema}"."${tableName}" ` +
      `SET ${setClauses.join(", ")} ` +
      `WHERE "${idColumn}" = $${paramIndex} ` +
      `RETURNING *`;

    return { sql, params };
  }

  /**
   * Build DELETE query for a single record
   */
  static buildDelete(
    tableName: string,
    id: unknown,
    schema = "public",
    idColumn = "id",
  ): CompiledQuery {
    return {
      sql: `DELETE FROM "${schema}"."${tableName}" WHERE "${idColumn}" = $1`,
      params: [id],
    };
  }

  /**
   * Build bulk DELETE query from QueryState filters
   */
  buildDeleteMany(): CompiledQuery {
    const parts: string[] = [`DELETE FROM ${this.qualifiedTable()}`];

    const where = this.buildWhere();
    if (where) {
      parts.push("WHERE", where);
    }

    return {
      sql: parts.join(" "),
      params: this.params,
    };
  }

  /**
   * Build bulk UPDATE query from QueryState filters
   */
  buildUpdateMany(data: Record<string, unknown>): CompiledQuery {
    const columns = Object.keys(data);
    const values = Object.values(data);

    // Add data params first
    const setClauses = columns.map((col) => {
      const placeholder = this.addParam(values[columns.indexOf(col)]);
      return `"${col}" = ${placeholder}`;
    });

    const parts: string[] = [
      `UPDATE ${this.qualifiedTable()}`,
      "SET",
      setClauses.join(", "),
    ];

    const where = this.buildWhere();
    if (where) {
      parts.push("WHERE", where);
    }

    return {
      sql: parts.join(" "),
      params: this.params,
    };
  }

  /**
   * Build EXISTS query
   */
  buildExists(): CompiledQuery {
    const parts: string[] = [
      "SELECT EXISTS(SELECT 1 FROM",
      this.qualifiedTable(),
    ];

    const where = this.buildWhere();
    if (where) {
      parts.push("WHERE", where);
    }

    parts.push(")");

    return {
      sql: parts.join(" "),
      params: this.params,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape a LIKE pattern (escape %, _, and \)
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

/**
 * Convert JavaScript value to PostgreSQL representation
 */
export function toPostgresValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Convert PostgreSQL value to JavaScript representation
 */
export function fromPostgresValue(
  value: unknown,
  fieldType?: string,
): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle date/datetime strings
  if (fieldType === "DateTimeField" || fieldType === "DateField") {
    if (typeof value === "string" || value instanceof Date) {
      return new Date(value);
    }
  }

  // Handle JSON fields (already parsed by pg driver)
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
