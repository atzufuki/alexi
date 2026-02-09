/**
 * URL Routing module for Alexi Admin
 *
 * This module provides URL pattern generation and routing for the admin interface.
 *
 * @module
 */

import type { AdminSite } from "./site.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * View type for admin URLs.
 */
export type AdminViewType = "index" | "list" | "add" | "change" | "delete";

/**
 * Handler function type for URL patterns.
 */
export type AdminHandler = (
  request: Request,
  params: Record<string, string>,
) => Response | Promise<Response>;

/**
 * URL pattern for admin routes.
 */
export interface AdminUrlPattern {
  /** URL pattern string (e.g., "/admin/users/:id/") */
  pattern: string;
  /** URL name (e.g., "admin:users_changelist") */
  name: string;
  /** View type */
  viewType: AdminViewType;
  /** Handler function for this route */
  handler: AdminHandler;
  /** Model name (if applicable) */
  modelName?: string;
  /** Match a URL against this pattern */
  match(url: string): boolean;
  /** Extract params from a URL */
  extractParams(url: string): Record<string, string> | null;
}

// =============================================================================
// AdminUrlPattern Implementation
// =============================================================================

/**
 * Create an AdminUrlPattern instance.
 */
function createUrlPattern(
  pattern: string,
  name: string,
  viewType: AdminViewType,
  handler: AdminHandler,
  modelName?: string,
): AdminUrlPattern {
  // Convert pattern to regex
  // The pattern uses :param syntax for URL parameters
  // We need to:
  // 1. Escape special regex chars in the static parts
  // 2. Replace :param with named capture groups

  // Split by :param, escape static parts, then rejoin with capture groups
  const parts = pattern.split(/:(\w+)/);
  let regexPattern = "";

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Static part - escape regex special chars
      regexPattern += parts[i].replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    } else {
      // Parameter name - create named capture group
      regexPattern += `(?<${parts[i]}>[^/]+)`;
    }
  }

  const regex = new RegExp(`^${regexPattern}$`);

  return {
    pattern,
    name,
    viewType,
    handler,
    modelName,

    match(url: string): boolean {
      return regex.test(url);
    },

    extractParams(url: string): Record<string, string> | null {
      const match = url.match(regex);
      if (!match) {
        return null;
      }
      return match.groups ?? {};
    },
  };
}

// =============================================================================
// URL Generation
// =============================================================================

/**
 * Default placeholder handler for admin views.
 * This will be replaced by actual view components.
 */
function createPlaceholderHandler(viewType: AdminViewType): AdminHandler {
  return (_request: Request, _params: Record<string, string>) => {
    return new Response(
      JSON.stringify({
        message: `Admin ${viewType} view`,
        viewType,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
}

/**
 * Generate URL patterns for an AdminSite.
 *
 * @param site - The AdminSite instance
 * @returns Array of AdminUrlPattern objects
 */
export function getAdminUrls(site: AdminSite): AdminUrlPattern[] {
  const urls: AdminUrlPattern[] = [];
  const prefix = normalizePrefix(site.urlPrefix);

  // Dashboard/index URL
  urls.push(
    createUrlPattern(
      `${prefix}/`,
      "admin:index",
      "index",
      createPlaceholderHandler("index"),
    ),
  );

  // Generate URLs for each registered model
  for (const model of site.getRegisteredModels()) {
    const modelName = model.name.toLowerCase();
    const admin = site.getModelAdmin(model);

    // List URL (changelist)
    urls.push(
      createUrlPattern(
        admin.getListUrl(),
        `admin:${modelName}_changelist`,
        "list",
        createPlaceholderHandler("list"),
        modelName,
      ),
    );

    // Add URL
    urls.push(
      createUrlPattern(
        admin.getAddUrl(),
        `admin:${modelName}_add`,
        "add",
        createPlaceholderHandler("add"),
        modelName,
      ),
    );

    // Detail/Change URL
    urls.push(
      createUrlPattern(
        `${prefix}/${modelName}/:id/`,
        `admin:${modelName}_change`,
        "change",
        createPlaceholderHandler("change"),
        modelName,
      ),
    );

    // Delete URL
    urls.push(
      createUrlPattern(
        `${prefix}/${modelName}/:id/delete/`,
        `admin:${modelName}_delete`,
        "delete",
        createPlaceholderHandler("delete"),
        modelName,
      ),
    );
  }

  return urls;
}

/**
 * Normalize URL prefix to have leading slash but no trailing slash.
 */
function normalizePrefix(prefix: string): string {
  let normalized = prefix.startsWith("/") ? prefix : `/${prefix}`;
  normalized = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  return normalized;
}

// =============================================================================
// Router Class
// =============================================================================

/**
 * AdminRouter handles URL routing for the admin interface.
 */
export class AdminRouter {
  private patterns: AdminUrlPattern[] = [];

  constructor(private site: AdminSite) {
    this.patterns = getAdminUrls(site);
  }

  /**
   * Find a matching URL pattern for a request.
   */
  match(url: string): {
    pattern: AdminUrlPattern;
    params: Record<string, string>;
  } | null {
    // Normalize URL - ensure trailing slash
    const normalizedUrl = url.endsWith("/") ? url : `${url}/`;

    for (const pattern of this.patterns) {
      if (pattern.match(normalizedUrl)) {
        const params = pattern.extractParams(normalizedUrl);
        if (params !== null) {
          return { pattern, params };
        }
      }
    }

    return null;
  }

  /**
   * Handle a request.
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = this.match(url.pathname);

    if (!match) {
      return new Response("Not Found", { status: 404 });
    }

    return await match.pattern.handler(request, match.params);
  }

  /**
   * Get all URL patterns.
   */
  getPatterns(): AdminUrlPattern[] {
    return this.patterns;
  }

  /**
   * Reverse a URL by name.
   */
  reverse(name: string, params?: Record<string, string>): string {
    return this.site.reverse(name, params);
  }
}
