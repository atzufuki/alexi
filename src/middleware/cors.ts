/**
 * CORS (Cross-Origin Resource Sharing) middleware for Alexi HTTP
 *
 * Handles CORS preflight requests and adds appropriate headers to responses.
 *
 * @module @alexi/middleware/cors
 */

import { BaseMiddleware } from "./types.ts";
import type { MiddlewareClass, NextFunction } from "./types.ts";

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
// CorsMiddleware — class-based
// ============================================================================

/**
 * Django-style class-based CORS middleware.
 *
 * Handles CORS preflight requests and adds `Access-Control-*` headers to
 * all responses. Instantiate with options by subclassing or use the
 * {@link corsMiddleware} factory for a one-liner.
 *
 * @example Using the factory (recommended)
 * ```ts
 * import { corsMiddleware } from "@alexi/middleware";
 *
 * export const MIDDLEWARE = [
 *   corsMiddleware({ origins: ["http://localhost:5173"], credentials: true }),
 * ];
 * ```
 *
 * @example Subclassing directly
 * ```ts
 * import { CorsMiddleware } from "@alexi/middleware";
 *
 * class MyCors extends CorsMiddleware {
 *   constructor(getResponse: NextFunction) {
 *     super(getResponse, { origins: ["https://myapp.com"], credentials: true });
 *   }
 * }
 *
 * export const MIDDLEWARE = [MyCors];
 * ```
 */
export class CorsMiddleware extends BaseMiddleware {
  /** Resolved CORS origins setting. */
  protected origins: string | string[] | ((origin: string) => boolean);
  /** Allowed HTTP methods. */
  protected methods: string[];
  /** Allowed request headers. */
  protected allowedHeaders: string[];
  /** Response headers exposed to the browser. */
  protected exposedHeaders: string[];
  /** Whether credentials are allowed. */
  protected credentials: boolean;
  /** Preflight cache max-age in seconds. */
  protected maxAge: number;
  /** Whether to pass preflight requests through to the next layer. */
  protected preflightContinue: boolean;

  /**
   * Create a new CorsMiddleware.
   *
   * @param getResponse The next layer in the middleware chain.
   * @param options CORS configuration options.
   */
  constructor(getResponse: NextFunction, options: CorsOptions = {}) {
    super(getResponse);
    const {
      origins = "*",
      methods = DEFAULT_METHODS,
      allowedHeaders = DEFAULT_HEADERS,
      exposedHeaders = [],
      credentials = false,
      maxAge = DEFAULT_MAX_AGE,
      preflightContinue = false,
    } = options;
    this.origins = origins;
    this.methods = methods;
    this.allowedHeaders = allowedHeaders;
    this.exposedHeaders = exposedHeaders;
    this.credentials = credentials;
    this.maxAge = maxAge;
    this.preflightContinue = preflightContinue;
  }

  /**
   * Handle CORS for the request.
   *
   * For `OPTIONS` preflight requests, returns a `204 No Content` response with
   * the appropriate headers (unless `preflightContinue` is `true`).
   * For all other requests, adds CORS headers to the downstream response.
   *
   * @param request The incoming HTTP request.
   */
  override async call(request: Request): Promise<Response> {
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      const preflightResponse = this._createPreflightResponse(origin);

      if (this.preflightContinue) {
        const response = await this.getResponse(request);
        return this._addCorsHeaders(response, origin);
      }

      return preflightResponse;
    }

