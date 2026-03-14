/**
 * URL Routing module for Alexi Admin
 *
 * This module provides URL pattern generation and routing for the admin interface.
 * `getAdminUrls()` returns standard `URLPattern[]` from `@alexi/urls`, so admin
 * routes can be mounted with `path()` / `include()` just like any other Alexi app.
 *
 * @module
 */

import { path } from "@alexi/urls";
import type { URLPattern } from "@alexi/urls";
import { conf, isSettingsConfigured } from "@alexi/core";
import { getBackend, hasBackend } from "@alexi/db";
import type { DatabaseBackend } from "@alexi/db";
import type { AdminSite } from "./site.ts";
import { renderChangeForm } from "./views/changeform_views.ts";
import { renderChangeList } from "./views/changelist_views.ts";
import { renderDashboard } from "./views/dashboard_views.ts";
import { renderDeleteConfirmation } from "./views/delete_views.ts";
import {
  handleLoginPost,
  handleLogout,
  renderLoginPage,
} from "./views/login_views.ts";

// =============================================================================
// Types (legacy — kept for backwards compatibility)
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
 *
 * @deprecated Use the standard `URLPattern` from `@alexi/urls` instead.
 * This interface is retained for backwards compatibility only and will be
 * removed in a future release.
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
// Static file handler
// =============================================================================

/**
 * Create a handler that serves admin static files (CSS/JS).
 *
 * The URL pattern captures an explicit sub-path so that `css/admin.css` and
 * `js/admin.js` are served correctly from the package's `./static/` directory.
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
      const response = await fetch(fileUrl);
      if (!response.ok) {
        return new Response("Not Found", { status: 404 });
      }
      const content = await response.text();
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
 * Resolve the effective settings object.
 *
 * Returns the global `conf` proxy when settings have been configured.
 * Falls back to `override` when provided (used by `AdminRouter` when an
 * explicit settings dict was passed to its constructor, e.g. in tests).
 *
 * @param override - Optional fallback settings dict.
 */
function resolveSettings(
  override?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (isSettingsConfigured()) {
    return conf as unknown as Record<string, unknown>;
  }
  return override;
}

/**
 * Normalize a URL prefix to have a leading slash but no trailing slash.
 *
 * @param prefix - Raw prefix string (e.g. `"/admin"` or `"admin/"`)
 * @returns Normalized prefix (e.g. `"/admin"`)
 */
function normalizePrefix(prefix: string): string {
  let normalized = prefix.startsWith("/") ? prefix : `/${prefix}`;
  normalized = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  return normalized;
}

/**
 * Strip the leading slash from a prefix to produce a relative URL pattern
 * segment suitable for use with `path()` from `@alexi/urls`.
 *
 * @example
 * ```ts
 * relativePrefix("/admin")  // → "admin"
 * relativePrefix("/admin/panel") // → "admin/panel"
 * ```
 */
function relativePrefix(absolutePrefix: string): string {
  return absolutePrefix.replace(/^\/+/, "");
}

/**
 * Generate URL patterns for an AdminSite as standard `URLPattern[]`.
 *
 * The returned patterns are compatible with `path()` / `include()` from
 * `@alexi/urls` and can be mounted in your project's ROOT_URLCONF:
 *
 * ```ts
 * import { path, include } from "@alexi/urls";
 * import { getAdminUrls } from "@alexi/admin";
 *
 * export const urlpatterns = [
 *   path("", include(getAdminUrls(adminSite, backend))),
 * ];
 * ```
 *
 * Or equivalently via `AdminSite.urls`:
 *
 * ```ts
 * path("", include(adminSite.urls)),
 * ```
 *
 * URL patterns are built lazily by `AdminRouter` on the first request —
 * not at module evaluation time — so that `configureSettings()` is
 * guaranteed to have been called before the backend / settings are resolved.
 *
 * When `backend` is provided, routes are wired to the real SSR view handlers.
 * Without a backend, placeholder JSON handlers are used (useful for testing
 * URL generation without a database).
 *
 * @param site - The AdminSite instance
 * @param backend - Optional database backend; enables real SSR view handlers
 * @param settingsOverride - Optional settings dict used as fallback when the
 *   global `conf` proxy is not configured (e.g. in tests or direct instantiation).
 *   In production, settings are always read from the global `conf` proxy.
 * @returns Array of URLPattern objects compatible with `@alexi/urls`
 */
