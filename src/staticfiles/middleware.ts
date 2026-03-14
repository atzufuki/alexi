/**
 * Static Files Middleware
 *
 * Django-style middleware for serving static files.
 * Used in development mode to serve files directly from app directories.
 *
 * In production, static files should be served by a CDN or web server,
 * not by this middleware.
 *
 * @module alexi_http/static/middleware
 */

import { BaseMiddleware } from "@alexi/middleware";
import type { MiddlewareClass, NextFunction } from "@alexi/middleware";
import { StaticFileFinders } from "./finders.ts";
import { getContentType } from "./storage.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for static file serving
 */
export interface StaticServeOptions {
  /**
   * Installed apps list
   */
  installedApps: string[];

  /**
   * Map of app names to their paths
   */
  appPaths: Record<string, string>;

  /**
   * Additional static files directories (like STATICFILES_DIRS)
   */
  staticFilesDirs?: string[];

  /**
   * Project root directory
   */
  projectRoot?: string;

  /**
   * STATIC_URL prefix
   * @default "/static/"
   */
  staticUrl?: string;

  /**
   * STATIC_ROOT for production
   */
  staticRoot?: string;

  /**
   * Debug mode (development)
   */
  debug?: boolean;

  /**
   * Cache control header for development
   * @default "no-cache"
   */
  devCacheControl?: string;

  /**
   * Cache control header for production (immutable files like chunks)
   * @default "public, max-age=31536000, immutable"
   */
  prodImmutableCacheControl?: string;

  /**
   * Cache control header for production (mutable files)
   * @default "public, max-age=86400"
   */
  prodCacheControl?: string;
}

// =============================================================================
// Static Files View
// =============================================================================

/**
 * Create a view function for serving static files
 *
 * Returns a view that can be used in URL patterns to serve static files.
 *
 * @example
 * ```ts
 * import { staticServe } from "@alexi/http/static";
 *
 * const serveStatic = staticServe({
 *   installedApps: settings.INSTALLED_APPS,
 *   appPaths: settings.APP_PATHS,
 *   debug: settings.DEBUG,
 * });
 *
 * // In URL patterns
 * path("static/<path:path>", serveStatic)
 * ```
 */
export function staticServe(
  options: StaticServeOptions,
): (request: Request, params?: Record<string, string>) => Promise<Response> {
  const {
    installedApps,
    appPaths,
    staticFilesDirs,
    projectRoot = Deno.cwd(),
    staticUrl = "/static/",
    staticRoot,
    debug = false,
    devCacheControl = "no-cache",
    prodImmutableCacheControl = "public, max-age=31536000, immutable",
    prodCacheControl = "public, max-age=86400",
  } = options;

  // Create finders for development mode
  const finders = StaticFileFinders.fromSettings({
    installedApps,
    appPaths,
    staticFilesDirs,
    projectRoot,
  });

  return async (
    request: Request,
    params?: Record<string, string>,
  ): Promise<Response> => {
    // Get the file path from params or URL
    let filePath = params?.path ?? "";

    if (!filePath) {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Extract path from URL if using STATIC_URL prefix
      if (pathname.startsWith(staticUrl)) {
        filePath = pathname.slice(staticUrl.length);
      } else {
        filePath = pathname.slice(1); // Remove leading slash
      }
    }

    // Prevent path traversal
    filePath = sanitizePath(filePath);

    if (!filePath) {
      return new Response("Not Found", { status: 404 });
    }

    // Try to serve the file
    let absolutePath: string | null = null;

    if (debug) {
      // Development: use finders to locate file in app directories
      const result = await finders.find(filePath);
      if (result) {
        absolutePath = result.path;
      }
    } else if (staticRoot) {
      // Production: serve from STATIC_ROOT
      absolutePath = `${staticRoot}/${filePath}`;
    }

    if (!absolutePath) {
      return new Response("Not Found", { status: 404 });
    }

    // Read the file
    let content: Uint8Array;
    try {
      content = await Deno.readFile(absolutePath);
    } catch {
      return new Response("Not Found", { status: 404 });
    }

    // Determine content type
    const contentType = getContentType(filePath);

    // Determine cache control
    let cacheControl: string;
    if (debug) {
      cacheControl = devCacheControl;
    } else {
      // Chunks with hashes can be cached forever
      const isImmutable = filePath.includes("/chunks/") ||
        (filePath.includes("-") && filePath.match(/\.[a-f0-9]{8,}\./));
      cacheControl = isImmutable ? prodImmutableCacheControl : prodCacheControl;
    }

    // Build response headers
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Length": content.length.toString(),
      "Cache-Control": cacheControl,
    });

    // Handle conditional requests (ETag)
    const etag = generateETag(content);
    headers.set("ETag", etag);

    const ifNoneMatch = request.headers.get("If-None-Match");
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(content as unknown as BodyInit, {
      status: 200,
      headers,
    });
  };
}

// =============================================================================
// StaticFilesMiddleware — class-based
// =============================================================================

/**
 * Django-style class-based middleware for serving static files.
 *
 * Intercepts requests to `STATIC_URL` and serves files from app
 * `static/` directories (development) or `STATIC_ROOT` (production).
 * Requests to other paths are forwarded to the next layer.
 *
 * Use the {@link staticFilesMiddleware} factory for a one-liner.
 *
 * @example Using the factory (recommended)
 * ```ts
 * import { staticFilesMiddleware } from "@alexi/staticfiles";
 *
 * export const MIDDLEWARE = [
 *   staticFilesMiddleware({
 *     installedApps: settings.INSTALLED_APPS,
 *     appPaths: settings.APP_PATHS,
 *     staticUrl: settings.STATIC_URL,
 *     debug: settings.DEBUG,
 *   }),
 * ];
 * ```
 */
