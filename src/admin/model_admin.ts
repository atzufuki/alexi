/**
 * ModelAdmin class for Alexi Admin
 *
 * This module defines the ModelAdmin class which controls how models
 * are displayed and edited in the admin interface.
 *
 * @module
 */

import type { Model } from "@alexi/db";
import type { Fieldset, ModelAdminBase, ModelClass } from "./options.ts";
import { DEFAULT_MODEL_ADMIN_OPTIONS } from "./options.ts";

// =============================================================================
// ModelAdmin Class
// =============================================================================

/**
 * ModelAdmin controls the display and behavior of a model in the admin interface.
 *
 * @example
 * ```typescript
 * class ArticleAdmin extends ModelAdmin {
 *   listDisplay = ["id", "title", "createdAt"];
 *   searchFields = ["title", "content"];
 *   listFilter = ["status", "category"];
 *   ordering = ["-createdAt"];
 * }
 * ```
 */
export class ModelAdmin implements ModelAdminBase {
  /**
   * The model this admin is for.
   * Set automatically when registering with AdminSite.
   */
  model: ModelClass = null as unknown as ModelClass;

  /**
   * Reference to the AdminSite this admin belongs to.
   * Set automatically when registering.
   */
  // deno-lint-ignore no-explicit-any
  protected _site: any = null;

  /**
   * Fields to display as columns in the list view.
   * If empty, displays all fields.
   */
  listDisplay: string[] = DEFAULT_MODEL_ADMIN_OPTIONS.listDisplay;

  /**
   * Fields that are searchable via the search box.
   */
  searchFields: string[] = DEFAULT_MODEL_ADMIN_OPTIONS.searchFields;

  /**
   * Fields to use for filtering in the sidebar.
   */
  listFilter: string[] = DEFAULT_MODEL_ADMIN_OPTIONS.listFilter;

  /**
   * Default ordering for the list view.
   * Use "-fieldname" for descending order.
   */
  ordering: string[] = DEFAULT_MODEL_ADMIN_OPTIONS.ordering;

  /**
   * Fields to show in the edit/create form.
   * If empty, displays all editable fields.
   */
  fields: string[] = DEFAULT_MODEL_ADMIN_OPTIONS.fields;

  /**
   * Fields that are displayed but cannot be edited.
   */
  readonlyFields: string[] = DEFAULT_MODEL_ADMIN_OPTIONS.readonlyFields;

  /**
   * Group fields into fieldsets with titles.
   */
  fieldsets: Fieldset[] = DEFAULT_MODEL_ADMIN_OPTIONS.fieldsets;

  /**
   * Number of items per page in list view.
   */
  listPerPage: number = DEFAULT_MODEL_ADMIN_OPTIONS.listPerPage;

  /**
   * Maximum items to show when selecting related objects.
   */
  listMaxShowAll: number = DEFAULT_MODEL_ADMIN_OPTIONS.listMaxShowAll;

  /**
   * Fields that are clickable links to the detail page.
   * Defaults to the first field in listDisplay.
   */
  listDisplayLinks: string[] = DEFAULT_MODEL_ADMIN_OPTIONS.listDisplayLinks;

  /**
   * Whether to show the "save as new" button.
   */
  saveAsNew: boolean = DEFAULT_MODEL_ADMIN_OPTIONS.saveAsNew;

  /**
   * Whether to show the "save and continue editing" button.
   */
  saveContinue: boolean = DEFAULT_MODEL_ADMIN_OPTIONS.saveContinue;

  /**
   * Date field to use for date hierarchy navigation.
   */
  dateHierarchy: string = DEFAULT_MODEL_ADMIN_OPTIONS.dateHierarchy;

  /**
   * Available bulk actions.
   */
  actions: string[] = DEFAULT_MODEL_ADMIN_OPTIONS.actions;

  /**
   * Placeholder text for the search input.
   */
  searchPlaceholder: string = DEFAULT_MODEL_ADMIN_OPTIONS.searchPlaceholder;

  /**
   * String to display for empty/null values.
   */
  emptyValueDisplay: string = DEFAULT_MODEL_ADMIN_OPTIONS.emptyValueDisplay;

  // ===========================================================================
  // URL Generation Methods
  // ===========================================================================

  /**
   * Get the URL for the list view.
   */
  getListUrl(): string {
    return this._buildUrl("");
  }

  /**
   * Get the URL for the add/create view.
   */
  getAddUrl(): string {
    return this._buildUrl("add/");
  }

  /**
   * Get the URL for the detail/change view.
   */
  getDetailUrl(id: string): string {
    return this._buildUrl(`${id}/`);
  }

  /**
   * Get the URL for the delete view.
   */
  getDeleteUrl(id: string): string {
    return this._buildUrl(`${id}/delete/`);
  }

