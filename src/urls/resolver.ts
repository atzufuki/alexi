/**
 * URL resolver functions
 *
 * Provides resolve() for matching URLs to views and reverse() for generating URLs.
 *
 * @module @alexi/urls/resolver
 */

import type { CompiledPattern, CompiledSegment, ResolveResult, URLPattern } from "./types.ts";

// ============================================================================
// Pattern Compilation
// ============================================================================

/**
 * Compile a URL pattern string into segments for efficient matching
 *
 * @param pattern - URL pattern string (e.g., "assets/:id/")
 * @returns Array of compiled segments
 */
function compilePattern(pattern: string): CompiledSegment[] {
  // Remove leading/trailing slashes and split
  const normalized = pattern.replace(/^\/+|\/+$/g, "");

  if (normalized === "") {
    return [];
  }

  return normalized.split("/").map((segment) => {
    if (segment.startsWith(":")) {
      return {
        isParam: true,
        value: segment.slice(1), // Remove the ":"
      };
    }
    return {
      isParam: false,
      value: segment,
    };
  });
}

/**
 * Compile a URLPattern tree into CompiledPattern tree
 *
 * @param patterns - Array of URL patterns
 * @returns Array of compiled patterns
 */
function compilePatterns(patterns: URLPattern[]): CompiledPattern[] {
  return patterns.map((pattern) => ({
    original: pattern.pattern,
    segments: compilePattern(pattern.pattern),
    view: pattern.view,
    children: pattern.children ? compilePatterns(pattern.children) : undefined,
    name: pattern.name,
  }));
}

// ============================================================================
// URL Resolution
// ============================================================================

/**
 * Try to match URL segments against a compiled pattern
 *
 * @param urlSegments - Remaining URL segments to match
 * @param pattern - Compiled pattern to match against
 * @param params - Accumulated URL parameters
 * @returns ResolveResult if matched, null otherwise
 */
