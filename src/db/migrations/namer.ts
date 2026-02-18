/**
 * Migration Namer
 *
 * Generates meaningful migration names based on detected changes.
 * Uses conventional commit-style prefixes (init, feat, fix, refactor, remove).
 *
 * @module
 */

import type { Change } from "./comparator.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Prefixes for migration names (inspired by Conventional Commits)
 */
export type MigrationPrefix =
  | "init" // First migration
  | "feat" // Adding new functionality
  | "fix" // Correcting mistakes
  | "refactor" // Reorganizing schema
  | "remove"; // Removing functionality

/**
 * Result of name generation
 */
export interface MigrationNameSuggestion {
  /** Full suggested name (e.g., "0001_feat_user_email") */
  fullName: string;
  /** Just the prefix (e.g., "feat") */
  prefix: MigrationPrefix;
  /** Just the description (e.g., "user_email") */
  description: string;
  /** Confidence level (0.0 to 1.0) */
  confidence: number;
  /** Human-readable explanation of why this name was chosen */
  reason: string;
}

// ============================================================================
// Known Patterns
// ============================================================================

/**
 * Known semantic patterns for field names
 */
const SEMANTIC_PATTERNS: Record<string, string[]> = {
  soft_delete: ["deletedAt", "isDeleted", "deleted_at", "is_deleted"],
  timestamps: ["createdAt", "updatedAt", "created_at", "updated_at"],
  audit: ["createdBy", "updatedBy", "created_by", "updated_by"],
  versioning: ["version", "revision"],
  slug: ["slug"],
  ordering: ["order", "position", "sortOrder", "sort_order"],
  status: ["status", "state"],
  active: ["isActive", "is_active", "active"],
  published: ["isPublished", "is_published", "publishedAt", "published_at"],
};

// ============================================================================
// MigrationNamer
// ============================================================================

/**
 * Generates meaningful migration names based on detected changes
 *
 * @example
 * ```ts
 * const namer = new MigrationNamer();
 * const suggestion = namer.suggestName(changes, existingMigrations);
 *
 * console.log(suggestion.fullName);     // "0002_feat_user_email"
 * console.log(suggestion.reason);       // "Adding email field to User model"
 * console.log(suggestion.confidence);   // 0.85
 * ```
 */
export class MigrationNamer {
  /**
   * Suggest a name for a migration based on changes
   *
   * @param changes - Detected changes from StateComparator
   * @param existingMigrations - List of existing migration names (for numbering)
   * @returns Suggested name with metadata
   */
  suggestName(
    changes: Change[],
    existingMigrations: string[] = [],
  ): MigrationNameSuggestion {
    const number = this._getNextNumber(existingMigrations);
    const { prefix, description, confidence, reason } = this._analyzeChanges(
      changes,
    );

    return {
      fullName: `${number}_${prefix}_${description}`,
      prefix,
      description,
      confidence,
      reason,
    };
  }