  /**
   * Build a URL for this model admin.
   */
  protected _buildUrl(suffix: string): string {
    const urlPrefix = this._site?.urlPrefix ?? "/admin";
    const modelName = this._getModelName();
    const normalizedPrefix = urlPrefix.startsWith("/")
      ? urlPrefix
      : `/${urlPrefix}`;
    const trimmedPrefix = normalizedPrefix.endsWith("/")
      ? normalizedPrefix.slice(0, -1)
      : normalizedPrefix;

    return `${trimmedPrefix}/${modelName}/${suffix}`;
  }

  /**
   * Get the lowercase model name for URLs.
   */
  protected _getModelName(): string {
    if (!this.model) return "";
    return this.model.name.toLowerCase();
  }

  // ===========================================================================
  // Display Helpers
  // ===========================================================================

  /**
   * Get the verbose name of the model.
   */
  getVerboseName(): string {
    const modelMeta =
      (this.model as unknown as { meta?: { verboseName?: string } })
        ?.meta;
    return modelMeta?.verboseName ?? this._humanize(this.model?.name ?? "");
  }

  /**
   * Get the plural verbose name of the model.
   */
  getVerboseNamePlural(): string {
    const modelMeta = (
      this.model as unknown as { meta?: { verboseNamePlural?: string } }
    )?.meta;
    return modelMeta?.verboseNamePlural ?? `${this.getVerboseName()}s`;
  }

  /**
   * Convert camelCase/PascalCase to human-readable text.
   */
  protected _humanize(str: string): string {
    return str
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  }

  // ===========================================================================
  // Queryset Methods
  // ===========================================================================

  /**
   * Get the base queryset for the list view.
   * Override this to customize the default queryset.
   */
  getQueryset(): unknown {
    // Returns the model's manager - caller should use .all() etc.
    return (this.model as unknown as { objects: unknown }).objects;
  }

  /**
   * Get search results by applying search query to searchFields.
   */
  getSearchResults(
    queryset: unknown,
    _searchQuery: string,
  ): unknown {
    // This would be implemented with actual queryset filtering
    // For now, return the queryset as-is (to be enhanced later)
    return queryset;
  }

  // ===========================================================================
  // Form Methods
  // ===========================================================================

  /**
   * Get the list of fields to display in the form.
   * If `fields` is empty, returns all editable fields from the model.
   */
  getFields(): string[] {
    if (this.fields.length > 0) {
      return this.fields;
    }

    // Auto-discover fields from model (to be implemented)
    return [];
  }

  /**
   * Check if a field is readonly.
   */
  isFieldReadonly(fieldName: string): boolean {
    return this.readonlyFields.includes(fieldName);
  }

  /**
   * Get the list of fields that should be links in the list view.
   * Defaults to the first field in listDisplay.
   */
  getListDisplayLinks(): string[] {
    if (this.listDisplayLinks.length > 0) {
      return this.listDisplayLinks;
    }

    // Default to first field in listDisplay
    if (this.listDisplay.length > 0) {
      return [this.listDisplay[0]];
    }

    return [];
  }

  // ===========================================================================
  // Validation Methods
  // ===========================================================================

  /**
   * Validate form data before saving.
   * Override to add custom validation.
   */
  // deno-lint-ignore no-explicit-any
  validateForm(data: Record<string, any>): {
    valid: boolean;
    errors: Record<string, string[]>;
  } {
    // Default implementation - just return valid
    // Model-level validation happens in the model itself
    return {
      valid: true,
      errors: {},
    };
  }

  // ===========================================================================
  // Action Methods
  // ===========================================================================

  /**
   * Delete selected objects (default bulk action).
   */
  async deleteSelected(
    _request: unknown,
    queryset: unknown,
  ): Promise<{ count: number; message: string }> {
    // Placeholder implementation - would use queryset.delete()
    const count = 0; // queryset.count()
    return {
      count,
      message: `Successfully deleted ${count} items.`,
    };
  }

  /**
   * Get the available actions for the list view.
   */
  getActions(): Array<{ name: string; label: string }> {
    return this.actions.map((action) => ({
      name: action,
      label: this._humanize(action.replace(/_/g, " ")),
    }));
  }

  // ===========================================================================
  // Permission Methods
  // ===========================================================================

  /**
   * Check if the user has permission to view this model.
   */
  hasViewPermission(_request?: unknown, _obj?: Model): boolean {
    // Default: allow all authenticated users
    return true;
  }

  /**
   * Check if the user has permission to add new objects.
   */
  hasAddPermission(_request?: unknown): boolean {
    return true;
  }

  /**
   * Check if the user has permission to change objects.
   */
  hasChangePermission(_request?: unknown, _obj?: Model): boolean {
    return true;
  }

  /**
   * Check if the user has permission to delete objects.
   */
  hasDeletePermission(_request?: unknown, _obj?: Model): boolean {
    return true;
  }
}
