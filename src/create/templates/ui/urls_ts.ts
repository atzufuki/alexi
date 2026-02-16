/**
 * UI urls.ts template generator
 *
 * @module @alexi/create/templates/ui/urls_ts
 */

/**
 * Generate urls.ts content for the UI app
 */
export function generateUiUrlsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} UI URLs
 *
 * URL patterns for the frontend SPA.
 *
 * @module ${name}-ui/urls
 */

import { path } from "@alexi/urls";
import type { URLPattern } from "@alexi/urls";
import * as views from "@${name}-ui/views.ts";

/**
 * URL patterns for the UI app
 */
export const urlpatterns: URLPattern[] = [
  path("", views.home, { name: "home" }),
];
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