    const response = await this.getResponse(request);
    return this._addCorsHeaders(response, origin);
  }

  /** Check if the given origin is allowed. */
  protected _isOriginAllowed(origin: string | null): boolean {
    if (!origin) return false;
    if (this.origins === "*") return true;
    if (typeof this.origins === "string") return this.origins === origin;
    if (Array.isArray(this.origins)) return this.origins.includes(origin);
    if (typeof this.origins === "function") return this.origins(origin);
    return false;
  }

  /** Get the `Access-Control-Allow-Origin` header value. */
  protected _getAllowOrigin(origin: string | null): string {
    if (!origin) return "";
    if (this.origins === "*" && !this.credentials) return "*";
    if (this._isOriginAllowed(origin)) return origin;
    return "";
  }

  /** Clone a response and add CORS headers. */
  protected _addCorsHeaders(
    response: Response,
    origin: string | null,
  ): Response {
    const allowOrigin = this._getAllowOrigin(origin);
    if (!allowOrigin) return response;

    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", allowOrigin);

    if (this.credentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }

    if (this.exposedHeaders.length > 0) {
      headers.set(
        "Access-Control-Expose-Headers",
        this.exposedHeaders.join(", "),
      );
    }

    if (this.origins !== "*") {
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

  /** Create a preflight `204 No Content` response with CORS headers. */
  protected _createPreflightResponse(origin: string | null): Response {
    const allowOrigin = this._getAllowOrigin(origin);
    if (!allowOrigin) return new Response(null, { status: 403 });

    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.set("Access-Control-Allow-Methods", this.methods.join(", "));
    headers.set("Access-Control-Allow-Headers", this.allowedHeaders.join(", "));
    headers.set("Access-Control-Max-Age", String(this.maxAge));

    if (this.credentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }

    if (this.origins !== "*") {
      headers.set(
        "Vary",
        "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
      );
    }

    return new Response(null, { status: 204, headers });
  }
}

// ============================================================================
// Factory function (backwards compatible + options passing)
// ============================================================================

/**
 * Create a CORS middleware class configured with the given options.
 *
 * Returns a {@link MiddlewareClass} (constructor) that can be added directly
 * to the `MIDDLEWARE` setting.
 *
 * @param options - CORS options
 * @returns A middleware class constructor configured with the given options.
 *
 * @example Basic usage (allow all origins)
 * ```ts
 * import { corsMiddleware } from "@alexi/middleware";
 *
 * export const MIDDLEWARE = [corsMiddleware()];
 * ```
 *
 * @example Specific origins
 * ```ts
 * export const MIDDLEWARE = [
 *   corsMiddleware({
 *     origins: ["http://localhost:5173", "https://myapp.com"],
 *     credentials: true,
 *   }),
 * ];
 * ```
 *
 * @example Dynamic origin validation
 * ```ts
 * export const MIDDLEWARE = [
 *   corsMiddleware({
 *     origins: (origin) => origin.endsWith(".myapp.com"),
 *     credentials: true,
 *   }),
 * ];
 * ```
 */
export function corsMiddleware(options: CorsOptions = {}): MiddlewareClass {
  return class extends CorsMiddleware {
    constructor(getResponse: NextFunction) {
      super(getResponse, options);
    }
  };
}

/**
 * Middleware class that allows all origins.
 *
 * Use this for quick setup during development.
 * For production, use {@link corsMiddleware} with specific origins.
 *
 * @example
 * ```ts
 * import { AllowAllOriginsCorsMiddleware } from "@alexi/middleware";
 *
 * export const MIDDLEWARE = [AllowAllOriginsCorsMiddleware];
 * ```
 */
export class AllowAllOriginsCorsMiddleware extends CorsMiddleware {
  /**
   * Creates an allow-all-origins CORS middleware instance.
   *
   * @param getResponse - The next middleware or view handler in the chain.
   */
  constructor(getResponse: NextFunction) {
    super(getResponse, {
      origins: "*",
      methods: DEFAULT_METHODS,
      allowedHeaders: DEFAULT_HEADERS,
    });
  }
}

// ============================================================================
// Legacy function-based exports (kept for backwards compatibility)
// ============================================================================

import type { Middleware } from "./types.ts";

/**
 * CORS middleware that allows all origins.
 *
 * @deprecated Use {@link AllowAllOriginsCorsMiddleware} class instead.
 * Function-based middleware will be removed in a future release.
 */
export const allowAllOriginsMiddleware: Middleware = (
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> => {
  const instance = new AllowAllOriginsCorsMiddleware(next);
  return instance.call(request);
};
