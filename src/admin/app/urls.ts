/**
 * Alexi Admin URL Configuration
 *
 * Django-style URL patterns for the admin SPA.
 * Maps URL paths to view functions defined in views.ts.
 *
 * @module alexi_admin/app/urls
 */

import { path } from "./spa_urls.ts";
import * as views from "./views.ts";

// =============================================================================
// URL Patterns
// =============================================================================

/**
 * Admin URL patterns
 *
 * These patterns are relative to the admin prefix (e.g., /admin/).
 * When included via include("@alexi/admin"), they will be mounted
 * under the specified prefix.
 *
 * Pattern examples:
 * - /admin/           → dashboard
 * - /admin/login/     → login page
 * - /admin/users/     → users list
 * - /admin/users/add/ → add new user
 * - /admin/users/123/ → edit user #123
 * - /admin/users/123/delete/ → delete confirmation
 */
export const urlpatterns = [
  // ==========================================================================
  // Auth routes
  // ==========================================================================
  path("login/", views.login, { name: "admin:login" }),

  // ==========================================================================
  // Dashboard
  // ==========================================================================
  path("", views.dashboard, { name: "admin:index" }),

  // ==========================================================================
  // Model routes (dynamic based on model name)
  // ==========================================================================

  // Model list (changelist)
  path(":model/", views.modelList, { name: "admin:model_changelist" }),

  // Add new model instance
  path(":model/add/", views.modelAdd, { name: "admin:model_add" }),

  // Model detail/edit
  path(":model/:id/", views.modelDetail, { name: "admin:model_change" }),

  // Model delete confirmation
  path(":model/:id/delete/", views.modelDelete, { name: "admin:model_delete" }),
];

// =============================================================================
// Exports
// =============================================================================

export { views };
