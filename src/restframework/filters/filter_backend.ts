/**
 * Filter Backends for Alexi REST Framework
 *
 * Provides filtering capabilities for ViewSets, similar to Django REST Framework's
 * filter backends.
 *
 * @module @alexi/restframework/filters/filter_backend
 */

import { ForeignKey, type Model, type QuerySet } from "@alexi/db";
import type { ViewSetContext } from "../viewsets/viewset.ts";

export type { Model, QuerySet } from "@alexi/db";
export type { ViewSetContext } from "../viewsets/viewset.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Filter backend interface
 *
 * Filter backends are used to filter querysets based on the request.
 * Multiple filter backends can be combined on a single ViewSet.
 */
export interface FilterBackend {
  /**
   * Filter the queryset based on the request
   *
   * @param queryset - The queryset to filter
   * @param context - The ViewSet context containing the request
   * @param viewset - The ViewSet instance (for accessing configuration)
   * @returns The filtered queryset
   */
  filterQueryset<T extends Model>(
    queryset: QuerySet<T>,
    context: ViewSetContext,
    viewset: FilterableViewSet,
  ): QuerySet<T>;
}

/**
 * Interface for ViewSets that support filtering
 */
export interface FilterableViewSet {
  /**
   * Fields that can be filtered via query parameters
   */
  filtersetFields?: string[];

  /**
   * Filter backends to use
   */
  filterBackends?: FilterBackend[];
}

// ============================================================================
// QueryParamFilterBackend
// ============================================================================

/**
 * Filter backend that filters by query parameters
 *
 * Only allows filtering on fields specified in `filterset_fields`.
 * Supports lookup expressions like `field__contains`, `field__gte`, etc.
 *
 * @example
 * ```ts
 * class TodoViewSet extends ModelViewSet {
 *   model = TodoModel;
 *   serializerClass = TodoSerializer;
 *   filterBackends = [new QueryParamFilterBackend()];
 *   filtersetFields = ['id', 'completed', 'title'];
 * }
 *
 * // Now supports:
 * // GET /api/todos/?id=18
 * // GET /api/todos/?completed=true
 * // GET /api/todos/?title__contains=test
 * ```
 */
export class QueryParamFilterBackend implements FilterBackend {
  /**
   * Query parameters to ignore (pagination, ordering, etc.)
   */
  private static readonly RESERVED_PARAMS = new Set([
    "limit",
    "offset",
    "page",
    "page_size",
    "ordering",
    "search",
    "format",
  ]);

  /**
   * Valid lookup expressions
   */
  private static readonly VALID_LOOKUPS = new Set([
    "exact",
    "iexact",
    "contains",
    "icontains",
    "startswith",
    "istartswith",
    "endswith",
    "iendswith",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "isnull",
    "regex",
    "iregex",
    "range",
  ]);

  /**
   * Filter a queryset using configured query parameters.
   */
  filterQueryset<T extends Model>(
    queryset: QuerySet<T>,
    context: ViewSetContext,
    viewset: FilterableViewSet,
  ): QuerySet<T> {
    const allowedFields = viewset.filtersetFields;

    // If no fields are configured, don't filter
    if (!allowedFields || allowedFields.length === 0) {
      return queryset;
    }

    const url = new URL(context.request.url);
    const filterConditions: Record<string, unknown> = {};

    for (const [key, value] of url.searchParams.entries()) {
      // Skip reserved parameters
      if (QueryParamFilterBackend.RESERVED_PARAMS.has(key)) {
        continue;
      }

      // Parse the key to extract field name and lookup
      const { field, lookup } = this.parseFilterKey(key);

      // Only allow filtering on configured fields.
      // Accept both the field name ("author") and the column name ("author_id")
      // so that the REST backend's FK column-name translation is transparent.
      const resolvedField = this.resolveFieldName(field, queryset);
      if (!allowedFields.includes(resolvedField)) {
        continue;
      }

      // Build the filter key using the resolved (field-name) form so the ORM
      // can do its own FK translation correctly downstream.
      const filterKey = lookup ? `${resolvedField}__${lookup}` : resolvedField;

      // Parse and set the value
      filterConditions[filterKey] = this.parseFilterValue(value, lookup);
    }

    // Apply filters if any
    if (Object.keys(filterConditions).length > 0) {
      return queryset.filter(filterConditions);
    }

    return queryset;
  }

  /**
   * Resolve a URL param field name to the canonical field name on the model.
   *
   * If `field` matches the column name of a ForeignKey (e.g. `"author_id"`),
   * returns the corresponding field name (e.g. `"author"`).  Otherwise returns
   * `field` unchanged.
   *
   * This makes `filtersetFields = ["author"]` accept both `?author=5` and
   * `?author_id=5`, matching Django's behaviour.
   */
  private resolveFieldName<T extends Model>(
    field: string,
    queryset: QuerySet<T>,
  ): string {
    try {
      // deno-lint-ignore no-explicit-any
      const state = (queryset as any)._state;
      if (!state?.model) return field;
      const instance = new state.model();
      const fields = instance.getFields() as Record<string, unknown>;

      // Check direct match first (most common path)
      if (fields[field] !== undefined) return field;

      // Check if field is a column-name alias for any FK field
      for (const [fieldName, fieldObj] of Object.entries(fields)) {
        if (
          fieldObj instanceof ForeignKey &&
          fieldObj.getColumnName() === field
        ) {
          return fieldName;
        }
      }
    } catch {
      // If model introspection fails, return field as-is
    }

    return field;
  }

