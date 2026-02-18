/**
 * State comparator for migrations
 *
 * Compares current model state to migration state and detects changes
 * that require new migrations.
 *
 * @module
 */

import { FieldState, ModelState, ProjectState } from "./state.ts";

// ============================================================================
// Change Types
// ============================================================================

/**
 * Types of changes that can be detected
 */
export type ChangeType =
  | "create_model"
  | "delete_model"
  | "rename_model"
  | "add_field"
  | "remove_field"
  | "alter_field"
  | "rename_field"
  | "add_index"
  | "remove_index"
  | "alter_unique_together";

/**
 * Base interface for all changes
 */
export interface BaseChange {
  type: ChangeType;
  appLabel: string;
}

/**
 * Model was created
 */
export interface CreateModelChange extends BaseChange {
  type: "create_model";
  modelName: string;
  model: ModelState;
}

/**
 * Model was deleted
 */
export interface DeleteModelChange extends BaseChange {
  type: "delete_model";
  modelName: string;
  model: ModelState;
}

/**
 * Model was renamed
 */
export interface RenameModelChange extends BaseChange {
  type: "rename_model";
  oldModelName: string;
  newModelName: string;
}

/**
 * Field was added
 */
export interface AddFieldChange extends BaseChange {
  type: "add_field";
  modelName: string;
  fieldName: string;
  field: FieldState;
}

/**
 * Field was removed
 */
export interface RemoveFieldChange extends BaseChange {
  type: "remove_field";
  modelName: string;
  fieldName: string;
  field: FieldState;
}

/**
 * Field was altered
 */
export interface AlterFieldChange extends BaseChange {
  type: "alter_field";
  modelName: string;
  fieldName: string;
  oldField: FieldState;
  newField: FieldState;
  changes: string[]; // What changed (e.g., ["maxLength", "null"])
}

/**
 * Field was renamed
 */
export interface RenameFieldChange extends BaseChange {
  type: "rename_field";
  modelName: string;
  oldFieldName: string;
  newFieldName: string;
}

/**
 * Index was added
 */
export interface AddIndexChange extends BaseChange {
  type: "add_index";
  modelName: string;
  indexName: string;
  fields: string[];
  unique: boolean;
}

/**
 * Index was removed
 */
export interface RemoveIndexChange extends BaseChange {
  type: "remove_index";
  modelName: string;
  indexName: string;
  fields: string[];
}

/**
 * Unique together constraint was altered
 */
export interface AlterUniqueTogetherChange extends BaseChange {
  type: "alter_unique_together";
  modelName: string;
  oldUniqueTogether: string[][];
  newUniqueTogether: string[][];
}

/**
 * Union type for all changes
 */
export type Change =
  | CreateModelChange
  | DeleteModelChange
  | RenameModelChange
  | AddFieldChange
  | RemoveFieldChange
  | AlterFieldChange
  | RenameFieldChange
  | AddIndexChange
  | RemoveIndexChange
  | AlterUniqueTogetherChange;

// ============================================================================
// State Comparator
// ============================================================================

/**
 * Options for state comparison
 */
export interface CompareOptions {
  /**
   * Whether to detect renames (more expensive)
   * Default: true
   */
  detectRenames?: boolean;

  /**
   * Similarity threshold for rename detection (0.0 to 1.0)
   * Fields must have this similarity to be considered a rename
   * Default: 0.8
   */
  renameThreshold?: number;
}

/**
 * Compares two ProjectStates and detects changes
 *
 * @example
 * ```ts
 * const comparator = new StateComparator();
 * const changes = comparator.compare(migrationState, currentModelState);
 *
 * if (changes.length > 0) {
 *   console.log("Detected changes:");
 *   for (const change of changes) {
 *     console.log(`  ${change.type}: ${formatChange(change)}`);
 *   }
 * }
 * ```
 */
export class StateComparator {
  private options: Required<CompareOptions>;

  constructor(options: CompareOptions = {}) {
    this.options = {
      detectRenames: options.detectRenames ?? true,
      renameThreshold: options.renameThreshold ?? 0.8,
    };
  }

