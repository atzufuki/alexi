/**
 * Alexi URLs - Path and Include Functions
 *
 * Provides Django-style path() and include() functions for URL routing.
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
 * This is similar to Django's path() function.
 * Generic version supports both backend (Request/Response) and SPA (ViewContext/Node) views.
 *
 * @template TContext - The context type (default: Request for backend)
 * @template TReturn - The return type (default: Response for backend)
 *
 * @param route - URL pattern string (e.g., "assets/", ":id/")
 * @param view - View function or nested patterns from include()
 * @param options - Optional configuration (name for reverse lookup)
 * @returns URLPattern object
 *
 * @example Backend routes
 * ```ts
 * import { path } from '@alexi/urls';
 *
 * const urlpatterns = [
 *   path("", home_view, { name: "home" }),
 *   path("about/", about_view, { name: "about" }),
 * ];
 * ```
 *
 * @example SPA routes
 * ```ts
 * import { path } from '@alexi/urls';
 * import type { ViewContext } from './app.ts';
 *
 * const urlpatterns = [
 *   path<ViewContext, Node>("", home_view, { name: "home" }),
 *   path<ViewContext, Node>("about/", about_view, { name: "about" }),
 * ];
 * ```
 *
 * @example Routes with parameters
 * ```ts
 * const urlpatterns = [
 *   path("assets/", list_assets, { name: "asset-list" }),
 *   path("assets/:id/", get_asset, { name: "asset-detail" }),
 * ];
 * ```
 *
 * @example With include()
 * ```ts
 * import { path, include } from '@alexi/urls';
 * import { urlpatterns as assetUrls } from "./assets/urls.ts";
 *
 * const urlpatterns = [
 *   path("api/assets/", include(assetUrls)),
 * ];
 * ```
 */
export function path<TContext = Request, TReturn = Response>(
  route: string,
  view: View<TContext, TReturn> | URLPattern<TContext, TReturn>[],
  options?: URLPatternOptions,
): URLPattern<TContext, TReturn> {
  // Check if view is an array of URLPatterns (from include())
  if (Array.isArray(view)) {
    return {
      pattern: route,
      children: view,
      name: options?.name,
    };
  }

  // view is a View function
  return {
    pattern: route,
    view: view as View<TContext, TReturn>,
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
 * Convenience function that creates a path with include in one step
 *
 * @template TContext - The context type (default: Request for backend)
 * @template TReturn - The return type (default: Response for backend)
 *
 * @param route - URL pattern string
 * @param patterns - Array of URL patterns to include
 * @param options - Optional configuration
 * @returns URLPattern object
 *
 * @example Backend usage
 * ```ts
 * import { pathInclude } from '@alexi/urls';
 * import { urlpatterns as assetUrls } from "./assets/urls.ts";
 *
 * export const urlpatterns = [
 *   pathInclude("api/assets/", assetUrls),
 * ];
 * ```
 *
 * @example SPA usage
 * ```ts
 * import { pathInclude } from '@alexi/urls';
 * import { urlpatterns as homeUrls } from "./templates/home/urls.ts";
 *
 * export const urlpatterns = [
 *   pathInclude<ViewContext, Node>("", homeUrls),
 * ];
 * ```
 */
export function pathInclude<TContext = Request, TReturn = Response>(
  route: string,
  patterns: URLPattern<TContext, TReturn>[],
  options?: URLPatternOptions,
): URLPattern<TContext, TReturn> {
  return {
    pattern: route,
    children: patterns,
    name: options?.name,
  };
}
