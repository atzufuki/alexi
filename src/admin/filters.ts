/**
 * Filter utilities for Alexi Admin
 *
 * This module provides filter configuration, URL parameter parsing,
 * and serialization for the admin list view filters.
 *
 * @module
 */

import type { FieldInfo } from "./introspection.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Filter type enum
 */
export type FilterType = "boolean" | "choice" | "date_range" | "text";

/**
 * Date range value with optional gte (>=) and lte (<=) bounds
 */
export interface DateRangeValue {
  gte?: string;
  lte?: string;
}

/**
 * Filter value can be a primitive, date range, or undefined
 */
export type FilterValue = string | boolean | DateRangeValue | undefined;

/**
 * Filter configuration for a single field
 */
export interface FilterConfig {
  /** Field name to filter on */
  field: string;
  /** Filter type */
  type: FilterType;
  /** Human-readable label */
  label: string;
  /** Choices for choice filters */
  choices?: [unknown, string][];
}

/**
 * Record of field names to filter values
 */
export type FilterValues = Record<string, FilterValue>;

// =============================================================================
// Filter Configuration
// =============================================================================

/**
 * Get filter configurations for the specified fields.
 *
 * @param modelFields - All fields from the model
 * @param filterFields - Field names to create filters for
 * @returns Array of FilterConfig objects
 */
export function getFiltersForFields(
  modelFields: FieldInfo[],
  filterFields: string[],
): FilterConfig[] {
  const filters: FilterConfig[] = [];

  for (const fieldName of filterFields) {
    const fieldInfo = modelFields.find((f) => f.name === fieldName);
    if (!fieldInfo) {
      continue;
    }

    const filterType = getFilterTypeForField(fieldInfo);
    const label = fieldInfo.options.verboseName ?? humanize(fieldName);
    const choices = fieldInfo.options.choices as
      | [unknown, string][]
      | undefined;

    filters.push({
      field: fieldName,
      type: filterType,
      label,
      choices,
    });
  }

  return filters;
}

/**
 * Determine the appropriate filter type for a field.
 *
 * @param fieldInfo - Field information
 * @returns Filter type
 */
function getFilterTypeForField(fieldInfo: FieldInfo): FilterType {
  // Boolean fields get boolean filter
  if (fieldInfo.type === "BooleanField") {
    return "boolean";
  }

  // Date/DateTime fields get date range filter
  if (fieldInfo.type === "DateField" || fieldInfo.type === "DateTimeField") {
    return "date_range";
  }

  // Fields with choices get choice filter
  if (fieldInfo.options.choices && fieldInfo.options.choices.length > 0) {
    return "choice";
  }

  // Default to text filter
  return "text";
}

/**
 * Get filter choices for a field.
 * Returns boolean choices for BooleanField, field choices for choice fields,
 * or undefined for other fields.
 *
 * @param fieldInfo - Field information
 * @returns Array of [value, label] pairs or undefined
 */
export function getFilterChoices(
  fieldInfo: FieldInfo,
): [unknown, string][] | undefined {
  // Boolean fields return yes/no choices
  if (fieldInfo.type === "BooleanField") {
    return [
      [true, "Yes"],
      [false, "No"],
    ];
  }

  // Return field choices if present
  if (fieldInfo.options.choices && fieldInfo.options.choices.length > 0) {
    return fieldInfo.options.choices as [unknown, string][];
  }

  return undefined;
}

// =============================================================================
// URL Parameter Parsing
// =============================================================================

/**
 * Parse URL search params into filter values.
 *
 * @param params - URLSearchParams from the current URL
 * @param filters - Filter configurations to parse
 * @returns Record of field names to filter values
 */
export function parseFilterParams(
  params: URLSearchParams,
  filters: FilterConfig[],
): FilterValues {
  const result: FilterValues = {};

  for (const filter of filters) {
    switch (filter.type) {
      case "boolean": {
        const value = params.get(filter.field);
        if (value === "true") {
          result[filter.field] = true;
        } else if (value === "false") {
          result[filter.field] = false;
        }
        break;
      }

      case "choice":
      case "text": {
        const value = params.get(filter.field);
        if (value && value.length > 0) {
          result[filter.field] = value;
        }
        break;
      }

      case "date_range": {
        const gteValue = params.get(`${filter.field}__gte`);
        const lteValue = params.get(`${filter.field}__lte`);

        if (gteValue || lteValue) {
          const dateRange: DateRangeValue = {};
          if (gteValue) {
            dateRange.gte = gteValue;
          }
          if (lteValue) {
            dateRange.lte = lteValue;
          }
          result[filter.field] = dateRange;
        }
        break;
      }
    }
  }

  return result;
}

