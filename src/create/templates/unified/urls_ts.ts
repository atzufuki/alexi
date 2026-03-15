/**
 * Unified urls.ts template generator
 *
 * @module @alexi/create/templates/unified/urls_ts
 */

/**
 * Generate urls.ts content for the unified app
 */
export function generateUrlsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} URL Configuration
 *
 * @module ${name}/urls
 */

import { path, include } from "@alexi/urls";
import { DefaultRouter } from "@alexi/restframework";
import { PostViewSet } from "@${name}/viewsets.ts";
import { HomeView, PostListView, PostCreateView, healthView } from "@${name}/views.ts";

// Create router and register viewsets
const router = new DefaultRouter();
router.register("posts", PostViewSet);

// API patterns
const apiPatterns = [
  // Health check endpoint
  path("health/", healthView),
  // Post endpoints from router
  ...router.urls,
];

// Main URL patterns
export const urlpatterns = [
  path("", HomeView.as_view()),
  path("posts/", PostListView.as_view()),
  path("posts/new/", PostCreateView.as_view()),
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