function matchPattern(
  urlSegments: string[],
  pattern: CompiledPattern,
  params: Record<string, string>,
): ResolveResult | null {
  const patternSegments = pattern.segments;

  // Check if pattern segments match the beginning of URL segments
  if (patternSegments.length > urlSegments.length) {
    return null;
  }

  const newParams = { ...params };

  // Match each pattern segment
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSeg = patternSegments[i];
    const urlSeg = urlSegments[i];

    if (patternSeg.isParam) {
      // Parameter segment - capture the value
      newParams[patternSeg.value] = urlSeg;
    } else {
      // Literal segment - must match exactly
      if (patternSeg.value !== urlSeg) {
        return null;
      }
    }
  }

  // Remaining URL segments after matching this pattern
  const remainingSegments = urlSegments.slice(patternSegments.length);

  // If this pattern has a view (leaf node)
  if (pattern.view) {
    // Must match all segments exactly
    if (remainingSegments.length === 0) {
      return {
        view: pattern.view,
        params: newParams,
        name: pattern.name,
      };
    }
    // Has remaining segments but no children - no match
    return null;
  }

  // If this pattern has children (branch node)
  if (pattern.children) {
    // Try to match remaining segments against children
    for (const child of pattern.children) {
      const result = matchPattern(remainingSegments, child, newParams);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

/**
 * Resolve a URL path to a view and parameters
 *
 * @param url - URL path to resolve (e.g., "/api/assets/123/")
 * @param urlpatterns - Array of URL patterns to match against
 * @returns ResolveResult if a match is found, null otherwise
 *
 * @example
 * ```ts
 * import { resolve, path } from "@alexi/urls";
 *
 * const urlpatterns = [
 *   path("assets/", list_assets, { name: "asset-list" }),
 *   path("assets/:id/", get_asset, { name: "asset-detail" }),
 * ];
 *
 * const result = resolve("/assets/123/", urlpatterns);
 * if (result) {
 *   console.log(result.params); // { id: "123" }
 *   console.log(result.name);   // "asset-detail"
 *   const response = await result.view(request, result.params);
 * }
 * ```
 */
export function resolve(
  url: string,
  urlpatterns: URLPattern[],
): ResolveResult | null {
  // Normalize URL: remove leading/trailing slashes and split
  const normalized = url.replace(/^\/+|\/+$/g, "");
  const urlSegments = normalized === "" ? [] : normalized.split("/");

  // Compile patterns
  const compiled = compilePatterns(urlpatterns);

  // Try each pattern
  for (const pattern of compiled) {
    const result = matchPattern(urlSegments, pattern, {});
    if (result) {
      return result;
    }
  }

  return null;
}

// ============================================================================
// URL Reversal
// ============================================================================

/**
 * Build a registry of named routes for reverse lookup
 */
interface RouteRegistry {
  [name: string]: {
    pattern: string;
    segments: CompiledSegment[];
  };
}

/**
 * Build a flat registry of all named routes
 *
 * @param patterns - Array of URL patterns
 * @param prefix - Current URL prefix
 * @returns Route registry
 */
function buildRouteRegistry(
  patterns: URLPattern[],
  prefix: string = "",
): RouteRegistry {
  const registry: RouteRegistry = {};

  for (const pattern of patterns) {
    const fullPattern = prefix + pattern.pattern;
    const segments = compilePattern(fullPattern);

    // Register named route
    if (pattern.name) {
      registry[pattern.name] = {
        pattern: fullPattern,
        segments,
      };
    }

    // Process children recursively
    if (pattern.children) {
      const childRegistry = buildRouteRegistry(pattern.children, fullPattern);
      Object.assign(registry, childRegistry);
    }
  }

  return registry;
}

// Cached registry for performance
let cachedRegistry: RouteRegistry | null = null;
let cachedPatterns: URLPattern[] | null = null;

/**
 * Get or build the route registry
 */
function getRegistry(urlpatterns: URLPattern[]): RouteRegistry {
  // Check if we can use cached registry
  if (cachedPatterns === urlpatterns && cachedRegistry) {
    return cachedRegistry;
  }

  // Build new registry
  cachedPatterns = urlpatterns;
  cachedRegistry = buildRouteRegistry(urlpatterns);
  return cachedRegistry;
}

/**
 * Clear the cached route registry
 *
 * Call this if URL patterns are modified at runtime.
 */
export function clearRegistryCache(): void {
  cachedRegistry = null;
  cachedPatterns = null;
}

/**
 * Generate a URL from a named route and parameters
 *
 * @param name - Name of the route
 * @param params - URL parameters to substitute
 * @param urlpatterns - Array of URL patterns (used to build registry)
 * @returns Generated URL path
 * @throws Error if route name is not found or required parameter is missing
 *
 * @example
 * ```ts
 * import { reverse, path } from "@alexi/urls";
 *
 * const urlpatterns = [
 *   path("assets/", list_assets, { name: "asset-list" }),
 *   path("assets/:id/", get_asset, { name: "asset-detail" }),
 *   path("users/:userId/posts/:postId/", get_post, { name: "user-post" }),
 * ];
 *
 * reverse("asset-list", {}, urlpatterns);
 * // => "/assets/"
 *
 * reverse("asset-detail", { id: "123" }, urlpatterns);
 * // => "/assets/123/"
 *
 * reverse("user-post", { userId: "5", postId: "42" }, urlpatterns);
 * // => "/users/5/posts/42/"
 * ```
 */
export function reverse(
  name: string,
  params: Record<string, string>,
  urlpatterns: URLPattern[],
): string {
  const registry = getRegistry(urlpatterns);
  const route = registry[name];

  if (!route) {
    throw new Error(`No route found with name: ${name}`);
  }

  // Build URL by substituting parameters
  const segments = route.segments.map((segment) => {
    if (segment.isParam) {
      const value = params[segment.value];
      if (value === undefined) {
        throw new Error(
          `Missing required parameter '${segment.value}' for route '${name}'`,
        );
      }
      return value;
    }
    return segment.value;
  });

  // Build final URL with leading slash
  const path = segments.length > 0 ? "/" + segments.join("/") + "/" : "/";
  return path;
}
