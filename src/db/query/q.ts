/**
 * Q object for complex query conditions in Alexi ORM
 *
 * Q objects allow combining filter conditions with AND, OR, and NOT operators.
 *
 * @module
 */

import type { Model } from "../models/model.ts";
import type { FilterConditions, LookupType, ParsedFilter } from "./types.ts";

// ============================================================================
// Q Object
// ============================================================================

/**
 * Connector types for combining Q objects
 */
export type QConnector = "AND" | "OR";

/**
 * Q object for building complex query conditions
 *
 * @example
 * ```ts
 * // Simple Q object
 * const q1 = new Q({ name__contains: 'test' });
 *
 * // Combining with OR
 * const q2 = new Q({ status: 'published' });
 * const combined = q1.or(q2);
 *
 * // Negation
 * const notDraft = new Q({ status: 'draft' }).not();
 *
 * // Complex combinations
 * const complex = new Q({ category: 'tech' })
 *   .and(new Q({ views__gte: 100 }).or(new Q({ featured: true })));
 *
 * // Usage in filter
 * Article.objects.filter(combined);
 * ```
 */
export class Q<T extends Model = Model> {
  private _conditions: FilterConditions<T>;
  private _connector: QConnector;
  private _negated: boolean;
  private _children: Q<T>[];

  constructor(conditions: FilterConditions<T> = {}) {
    this._conditions = conditions;
    this._connector = "AND";
    this._negated = false;
    this._children = [];
  }

  /**
   * Get the filter conditions
   */
  get conditions(): FilterConditions<T> {
    return this._conditions;
  }

  /**
   * Get the connector type
   */
  get connector(): QConnector {
    return this._connector;
  }

  /**
   * Check if this Q is negated
   */
  get negated(): boolean {
    return this._negated;
  }

  /**
   * Get child Q objects
   */
  get children(): Q<T>[] {
    return this._children;
  }

  /**
   * Check if this Q has children
   */
  get hasChildren(): boolean {
    return this._children.length > 0;
  }

  /**
   * Check if this Q has conditions
   */
  get hasConditions(): boolean {
    return Object.keys(this._conditions).length > 0;
  }

  /**
   * Check if this Q is empty (no conditions and no children)
   */
  get isEmpty(): boolean {
    return !this.hasConditions && !this.hasChildren;
  }

  /**
   * Combine with another Q using AND
   *
   * @example
   * ```ts
   * const q = new Q({ status: 'active' }).and(new Q({ verified: true }));
   * ```
   */
  and(other: Q<T>): Q<T> {
    const combined = new Q<T>();
    combined._connector = "AND";
    combined._children = [this._clone(), other._clone()];
    return combined;
  }

  /**
   * Combine with another Q using OR
   *
   * @example
   * ```ts
   * const q = new Q({ status: 'draft' }).or(new Q({ status: 'pending' }));
   * ```
   */
  or(other: Q<T>): Q<T> {
    const combined = new Q<T>();
    combined._connector = "OR";
    combined._children = [this._clone(), other._clone()];
    return combined;
  }

  /**
   * Negate this Q object
   *
   * @example
   * ```ts
   * const notDraft = new Q({ status: 'draft' }).not();
   * ```
   */
  not(): Q<T> {
    const negated = this._clone();
    negated._negated = !this._negated;
    return negated;
  }

  /**
   * Clone this Q object
   */
  private _clone(): Q<T> {
    const cloned = new Q<T>({ ...this._conditions });
    cloned._connector = this._connector;
    cloned._negated = this._negated;
    cloned._children = this._children.map((child) => child._clone());
    return cloned;
  }

  /**
   * Convert this Q object to parsed filters
   */
  toParsedFilters(): ParsedFilter[] {
    const filters: ParsedFilter[] = [];

    // Parse own conditions
    for (const [key, value] of Object.entries(this._conditions)) {
      const parsed = this._parseCondition(key, value);
      if (this._negated) {
        parsed.negated = !parsed.negated;
      }
      filters.push(parsed);
    }

    // Note: Children are handled separately during query compilation
    // as they need to be wrapped in parentheses with their connector

    return filters;
  }

  /**
   * Parse a single condition key into field and lookup
   */
  private _parseCondition(key: string, value: unknown): ParsedFilter {
    const parts = key.split("__");
    let field: string;
    let lookup: LookupType = "exact";

    if (parts.length === 1) {
      // Simple field name, use exact lookup
      field = parts[0];
    } else {
      // Check if the last part is a valid lookup type
      const possibleLookup = parts[parts.length - 1] as LookupType;
      if (this._isValidLookup(possibleLookup)) {
        lookup = possibleLookup;
        field = parts.slice(0, -1).join("__");
      } else {
        // It's a related field path
        field = key;
        lookup = "exact";
      }
    }

    return {
      field,
      lookup,
      value,
      negated: false,
    };
  }

  /**
   * Check if a string is a valid lookup type
   */
  private _isValidLookup(lookup: string): lookup is LookupType {
    const validLookups: LookupType[] = [
      "exact",
      "iexact",
      "contains",
      "icontains",
      "startswith",
      "istartswith",
      "endswith",
      "iendswith",
      "in",
      "gt",
      "gte",
      "lt",
      "lte",
      "range",
      "isnull",
      "regex",
      "iregex",
      "date",
      "year",
      "month",
      "day",
      "week",
      "weekday",
    ];
    return validLookups.includes(lookup as LookupType);
  }

  /**
   * Recursively resolve this Q object and its children into a tree structure
   * for query compilation
   */
  resolve(): ResolvedQ {
    return {
      conditions: this.toParsedFilters(),
      connector: this._connector,
      negated: this._negated,
      children: this._children.map((child) => child.resolve()),
    };
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    const parts: string[] = [];

    if (this._negated) {
      parts.push("NOT");
    }

    if (this.hasConditions) {
      const condStr = Object.entries(this._conditions)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(", ");
      parts.push(`(${condStr})`);
    }

    if (this.hasChildren) {
      const childrenStr = this._children
        .map((child) => child.toString())
        .join(` ${this._connector} `);
      parts.push(`(${childrenStr})`);
    }

    return parts.join(" ") || "(empty)";
  }
}

/**
 * Resolved Q object structure for query compilation
 */
export interface ResolvedQ {
  /** Parsed filter conditions at this level */
  conditions: ParsedFilter[];
  /** Connector for combining children */
  connector: QConnector;
  /** Whether this level is negated */
  negated: boolean;
  /** Child Q objects */
  children: ResolvedQ[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new Q object (shorthand)
 */
export function q<T extends Model>(conditions: FilterConditions<T>): Q<T> {
  return new Q<T>(conditions);
}

/**
 * Combine multiple Q objects with AND
 */
export function andQ<T extends Model>(...qs: Q<T>[]): Q<T> {
  if (qs.length === 0) return new Q<T>();
  if (qs.length === 1) return qs[0];

  return qs.reduce((acc, q) => acc.and(q));
}

/**
 * Combine multiple Q objects with OR
 */
export function orQ<T extends Model>(...qs: Q<T>[]): Q<T> {
  if (qs.length === 0) return new Q<T>();
  if (qs.length === 1) return qs[0];

  return qs.reduce((acc, q) => acc.or(q));
}
