/**
 * Bulk action utilities for Alexi Admin
 *
 * This module provides utilities for handling bulk actions
 * in the admin list view.
 *
 * @module
 */

import type { ModelAdmin } from "./model_admin.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Action configuration
 */
export interface ActionConfig {
  /** Action name (e.g., "delete_selected") */
  actionName: string;
  /** Selected item IDs */
  selectedIds: string[];
  /** Number of items affected */
  itemCount: number;
  /** Whether this action requires confirmation */
  requiresConfirmation: boolean;
  /** Confirmation dialog type */
  confirmationType: "danger" | "warning" | "info";
  /** Confirmation dialog title */
  confirmTitle: string;
  /** Confirmation dialog message */
  confirmMessage: string;
  /** Whether to check permissions before executing */
  checkPermissions: boolean;
  /** Model name for display */
  modelName?: string;
}

/**
 * Action result after execution
 */
export interface ActionResult {
  /** Whether the action was successful */
  success: boolean;
  /** Result message */
  message: string;
  /** Number of items affected */
  affectedCount?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Available action definition
 */
export interface ActionDefinition {
  /** Action name */
  name: string;
  /** Human-readable label */
  label: string;
  /** Whether this action is dangerous */
  isDangerous?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the selection is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Options for building action config
 */
export interface BuildActionOptions {
  /** Selected item IDs */
  selectedIds: string[];
  /** Model name for display */
  modelName?: string;
  /** Whether to require confirmation */
  requiresConfirmation?: boolean;
  /** Whether to check permissions */
  checkPermissions?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Actions that are considered dangerous and require confirmation
 */
const DANGEROUS_ACTION_PATTERNS = [
  "delete",
  "remove",
  "purge",
];

/**
 * Default actions that require confirmation
 */
const ACTIONS_REQUIRING_CONFIRMATION = [
  "delete_selected",
  "remove_selected",
  "purge_selected",
];

// =============================================================================
// Action Utilities
// =============================================================================

/**
 * Get available actions from a ModelAdmin.
 *
 * @param admin - The ModelAdmin instance
 * @returns Array of action definitions
 */
export function getAvailableActions(admin: ModelAdmin): ActionDefinition[] {
  const actions: ActionDefinition[] = [];

  for (const actionName of admin.actions) {
    actions.push({
      name: actionName,
      label: humanizeActionName(actionName),
      isDangerous: isDangerousAction(actionName),
    });
  }

  return actions;
}

/**
 * Build action configuration for executing an action.
 *
 * @param actionName - The action to execute
 * @param options - Action options
 * @returns ActionConfig object
 */
export function buildActionConfig(
  actionName: string,
  options: BuildActionOptions,
): ActionConfig {
  const selectedIds = options.selectedIds ?? [];
  const itemCount = selectedIds.length;
  const modelName = options.modelName ?? "item";
  const isDangerous = isDangerousAction(actionName);

  // Determine if confirmation is required
  let requiresConfirmation = options.requiresConfirmation ?? false;
  if (ACTIONS_REQUIRING_CONFIRMATION.includes(actionName) || isDangerous) {
    requiresConfirmation = true;
  }

  // Determine confirmation type
  const confirmationType = isDangerous ? "danger" : "warning";

  // Build confirmation title
  const pluralizedModel = itemCount === 1 ? modelName : pluralize(modelName);
  const actionVerb = getActionVerb(actionName);
  const confirmTitle = `${actionVerb} ${pluralizedModel}`;

  // Build confirmation message
  const confirmMessage = buildConfirmMessage(actionName, itemCount, modelName);

  return {
    actionName,
    selectedIds,
    itemCount,
    requiresConfirmation,
    confirmationType,
    confirmTitle,
    confirmMessage,
    checkPermissions: options.checkPermissions ?? false,
    modelName,
  };
}

/**
 * Validate action selection.
 *
 * @param actionName - The action to validate
 * @param selectedIds - Selected item IDs
 * @returns Validation result
 */
export function validateActionSelection(
  actionName: string,
  selectedIds: string[] | null | undefined,
): ValidationResult {
  if (!actionName || actionName.trim() === "") {
    return {
      valid: false,
      error: "No action selected",
    };
  }

  if (!selectedIds || !Array.isArray(selectedIds) || selectedIds.length === 0) {
    return {
      valid: false,
      error: "No items selected",
    };
  }

  return {
    valid: true,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert snake_case action name to human-readable label.
 *
 * @param actionName - Action name in snake_case
 * @returns Human-readable label
 */
function humanizeActionName(actionName: string): string {
  return actionName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Check if an action is considered dangerous.
 *
 * @param actionName - Action name to check
 * @returns True if dangerous
 */
function isDangerousAction(actionName: string): boolean {
  const lowerName = actionName.toLowerCase();
  return DANGEROUS_ACTION_PATTERNS.some((pattern) =>
    lowerName.includes(pattern)
  );
}

/**
 * Get the verb from an action name for display.
 *
 * @param actionName - Action name
 * @returns Action verb (e.g., "Delete" from "delete_selected")
 */
function getActionVerb(actionName: string): string {
  const parts = actionName.split("_");
  if (parts.length > 0) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  }
  return "Perform";
}

/**
 * Simple pluralization helper.
 *
 * @param word - Word to pluralize
 * @returns Pluralized word
 */
function pluralize(word: string): string {
  if (word.endsWith("s") || word.endsWith("x") || word.endsWith("ch")) {
    return word + "es";
  }
  if (word.endsWith("y") && !/[aeiou]y$/i.test(word)) {
    return word.slice(0, -1) + "ies";
  }
  return word + "s";
}

/**
 * Build confirmation message based on action type.
 *
 * @param actionName - Action name
 * @param itemCount - Number of items
 * @param modelName - Model name
 * @returns Confirmation message
 */
function buildConfirmMessage(
  actionName: string,
  itemCount: number,
  modelName: string,
): string {
  const itemText = itemCount === 1
    ? `1 ${modelName}`
    : `${itemCount} ${pluralize(modelName)}`;

  if (actionName.includes("delete")) {
    return `Are you sure you want to delete ${itemText}? This action cannot be undone.`;
  }

  if (actionName.includes("remove")) {
    return `Are you sure you want to remove ${itemText}? This action cannot be undone.`;
  }

  if (actionName.includes("purge")) {
    return `Are you sure you want to permanently purge ${itemText}? This action cannot be undone.`;
  }

  const verb = getActionVerb(actionName).toLowerCase();
  return `Are you sure you want to ${verb} ${itemText}?`;
}

/**
 * Create a success result.
 *
 * @param message - Success message
 * @param affectedCount - Number of items affected
 * @returns ActionResult
 */
export function createSuccessResult(
  message: string,
  affectedCount?: number,
): ActionResult {
  return {
    success: true,
    message,
    affectedCount,
  };
}

/**
 * Create an error result.
 *
 * @param message - Error message
 * @param error - Detailed error
 * @returns ActionResult
 */
export function createErrorResult(
  message: string,
  error?: string,
): ActionResult {
  return {
    success: false,
    message,
    error,
  };
}
