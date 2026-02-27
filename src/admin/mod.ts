/**
 * Alexi Admin - Django Admin-inspired administration interface
 *
 * A powerful and flexible admin interface for Alexi ORM models,
 * built with HTML Props web components.
 *
 * @module @alexi/admin
 *
 * @example Basic Usage
 * ```typescript
 * import { AdminSite, ModelAdmin, register } from "@alexi/admin";
 * import { UserModel } from "./models/user.ts";
 *
 * // Create an admin site
 * const adminSite = new AdminSite({
 *   title: "My App Admin",
 *   urlPrefix: "/admin",
 * });
 *
 * // Register a model with custom options
 * class UserAdmin extends ModelAdmin {
 *   listDisplay = ["id", "email", "firstName", "isActive"];
 *   searchFields = ["email", "firstName", "lastName"];
 *   listFilter = ["isActive", "subscriptionPlan"];
 *   ordering = ["-createdAt"];
 * }
 *
 * adminSite.register(UserModel, UserAdmin);
 *
 * // Or use the decorator
 * @register(UserModel, adminSite)
 * class DecoratedUserAdmin extends ModelAdmin {
 *   listDisplay = ["email", "isActive"];
 * }
 *
 * export { adminSite };
 * ```
 *
 * @example Using UI Components (browser only)
 * ```typescript
 * // Import components separately for browser environments
 * import { AdminDataTable, AdminButton } from "@alexi/admin/components";
 * ```
 */

// =============================================================================
// Core Classes
// =============================================================================

export { AdminSite, register } from "./site.ts";
export { ModelAdmin } from "./model_admin.ts";

// =============================================================================
// Options & Configuration
// =============================================================================

export type {
  AdminSiteOptions,
  Fieldset,
  ModelAdminBase,
  ModelAdminClass,
  ModelAdminOptions,
  ModelClass,
} from "./options.ts";

export {
  DEFAULT_ADMIN_SITE_OPTIONS,
  DEFAULT_MODEL_ADMIN_OPTIONS,
} from "./options.ts";

// =============================================================================
// Introspection
// =============================================================================

export {
  getDisplayValue,
  getEditableFields,
  getFieldInfo,
  getListDisplayFields,
  getModelFields,
  getModelMeta,
  getWidgetForField,
} from "./introspection.ts";

export type {
  FieldInfo,
  FieldInfoOptions,
  ModelMeta,
} from "./introspection.ts";

// =============================================================================
// URL Routing
// =============================================================================

export { AdminRouter, getAdminUrls } from "./urls.ts";

export type { AdminHandler, AdminUrlPattern, AdminViewType } from "./urls.ts";

// =============================================================================
// Filters
// =============================================================================

export {
  clearFilterParams,
  countActiveFilters,
  getFilterChoices,
  getFiltersForFields,
  hasActiveFilters,
  mergeFilterParams,
  parseFilterParams,
  serializeFilterParams,
} from "./filters.ts";

export type {
  DateRangeValue,
  FilterConfig,
  FilterType,
  FilterValue,
  FilterValues,
} from "./filters.ts";

// =============================================================================
// Relations
// =============================================================================

export {
  extractRelatedId,
  extractRelatedIds,
  formatRelatedObject,
  getRelatedModelInfo,
  getRelationFieldInfo,
  getRelationFields,
  isRelationField,
} from "./relations.ts";

export type {
  RelatedModelInfo,
  RelationFieldInfo,
  RelationType,
} from "./relations.ts";

// =============================================================================
// Actions
// =============================================================================

export {
  buildActionConfig,
  createErrorResult,
  createSuccessResult,
  getAvailableActions,
  validateActionSelection,
} from "./actions.ts";

export type {
  ActionConfig,
  ActionDefinition,
  ActionResult,
  BuildActionOptions,
  ValidationResult,
} from "./actions.ts";