  /**
   * Generate multiple name suggestions (for user selection)
   */
  suggestNames(
    changes: Change[],
    existingMigrations: string[] = [],
  ): MigrationNameSuggestion[] {
    const suggestions: MigrationNameSuggestion[] = [];
    const number = this._getNextNumber(existingMigrations);

    // Primary suggestion
    const primary = this._analyzeChanges(changes);
    suggestions.push({
      fullName: `${number}_${primary.prefix}_${primary.description}`,
      prefix: primary.prefix,
      description: primary.description,
      confidence: primary.confidence,
      reason: primary.reason,
    });

    // Alternative: use model names if multiple models
    const modelNames = this._extractModelNames(changes);
    if (modelNames.length > 1 && modelNames.length <= 3) {
      const altDesc = modelNames.map((n) => this._toSnakeCase(n)).join("_and_");
      suggestions.push({
        fullName: `${number}_${primary.prefix}_${altDesc}`,
        prefix: primary.prefix,
        description: altDesc,
        confidence: 0.6,
        reason: `Named after affected models: ${modelNames.join(", ")}`,
      });
    }

    // Alternative: generic change type description
    const changeTypes = [...new Set(changes.map((c) => c.type))];
    if (changeTypes.length === 1) {
      const genericDesc = this._changeTypeToDescription(changeTypes[0]);
      if (genericDesc !== primary.description) {
        suggestions.push({
          fullName: `${number}_${primary.prefix}_${genericDesc}`,
          prefix: primary.prefix,
          description: genericDesc,
          confidence: 0.4,
          reason: `Generic description based on change type`,
        });
      }
    }

    return suggestions;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private _getNextNumber(existingMigrations: string[]): string {
    if (existingMigrations.length === 0) {
      return "0001";
    }

    const numbers = existingMigrations
      .map((name) => {
        const match = name.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));

    const maxNum = Math.max(...numbers, 0);
    return String(maxNum + 1).padStart(4, "0");
  }

  private _analyzeChanges(changes: Change[]): {
    prefix: MigrationPrefix;
    description: string;
    confidence: number;
    reason: string;
  } {
    if (changes.length === 0) {
      return {
        prefix: "feat",
        description: "changes",
        confidence: 0.1,
        reason: "No changes detected, using generic name",
      };
    }

    const types = new Set(changes.map((c) => c.type));

    // Check for specific patterns first

    // 1. Initial migration (single create_model)
    if (types.size === 1 && types.has("create_model") && changes.length === 1) {
      const modelName = this._toSnakeCase(
        (changes[0] as { modelName: string }).modelName,
      );
      return {
        prefix: "init",
        description: modelName,
        confidence: 0.95,
        reason: `Initial migration creating ${modelName} model`,
      };
    }

    // 2. Check for semantic patterns in field names
    const semanticPattern = this._detectSemanticPattern(changes);
    if (semanticPattern) {
      return semanticPattern;
    }

    // 3. Determine prefix based on change types
    const prefix = this._determinePrefix(types);

    // 4. Try to find a good description
    const description = this._generateDescription(changes);

    return {
      prefix,
      description,
      confidence: this._calculateConfidence(changes, description),
      reason: this._generateReason(changes, prefix, description),
    };
  }

  private _detectSemanticPattern(changes: Change[]): {
    prefix: MigrationPrefix;
    description: string;
    confidence: number;
    reason: string;
  } | null {
    // Only look at add_field changes for semantic patterns
    const addFields = changes.filter((c) => c.type === "add_field");
    if (addFields.length === 0) return null;

    const fieldNames = addFields.map(
      (c) => (c as { fieldName: string }).fieldName,
    );

    // Check each semantic pattern
    for (const [pattern, knownFields] of Object.entries(SEMANTIC_PATTERNS)) {
      const matchingFields = fieldNames.filter((f) =>
        knownFields.some(
          (kf) => f.toLowerCase() === kf.toLowerCase(),
        )
      );

      // If all added fields match the same pattern
      if (
        matchingFields.length === fieldNames.length && fieldNames.length > 0
      ) {
        return {
          prefix: "feat",
          description: pattern,
          confidence: 0.9,
          reason: `All added fields match the '${pattern}' pattern`,
        };
      }

      // If multiple models get the same field
      if (matchingFields.length > 1) {
        return {
          prefix: "feat",
          description: pattern,
          confidence: 0.85,
          reason: `Adding ${pattern} fields to multiple models`,
        };
      }
    }

    return null;
  }

  private _determinePrefix(types: Set<string>): MigrationPrefix {
    // Only create operations
    const createOnly = types.size === 1 &&
      (types.has("create_model") || types.has("add_field"));
    if (createOnly) {
      return "feat";
    }

    // Only add operations
    const addTypes = ["create_model", "add_field", "add_index"];
    const onlyAdds = [...types].every((t) => addTypes.includes(t));
    if (onlyAdds) {
      return "feat";
    }

    // Only remove operations
    const removeTypes = ["delete_model", "remove_field", "remove_index"];
    const onlyRemoves = [...types].every((t) => removeTypes.includes(t));
    if (onlyRemoves) {
      return "remove";
    }

    // Only alter operations
    const alterTypes = ["alter_field", "alter_unique_together"];
    const onlyAlters = [...types].every((t) => alterTypes.includes(t));
    if (onlyAlters) {
      return "fix";
    }

    // Mix of operations
    return "refactor";
  }

  private _generateDescription(changes: Change[]): string {
    // If all changes are on the same model
    const modelNames = this._extractModelNames(changes);
    if (modelNames.length === 1) {
      return this._toSnakeCase(modelNames[0]);
    }

    // If all changes are add_field with same field name
    const addFields = changes.filter((c) => c.type === "add_field");
    if (addFields.length === changes.length) {
      const fieldNames = new Set(
        addFields.map((c) => (c as { fieldName: string }).fieldName),
      );
      if (fieldNames.size === 1) {
        return this._toSnakeCase([...fieldNames][0]);
      }
    }

    // If it's create_model for multiple models
    const createModels = changes.filter((c) => c.type === "create_model");
    if (createModels.length === changes.length && createModels.length <= 3) {
      return createModels
        .map((c) => this._toSnakeCase((c as { modelName: string }).modelName))
        .join("_");
    }

    // Fall back to generic based on first change
    if (changes.length > 0) {
      const first = changes[0];
      switch (first.type) {
        case "create_model":
        case "delete_model":
          return this._toSnakeCase((first as { modelName: string }).modelName);
        case "add_field":
        case "remove_field":
        case "alter_field":
          return `${
            this._toSnakeCase((first as { modelName: string }).modelName)
          }_${this._toSnakeCase((first as { fieldName: string }).fieldName)}`;
        case "rename_field":
          return `${
            this._toSnakeCase((first as { modelName: string }).modelName)
          }_rename`;
        case "rename_model":
          return `${
            this._toSnakeCase((first as { newModelName: string }).newModelName)
          }`;
        default:
          return "schema_update";
      }
    }

    return "changes";
  }

  private _extractModelNames(changes: Change[]): string[] {
    const models = new Set<string>();

    for (const change of changes) {
      switch (change.type) {
        case "create_model":
        case "delete_model":
          models.add(change.modelName);
          break;
        case "rename_model":
          models.add(change.newModelName);
          break;
        default:
          if ("modelName" in change) {
            models.add((change as { modelName: string }).modelName);
          }
      }
    }

    return [...models];
  }

  private _changeTypeToDescription(type: string): string {
    switch (type) {
      case "create_model":
        return "create_models";
      case "delete_model":
        return "remove_models";
      case "add_field":
        return "add_fields";
      case "remove_field":
        return "remove_fields";
      case "alter_field":
        return "alter_fields";
      case "rename_field":
        return "rename_fields";
      case "rename_model":
        return "rename_models";
      case "add_index":
        return "add_indexes";
      case "remove_index":
        return "remove_indexes";
      default:
        return "schema_update";
    }
  }

  private _calculateConfidence(changes: Change[], description: string): number {
    let confidence = 0.5;

    // Higher confidence for single model changes
    const modelNames = this._extractModelNames(changes);
    if (modelNames.length === 1) {
      confidence += 0.2;
    }

    // Higher confidence for homogeneous change types
    const types = new Set(changes.map((c) => c.type));
    if (types.size === 1) {
      confidence += 0.15;
    }

    // Lower confidence for generic descriptions
    if (description === "changes" || description === "schema_update") {
      confidence -= 0.3;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private _generateReason(
    changes: Change[],
    prefix: MigrationPrefix,
    description: string,
  ): string {
    const modelNames = this._extractModelNames(changes);
    const types = new Set(changes.map((c) => c.type));

    if (prefix === "init") {
      return `Initial migration creating ${modelNames.join(", ")} model(s)`;
    }

    if (types.size === 1) {
      const type = [...types][0];
      switch (type) {
        case "create_model":
          return `Creating new model(s): ${modelNames.join(", ")}`;
        case "add_field":
          return `Adding fields to ${modelNames.join(", ")}`;
        case "remove_field":
          return `Removing fields from ${modelNames.join(", ")}`;
        case "alter_field":
          return `Modifying fields in ${modelNames.join(", ")}`;
        default:
          return `${type.replace("_", " ")} changes to ${
            modelNames.join(", ")
          }`;
      }
    }

    return `Multiple changes affecting ${modelNames.join(", ")}`;
  }

  private _toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
      .replace(/Model$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }
}