  /**
   * Compare two states and return list of changes
   *
   * @param fromState - The "old" state (usually migration state)
   * @param toState - The "new" state (usually current model state)
   * @returns List of detected changes
   */
  compare(fromState: ProjectState, toState: ProjectState): Change[] {
    const changes: Change[] = [];

    // Get all models from both states
    const fromModels = fromState.getModels();
    const toModels = toState.getModels();

    // Track which models we've processed
    const processedFrom = new Set<string>();
    const processedTo = new Set<string>();

    // Detect renames first (if enabled)
    if (this.options.detectRenames) {
      const renames = this.detectModelRenames(fromModels, toModels);
      for (const rename of renames) {
        changes.push(rename);
        processedFrom.add(`${rename.appLabel}.${rename.oldModelName}`);
        processedTo.add(`${rename.appLabel}.${rename.newModelName}`);
      }
    }

    // Process models that exist in toState
    for (const [fullName, toModel] of toModels) {
      if (processedTo.has(fullName)) continue;

      const fromModel = fromModels.get(fullName);
      if (!fromModel) {
        // Model was created
        changes.push({
          type: "create_model",
          appLabel: toModel.appLabel,
          modelName: toModel.name,
          model: toModel,
        });
      } else {
        // Model exists in both - compare fields
        const fieldChanges = this.compareModel(fromModel, toModel);
        changes.push(...fieldChanges);
        processedFrom.add(fullName);
      }
      processedTo.add(fullName);
    }

    // Models that only exist in fromState were deleted
    for (const [fullName, fromModel] of fromModels) {
      if (processedFrom.has(fullName)) continue;

      changes.push({
        type: "delete_model",
        appLabel: fromModel.appLabel,
        modelName: fromModel.name,
        model: fromModel,
      });
    }

    return changes;
  }

  /**
   * Compare two models and return field-level changes
   */
  private compareModel(fromModel: ModelState, toModel: ModelState): Change[] {
    const changes: Change[] = [];
    const appLabel = toModel.appLabel;
    const modelName = toModel.name;

    // Track processed fields
    const processedFrom = new Set<string>();
    const processedTo = new Set<string>();

    // Detect field renames
    if (this.options.detectRenames) {
      const renames = this.detectFieldRenames(fromModel, toModel);
      for (const rename of renames) {
        changes.push(rename);
        processedFrom.add(rename.oldFieldName);
        processedTo.add(rename.newFieldName);
      }
    }

    // Process fields in toModel
    for (const fieldName of toModel.getFieldNames()) {
      if (processedTo.has(fieldName)) continue;

      const toField = toModel.getField(fieldName)!;
      const fromField = fromModel.getField(fieldName);

      if (!fromField) {
        // Field was added
        changes.push({
          type: "add_field",
          appLabel,
          modelName,
          fieldName,
          field: toField,
        });
      } else {
        // Field exists in both - check for alterations
        const alterChanges = this.compareField(
          fromField,
          toField,
          appLabel,
          modelName,
          fieldName,
        );
        if (alterChanges) {
          changes.push(alterChanges);
        }
        processedFrom.add(fieldName);
      }
      processedTo.add(fieldName);
    }

    // Fields that only exist in fromModel were removed
    for (const fieldName of fromModel.getFieldNames()) {
      if (processedFrom.has(fieldName)) continue;

      changes.push({
        type: "remove_field",
        appLabel,
        modelName,
        fieldName,
        field: fromModel.getField(fieldName)!,
      });
    }

    // Compare indexes
    const indexChanges = this.compareIndexes(fromModel, toModel);
    changes.push(...indexChanges);

    // Compare unique_together
    const uniqueTogetherChange = this.compareUniqueTogether(fromModel, toModel);
    if (uniqueTogetherChange) {
      changes.push(uniqueTogetherChange);
    }

    return changes;
  }

