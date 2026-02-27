/**
 * URL Routing module for Alexi Admin
 *
 * This module provides URL pattern generation and routing for the admin interface.
 *
 * @module
 */

import type { DatabaseBackend } from "@alexi/db";
import type { AdminSite } from "./site.ts";
import {
  renderDashboard,
  renderModelDetail,
  renderModelList,
} from "./views/admin_views.ts";

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
  // Convert pattern to regex.
  // The pattern uses :param syntax for URL parameters.
  // Split by :param, escape static parts, then rejoin with named capture groups.
  const parts = pattern.split(/:(\w+)/);
  let regexPattern = "";

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Static part — escape regex special chars
      regexPattern += parts[i].replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    } else {
      // Parameter name — create named capture group (matches anything except /)
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
      const m = url.match(regex);
      if (!m) {
        return null;
      }
      return m.groups ?? {};
    },
  };
}

// =============================================================================
// URL Generation Helpers
// =============================================================================

/**
 * Default placeholder handler — used when no backend is provided (e.g. tests).
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
 * Create a handler that serves admin static files (CSS/JS).
 *
 * The URL pattern `/admin/static/:file` only captures a single path segment,
 * but the real sub-path (e.g. `css/admin.css`) is read from the raw URL so that
 * `css/` and `js/` sub-directories are handled correctly.
 */
function createStaticHandler(prefix: string): AdminHandler {
  return async (request: Request, _params: Record<string, string>) => {
    const url = new URL(request.url);
    // Strip the prefix + "/static/" to get the relative file path
    const filePath = url.pathname.replace(`${prefix}/static/`, "");
    const allowed: Record<string, string> = {
      "css/admin.css": "text/css; charset=utf-8",
      "js/admin.js": "application/javascript; charset=utf-8",
    };
    const contentType = allowed[filePath];
    if (!contentType) {
      return new Response("Not Found", { status: 404 });
    }
    const moduleDir = new URL("./static/", import.meta.url);
    const fileUrl = new URL(filePath, moduleDir);
    try {
      const content = await Deno.readTextFile(fileUrl);
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": contentType },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  };
}

// =============================================================================
// URL Generation
// =============================================================================

/**
 * Generate URL patterns for an AdminSite.
 *
 * When `backend` is provided, routes are wired to the real SSR view handlers
 * from `views/admin_views.ts`. Without a backend (e.g. in tests), placeholder
 * handlers are used so existing tests continue to pass unchanged.
 *
 * @param site - The AdminSite instance
 * @param backend - Optional database backend; enables real SSR view handlers
 * @returns Array of AdminUrlPattern objects
 */
export function getAdminUrls(
  site: AdminSite,
  backend?: DatabaseBackend,
): AdminUrlPattern[] {
  const urls: AdminUrlPattern[] = [];
  const prefix = normalizePrefix(site.urlPrefix);

  if (backend) {
    // -------------------------------------------------------------------------
    // Real SSR handlers (backend provided)
    // -------------------------------------------------------------------------

    // Static files: /admin/static/css/admin.css, /admin/static/js/admin.js
    // The :file segment only matches one path part; the handler reads the full
    // sub-path from the raw request URL instead.
    urls.push(
      createUrlPattern(
        `${prefix}/static/:file`,
        "admin:static",
        "index",
        createStaticHandler(prefix),
      ),
    );

    // Dashboard/index
    urls.push(
      createUrlPattern(
        `${prefix}/`,
        "admin:index",
        "index",
        (request, params) => {
          const result = renderDashboard({
            request,
            params,
            adminSite: site,
            backend: backend,
          });
          return new Response(result.html, {
            status: result.status ?? 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              ...result.headers,
            },
          });
        },
      ),
    );

    // Per-model routes
    for (const model of site.getRegisteredModels()) {
      const modelName = model.name.toLowerCase();
      const admin = site.getModelAdmin(model);

      // List (changelist)
      urls.push(
        createUrlPattern(
          admin.getListUrl(),
          `admin:${modelName}_changelist`,
          "list",
          async (request, params) => {
            const result = await renderModelList(
              { request, params, adminSite: site, backend: backend },
              modelName,
            );
            return new Response(result.html, {
              status: result.status ?? 200,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                ...result.headers,
              },
            });
          },
          modelName,
        ),
      );

      // Add
      urls.push(
        createUrlPattern(
          admin.getAddUrl(),
          `admin:${modelName}_add`,
          "add",
          (_request, _params) => {
            return new Response("Add form not implemented yet", {
              status: 501,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          },
          modelName,
        ),
      );

      // Change (detail)
      urls.push(
        createUrlPattern(
          `${prefix}/${modelName}/:id/`,
          `admin:${modelName}_change`,
          "change",
          async (request, params) => {
            const result = await renderModelDetail(
              { request, params, adminSite: site, backend: backend },
              modelName,
              params.id,
            );
            return new Response(result.html, {
              status: result.status ?? 200,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                ...result.headers,
              },
            });
          },
          modelName,
        ),
      );

      // Delete confirmation
      urls.push(
        createUrlPattern(
          `${prefix}/${modelName}/:id/delete/`,
          `admin:${modelName}_delete`,
          "delete",
          (_request, _params) => {
            return new Response("Delete confirmation not implemented yet", {
              status: 501,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          },
          modelName,
        ),
      );
    }
  } else {
    // -------------------------------------------------------------------------
    // Placeholder handlers (no backend — used by tests and tooling)
    // -------------------------------------------------------------------------

    // Dashboard/index
    urls.push(
      createUrlPattern(
        `${prefix}/`,
        "admin:index",
        "index",
        createPlaceholderHandler("index"),
      ),
    );

    for (const model of site.getRegisteredModels()) {
      const modelName = model.name.toLowerCase();
      const admin = site.getModelAdmin(model);

      urls.push(
        createUrlPattern(
          admin.getListUrl(),
          `admin:${modelName}_changelist`,
          "list",
          createPlaceholderHandler("list"),
          modelName,
        ),
      );

      urls.push(
        createUrlPattern(
          admin.getAddUrl(),
          `admin:${modelName}_add`,
          "add",
          createPlaceholderHandler("add"),
          modelName,
        ),
      );

      urls.push(
        createUrlPattern(
          `${prefix}/${modelName}/:id/`,
          `admin:${modelName}_change`,
          "change",
          createPlaceholderHandler("change"),
          modelName,
        ),
      );

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

  constructor(private site: AdminSite, backend?: DatabaseBackend) {
    this.patterns = getAdminUrls(site, backend);
  }

  /**
   * Find a matching URL pattern for a request.
   */
  match(url: string): {
    pattern: AdminUrlPattern;
    params: Record<string, string>;
  } | null {
    // Normalize URL — ensure trailing slash
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
