/**
 * Model Introspection utilities for Alexi Admin
 *
 * This module provides utilities to introspect ORM models and extract
 * field information for dynamic form and table generation.
 *
 * @module
 */

import type { Field, Model } from "@alexi/db";

// =============================================================================
// Types
// =============================================================================

/**
 * Field information extracted from a model field.
 */
export interface FieldInfo {
  /** Field name */
  name: string;
  /** Field type (e.g., "CharField", "IntegerField") */
  type: string;
  /** Field options from the Field instance */
  options: FieldInfoOptions;
  /** Whether this is the primary key field */
  isPrimaryKey: boolean;
  /** Whether this field is editable */
  isEditable: boolean;
  /** Whether this field is auto-generated (auto_now, auto_now_add, etc.) */
  isAuto: boolean;
  /** Whether this field is required (not blank and not null) */
  isRequired: boolean;
  /** Reference to the original Field instance (for relation fields) */
  _field?: Field<unknown>;
}

/**
 * Field options from introspection.
 */
export interface FieldInfoOptions {
  /** Maximum length (for CharField) */
  maxLength?: number;
  /** Allow NULL values */
  null?: boolean;
  /** Allow blank/empty values */
  blank?: boolean;
  /** Default value */
  default?: unknown;
  /** Human-readable field name */
  verboseName?: string;
  /** Help text for the field */
  helpText?: string;
  /** Field choices as [value, displayName] pairs */
  choices?: [unknown, string][];
  /** Whether this field is unique */
  unique?: boolean;
  /** Whether this field is indexed */
  dbIndex?: boolean;
  /** Whether this field is editable */
  editable?: boolean;
}

/**
 * Model metadata extracted from introspection.
 */
export interface ModelMeta {
  /** Model class name */
  name: string;
  /** Database table name */
  tableName: string;
  /** Human-readable model name */
  verboseName: string;
  /** Human-readable plural name */
  verboseNamePlural: string;
  /** Primary key field name */
  primaryKey: string;
  /** Default ordering */
  ordering?: string[];
}

/**
 * Type for Model constructor
 */
// deno-lint-ignore no-explicit-any
type ModelClass<T extends Model = Model> = new () => T;

// =============================================================================
// Field Introspection
// =============================================================================

/**
 * Get all fields from a model class.
 *
 * @param modelClass - The model class to introspect
 * @returns Array of FieldInfo objects
 */
export function getModelFields(modelClass: ModelClass): FieldInfo[] {
  const instance = new modelClass();
  const fields: FieldInfo[] = [];

  // Get fields from the model instance
  const modelFields = instance.getFields();

  for (const [name, field] of Object.entries(modelFields)) {
    fields.push(getFieldInfo(name, field));
  }

  return fields;
}

/**
 * Get detailed information about a single field.
 *
 * @param name - Field name
 * @param field - Field instance
 * @returns FieldInfo object
 */
export function getFieldInfo(name: string, field: Field<unknown>): FieldInfo {
  const fieldType = field.constructor.name;
  const options = field.options;

  // Check if this is a primary key field
  const isPrimaryKey = options.primaryKey === true;

  // AutoField is never editable
  const isAutoField = fieldType === "AutoField";

  // Check for auto timestamp fields
  // deno-lint-ignore no-explicit-any
  const fieldAny = field as any;
  const isAutoTimestamp = fieldAny.autoNow === true ||
    fieldAny.autoNowAdd === true;

  // Determine if editable
  const isEditable = !isAutoField &&
    !isAutoTimestamp &&
    options.editable !== false;

  // Determine if auto-generated
  const isAuto = isAutoField || isAutoTimestamp;

  // Determine if required
  const isRequired = !options.blank && !options.null && !isPrimaryKey;

  // Extract options
  const fieldOptions: FieldInfoOptions = {
    null: options.null,
    blank: options.blank,
    default: options.default,
    verboseName: options.verboseName,
    helpText: options.helpText,
    choices: options.choices as [unknown, string][] | undefined,
    unique: options.unique,
    dbIndex: options.dbIndex,
    editable: options.editable,
  };

  // Get maxLength for CharField
  // deno-lint-ignore no-explicit-any
  const charFieldOptions = (field as any).options;
  if (charFieldOptions?.maxLength !== undefined) {
    fieldOptions.maxLength = charFieldOptions.maxLength;
  }

  return {
    name,
    type: fieldType,
    options: fieldOptions,
    isPrimaryKey,
    isEditable,
    isAuto,
    isRequired,
    _field: field,
  };
}

