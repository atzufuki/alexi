/**
 * Options and configuration types for Alexi Admin
 *
 * This module defines the configuration interfaces for AdminSite and ModelAdmin.
 *
 * @module
 */

import type { Model } from "@alexi/db";

// =============================================================================
// Fieldset Configuration
// =============================================================================

/**
 * Fieldset configuration for grouping form fields
 */
export interface Fieldset {
  /** Name/title of the fieldset */
  name: string;
  /** Field names to include in this fieldset */
  fields: string[];
  /** Whether the fieldset is initially collapsed */
  collapsed?: boolean;
  /** CSS classes to add to the fieldset */
  classes?: string[];
  /** Description text shown below the fieldset title */
  description?: string;
}

// =============================================================================
// AdminSite Options
// =============================================================================

/**
 * Configuration options for AdminSite
 */
export interface AdminSiteOptions {
  /** Site title shown in the header */
  title?: string;
  /** Header text */
  header?: string;
  /** URL prefix for admin routes (default: "/admin") */
  urlPrefix?: string;
  /** Site-wide CSS classes */
  siteClasses?: string[];
}

/**
 * Default options for AdminSite
 */
export const DEFAULT_ADMIN_SITE_OPTIONS: Required<AdminSiteOptions> = {
  title: "Admin",
  header: "Administration",
  urlPrefix: "/admin",
  siteClasses: [],
};

// =============================================================================
// ModelAdmin Options
// =============================================================================

/**
 * Configuration options for ModelAdmin
 */
export interface ModelAdminOptions {
  /** Fields to display in the list view */
  listDisplay?: string[];

  /** Fields that are searchable */
  searchFields?: string[];

  /** Fields to use for filtering in the sidebar */
  listFilter?: string[];

  /** Default ordering for the list view */
  ordering?: string[];

  /** Fields to show in the edit form */
  fields?: string[];

  /** Fields that cannot be edited */
  readonlyFields?: string[];

  /** Group fields into fieldsets */
  fieldsets?: Fieldset[];

  /** Number of items per page in list view */
  listPerPage?: number;

  /** Maximum items to show when selecting related objects */
  listMaxShowAll?: number;

  /** Fields that are links to the detail page in list view */
  listDisplayLinks?: string[];

  /** Whether to show the "save and add another" button */
  saveAsNew?: boolean;

  /** Whether to show the "save and continue editing" button */
  saveContinue?: boolean;

  /** Date/datetime fields to use for date hierarchy navigation */
  dateHierarchy?: string;

  /** Actions available for bulk operations */
  actions?: string[];

  /** Placeholder text for search input */
  searchPlaceholder?: string;

  /** Empty value display string */
  emptyValueDisplay?: string;
}

/**
 * Default options for ModelAdmin
 */
export const DEFAULT_MODEL_ADMIN_OPTIONS: Required<ModelAdminOptions> = {
  listDisplay: [],
  searchFields: [],
  listFilter: [],
  ordering: [],
  fields: [],
  readonlyFields: [],
  fieldsets: [],
  listPerPage: 100,
  listMaxShowAll: 200,
  listDisplayLinks: [],
  saveAsNew: false,
  saveContinue: true,
  dateHierarchy: "",
  actions: ["delete_selected"],
  searchPlaceholder: "Search...",
  emptyValueDisplay: "-",
};

// =============================================================================
// Type Helpers
// =============================================================================

/**
 * Type for Model constructor
 */
// deno-lint-ignore no-explicit-any
export type ModelClass<T extends Model = Model> = new () => T;

/**
 * Type for ModelAdmin constructor
 */
// deno-lint-ignore no-explicit-any
export type ModelAdminClass = new () => any;

/**
 * Base interface for ModelAdmin (used to avoid circular dependencies)
 */
export interface ModelAdminBase {
  model: ModelClass;
  listDisplay: string[];
  searchFields: string[];
  listFilter: string[];
  ordering: string[];
  fields: string[];
  readonlyFields: string[];
  fieldsets: Fieldset[];
  listPerPage: number;
  listMaxShowAll: number;
  listDisplayLinks: string[];
  saveAsNew: boolean;
  saveContinue: boolean;
  dateHierarchy: string;
  actions: string[];
  searchPlaceholder: string;
  emptyValueDisplay: string;

  // URL methods
  getListUrl(): string;
  getAddUrl(): string;
  getDetailUrl(id: string): string;
  getDeleteUrl(id: string): string;
}
