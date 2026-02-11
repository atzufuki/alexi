/**
 * Alexi URLs - Django-inspired URL routing for Deno
 *
 * A Django-like URL routing system for TypeScript/Deno.
 *
 * @module @alexi/urls
 *
 * @example Basic usage
 * ```ts
 * import { path, include, resolve, reverse } from '@alexi/urls';
 *
 * // Define views (using native Request/Response)
 * const list_assets = async (request: Request, params: Record<string, string>) => {
 *   return Response.json({ assets: [] });
 * };
 *
 * const get_asset = async (request: Request, params: Record<string, string>) => {
 *   const { id } = params;
 *   return Response.json({ id });
 * };
 *
 * // Define URL patterns
 * const urlpatterns = [
 *   path("assets/", list_assets, { name: "asset-list" }),
 *   path("assets/:id/", get_asset, { name: "asset-detail" }),
 * ];
 *
 * // Resolve a URL to a view
 * const result = resolve("/assets/123/", urlpatterns);
 * if (result) {
 *   const response = await result.view(request, result.params);
 * }
 *
 * // Generate a URL from a named route
 * const url = reverse("asset-detail", { id: "123" }, urlpatterns);
 * // => "/assets/123/"
 * ```
 *
 * @example Modular URL patterns with include()
 * ```ts
 * // assets/urls.ts
 * export const urlpatterns = [
 *   path("", list_assets, { name: "asset-list" }),
 *   path(":id/", get_asset, { name: "asset-detail" }),
 * ];
 *
 * // urls.ts
 * import { urlpatterns as assetUrls } from "./assets/urls.ts";
 * import { urlpatterns as taskUrls } from "./tasks/urls.ts";
 *
 * export const urlpatterns = [
 *   path("api/assets/", include(assetUrls)),
 *   path("api/tasks/", include(taskUrls)),
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
