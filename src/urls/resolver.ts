/**
 * URL resolver functions
 *
 * Provides Django-style URL resolution and reverse lookup.
 * Generic version supports both backend (Request/Response) and SPA (ViewContext/Node).
 *
 * @module @alexi/urls/resolver
 */

import type {
  CompiledPattern,
  CompiledSegment,
  ResolveResult,
  URLPattern,
} from "./types.ts";

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
 /**
  * Compile URL patterns for matching
  * @template TContext - The context type (default: Request for backend)
  * @template TReturn - The return type (default: Response for backend)
  */
function compilePatterns<TContext = Request, TReturn = Response>(
  patterns: URLPattern<TContext, TReturn>[],
): CompiledPattern<TContext, TReturn>[] {
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
 * @template TContext - The context type (default: Request for backend)
 * @template TReturn - The return type (default: Response for backend)
 * @param urlSegments - Remaining URL segments to match
 * @param pattern - Compiled pattern to match against
 * @param params - Accumulated URL parameters
 * @returns ResolveResult if matched, null otherwise
 */
function matchPattern<TContext = Request, TReturn = Response>(
  urlSegments: string[],
  pattern: CompiledPattern<TContext, TReturn>,
  params: Record<string, string>,
): ResolveResult<TContext, TReturn> | null {
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
 * Generic version supports both backend (Request/Response) and SPA (ViewContext/Node).
 *
 * @template TContext - The context type (default: Request for backend)
 * @template TReturn - The return type (default: Response for backend)
 * @param url - URL path to resolve (e.g., "/api/assets/123/")
 * @param urlpatterns - Array of URL patterns to match against
 * @returns ResolveResult if a match is found, null otherwise
 *
 * @example Backend usage
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
 *
 * @example SPA usage
 * ```ts
 * import { resolve, path } from "@alexi/urls";
 * import type { ViewContext } from "./app.ts";
 *
 * const urlpatterns = [
 *   path<ViewContext, Node>("", home_view, { name: "home" }),
 * ];
 *
 * const result = resolve<ViewContext, Node>("/", urlpatterns);
 * if (result) {
 *   const node = await result.view(ctx, result.params);
 * }
 * ```
 */
export function resolve<TContext = Request, TReturn = Response>(
  url: string,
  urlpatterns: URLPattern<TContext, TReturn>[],
): ResolveResult<TContext, TReturn> | null {
  // Normalize URL: remove leading/trailing slashes and split
  const normalized = url.replace(/^\/+|\/+$/g, "");
  const urlSegments = normalized === "" ? [] : normalized.split("/");

  // Compile patterns
  const compiled = compilePatterns(urlpatterns);

  // Try each pattern
  // Try to match against each pattern
  for (const pattern of compiled) {
    const result = matchPattern<TContext, TReturn>(urlSegments, pattern, {});
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
 * @template TContext - The context type (default: Request for backend)
 * @template TReturn - The return type (default: Response for backend)
 * @param patterns - Array of URL patterns
 * @param prefix - Current URL prefix
 * @returns Route registry
 */
function buildRouteRegistry<TContext = Request, TReturn = Response>(
  patterns: URLPattern<TContext, TReturn>[],
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
let cachedPatterns: unknown | null = null;

/**
 * Get or build the route registry
 * @template TContext - The context type (default: Request for backend)
 * @template TReturn - The return type (default: Response for backend)
 */
function getRegistry<TContext = Request, TReturn = Response>(
  urlpatterns: URLPattern<TContext, TReturn>[],
): RouteRegistry {
  // Check if we can use cached registry
  if (cachedPatterns === urlpatterns && cachedRegistry) {
    return cachedRegistry;
  }

  // Build new registry
  cachedPatterns = urlpatterns;
  cachedRegistry = buildRouteRegistry<TContext, TReturn>(urlpatterns);
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
 * Generic version supports both backend and SPA URL patterns.
 *
 * @template TContext - The context type (default: Request for backend)
 * @template TReturn - The return type (default: Response for backend)
 * @param name - Name of the route
 * @param params - URL parameters to substitute
 * @param urlpatterns - Array of URL patterns (used to build registry)
 * @returns Generated URL path
 * @throws Error if route name is not found or required parameter is missing
 *
 * @example Backend usage
 * ```ts
 * import { reverse, path } from "@alexi/urls";
 *
 * const urlpatterns = [
 *   path("assets/", list_assets, { name: "asset-list" }),
 *   path("assets/:id/", get_asset, { name: "asset-detail" }),
 * ];
 *
 * reverse("asset-list", {}, urlpatterns);
 * // => "/assets/"
 *
 * reverse("asset-detail", { id: "123" }, urlpatterns);
 * // => "/assets/123/"
 * ```
 *
 * @example SPA usage
 * ```ts
 * import { reverse, path } from "@alexi/urls";
 * import type { ViewContext } from "./app.ts";
 *
 * const urlpatterns = [
 *   path<ViewContext, Node>("", home_view, { name: "home" }),
 * ];
 *
 * reverse<ViewContext, Node>("home", {}, urlpatterns);
 * // => "/"
 * ```
 */
export function reverse<TContext = Request, TReturn = Response>(
  name: string,
  params: Record<string, string>,
  urlpatterns: URLPattern<TContext, TReturn>[],
): string {
  const registry = getRegistry<TContext, TReturn>(urlpatterns);
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