export function getAdminUrls(
  site: AdminSite,
  backend?: DatabaseBackend,
  settingsOverride?: Record<string, unknown>,
): URLPattern[] {
  const urls: URLPattern[] = [];
  const absPrefix = normalizePrefix(site.urlPrefix);
  const rel = relativePrefix(absPrefix); // e.g. "admin"

  if (backend) {
    // -------------------------------------------------------------------------
    // Real SSR handlers (backend provided)
    // -------------------------------------------------------------------------

    // Static files: admin/static/css/admin.css, admin/static/js/admin.js
    const staticHandler = createStaticHandler(absPrefix);
    for (const subPath of ["css/admin.css", "js/admin.js"]) {
      urls.push(
        path(`${rel}/static/${subPath}`, staticHandler, {
          name: "admin:static",
        }),
      );
    }

    // Login page: GET|POST admin/login/
    urls.push(
      path(
        `${rel}/login/`,
        (request, params) => {
          if (request.method === "POST") {
            return handleLoginPost({
              request,
              params,
              adminSite: site,
              backend: backend,
              settings: resolveSettings(settingsOverride),
            });
          }
          const url = new URL(request.url);
          const next = url.searchParams.get("next") ?? undefined;
          return renderLoginPage(site, { next });
        },
        { name: "admin:login" },
      ),
    );

    // Logout: GET|POST admin/logout/
    urls.push(
      path(
        `${rel}/logout/`,
        (_request, _params) => handleLogout(site),
        { name: "admin:logout" },
      ),
    );

    // Dashboard/index: GET|POST admin/
    urls.push(
      path(
        `${rel}/`,
        (request, params) =>
          renderDashboard({
            request,
            params,
            adminSite: site,
            settings: resolveSettings(settingsOverride),
          }),
        { name: "admin:index" },
      ),
    );

    // Per-model routes
    for (const model of site.getRegisteredModels()) {
      const modelName = model.name.toLowerCase();

      // Changelist: admin/<model>/
      urls.push(
        path(
          `${rel}/${modelName}/`,
          (request, params) =>
            renderChangeList(
              {
                request,
                params,
                adminSite: site,
                backend,
                settings: resolveSettings(settingsOverride),
              },
              modelName,
            ),
          { name: `admin:${modelName}_changelist` },
        ),
      );

      // Add: admin/<model>/add/
      urls.push(
        path(
          `${rel}/${modelName}/add/`,
          (request, params) =>
            renderChangeForm(
              {
                request,
                params,
                adminSite: site,
                backend,
                settings: resolveSettings(settingsOverride),
              },
              modelName,
            ),
          { name: `admin:${modelName}_add` },
        ),
      );

      // Change (detail): admin/<model>/:id/
      urls.push(
        path(
          `${rel}/${modelName}/:id/`,
          (request, params) =>
            renderChangeForm(
              {
                request,
                params,
                adminSite: site,
                backend,
                settings: resolveSettings(settingsOverride),
              },
              modelName,
              params.id,
            ),
          { name: `admin:${modelName}_change` },
        ),
      );

      // Delete: admin/<model>/:id/delete/
      urls.push(
        path(
          `${rel}/${modelName}/:id/delete/`,
          (request, params) =>
            renderDeleteConfirmation(
              {
                request,
                params,
                adminSite: site,
                backend,
                settings: resolveSettings(settingsOverride),
              },
              modelName,
              params.id,
            ),
          { name: `admin:${modelName}_delete` },
        ),
      );
    }
  } else {
    // -------------------------------------------------------------------------
    // Placeholder handlers (no backend — used by tests and tooling)
    // -------------------------------------------------------------------------

    const placeholder = (
      _request: Request,
      _params: Record<string, string>,
    ): Response =>
      new Response(JSON.stringify({ message: "Admin placeholder" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    urls.push(path(`${rel}/login/`, placeholder, { name: "admin:login" }));
    urls.push(path(`${rel}/logout/`, placeholder, { name: "admin:logout" }));
    urls.push(path(`${rel}/`, placeholder, { name: "admin:index" }));

    for (const model of site.getRegisteredModels()) {
      const modelName = model.name.toLowerCase();

      urls.push(
        path(`${rel}/${modelName}/`, placeholder, {
          name: `admin:${modelName}_changelist`,
        }),
      );
      urls.push(
        path(`${rel}/${modelName}/add/`, placeholder, {
          name: `admin:${modelName}_add`,
        }),
      );
      urls.push(
        path(`${rel}/${modelName}/:id/`, placeholder, {
          name: `admin:${modelName}_change`,
        }),
      );
      urls.push(
        path(`${rel}/${modelName}/:id/delete/`, placeholder, {
          name: `admin:${modelName}_delete`,
        }),
      );
    }
  }

  return urls;
}

// =============================================================================
// Router Class
// =============================================================================

/**
 * AdminRouter handles URL routing for the admin interface.
 *
 * URL patterns are built lazily on the first request — not in the constructor.
 * This mirrors Django's URLconf lazy-loading behaviour: `ROOT_URLCONF` is
 * imported and evaluated before `configureSettings()` has been called (during
 * `runserver` startup), so resolving the backend / settings at construction
 * time would always yield `undefined` and fall back to placeholder handlers.
 *
 * By deferring pattern creation to the first call to `_getPatterns()`, the
 * router is guaranteed to see the fully-configured backend and settings
 * regardless of module evaluation order.
 *
 * ### Migration guide
 *
 * `AdminRouter` is retained for backwards compatibility. For new projects,
 * prefer mounting admin routes via `AdminSite.urls` and `include()`:
 *
 * ```ts
 * // urls.ts
 * import { path, include } from "@alexi/urls";
 * import { adminSite } from "./admin.ts";
 *
 * export const urlpatterns = [
 *   path("", include(adminSite.urls)),
 * ];
 * ```
 */
export class AdminRouter {
  /**
   * Lazily-built URL patterns (standard URLPattern[] from @alexi/urls).
   *
   * `null` means "not yet built". Once built, the array is cached for the
   * lifetime of the router — exactly as Django caches its compiled URL
   * resolver on first access.
   */
  private _patterns: URLPattern[] | null = null;

  /**
   * Explicit backend override supplied by the caller.
   * When `undefined`, the router falls back to the globally registered default.
   */
  private _backendOverride: DatabaseBackend | undefined;

  /**
   * Explicit settings override supplied by the caller.
   * Used as a fallback when the global `conf` proxy is not yet configured
   * (e.g. in tests). Production code should use `configureSettings()` instead.
   */
  private _settingsOverride: Record<string, unknown> | undefined;

  /**
   * Creates a new AdminRouter for the given site.
   *
   * @param site - The AdminSite whose registered models define the URL tree.
   * @param backend - Optional explicit database backend. Defaults to the
   *   globally registered default backend from `@alexi/db`.
   * @param settings - Optional settings override used as a fallback when the
   *   global `conf` proxy is not configured (e.g. in tests).
   */
  constructor(
    private site: AdminSite,
    backend?: DatabaseBackend,
    settings?: Record<string, unknown>,
  ) {
    this._backendOverride = backend;
    this._settingsOverride = settings;
  }

  /**
   * Resolve the active backend.
   *
   * Returns the explicit override (if any), otherwise falls back to the
   * globally registered default backend from `@alexi/db`.
   */
  private _resolveBackend(): DatabaseBackend | undefined {
    return this._backendOverride ??
      (hasBackend("default") ? getBackend() : undefined);
  }

  /**
   * Return the URL patterns, building them on first access (lazy init).
   *
   * This is the Django-style "setup on first request" pattern: the URL
   * resolver caches its compiled patterns after the first lookup so that
   * subsequent requests pay no extra cost.
   */
  private _getPatterns(): URLPattern[] {
    if (this._patterns === null) {
      this._patterns = getAdminUrls(
        this.site,
        this._resolveBackend(),
        this._settingsOverride,
      );
    }
    return this._patterns;
  }

  /**
   * Find a matching URL pattern for a request path.
   *
   * Tries the URL as-is first (for static files without trailing slashes),
   * then with a trailing slash appended (for all other admin routes).
   *
   * @param urlPath - The URL pathname to match (e.g. `/admin/login/`)
   * @returns The matched pattern and extracted params, or `null` if no match.
   */
  match(urlPath: string): {
    pattern: URLPattern;
    params: Record<string, string>;
  } | null {
    const candidates = urlPath.endsWith("/")
      ? [urlPath]
      : [urlPath, `${urlPath}/`];

    for (const candidate of candidates) {
      const result = _resolveUrl(candidate, this._getPatterns());
      if (result) {
        // Find the matched URLPattern by name so the caller gets the real view fn
        const matchedPat = result.name
          ? (this._getPatterns().find((p) => p.name === result.name) ??
            {
              pattern: candidate,
              view: result.view as unknown as URLPattern["view"],
            })
          : {
            pattern: candidate,
            view: result.view as unknown as URLPattern["view"],
          };
        return { pattern: matchedPat as URLPattern, params: result.params };
      }
    }

    return null;
  }

  /**
   * Handle a request by dispatching to the matched admin view.
   *
   * @param request - The incoming HTTP request
   * @returns The HTTP response
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const candidates = url.pathname.endsWith("/")
      ? [url.pathname]
      : [url.pathname, `${url.pathname}/`];

    for (const candidate of candidates) {
      const result = _resolveUrl(candidate, this._getPatterns());
      if (result) {
        return await result.view(request, result.params);
      }
    }

    return new Response("Not Found", { status: 404 });
  }

  /**
   * Get all URL patterns.
   *
   * @returns The lazily-built array of URL patterns.
   */
  getPatterns(): URLPattern[] {
    return this._getPatterns();
  }

  /**
   * Reverse a URL by name.
   *
   * @param name - The URL name (e.g., `"admin:article_changelist"`)
   * @param params - URL parameters to substitute
   * @returns The resolved URL path
   */
  reverse(name: string, params?: Record<string, string>): string {
    return this.site.reverse(name, params);
  }
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Thin URL resolver used by `AdminRouter.match()` and `AdminRouter.handle()`.
 *
 * Mirrors the logic in `@alexi/urls/resolver.ts` inline to avoid any circular
 * dependency issues that could arise from importing the resolver at the top
 * level of this module.
 * @internal
 */
function _resolveUrl(
  urlPath: string,
  patterns: URLPattern[],
):
  | { view: AdminHandler; params: Record<string, string>; name?: string }
  | null {
  // Inline resolution to avoid extra imports — mirrors resolver.ts logic.
  function compileSegments(
    pattern: string,
  ): Array<{ isParam: boolean; value: string }> {
    const normalized = pattern.replace(/^\/+|\/+$/g, "");
    if (normalized === "") return [];
    return normalized.split("/").map((seg) =>
      seg.startsWith(":")
        ? { isParam: true, value: seg.slice(1) }
        : { isParam: false, value: seg }
    );
  }

  function matchSegments(
    urlSegs: string[],
    patternSegs: Array<{ isParam: boolean; value: string }>,
    accumulated: Record<string, string>,
  ): Record<string, string> | null {
    if (patternSegs.length !== urlSegs.length) return null;
    const params = { ...accumulated };
    for (let i = 0; i < patternSegs.length; i++) {
      if (patternSegs[i].isParam) {
        params[patternSegs[i].value] = urlSegs[i];
      } else if (patternSegs[i].value !== urlSegs[i]) {
        return null;
      }
    }
    return params;
  }

  function tryMatch(
    urlSegs: string[],
    pats: URLPattern[],
    acc: Record<string, string>,
  ):
    | { view: AdminHandler; params: Record<string, string>; name?: string }
    | null {
    for (const pat of pats) {
      const patSegs = compileSegments(pat.pattern);
      if (pat.view) {
        const params = matchSegments(urlSegs, patSegs, acc);
        if (params !== null) {
          return {
            view: pat.view as unknown as AdminHandler,
            params,
            name: pat.name,
          };
        }
      } else if (pat.children && urlSegs.length >= patSegs.length) {
        const partial = matchSegments(
          urlSegs.slice(0, patSegs.length),
          patSegs,
          acc,
        );
        if (partial !== null) {
          const sub = tryMatch(
            urlSegs.slice(patSegs.length),
            pat.children,
            partial,
          );
          if (sub) return sub;
        }
      }
    }
    return null;
  }

  const normalized = urlPath.replace(/^\/+|\/+$/g, "");
  const urlSegs = normalized === "" ? [] : normalized.split("/");
  return tryMatch(urlSegs, patterns, {});
}
