/**
 * URL pattern creation functions
 *
 * Provides Django-style path() and include() functions for defining URL routes.
 *
 * @module @alexi/urls/path
 */

import type { URLPattern, URLPatternOptions, View } from "./types.ts";

/**
 * Type for the second argument of path() - can be a View or included patterns
 */
type PathTarget = View | URLPattern[];

// ============================================================================
// path() function
// ============================================================================

/**
 * Create a URL pattern that maps a route to a view function
 *
 * @param route - URL pattern string (e.g., "assets/", ":id/", "users/:userId/")
 * @param view - View function to handle requests
 * @param options - Optional configuration (name for reverse lookup)
 * @returns URLPattern object
 *
 * @example Basic routes
 * ```ts
 * import { path } from "@alexi/urls";
 *
 * const urlpatterns = [
 *   path("", home_view, { name: "home" }),
 *   path("about/", about_view, { name: "about" }),
 * ];
 * ```
 *
 * @example Routes with parameters
 * ```ts
 * const urlpatterns = [
 *   path("assets/", list_assets, { name: "asset-list" }),
 *   path("assets/:id/", get_asset, { name: "asset-detail" }),
 *   path("users/:userId/posts/:postId/", get_post, { name: "user-post" }),
 * ];
 * ```
 *
 * @example With include()
 * ```ts
 * import { path, include } from "@alexi/urls";
 * import { urlpatterns as assetUrls } from "./assets/urls.ts";
 *
 * const urlpatterns = [
 *   path("api/assets/", include(assetUrls)),
 * ];
 * ```
 */
export function path(
  route: string,
  target: PathTarget,
  options?: URLPatternOptions,
): URLPattern {
  // Check if target is an array of URLPatterns (from include())
  if (Array.isArray(target)) {
    return {
      pattern: route,
      children: target,
      name: options?.name,
    };
  }

  // Target is a View function
  return {
    pattern: route,
    view: target,
    name: options?.name,
  };
}

// ============================================================================
// include() function
// ============================================================================

/**
 * Include nested URL patterns under a common prefix
 *
 * This allows modular organization of URL patterns across multiple files.
 *
 * @param patterns - Array of URL patterns to include
 * @returns URLPattern array (for use with path())
 *
 * @example Including module routes
 * ```ts
 * // src/comachine-web/assets/urls.ts
 * import { path } from "@alexi/urls";
 * import { list_assets, get_asset } from "./views.ts";
 *
 * export const urlpatterns = [
 *   path("", list_assets, { name: "asset-list" }),
 *   path(":id/", get_asset, { name: "asset-detail" }),
 * ];
 *
 * // src/comachine-web/urls.ts
 * import { path, include } from "@alexi/urls";
 * import { urlpatterns as assetUrls } from "./assets/urls.ts";
 * import { urlpatterns as taskUrls } from "./tasks/urls.ts";
 *
 * export const urlpatterns = [
 *   path("api/assets/", include(assetUrls)),
 *   path("api/tasks/", include(taskUrls)),
 * ];
 * ```
 */
export function include(patterns: URLPattern[]): URLPattern[];

/**
 * Create a URL pattern that includes nested patterns under a prefix
 *
 * @param route - URL prefix for all nested patterns
 * @param patterns - Array of URL patterns to include
 * @param options - Optional configuration
 * @returns URLPattern object with nested children
 *
 * @example Direct include with prefix
 * ```ts
 * import { path, include } from "@alexi/urls";
 * import { urlpatterns as assetUrls } from "./assets/urls.ts";
 *
 * export const urlpatterns = [
 *   include("api/assets/", assetUrls),
 *   include("api/tasks/", taskUrls),
 * ];
 * ```
 */
export function include(
  route: string,
  patterns: URLPattern[],
  options?: URLPatternOptions,
): URLPattern;

// Implementation
export function include(
  routeOrPatterns: string | URLPattern[],
  patternsOrOptions?: URLPattern[] | URLPatternOptions,
  options?: URLPatternOptions,
): URLPattern | URLPattern[] {
  // Overload 1: include(patterns) - returns patterns as-is for use with path()
  if (Array.isArray(routeOrPatterns)) {
    return routeOrPatterns;
  }

  // Overload 2: include(route, patterns, options?) - returns a URLPattern with children
  const route = routeOrPatterns;
  const patterns = patternsOrOptions as URLPattern[];

  return {
    pattern: route,
    children: patterns,
    name: options?.name,
  };
}

// ============================================================================
// Helper: Create path with include
// ============================================================================

/**
 * Convenience function to create a path that includes nested patterns
 *
 * This is equivalent to using path() with include() but with a cleaner syntax.
 *
 * @param route - URL prefix for nested patterns
 * @param patterns - Array of URL patterns to include
 * @param options - Optional configuration
 * @returns URLPattern object with nested children
 *
 * @example
 * ```ts
 * import { pathInclude } from "@alexi/urls";
 * import { urlpatterns as assetUrls } from "./assets/urls.ts";
 *
 * export const urlpatterns = [
 *   pathInclude("api/assets/", assetUrls),
 *   pathInclude("api/tasks/", taskUrls),
 * ];
 * ```
 */
export function pathInclude(
  route: string,
  patterns: URLPattern[],
  options?: URLPatternOptions,
): URLPattern {
  return {
    pattern: route,
    children: patterns,
    name: options?.name,
  };
}
