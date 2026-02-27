/**
 * ModelAdmin class for Alexi Admin
 *
 * This module defines the ModelAdmin class which controls how models
 * are displayed and edited in the admin interface.
 *
 * @module
 */

import type { DatabaseBackend, Model } from "@alexi/db";
import { Q } from "@alexi/db";
import type { Fieldset, ModelAdminBase, ModelClass } from "./options.ts";
import { DEFAULT_MODEL_ADMIN_OPTIONS } from "./options.ts";
import { getModelFields, getModelMeta } from "./introspection.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Result of a paginate() call.
 */
export interface PaginationResult<T extends Model> {
  objects: T[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

// Internal type alias for a QuerySet-like object
type AnyQuerySet = {
  filter(
    conditions: Record<string, unknown>,
  ): AnyQuerySet;
  orderBy(...fields: string[]): AnyQuerySet;
  offset(n: number): AnyQuerySet;
  limit(n: number): AnyQuerySet;
  count(): Promise<number>;
  fetch(): Promise<{ array(): unknown[] }>;
};

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
   * Apply search query to the queryset using `searchFields` with icontains OR
   * logic. Returns the queryset unchanged if `searchQuery` is empty or there
   * are no `searchFields` configured.
   */
  getSearchResults(
    queryset: unknown,
    searchQuery: string,
  ): unknown {
    if (!searchQuery || this.searchFields.length === 0) {
      return queryset;
    }

    // Build an OR Q object across all search fields using icontains
    const qs = queryset as AnyQuerySet;
    let combined: Q | null = null;
    for (const fieldName of this.searchFields) {
      const qObj = new Q({ [`${fieldName}__icontains`]: searchQuery });
      combined = combined ? combined.or(qObj) : qObj;
    }

    if (!combined) return queryset;
    return qs.filter(combined as unknown as Record<string, unknown>);
  }

  /**
   * Apply filter params from a URL query string to the queryset.
   * BooleanField params are coerced to booleans; date range params use
   * `__gte` / `__lte` lookups.
   *
   * @param queryset  - the base queryset
   * @param filterParams - raw URL search params (e.g. from `url.searchParams`)
   */
  getFilteredQueryset(
    queryset: unknown,
    filterParams: URLSearchParams,
  ): unknown {
    if (this.listFilter.length === 0) return queryset;

    const fields = getModelFields(this.model);
    let qs = queryset as AnyQuerySet;

    for (const fieldName of this.listFilter) {
      const paramValue = filterParams.get(fieldName);
      if (paramValue === null) continue;

      const field = fields.find((f) => f.name === fieldName);
      if (!field) continue;

      if (field.type === "BooleanField") {
        qs = qs.filter({ [fieldName]: paramValue === "true" });
      } else if (
        field.type === "DateTimeField" || field.type === "DateField"
      ) {
        const gteValue = filterParams.get(`${fieldName}__gte`);
        const lteValue = filterParams.get(`${fieldName}__lte`);
        if (gteValue) qs = qs.filter({ [`${fieldName}__gte`]: gteValue });
        if (lteValue) qs = qs.filter({ [`${fieldName}__lte`]: lteValue });
      } else {
        qs = qs.filter({ [fieldName]: paramValue });
      }
    }

    return qs;
  }

  /**
   * Apply ordering to the queryset.
   * If `orderingParam` is provided (e.g. "title" or "-createdAt"), it is used.
   * Otherwise falls back to `this.ordering[0]` if set.
   *
   * Ordering is only applied when the field is in `listDisplay` (security check).
   */
  getOrderedQueryset(
    queryset: unknown,
    orderingParam: string | null,
  ): unknown {
    const qs = queryset as AnyQuerySet;
    const displayFields = this.listDisplay.length > 0
      ? this.listDisplay
      : getModelFields(this.model).slice(0, 6).map((f) => f.name);

    if (orderingParam) {
      const fieldName = orderingParam.startsWith("-")
        ? orderingParam.slice(1)
        : orderingParam;
      if (displayFields.includes(fieldName)) {
        return qs.orderBy(orderingParam);
      }
    }

    if (this.ordering.length > 0) {
      return qs.orderBy(...this.ordering);
    }

    return qs;
  }

  /**
   * Paginate a queryset and return a `PaginationResult`.
   *
   * @param queryset  - the (filtered/ordered) queryset to paginate
   * @param page      - 1-based page number
   * @param pageSize  - items per page (defaults to `this.listPerPage`)
   */
  async paginate<T extends Model>(
    queryset: unknown,
    page: number,
    pageSize?: number,
  ): Promise<PaginationResult<T>> {
    const perPage = pageSize ?? this.listPerPage;
    const currentPage = Math.max(1, page);
    const qs = queryset as AnyQuerySet;

    const totalCount = await qs.count();
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * perPage;

    const fetchedSet = await qs.offset(startIndex).limit(perPage).fetch();
    const objects = fetchedSet.array() as T[];

    return {
      objects,
      totalCount,
      currentPage: safePage,
      totalPages,
      hasPrevious: safePage > 1,
      hasNext: safePage < totalPages,
    };
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
   * Validate form data against model field constraints.
   *
   * Checks performed:
   * - Required fields (not blank, not null) must have a non-empty value
   * - CharField: value must not exceed `maxLength`
   * - IntegerField / FloatField: value must be a valid number
   * - DateField / DateTimeField: value must parse as a valid date
   *
   * Override in subclasses to add custom validation.
   */
  validateForm(data: Record<string, unknown>): {
    valid: boolean;
    errors: Record<string, string[]>;
  } {
    const errors: Record<string, string[]> = {};
    const fields = getModelFields(this.model);

    for (const fieldInfo of fields) {
      if (!fieldInfo.isEditable || fieldInfo.isAuto || fieldInfo.isPrimaryKey) {
        continue;
      }

      const fieldErrors: string[] = [];
      const rawValue = data[fieldInfo.name];
      const isEmpty = rawValue === null || rawValue === undefined ||
        rawValue === "";

      // Required check — skip if the field has a default value
      const hasDefault = fieldInfo.options.default !== undefined;
      if (fieldInfo.isRequired && isEmpty && !hasDefault) {
        fieldErrors.push("This field is required.");
      }

      if (!isEmpty) {
        const strVal = String(rawValue);

        // maxLength validation for CharField
        if (
          fieldInfo.type === "CharField" &&
          typeof fieldInfo.options.maxLength === "number"
        ) {
          if (strVal.length > fieldInfo.options.maxLength) {
            fieldErrors.push(
              `Ensure this value has at most ${fieldInfo.options.maxLength} characters (it has ${strVal.length}).`,
            );
          }
        }

        // Integer validation
        if (fieldInfo.type === "IntegerField") {
          const num = Number(rawValue);
          if (!Number.isInteger(num) || isNaN(num)) {
            fieldErrors.push("Enter a whole number.");
          }
        }

        // Float validation
        if (
          fieldInfo.type === "FloatField" || fieldInfo.type === "DecimalField"
        ) {
          if (isNaN(Number(rawValue))) {
            fieldErrors.push("Enter a number.");
          }
        }

        // Date / DateTime validation
        if (
          fieldInfo.type === "DateField" ||
          fieldInfo.type === "DateTimeField"
        ) {
          const d = new Date(String(rawValue));
          if (isNaN(d.getTime())) {
            fieldErrors.push("Enter a valid date/time.");
          }
        }
      }

      if (fieldErrors.length > 0) {
        errors[fieldInfo.name] = fieldErrors;
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  // ===========================================================================
  // Action Methods
  // ===========================================================================

  /**
   * Delete selected objects by primary key IDs.
   *
   * @param ids     - list of primary key values to delete
   * @param backend - the database backend to use
   * @returns number of objects actually deleted
   */
  async deleteSelected(
    ids: unknown[],
    backend: DatabaseBackend,
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const meta = getModelMeta(this.model);
    const pk = meta.primaryKey;

    const manager = (this.model as unknown as {
      objects: {
        using(b: DatabaseBackend): {
          filter(
            conditions: Record<string, unknown>,
          ): { fetch(): Promise<{ array(): unknown[] }> };
        };
      };
    }).objects;

    // Fetch the objects matching the given IDs
    const fetchedSet = await manager
      .using(backend)
      .filter({ [`${pk}__in`]: ids })
      .fetch();

    const objects = fetchedSet.array() as (Model & {
      delete(): Promise<void>;
    })[];

    let count = 0;
    for (const obj of objects) {
      await obj.delete();
      count++;
    }

    return count;
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