// =============================================================================
// Widget Mapping
// =============================================================================

/**
 * Map of field types to admin widget types.
 */
const FIELD_WIDGET_MAP: Record<string, string> = {
  AutoField: "admin-input[readonly]",
  CharField: "admin-input",
  TextField: "admin-textarea",
  IntegerField: "admin-input[type=number]",
  FloatField: "admin-input[type=number]",
  DecimalField: "admin-input[type=number]",
  BooleanField: "admin-checkbox",
  DateField: "admin-input[type=date]",
  DateTimeField: "admin-input[type=datetime-local]",
  UUIDField: "admin-input",
  JSONField: "admin-textarea",
  BinaryField: "admin-input[type=file]",
  ForeignKey: "admin-foreign-key-select",
  ManyToManyField: "admin-many-to-many-select",
  OneToOneField: "admin-foreign-key-select",
};

/**
 * Get the appropriate widget type for a field.
 *
 * @param fieldInfo - The field information
 * @returns Widget type string
 */
export function getWidgetForField(fieldInfo: FieldInfo): string {
  // Check for choices - use select widget
  if (
    fieldInfo.options.choices && fieldInfo.options.choices.length > 0 &&
    fieldInfo.type !== "BooleanField"
  ) {
    return "admin-select";
  }

  // Look up in the widget map
  const widget = FIELD_WIDGET_MAP[fieldInfo.type];
  if (widget) {
    return widget;
  }

  // Default to text input
  return "admin-input";
}

// =============================================================================
// Model Metadata
// =============================================================================

/**
 * Get model metadata.
 *
 * @param modelClass - The model class to introspect
 * @returns ModelMeta object
 */
export function getModelMeta(modelClass: ModelClass): ModelMeta {
  const instance = new modelClass();

  // Get model meta from static property
  // deno-lint-ignore no-explicit-any
  const modelMeta = (modelClass as any).meta ?? {};

  // Get table name
  const tableName = modelMeta.dbTable ?? modelClass.name.toLowerCase() + "s";

  // Get verbose name
  const verboseName = modelMeta.verboseName ?? humanize(modelClass.name);

  // Get verbose name plural
  const verboseNamePlural = modelMeta.verboseNamePlural ??
    `${verboseName}s`;

  // Get primary key field name
  const pkField = instance.getPrimaryKeyField();
  const primaryKey = pkField?.name ?? "id";

  // Get ordering
  const ordering = modelMeta.ordering;

  return {
    name: modelClass.name,
    tableName,
    verboseName,
    verboseNamePlural,
    primaryKey,
    ordering,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert camelCase/PascalCase to human-readable text.
 *
 * @param str - The string to humanize
 * @returns Human-readable string
 */
function humanize(str: string): string {
  // Remove "Model" suffix if present
  let result = str.replace(/Model$/, "");

  // Split on capital letters and join with spaces
  result = result
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

  return result;
}

/**
 * Get the display value for a field.
 *
 * @param fieldInfo - The field information
 * @param value - The field value
 * @returns Display string
 */
export function getDisplayValue(
  fieldInfo: FieldInfo,
  value: unknown,
): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return "-";
  }

  // Handle boolean
  if (fieldInfo.type === "BooleanField") {
    return value ? "Yes" : "No";
  }

  // Handle date/datetime
  if (fieldInfo.type === "DateField" || fieldInfo.type === "DateTimeField") {
    if (value instanceof Date) {
      return fieldInfo.type === "DateField" ? value.toLocaleDateString() : value.toLocaleString();
    }
    return String(value);
  }

  // Handle choices
  if (fieldInfo.options.choices) {
    const choice = fieldInfo.options.choices.find(([v]) => v === value);
    if (choice) {
      return choice[1];
    }
  }

  // Default: convert to string
  return String(value);
}

/**
 * Get editable fields from a model.
 *
 * @param modelClass - The model class to introspect
 * @returns Array of editable FieldInfo objects
 */
export function getEditableFields(modelClass: ModelClass): FieldInfo[] {
  return getModelFields(modelClass).filter((f) => f.isEditable);
}

/**
 * Get fields suitable for list display.
 *
 * @param modelClass - The model class to introspect
 * @returns Array of FieldInfo objects suitable for list view
 */
export function getListDisplayFields(modelClass: ModelClass): FieldInfo[] {
  return getModelFields(modelClass).filter((f) =>
    // Exclude large text fields from list display
    f.type !== "TextField" && f.type !== "JSONField" && f.type !== "BinaryField"
  );
}
