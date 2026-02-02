/**
 * Alexi Admin Types
 *
 * Shared type definitions for the admin SPA.
 *
 * @module alexi_admin/app/types
 */

// =============================================================================
// View Context
// =============================================================================

/**
 * View context passed to view functions
 *
 * Similar to the main app's ViewContext but with admin-specific fields.
 */
export interface ViewContext {
  /** Current URL path */
  path: string;

  /** URL parameters extracted from the route (e.g., { model: "users", id: "123" }) */
  params: Record<string, string>;

  /** URL query parameters */
  query: URLSearchParams;

  /** Navigate to a different path */
  navigate: (path: string, options?: { replace?: boolean }) => void;

  /** Generate URL from route name */
  reverse: (name: string, params?: Record<string, string>) => string;
}

// =============================================================================
// Admin User
// =============================================================================

/**
 * Admin user interface
 */
export interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
}

// =============================================================================
// Admin Route
// =============================================================================

/**
 * Parsed admin route
 */
export interface AdminRoute {
  type:
    | "login"
    | "dashboard"
    | "model_list"
    | "model_detail"
    | "model_add"
    | "model_delete";
  modelName?: string;
  objectId?: string;
}

// =============================================================================
// Model Configuration
// =============================================================================

/**
 * Column configuration for model list view
 */
export interface ModelColumn {
  field: string;
  label: string;
  sortable: boolean;
  isLink: boolean;
}

/**
 * Field configuration for model detail view
 */
export interface ModelField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  readOnly: boolean;
  choices?: Array<{ value: string; label: string }>;
}

/**
 * Model admin configuration from backend
 */
export interface ModelConfig {
  name: string;
  apiEndpoint: string;
  verboseName: string;
  verboseNamePlural: string;
  columns: ModelColumn[];
  fields: ModelField[];
  listFilter: string[];
  searchFields: string[];
  ordering: string[];
  listPerPage: number;
}

/**
 * Admin site configuration from backend
 */
export interface AdminSiteConfig {
  siteTitle: string;
  siteHeader: string;
  urlPrefix: string;
  models: ModelConfig[];
}
