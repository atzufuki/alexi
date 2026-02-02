/**
 * Relation field utilities for Alexi Admin
 *
 * This module provides utilities for handling relation fields
 * (ForeignKey, OneToOneField, ManyToManyField) in the admin interface.
 *
 * @module
 */

import type { FieldInfo } from "./introspection.ts";
import { getModelMeta, type ModelMeta } from "./introspection.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Relation type enum
 */
export type RelationType = "foreignkey" | "onetoone" | "manytomany";

/**
 * Relation field information extracted from model fields
 */
export interface RelationFieldInfo {
  /** Field name */
  name: string;
  /** Type of relation */
  relationType: RelationType;
  /** Whether this field allows multiple selections (M2M) */
  isMultiple: boolean;
  /** Whether this field is required */
  isRequired: boolean;
  /** Human-readable label */
  label: string;
  /** The related model class (if available) */
  relatedModel?: unknown;
  /** Fields to search when using autocomplete */
  searchFields?: string[];
  /** Field to use for display value */
  displayField?: string;
  /** Help text for the field */
  helpText?: string;
}

/**
 * Related model information
 */
export interface RelatedModelInfo {
  /** Model class name */
  name: string;
  /** Human-readable name */
  verboseName: string;
  /** Human-readable plural name */
  verboseNamePlural: string;
  /** Primary key field name */
  primaryKey: string;
}

// =============================================================================
// Relation Type Constants
// =============================================================================

const RELATION_FIELD_TYPES = [
  "ForeignKey",
  "OneToOneField",
  "ManyToManyField",
];

// =============================================================================
// Relation Field Detection
// =============================================================================

/**
 * Check if a field is a relation field.
 *
 * @param fieldInfo - Field information
 * @returns True if the field is a relation (FK, O2O, or M2M)
 */
export function isRelationField(fieldInfo: FieldInfo): boolean {
  return RELATION_FIELD_TYPES.includes(fieldInfo.type);
}

/**
 * Get detailed relation information for a field.
 *
 * @param fieldInfo - Field information
 * @returns RelationFieldInfo or null if not a relation field
 */
export function getRelationFieldInfo(
  fieldInfo: FieldInfo,
): RelationFieldInfo | null {
  if (!isRelationField(fieldInfo)) {
    return null;
  }

  const relationType = getRelationType(fieldInfo.type);
  const isMultiple = relationType === "manytomany";

  // ManyToMany fields are never required
  // ForeignKey/OneToOne are required unless null/blank is set
  const isRequired = isMultiple ? false : !fieldInfo.options.null && !fieldInfo.options.blank;

  // Get label from verboseName or humanize field name
  const label = fieldInfo.options.verboseName ?? humanize(fieldInfo.name);

  // Get related model from field if available
  // deno-lint-ignore no-explicit-any
  const fieldAny = fieldInfo as any;
  const relatedModel = fieldAny._field?.getRelatedModel?.() ??
    fieldAny._field?.relatedModel;

  return {
    name: fieldInfo.name,
    relationType,
    isMultiple,
    isRequired,
    label,
    relatedModel,
    searchFields: undefined, // Can be configured per-field
    displayField: undefined, // Can be configured per-field
    helpText: fieldInfo.options.helpText,
  };
}

/**
 * Get the relation type from a field type string.
 *
 * @param fieldType - Field type string
 * @returns RelationType
 */
function getRelationType(fieldType: string): RelationType {
  switch (fieldType) {
    case "ForeignKey":
      return "foreignkey";
    case "OneToOneField":
      return "onetoone";
    case "ManyToManyField":
      return "manytomany";
    default:
      return "foreignkey";
  }
}

// =============================================================================
// Get Relation Fields
// =============================================================================

/**
 * Get all relation fields from a list of fields.
 *
 * @param fields - Array of field info objects
 * @returns Array of RelationFieldInfo objects
 */