  /**
   * Compare two fields and return alter change if different
   */
  private compareField(
    fromField: FieldState,
    toField: FieldState,
    appLabel: string,
    modelName: string,
    fieldName: string,
  ): AlterFieldChange | null {
    const changedOptions: string[] = [];

    // Compare type
    if (fromField.type !== toField.type) {
      changedOptions.push("type");
    }

    // Compare column name
    if (fromField.columnName !== toField.columnName) {
      changedOptions.push("columnName");
    }

    // Compare options
    const allOptionKeys = new Set([
      ...Object.keys(fromField.options),
      ...Object.keys(toField.options),
    ]);

    for (const key of allOptionKeys) {
      const fromValue = fromField.options[key];
      const toValue = toField.options[key];

      if (!this.optionsEqual(fromValue, toValue)) {
        changedOptions.push(key);
      }
    }

    if (changedOptions.length > 0) {
      return {
        type: "alter_field",
        appLabel,
        modelName,
        fieldName,
        oldField: fromField,
        newField: toField,
        changes: changedOptions,
      };
    }

    return null;
  }

  /**
   * Compare two option values for equality
   */
  private optionsEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === undefined && b === undefined) return true;
    if (a === null && b === null) return true;
    if (a === undefined || b === undefined) return false;
    if (a === null || b === null) return false;

    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.optionsEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (typeof a === "object" && typeof b === "object") {
      const aKeys = Object.keys(a as object);
      const bKeys = Object.keys(b as object);
      if (aKeys.length !== bKeys.length) return false;
      for (const key of aKeys) {
        if (
          !this.optionsEqual(
            (a as Record<string, unknown>)[key],
            (b as Record<string, unknown>)[key],
          )
        ) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Compare indexes between two models
   */
  private compareIndexes(
    fromModel: ModelState,
    toModel: ModelState,
  ): Change[] {
    const changes: Change[] = [];
    const appLabel = toModel.appLabel;
    const modelName = toModel.name;

    // Create sets for comparison
    const fromIndexKeys = new Set(
      fromModel.indexes.map((i) => this.indexKey(i)),
    );
    const toIndexKeys = new Set(toModel.indexes.map((i) => this.indexKey(i)));

    // Find added indexes
    for (const index of toModel.indexes) {
      const key = this.indexKey(index);
      if (!fromIndexKeys.has(key)) {
        changes.push({
          type: "add_index",
          appLabel,
          modelName,
          indexName: index.name ??
            `${toModel.dbTable}_${index.fields.join("_")}_idx`,
          fields: index.fields,
          unique: index.unique ?? false,
        });
      }
    }

    // Find removed indexes
    for (const index of fromModel.indexes) {
      const key = this.indexKey(index);
      if (!toIndexKeys.has(key)) {
        changes.push({
          type: "remove_index",
          appLabel,
          modelName,
          indexName: index.name ??
            `${fromModel.dbTable}_${index.fields.join("_")}_idx`,
          fields: index.fields,
        });
      }
    }

    return changes;
  }

  /**
   * Create a unique key for an index
   */
  private indexKey(index: { fields: string[]; unique?: boolean }): string {
    return `${index.fields.sort().join(",")}:${index.unique ?? false}`;
  }

  /**
   * Compare unique_together constraints
   */
  private compareUniqueTogether(
    fromModel: ModelState,
    toModel: ModelState,
  ): AlterUniqueTogetherChange | null {
    const fromUT = fromModel.uniqueTogether;
    const toUT = toModel.uniqueTogether;

    // Normalize for comparison
    const fromKeys = new Set(fromUT.map((ut) => ut.sort().join(",")));
    const toKeys = new Set(toUT.map((ut) => ut.sort().join(",")));

    // Check if they're the same
    if (fromKeys.size !== toKeys.size) {
      return {
        type: "alter_unique_together",
        appLabel: toModel.appLabel,
        modelName: toModel.name,
        oldUniqueTogether: fromUT,
        newUniqueTogether: toUT,
      };
    }

    for (const key of fromKeys) {
      if (!toKeys.has(key)) {
        return {
          type: "alter_unique_together",
          appLabel: toModel.appLabel,
          modelName: toModel.name,
          oldUniqueTogether: fromUT,
          newUniqueTogether: toUT,
        };
      }
    }

    return null;
  }

  /**
   * Detect model renames by comparing structure
   */
  private detectModelRenames(
    fromModels: Map<string, ModelState>,
    toModels: Map<string, ModelState>,
  ): RenameModelChange[] {
    const renames: RenameModelChange[] = [];

    // Find models that were deleted
    const deletedModels: ModelState[] = [];
    for (const [fullName, model] of fromModels) {
      if (!toModels.has(fullName)) {
        deletedModels.push(model);
      }
    }

    // Find models that were created
    const createdModels: ModelState[] = [];
    for (const [fullName, model] of toModels) {
      if (!fromModels.has(fullName)) {
        createdModels.push(model);
      }
    }

    // Try to match deleted to created based on similarity
    const matched = new Set<string>();

    for (const deleted of deletedModels) {
      let bestMatch: ModelState | null = null;
      let bestSimilarity = this.options.renameThreshold;

      for (const created of createdModels) {
        if (matched.has(created.getFullName())) continue;
        if (created.appLabel !== deleted.appLabel) continue;

        const similarity = this.modelSimilarity(deleted, created);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = created;
        }
      }

      if (bestMatch) {
        renames.push({
          type: "rename_model",
          appLabel: deleted.appLabel,
          oldModelName: deleted.name,
          newModelName: bestMatch.name,
        });
        matched.add(deleted.getFullName());
        matched.add(bestMatch.getFullName());
      }
    }

    return renames;
  }

  /**
   * Detect field renames within a model
   */
  private detectFieldRenames(
    fromModel: ModelState,
    toModel: ModelState,
  ): RenameFieldChange[] {
    const renames: RenameFieldChange[] = [];

    // Find fields that were removed
    const removedFields: string[] = [];
    for (const fieldName of fromModel.getFieldNames()) {
      if (!toModel.hasField(fieldName)) {
        removedFields.push(fieldName);
      }
    }

    // Find fields that were added
    const addedFields: string[] = [];
    for (const fieldName of toModel.getFieldNames()) {
      if (!fromModel.hasField(fieldName)) {
        addedFields.push(fieldName);
      }
    }

    // Try to match removed to added based on similarity
    const matched = new Set<string>();

    for (const removed of removedFields) {
      let bestMatch: string | null = null;
      let bestSimilarity = this.options.renameThreshold;

      const removedField = fromModel.getField(removed)!;

      for (const added of addedFields) {
        if (matched.has(added)) continue;

        const addedField = toModel.getField(added)!;
        const similarity = this.fieldSimilarity(removedField, addedField);

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = added;
        }
      }

      if (bestMatch) {
        renames.push({
          type: "rename_field",
          appLabel: toModel.appLabel,
          modelName: toModel.name,
          oldFieldName: removed,
          newFieldName: bestMatch,
        });
        matched.add(removed);
        matched.add(bestMatch);
      }
    }

    return renames;
  }

  /**
   * Calculate similarity between two models (0.0 to 1.0)
   */
  private modelSimilarity(a: ModelState, b: ModelState): number {
    const aFields = new Set(a.getFieldNames());
    const bFields = new Set(b.getFieldNames());

    // Calculate Jaccard similarity
    const intersection = new Set([...aFields].filter((f) => bFields.has(f)));
    const union = new Set([...aFields, ...bFields]);

    if (union.size === 0) return 0;

    // Weight by field similarity
    let matchingScore = 0;
    for (const fieldName of intersection) {
      const aField = a.getField(fieldName)!;
      const bField = b.getField(fieldName)!;
      matchingScore += this.fieldSimilarity(aField, bField);
    }

    return matchingScore / union.size;
  }

  /**
   * Calculate similarity between two fields (0.0 to 1.0)
   */
  private fieldSimilarity(a: FieldState, b: FieldState): number {
    let score = 0;
    let total = 0;

    // Type match (most important)
    total += 3;
    if (a.type === b.type) {
      score += 3;
    }

    // Column name match
    total += 1;
    if (a.columnName === b.columnName) {
      score += 1;
    }

    // Options match
    const allKeys = new Set([
      ...Object.keys(a.options),
      ...Object.keys(b.options),
    ]);

    for (const key of allKeys) {
      total += 1;
      if (this.optionsEqual(a.options[key], b.options[key])) {
        score += 1;
      }
    }

    return score / total;
  }
}

