/**
 * urls.ts template generator
 *
 * @module @alexi/create/templates/urls_ts
 */

/**
 * Generate urls.ts content for a new app
 */
export function generateUrlsTs(name: string): string {
  return `/**
 * ${name} URL Configuration
 *
 * Define your URL patterns here.
 *
 * @module ${name}/urls
 */

import { path } from "@alexi/urls";
import { homeView, healthView } from "./views.ts";

// =============================================================================
// URL Patterns
// =============================================================================

export const urlpatterns = [
  path("", homeView, { name: "home" }),
  path("api/health/", healthView, { name: "health" }),
];
`;
}
