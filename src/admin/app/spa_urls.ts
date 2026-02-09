/**
 * Alexi Admin SPA URL Utilities
 *
 * Simplified SPA URL routing for the admin panel.
 * Based on comachine-ui/src/spa_urls.ts but tailored for admin needs.
 *
 * @module alexi_admin/app/spa_urls
 */

import type { ViewContext } from "./types.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * SPA View function signature
 */
export type SPAView = (ctx: ViewContext) => Node | Promise<Node>;

/**
 * SPA URL Pattern
 */
export interface SPAURLPattern {
  /** URL pattern string (e.g., ":model/", ":model/:id/") */
  pattern: string;

  /** SPA View function to handle the route */
  view?: SPAView;

  /** Nested URL patterns (mutually exclusive with view) */
  children?: SPAURLPattern[];

  /** Named route for reverse URL lookup */
  name?: string;
}

/**
 * URL pattern options
 */
export interface URLPatternOptions {
  name?: string;
}

// =============================================================================
// Path Function
// =============================================================================

/**
 * Create an SPA URL pattern
 *
 * @param route - URL pattern string (e.g., ":model/", ":model/:id/")
 * @param view - SPA View function or nested patterns from include()
 * @param options - Optional configuration (name for reverse lookup)
 * @returns SPAURLPattern object
 */
export function path(
  route: string,
  view: SPAView | SPAURLPattern[],
  options?: URLPatternOptions,
): SPAURLPattern {
  if (Array.isArray(view)) {
    return {
      pattern: route,
      children: view,
      name: options?.name,
    };
  }

  return {
    pattern: route,
    view: view,
    name: options?.name,
  };
}

// =============================================================================
// Include Function
// =============================================================================

/**
 * Include nested SPA URL patterns
 *
 * @param patterns - Array of SPA URL patterns to include
 * @returns The patterns array (for use with path())
 */
export function include(patterns: SPAURLPattern[]): SPAURLPattern[] {
  return patterns;
}

// =============================================================================
// Resolution
// =============================================================================

/**
 * Compiled segment for efficient matching
 */
interface CompiledSegment {
  isParam: boolean;
  value: string;
}

/**
 * Compiled SPA pattern
 */
interface CompiledSPAPattern {
  original: string;
  segments: CompiledSegment[];
  view?: SPAView;
  children?: CompiledSPAPattern[];
  name?: string;
}

/**
 * Result of resolving an SPA URL
 */
export interface SPAResolveResult {
  view: SPAView;
  params: Record<string, string>;
  name?: string;
}

/**
 * Compile a URL pattern string into segments
 */
function compilePattern(pattern: string): CompiledSegment[] {
  const normalized = pattern.replace(/^\/+|\/+$/g, "");

  if (normalized === "") {
    return [];
  }

  return normalized.split("/").map((segment) => {
    if (segment.startsWith(":")) {
      return { isParam: true, value: segment.slice(1) };
    }
    return { isParam: false, value: segment };
  });
}

/**
 * Compile SPA patterns for matching
 */
function compilePatterns(patterns: SPAURLPattern[]): CompiledSPAPattern[] {
  return patterns.map((pattern) => ({
    original: pattern.pattern,
    segments: compilePattern(pattern.pattern),
    view: pattern.view,
    children: pattern.children ? compilePatterns(pattern.children) : undefined,
    name: pattern.name,
  }));
}

/**
 * Try to match URL segments against a compiled pattern
 */
function matchPattern(
  urlSegments: string[],
  pattern: CompiledSPAPattern,
  params: Record<string, string>,
): SPAResolveResult | null {
  const patternSegments = pattern.segments;

  if (patternSegments.length > urlSegments.length) {
    return null;
  }

  const newParams = { ...params };

  for (let i = 0; i < patternSegments.length; i++) {
    const patternSeg = patternSegments[i];
    const urlSeg = urlSegments[i];

    if (patternSeg.isParam) {
      newParams[patternSeg.value] = urlSeg;
    } else if (patternSeg.value !== urlSeg) {
      return null;
    }
  }

  const remainingSegments = urlSegments.slice(patternSegments.length);

  // Leaf node with view
  if (pattern.view) {
    if (remainingSegments.length === 0) {
      return {
        view: pattern.view,
        params: newParams,
        name: pattern.name,
      };
    }
    return null;
  }

  // Branch node with children
  if (pattern.children) {
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
 * Resolve an SPA URL path to a view and parameters
 *
 * @param url - URL path to resolve (relative to admin prefix)
 * @param urlpatterns - Array of SPA URL patterns
 * @returns SPAResolveResult if matched, null otherwise
 */
export function resolve(
  url: string,
  urlpatterns: SPAURLPattern[],
): SPAResolveResult | null {
  const normalized = url.replace(/^\/+|\/+$/g, "");
  const urlSegments = normalized === "" ? [] : normalized.split("/");

  const compiled = compilePatterns(urlpatterns);

  for (const pattern of compiled) {
    const result = matchPattern(urlSegments, pattern, {});
    if (result) {
      return result;
    }
  }

  return null;
}

// =============================================================================
// Reverse URL
// =============================================================================

/**
 * Route registry entry
 */
interface RouteEntry {
  pattern: string;
  segments: CompiledSegment[];
}

/**
 * Build a registry of named routes
 */
function buildRouteRegistry(
  patterns: SPAURLPattern[],
  prefix: string = "",
): Map<string, RouteEntry> {
  const registry = new Map<string, RouteEntry>();

  for (const pattern of patterns) {
    const fullPattern = prefix + pattern.pattern;
    const segments = compilePattern(fullPattern);

    if (pattern.name) {
      registry.set(pattern.name, { pattern: fullPattern, segments });
    }

    if (pattern.children) {
      const childRegistry = buildRouteRegistry(pattern.children, fullPattern);
      for (const [name, entry] of childRegistry) {
        registry.set(name, entry);
      }
    }
  }

  return registry;
}

// Cache for route registry
let cachedRegistry: Map<string, RouteEntry> | null = null;
let cachedPatterns: SPAURLPattern[] | null = null;

/**
 * Get or build route registry
 */
function getRegistry(urlpatterns: SPAURLPattern[]): Map<string, RouteEntry> {
  if (cachedPatterns === urlpatterns && cachedRegistry) {
    return cachedRegistry;
  }

  cachedPatterns = urlpatterns;
  cachedRegistry = buildRouteRegistry(urlpatterns);
  return cachedRegistry;
}

/**
 * Generate a URL from a named route and parameters
 *
 * @param name - Name of the route (e.g., "admin:model_changelist")
 * @param params - URL parameters to substitute
 * @param urlpatterns - Array of SPA URL patterns
 * @returns Generated URL path
 */
export function reverse(
  name: string,
  params: Record<string, string>,
  urlpatterns: SPAURLPattern[],
): string {
  const registry = getRegistry(urlpatterns);
  const route = registry.get(name);

  if (!route) {
    throw new Error(`No route found with name: ${name}`);
  }

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

  return segments.length > 0 ? "/" + segments.join("/") + "/" : "/";
}

/**
 * Clear the route registry cache
 */
export function clearRegistryCache(): void {
  cachedRegistry = null;
  cachedPatterns = null;
}