// ============================================================================
// Change Formatting Utilities
// ============================================================================

/**
 * Format a change for display
 */
export function formatChange(change: Change): string {
  switch (change.type) {
    case "create_model":
      return `+ ${change.appLabel}.${change.modelName}`;
    case "delete_model":
      return `- ${change.appLabel}.${change.modelName}`;
    case "rename_model":
      return `~ ${change.appLabel}.${change.oldModelName} → ${change.newModelName}`;
    case "add_field":
      return `+ ${change.appLabel}.${change.modelName}.${change.fieldName}: ${change.field.type}`;
    case "remove_field":
      return `- ${change.appLabel}.${change.modelName}.${change.fieldName}`;
    case "alter_field":
      return `~ ${change.appLabel}.${change.modelName}.${change.fieldName} (${
        change.changes.join(", ")
      })`;
    case "rename_field":
      return `~ ${change.appLabel}.${change.modelName}.${change.oldFieldName} → ${change.newFieldName}`;
    case "add_index":
      return `+ index ${change.indexName} on ${change.modelName}(${
        change.fields.join(", ")
      })`;
    case "remove_index":
      return `- index ${change.indexName} on ${change.modelName}`;
    case "alter_unique_together":
      return `~ ${change.appLabel}.${change.modelName} unique_together`;
  }
}

