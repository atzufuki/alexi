/**
 * Web urls.ts template generator
 *
 * @module @alexi/create/templates/web/urls_ts
 */

/**
 * Generate urls.ts content for the web app
 */
export function generateWebUrlsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Web URLs
 *
 * URL configuration for the REST API.
 *
 * @module ${name}-web/urls
 */

import { path, include } from "@alexi/urls";
import { DefaultRouter } from "@alexi/restframework";
import { TodoViewSet } from "@${name}-web/viewsets.ts";

// Create router and register viewsets
const router = new DefaultRouter();
router.register("todos", TodoViewSet);

// API patterns
const apiPatterns = [
  // Health check endpoint
  path("health/", async () => Response.json({ status: "ok" })),
  // Todo endpoints from router
  ...router.urls,
];

// Main URL patterns
export const urlpatterns = [
  path("api/", include(apiPatterns)),
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
