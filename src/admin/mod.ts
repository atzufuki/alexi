/**
 * Alexi's Django Admin-style administration interface.
 *
 * `@alexi/admin` provides the classes and helpers needed to expose Alexi ORM
 * models through a server-rendered admin UI. It centers on `AdminSite` for site
 * configuration, `ModelAdmin` for per-model behavior, and `AdminRouter` for
 * generating the actual admin URL tree and request handlers.
 *
 * The typical flow is to create an `AdminSite`, register models with
 * `ModelAdmin` subclasses, then mount the generated routes in your application.
 * Supporting exports cover model introspection, list filters, relation helpers,
 * and bulk actions used by the admin implementation. The admin is intended for
 * server-side use and depends on Alexi's request handling, templates, and JWT-
 * backed admin authentication flow.
 *
 * @module @alexi/admin
 *
 * @example Register a model with an admin site
 * ```ts
 * import { AdminSite, ModelAdmin } from "@alexi/admin";
 * import { UserModel } from "./models.ts";
 *
 * const admin_site = new AdminSite({ urlPrefix: "/admin" });
 *
 * class UserAdmin extends ModelAdmin {
 *   listDisplay = ["id", "email", "isActive"];
 *   searchFields = ["email"];
 * }
 *
 * admin_site.register(UserModel, UserAdmin);
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