// =============================================================================
// URL Parameter Serialization
// =============================================================================

/**
 * Serialize filter values to URLSearchParams.
 *
 * @param values - Filter values to serialize
 * @returns URLSearchParams with filter values
 */
export function serializeFilterParams(values: FilterValues): URLSearchParams {
  const params = new URLSearchParams();

  for (const [field, value] of Object.entries(values)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "boolean") {
      params.set(field, value ? "true" : "false");
    } else if (typeof value === "string") {
      if (value.length > 0) {
        params.set(field, value);
      }
    } else if (typeof value === "object") {
      // DateRangeValue
      const dateRange = value as DateRangeValue;
      if (dateRange.gte) {
        params.set(`${field}__gte`, dateRange.gte);
      }
      if (dateRange.lte) {
        params.set(`${field}__lte`, dateRange.lte);
      }
    }
  }

  return params;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert camelCase/snake_case to human-readable label.
 *
 * @param str - Field name to humanize
 * @returns Human-readable label
 */
function humanize(str: string): string {
  return str
    // Insert space before capital letters
    .replace(/([A-Z])/g, " $1")
    // Replace underscores with spaces
    .replace(/_/g, " ")
    // Capitalize first letter
    .replace(/^./, (s) => s.toUpperCase())
    // Clean up multiple spaces
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Merge filter params with existing URL params, preserving non-filter params.
 *
 * @param currentParams - Current URL search params
 * @param filterValues - New filter values
 * @param filters - Filter configurations
 * @returns New URLSearchParams with merged values
 */
export function mergeFilterParams(
  currentParams: URLSearchParams,
  filterValues: FilterValues,
  filters: FilterConfig[],
): URLSearchParams {
  const result = new URLSearchParams();

  // Preserve non-filter params (like 'q' for search, 'page', 'per_page')
  const filterFieldSet = new Set<string>();
  for (const filter of filters) {
    filterFieldSet.add(filter.field);
    if (filter.type === "date_range") {
      filterFieldSet.add(`${filter.field}__gte`);
      filterFieldSet.add(`${filter.field}__lte`);
    }
  }

  for (const [key, value] of currentParams.entries()) {
    if (!filterFieldSet.has(key)) {
      result.set(key, value);
    }
  }

  // Add filter values
  const filterParams = serializeFilterParams(filterValues);
  for (const [key, value] of filterParams.entries()) {
    result.set(key, value);
  }

  return result;
}

/**
 * Clear all filter values while preserving other URL params.
 *
 * @param currentParams - Current URL search params
 * @param filters - Filter configurations
 * @returns New URLSearchParams with filters cleared
 */
export function clearFilterParams(
  currentParams: URLSearchParams,
  filters: FilterConfig[],
): URLSearchParams {
  return mergeFilterParams(currentParams, {}, filters);
}

/**
 * Check if any filters are currently active.
 *
 * @param values - Current filter values
 * @returns True if any filter has a value
 */
export function hasActiveFilters(values: FilterValues): boolean {
  for (const value of Object.values(values)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === "string" && value.length === 0) {
      continue;
    }
    if (typeof value === "object") {
      const dateRange = value as DateRangeValue;
      if (dateRange.gte || dateRange.lte) {
        return true;
      }
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Get the count of active filters.
 *
 * @param values - Current filter values
 * @returns Number of active filters
 */
export function countActiveFilters(values: FilterValues): number {
  let count = 0;

  for (const value of Object.values(values)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === "string" && value.length === 0) {
      continue;
    }
    if (typeof value === "object") {
      const dateRange = value as DateRangeValue;
      if (dateRange.gte || dateRange.lte) {
        count++;
      }
      continue;
    }
    count++;
  }

  return count;
}