export function getRelationFields(fields: FieldInfo[]): RelationFieldInfo[] {
  const relationFields: RelationFieldInfo[] = [];

  for (const field of fields) {
    const info = getRelationFieldInfo(field);
    if (info) {
      relationFields.push(info);
    }
  }

  return relationFields;
}

// =============================================================================
// Related Model Info
// =============================================================================

/**
 * Get metadata about the related model.
 *
 * @param relationInfo - Relation field information
 * @returns RelatedModelInfo or null if model not available
 */
export function getRelatedModelInfo(
  relationInfo: RelationFieldInfo,
): RelatedModelInfo | null {
  const relatedModel = relationInfo.relatedModel;

  if (!relatedModel) {
    return null;
  }

  // Try to get model meta using the introspection utilities
  try {
    // deno-lint-ignore no-explicit-any
    const modelClass = relatedModel as any;
    const meta = getModelMeta(modelClass);

    return {
      name: meta.name,
      verboseName: meta.verboseName,
      verboseNamePlural: meta.verboseNamePlural,
      primaryKey: meta.primaryKey,
    };
  } catch {
    // If we can't get full meta, extract what we can
    // deno-lint-ignore no-explicit-any
    const modelClass = relatedModel as any;
    const name = modelClass.name ?? "Unknown";

    return {
      name,
      verboseName: humanize(name),
      verboseNamePlural: humanize(name) + "s",
      primaryKey: "id",
    };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert camelCase/PascalCase/snake_case to human-readable label.
 *
 * @param str - Field name to humanize
 * @returns Human-readable label
 */
function humanize(str: string): string {
  return str
    // Remove Model suffix
    .replace(/Model$/, "")
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
 * Format a related object for display.
 *
 * @param obj - The related object
 * @param displayField - Field to use for display (optional)
 * @returns Display string
 */
export function formatRelatedObject(
  obj: unknown,
  displayField?: string,
): string {
  if (obj === null || obj === undefined) {
    return "-";
  }

  // If displayField is specified, use it
  if (displayField && typeof obj === "object") {
    // deno-lint-ignore no-explicit-any
    const value = (obj as any)[displayField];
    if (value !== undefined) {
      // If it's a Field instance with .get(), use that
      if (value && typeof value.get === "function") {
        return String(value.get());
      }
      return String(value);
    }
  }

  // Try common display fields
  const commonFields = ["name", "title", "label", "email", "username"];
  if (typeof obj === "object") {
    for (const field of commonFields) {
      // deno-lint-ignore no-explicit-any
      const value = (obj as any)[field];
      if (value !== undefined) {
        if (value && typeof value.get === "function") {
          return String(value.get());
        }
        return String(value);
      }
    }
  }

  // Try __str__ or toString
  // deno-lint-ignore no-explicit-any
  const objAny = obj as any;
  if (typeof objAny.__str__ === "function") {
    return objAny.__str__();
  }

  // Fall back to string representation
  return String(obj);
}

/**
 * Extract the ID from a related object or value.
 *
 * @param value - The value (could be ID or object)
 * @param pkField - Primary key field name (default: "id")
 * @returns The ID value or null
 */
export function extractRelatedId(
  value: unknown,
  pkField: string = "id",
): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  // If it's a primitive (already an ID), return it
  if (typeof value !== "object") {
    return value;
  }

  // If it's an object, extract the PK
  // deno-lint-ignore no-explicit-any
  const obj = value as any;

  // Check if it has the PK field
  const pkValue = obj[pkField];
  if (pkValue !== undefined) {
    // If it's a Field instance, get the value
    if (pkValue && typeof pkValue.get === "function") {
      return pkValue.get();
    }
    return pkValue;
  }

  return null;
}

/**
 * Extract multiple IDs from an array of related objects.
 *
 * @param values - Array of values (could be IDs or objects)
 * @param pkField - Primary key field name (default: "id")
 * @returns Array of ID values
 */
export function extractRelatedIds(
  values: unknown[],
  pkField: string = "id",
): unknown[] {
  return values
    .map((v) => extractRelatedId(v, pkField))
    .filter((id) => id !== null);
}
