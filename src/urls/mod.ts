/**
 * Alexi's Django-style URL dispatcher.
 *
 * `@alexi/urls` defines the routing primitives used across the framework:
 * `path()` for declaring routes, `include()` for composing URL trees,
 * `resolve()` for matching requests to views, and `reverse()` for generating
 * URLs from named routes. It is the common foundation shared by plain Alexi
 * apps, class-based views, admin routes, and the REST framework router.
 *
 * Route handlers use native `Request` and `Response` objects plus a simple
 * params record, making the package easy to use both inside and outside the
 * rest of Alexi. The API mirrors Django terminology while keeping the actual
 * runtime model close to the Web Platform.
 *
 * @module @alexi/urls
 *
 * @example Declare and reverse named routes
 * ```ts
 * import { path, reverse } from "@alexi/urls";
 *
 * const urlpatterns = [
 *   path("articles/:id/", async (_request, params) => {
 *     return Response.json({ id: params.id });
 *   }, { name: "article-detail" }),
 * ];
 *
 * const url = reverse("article-detail", { id: "123" }, urlpatterns);
 * // "/articles/123/"
 * ```
 *
 * @example Compose modular URL trees
 * ```ts
 * import { include, path } from "@alexi/urls";
 * import { urlpatterns as api_urls } from "./api/urls.ts";
 *
 * export const urlpatterns = [
 *   path("api/", include(api_urls)),
 * ];
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  CompiledPattern,
  CompiledSegment,
  ResolveResult,
  URLPattern,
  URLPatternOptions,
  View,
} from "./types.ts";

export type { RedirectOptions, RedirectResponse } from "./redirect.ts";

// ============================================================================
// Path and Include
// ============================================================================

export { include, path, pathInclude } from "./path.ts";

// ============================================================================
// Resolver
// ============================================================================

export { clearRegistryCache, resolve, reverse } from "./resolver.ts";

// ============================================================================
// Redirect
// ============================================================================

export { isRedirectResponse, redirect } from "./redirect.ts";