export class StaticFilesMiddleware extends BaseMiddleware {
  /** Resolved static file serving options. */
  protected options: StaticServeOptions;
  /** Resolved STATIC_URL prefix. */
  protected staticUrl: string;
  /** Inner static serve function. */
  protected serveStatic: (
    request: Request,
    params?: Record<string, string>,
  ) => Promise<Response>;

  /**
   * Create a new StaticFilesMiddleware.
   *
   * @param getResponse The next layer in the middleware chain.
   * @param options Static file serving options.
   */
  constructor(getResponse: NextFunction, options: StaticServeOptions) {
    super(getResponse);
    this.options = options;
    this.staticUrl = options.staticUrl ?? "/static/";
    this.serveStatic = staticServe(options);
  }

  /**
   * Serve static files or forward to the next layer.
   *
   * @param request The incoming HTTP request.
   */
  override async call(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (!pathname.startsWith(this.staticUrl)) {
      return this.getResponse(request);
    }

    const filePath = pathname.slice(this.staticUrl.length);

    if (!filePath) {
      return this.getResponse(request);
    }

    const response = await this.serveStatic(request, { path: filePath });

    if (response.status === 404) {
      return this.getResponse(request);
    }

    return response;
  }
}

// =============================================================================
// Middleware factory (backwards compatible + options passing)
// =============================================================================

/**
 * Create a static files middleware class configured with the given options.
 *
 * Returns a {@link MiddlewareClass} (constructor) that can be added directly
 * to the `MIDDLEWARE` setting.
 *
 * @param options - Static file serving options.
 * @returns A middleware class constructor configured with the given options.
 *
 * @example
 * ```ts
 * import { staticFilesMiddleware } from "@alexi/staticfiles";
 *
 * export const MIDDLEWARE = [
 *   staticFilesMiddleware({
 *     installedApps: settings.INSTALLED_APPS,
 *     appPaths: settings.APP_PATHS,
 *     staticUrl: settings.STATIC_URL,
 *     debug: settings.DEBUG,
 *   }),
 * ];
 * ```
 */
export function staticFilesMiddleware(
  options: StaticServeOptions,
): MiddlewareClass {
  return class extends StaticFilesMiddleware {
    constructor(getResponse: NextFunction) {
      super(getResponse, options);
    }
  };
}

// =============================================================================
// Bundle Serving (Development)
// =============================================================================

/**
 * Create middleware for serving bundled files directly (without /static/ prefix)
 *
 * In development, bundle.js and bundle.css are often served from root.
 * This middleware handles those requests.
 *
 * @example
 * ```ts
 * const bundleMiddleware = serveBundleMiddleware({
 *   installedApps: settings.INSTALLED_APPS,
 *   appPaths: settings.APP_PATHS,
 *   bundleFiles: ["bundle.js", "bundle.css", "chunks/"],
 * });
 * ```
 */
export function serveBundleMiddleware(options: {
  installedApps: string[];
  appPaths: Record<string, string>;
  projectRoot?: string;
  /**
   * Files/directories to serve from root
   * @default ["bundle.js", "bundle.css", "bundle.js.map", "chunks/"]
   */
  bundleFiles?: string[];
  debug?: boolean;
}): (request: Request, next: () => Promise<Response>) => Promise<Response> {
  const {
    installedApps,
    appPaths,
    projectRoot = Deno.cwd(),
    bundleFiles = ["bundle.js", "bundle.css", "bundle.js.map", "chunks/"],
    debug = true,
  } = options;

  const finders = StaticFileFinders.fromSettings({
    installedApps,
    appPaths,
    projectRoot,
  });

  return async (
    request: Request,
    next: () => Promise<Response>,
  ): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Check if this is a bundle file request
    const isBundleRequest = bundleFiles.some((file) => {
      if (file.endsWith("/")) {
        // Directory match (e.g., "chunks/")
        return pathname.startsWith(`/${file}`) ||
          pathname.startsWith(`/${file.slice(0, -1)}`);
      }
      return pathname === `/${file}`;
    });

    if (!isBundleRequest) {
      return next();
    }

    // Remove leading slash
    const filePath = pathname.slice(1);

    // Try to find the file in each app's static directory
    for (const appName of installedApps) {
      const appPath = appPaths[appName];
      if (!appPath) continue;

      // Try app-namespaced path first: static/app-name/bundle.js
      const namespacedPath = `${appName}/${filePath}`;
      const result = await finders.find(namespacedPath);

      if (result) {
        try {
          const content = await Deno.readFile(result.path);
          const contentType = getContentType(filePath);

          return new Response(content, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": debug
                ? "no-cache, no-store, must-revalidate"
                : "public, max-age=86400",
              ...(debug ? { Pragma: "no-cache", Expires: "0" } : {}),
            },
          });
        } catch {
          // Continue to next app
        }
      }
    }

    return next();
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Sanitize a file path to prevent directory traversal
 */
function sanitizePath(path: string): string {
  return path
    .replace(/\\/g, "/") // Normalize backslashes
    .replace(/\.{2,}/g, "") // Remove ..
    .replace(/\/+/g, "/") // Collapse multiple slashes
    .replace(/^\/+/, "") // Remove leading slashes
    .replace(/^\.+/, ""); // Remove leading dots
}

/**
 * Generate a simple ETag from content
 */
function generateETag(content: Uint8Array): string {
  const size = content.length;
  const first = content.length > 0 ? content[0] : 0;
  const last = content.length > 0 ? content[content.length - 1] : 0;
  const mid = content.length > 1 ? content[Math.floor(content.length / 2)] : 0;
  const hash = (((size * 31 + first) * 31 + last) * 31 + mid) >>> 0;
  return `"${hash.toString(16)}"`;
}