/**
 * Group changes by type for display
 */
export function groupChanges(changes: Change[]): Map<ChangeType, Change[]> {
  const groups = new Map<ChangeType, Change[]>();

  for (const change of changes) {
    const existing = groups.get(change.type) ?? [];
    existing.push(change);
    groups.set(change.type, existing);
  }

  return groups;
}

/**
 * Categorize changes by prefix (for naming suggestions)
 */
export function categorizeChanges(changes: Change[]): {
  prefix: string;
  description: string;
} {
  const types = new Set(changes.map((c) => c.type));

  // Only create operations
  const createOnly = types.size === 1 && types.has("create_model") &&
    changes.length === 1;
  if (createOnly) {
    const first = changes[0] as CreateModelChange;
    return { prefix: "init", description: first.modelName.toLowerCase() };
  }

  // Only add operations
  const addTypes: ChangeType[] = ["create_model", "add_field", "add_index"];
  const onlyAdds = [...types].every((t) => addTypes.includes(t));
  if (onlyAdds) {
    return { prefix: "feat", description: suggestDescription(changes) };
  }

  // Only remove operations
  const removeTypes: ChangeType[] = [
    "delete_model",
    "remove_field",
    "remove_index",
  ];
  const onlyRemoves = [...types].every((t) => removeTypes.includes(t));
  if (onlyRemoves) {
    return { prefix: "remove", description: suggestDescription(changes) };
  }

  // Only alter operations
  const alterTypes: ChangeType[] = ["alter_field", "alter_unique_together"];
  const onlyAlters = [...types].every((t) => alterTypes.includes(t));
  if (onlyAlters) {
    return { prefix: "fix", description: suggestDescription(changes) };
  }

  // Mix of operations
  return { prefix: "refactor", description: suggestDescription(changes) };
}

/**
 * Suggest a description based on changes
 */
function suggestDescription(changes: Change[]): string {
  // If all changes are on the same model, use the model name
  const models = new Set(
    changes.map((c) => {
      switch (c.type) {
        case "create_model":
        case "delete_model":
          return c.modelName;
        case "rename_model":
          return c.newModelName;
        default:
          return (c as { modelName: string }).modelName;
      }
    }),
  );

  if (models.size === 1) {
    return [...models][0].toLowerCase();
  }

  // If all changes are add_field with the same field name, suggest field concept
  if (changes.every((c) => c.type === "add_field")) {
    const fieldNames = new Set(
      (changes as AddFieldChange[]).map((c) => c.fieldName),
    );
    if (fieldNames.size === 1) {
      const fieldName = [...fieldNames][0];
      // Common patterns
      if (fieldName === "deletedAt" || fieldName === "isDeleted") {
        return "soft_delete";
      }
      if (fieldName === "createdAt" || fieldName === "updatedAt") {
        return "timestamps";
      }
      if (fieldName === "createdBy" || fieldName === "updatedBy") {
        return "audit";
      }
      return fieldName.toLowerCase();
    }
  }

  // No common pattern
  return "";
}
