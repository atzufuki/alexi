/**
 * CORS (Cross-Origin Resource Sharing) middleware for Alexi HTTP
 *
 * Handles CORS preflight requests and adds appropriate headers to responses.
 *
 * @module @alexi/http/middleware/cors
 */

import type { Middleware } from "./types.ts";

// ============================================================================
// CORS Options
// ============================================================================

/**
 * Options for CORS middleware
 */
export interface CorsOptions {
  /**
   * Allowed origins
   *
   * Can be:
   * - A string: single origin (e.g., "http://localhost:5173")
   * - An array: multiple origins (e.g., ["http://localhost:5173", "https://example.com"])
   * - "*": allow all origins (not recommended for production with credentials)
   * - A function: dynamic origin validation
   *
   * @default "*"
   */
  origins?: string | string[] | ((origin: string) => boolean);

  /**
   * Allowed HTTP methods
   * @default ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
   */
  methods?: string[];

  /**
   * Allowed headers
   * @default ["Content-Type", "Authorization", "X-Requested-With"]
   */
  allowedHeaders?: string[];

  /**
   * Headers exposed to the browser
   * @default []
   */
  exposedHeaders?: string[];

  /**
   * Allow credentials (cookies, authorization headers)
   * @default false
   */
  credentials?: boolean;

  /**
   * Max age for preflight cache (in seconds)
   * @default 86400 (24 hours)
   */
  maxAge?: number;

  /**
   * Handle preflight OPTIONS requests automatically
   * @default true
   */
  preflightContinue?: boolean;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const DEFAULT_HEADERS = ["Content-Type", "Authorization", "X-Requested-With"];
const DEFAULT_MAX_AGE = 86400; // 24 hours

// ============================================================================
// CORS Middleware
// ============================================================================

/**
 * Create a CORS middleware
 *
 * @param options - CORS options
 * @returns Middleware function
 *
 * @example Basic usage (allow all origins)
 * ```ts
 * import { corsMiddleware } from "@alexi/middleware";
 *
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [corsMiddleware()],
 * });
 * ```
 *
 * @example Specific origins
 * ```ts
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [
 *     corsMiddleware({
 *       origins: ["http://localhost:5173", "https://myapp.com"],
 *       credentials: true,
 *     }),
 *   ],
 * });
 * ```
 *
 * @example Dynamic origin validation
 * ```ts
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [
 *     corsMiddleware({
 *       origins: (origin) => origin.endsWith(".myapp.com"),
 *       credentials: true,
 *     }),
 *   ],
 * });
 * ```
 */
export function corsMiddleware(options: CorsOptions = {}): Middleware {
  const {
    origins = "*",
    methods = DEFAULT_METHODS,
    allowedHeaders = DEFAULT_HEADERS,
    exposedHeaders = [],
    credentials = false,
    maxAge = DEFAULT_MAX_AGE,
    preflightContinue = false,
  } = options;

  /**
   * Check if an origin is allowed
   */
  function isOriginAllowed(origin: string | null): boolean {
    if (!origin) return false;

    if (origins === "*") return true;

    if (typeof origins === "string") {
      return origins === origin;
    }

    if (Array.isArray(origins)) {
      return origins.includes(origin);
    }

    if (typeof origins === "function") {
      return origins(origin);
    }

    return false;
  }

  /**
   * Get the Access-Control-Allow-Origin header value
   */
  function getAllowOrigin(origin: string | null): string {
    if (!origin) return "";

    if (origins === "*" && !credentials) {
      return "*";
    }

    if (isOriginAllowed(origin)) {
      return origin;
    }

    return "";
  }

  /**
   * Add CORS headers to a response
   */
  function addCorsHeaders(
    response: Response,
    origin: string | null,
  ): Response {
    const allowOrigin = getAllowOrigin(origin);

    if (!allowOrigin) {
      return response;
    }

    // Clone the response to modify headers
    const headers = new Headers(response.headers);

    headers.set("Access-Control-Allow-Origin", allowOrigin);

    if (credentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }

    if (exposedHeaders.length > 0) {
      headers.set("Access-Control-Expose-Headers", exposedHeaders.join(", "));
    }

    // Vary header for caching
    if (origins !== "*") {
      const vary = headers.get("Vary");
      if (vary) {
        if (!vary.includes("Origin")) {
          headers.set("Vary", `${vary}, Origin`);
        }
      } else {
        headers.set("Vary", "Origin");
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /**
   * Create a preflight response
   */
  function createPreflightResponse(origin: string | null): Response {
    const allowOrigin = getAllowOrigin(origin);

    if (!allowOrigin) {
      return new Response(null, { status: 403 });
    }

    const headers = new Headers();

    headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.set("Access-Control-Allow-Methods", methods.join(", "));
    headers.set("Access-Control-Allow-Headers", allowedHeaders.join(", "));
    headers.set("Access-Control-Max-Age", String(maxAge));

    if (credentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }

    // Vary header for caching
    if (origins !== "*") {
      headers.set(
        "Vary",
        "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
      );
    }

    return new Response(null, {
      status: 204,
      headers,
    });
  }

  // Return the middleware function
  return async (request, next) => {
    const origin = request.headers.get("Origin");

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      const preflightResponse = createPreflightResponse(origin);

      if (preflightContinue) {
        // Continue to next middleware/view
        const response = await next();
        return addCorsHeaders(response, origin);
      }

      return preflightResponse;
    }

    // Handle actual requests
    const response = await next();
    return addCorsHeaders(response, origin);
  };
}

/**
 * Simple CORS middleware that allows all origins
 *
 * Use this for quick setup during development.
 * For production, use corsMiddleware() with specific origins.
 *
 * @example
 * ```ts
 * import { allowAllOriginsMiddleware } from "@alexi/middleware";
 *
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [allowAllOriginsMiddleware],
 * });
 * ```
 */
export const allowAllOriginsMiddleware: Middleware = corsMiddleware({
  origins: "*",
  methods: DEFAULT_METHODS,
  allowedHeaders: DEFAULT_HEADERS,
});