  /**
   * Parse a filter key to extract field name and lookup expression
   *
   * @example
   * "title" -> { field: "title", lookup: null }
   * "title__contains" -> { field: "title", lookup: "contains" }
   * "created_at__gte" -> { field: "created_at", lookup: "gte" }
   */
  private parseFilterKey(
    key: string,
  ): { field: string; lookup: string | null } {
    const parts = key.split("__");

    if (parts.length === 1) {
      return { field: key, lookup: null };
    }

    // Check if the last part is a valid lookup
    const lastPart = parts[parts.length - 1];
    if (QueryParamFilterBackend.VALID_LOOKUPS.has(lastPart)) {
      return {
        field: parts.slice(0, -1).join("__"),
        lookup: lastPart,
      };
    }

    // Not a lookup, treat the whole thing as a field name
    // (could be a related field like "author__name")
    return { field: key, lookup: null };
  }

  /**
   * Parse a filter value from query string to appropriate type
   *
   * Converts string values to boolean, number, null, or array as appropriate.
   */
  private parseFilterValue(value: string, lookup: string | null): unknown {
    // Handle 'in' lookup - expects comma-separated values
    if (lookup === "in") {
      return value.split(",").map((v) => this.parseSingleValue(v.trim()));
    }

    // Handle 'range' lookup - expects two comma-separated values
    if (lookup === "range") {
      const parts = value.split(",").map((v) =>
        this.parseSingleValue(v.trim())
      );
      if (parts.length === 2) {
        return parts;
      }
      // Invalid range, return as-is
      return value;
    }

    // Handle 'isnull' lookup - expects boolean
    if (lookup === "isnull") {
      return value === "true" || value === "1";
    }

    return this.parseSingleValue(value);
  }

  /**
   * Parse a single value to appropriate type
   */
  private parseSingleValue(value: string): unknown {
    // Boolean values
    if (value === "true") return true;
    if (value === "false") return false;

    // Null value
    if (value === "null") return null;

    // Try parsing as number
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== "") {
      return num;
    }

    // Return as string
    return value;
  }
}

// ============================================================================
// SearchFilter (placeholder for future implementation)
// ============================================================================

/**
 * Filter backend that provides text search across multiple fields
 *
 * Similar to DRF's SearchFilter. Uses the `search` query parameter.
 *
 * @example
 * ```ts
 * class ArticleViewSet extends ModelViewSet {
 *   model = ArticleModel;
 *   serializerClass = ArticleSerializer;
 *   filterBackends = [new SearchFilter()];
 *   searchFields = ['title', 'body', 'author__name'];
 * }
 *
 * // GET /api/articles/?search=typescript
 * ```
 */
export class SearchFilter implements FilterBackend {
  /**
   * Apply basic text search using the `search` query parameter.
   */
  filterQueryset<T extends Model>(
    queryset: QuerySet<T>,
    context: ViewSetContext,
    viewset: FilterableViewSet & { searchFields?: string[] },
  ): QuerySet<T> {
    const searchFields = viewset.searchFields;

    if (!searchFields || searchFields.length === 0) {
      return queryset;
    }

    const url = new URL(context.request.url);
    const searchTerm = url.searchParams.get("search");

    if (!searchTerm || searchTerm.trim() === "") {
      return queryset;
    }

    // For now, search on the first field with icontains
    // TODO: Implement proper OR-based search across multiple fields
    // This requires Q objects support in the ORM
    const firstField = searchFields[0];
    return queryset.filter({
      [`${firstField}__icontains`]: searchTerm.trim(),
    });
  }
}

// ============================================================================
// OrderingFilter
// ============================================================================

/**
 * Filter backend that provides ordering via the `ordering` query parameter
 *
 * @example
 * ```ts
 * class ArticleViewSet extends ModelViewSet {
 *   model = ArticleModel;
 *   serializerClass = ArticleSerializer;
 *   filterBackends = [new OrderingFilter()];
 *   orderingFields = ['title', 'createdAt', 'updatedAt'];
 *   ordering = ['-createdAt']; // default ordering
 * }
 *
 * // GET /api/articles/?ordering=-created_at,title
 * ```
 */
export class OrderingFilter implements FilterBackend {
  /**
   * Apply ordering from the `ordering` query parameter or view defaults.
   */
  filterQueryset<T extends Model>(
    queryset: QuerySet<T>,
    context: ViewSetContext,
    viewset: FilterableViewSet & {
      orderingFields?: string[];
      ordering?: string[];
    },
  ): QuerySet<T> {
    const allowedFields = viewset.orderingFields;
    const url = new URL(context.request.url);
    const orderingParam = url.searchParams.get("ordering");

    let orderingFields: string[] = [];

    if (orderingParam) {
      // Parse ordering parameter
      const requestedFields = orderingParam.split(",").map((f) => f.trim());

      // Filter to only allowed fields
      if (allowedFields && allowedFields.length > 0) {
        orderingFields = requestedFields.filter((field) => {
          const fieldName = field.startsWith("-") ? field.slice(1) : field;
          return allowedFields.includes(fieldName);
        });
      } else {
        // If no allowed fields specified, allow all
        orderingFields = requestedFields;
      }
    } else if (viewset.ordering) {
      // Use default ordering
      orderingFields = viewset.ordering;
    }

    if (orderingFields.length > 0) {
      return queryset.orderBy(...orderingFields);
    }

    return queryset;
  }
}
