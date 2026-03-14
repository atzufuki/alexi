/**
 * Logging middleware for Alexi HTTP
 *
 * Logs incoming requests and outgoing responses with timing information.
 *
 * @module @alexi/http/middleware/logging
 */

import { BaseMiddleware } from "./types.ts";
import type { MiddlewareClass, NextFunction } from "./types.ts";

// ============================================================================
// Color Helpers (for terminal output)
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

/**
 * Get color for HTTP method
 */
function getMethodColor(method: string): string {
  switch (method) {
    case "GET":
      return colors.green;
    case "POST":
      return colors.cyan;
    case "PUT":
    case "PATCH":
      return colors.yellow;
    case "DELETE":
      return colors.red;
    default:
      return colors.magenta;
  }
}

/**
 * Get color for status code
 */
function getStatusColor(status: number): string {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  if (status >= 200) return colors.green;
  return colors.dim;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Get status text for common status codes
 */
function getStatusText(status: number): string {
  const texts: Record<number, string> = {
    200: "OK",
    201: "Created",
    204: "No Content",
    301: "Moved Permanently",
    302: "Found",
    304: "Not Modified",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  };
  return texts[status] || "";
}

// ============================================================================
// LoggingOptions
// ============================================================================

/**
 * Options for logging middleware
 */
export interface LoggingOptions {
  /**
   * Enable colored output
   * @default true
   */
  colors?: boolean;

  /**
   * Log request headers
   * @default false
   */
  logHeaders?: boolean;

  /**
   * Custom log function
   * @default console.log
   */
  logger?: (message: string) => void;

  /**
   * Skip logging for certain paths (e.g., health checks)
   */
  skip?: (request: Request) => boolean;
}

// ============================================================================
// LoggingMiddleware — class-based
// ============================================================================

/**
 * Django-style class-based request/response logging middleware.
 *
 * Logs every request's method and path before dispatch, and the response
 * status with elapsed time after. Use the {@link loggingMiddleware} factory
 * for a one-liner with custom options.
 *
 * @example Using the factory (recommended)
 * ```ts
 * import { loggingMiddleware } from "@alexi/middleware";
 *
 * export const MIDDLEWARE = [loggingMiddleware({ colors: false })];
 * ```
 *
 * @example Subclassing directly
 * ```ts
 * import { LoggingMiddleware } from "@alexi/middleware";
 * import type { NextFunction } from "@alexi/middleware";
 *
 * class QuietLoggingMiddleware extends LoggingMiddleware {
 *   constructor(getResponse: NextFunction) {
 *     super(getResponse, { colors: false, skip: (req) => req.url.includes("/health") });
 *   }
 * }
 *
 * export const MIDDLEWARE = [QuietLoggingMiddleware];
 * ```
 */
export class LoggingMiddleware extends BaseMiddleware {
  /** Whether to use ANSI colors in log output. */
  protected useColors: boolean;
  /** Whether to log all request headers. */
  protected logHeaders: boolean;
  /** Log output function. */
  protected logger: (message: string) => void;
  /** Optional skip predicate. */
  protected skip: ((request: Request) => boolean) | undefined;

  /**
   * Create a new LoggingMiddleware.
   *
   * @param getResponse The next layer in the middleware chain.
   * @param options Logging configuration options.
   */
  constructor(getResponse: NextFunction, options: LoggingOptions = {}) {
    super(getResponse);
    const {
      colors: useColors = true,
      logHeaders = false,
      logger = console.log,
      skip,
    } = options;
    this.useColors = useColors;
    this.logHeaders = logHeaders;
    this.logger = logger;
    this.skip = skip;
  }

  /**
   * Log the request, call the next layer, and log the response.
   *
   * @param request The incoming HTTP request.
   */
  override async call(request: Request): Promise<Response> {
    if (this.skip && this.skip(request)) {
      return this.getResponse(request);
    }

    const start = performance.now();
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname + url.search;

    // Log request
    if (this.useColors) {
      const methodColor = getMethodColor(method);
      this.logger(
        `${colors.dim}→${colors.reset} ${methodColor}${method}${colors.reset} ${path}`,
      );
    } else {
      this.logger(`→ ${method} ${path}`);
    }

    if (this.logHeaders) {
      request.headers.forEach((value, key) => {
        this.logger(`  ${key}: ${value}`);
      });
    }

    let response!: Response;
    let error: unknown;

    try {
      response = await this.getResponse(request);
    } catch (e) {
      error = e;
      throw e;
    } finally {
      const duration = performance.now() - start;
      const durationStr = formatDuration(duration);

      if (error) {
        if (this.useColors) {
          this.logger(
            `${colors.dim}←${colors.reset} ${colors.red}ERROR${colors.reset} ${colors.dim}(${durationStr})${colors.reset}`,
          );
        } else {
          this.logger(`← ERROR (${durationStr})`);
        }
      }
    }

    const status = response.status;
    const statusText = response.statusText || getStatusText(status);
    const duration = performance.now() - start;
    const durationStr = formatDuration(duration);

    if (this.useColors) {
      const statusColor = getStatusColor(status);
      this.logger(
        `${colors.dim}←${colors.reset} ${statusColor}${status}${colors.reset} ${statusText} ${colors.dim}(${durationStr})${colors.reset}`,
      );
    } else {
      this.logger(`← ${status} ${statusText} (${durationStr})`);
    }

    return response;
  }
}

// ============================================================================
// Factory function (backwards compatible + options passing)
// ============================================================================

/**
 * Create a logging middleware class configured with the given options.
 *
 * Returns a {@link MiddlewareClass} (constructor) that can be added directly
 * to the `MIDDLEWARE` setting.
 *
 * @param options - Logging options
 * @returns A middleware class constructor configured with the given options.
 *
 * @example Basic usage
 * ```ts
 * import { loggingMiddleware } from "@alexi/middleware";
 *
 * export const MIDDLEWARE = [loggingMiddleware()];
 * ```
 *
 * @example With options
 * ```ts
 * export const MIDDLEWARE = [
 *   loggingMiddleware({
 *     colors: true,
 *     logHeaders: true,
 *     skip: (req) => req.url.includes("/health"),
 *   }),
 * ];
 * ```
 */
export function loggingMiddleware(
  options: LoggingOptions = {},
): MiddlewareClass {
  return class extends LoggingMiddleware {
    constructor(getResponse: NextFunction) {
      super(getResponse, options);
    }
  };
}

// ============================================================================
// Legacy function-based exports (kept for backwards compatibility)
// ============================================================================

import type { Middleware } from "./types.ts";

/**
 * Simple logging middleware with default options.
 *
 * @deprecated Use {@link loggingMiddleware} which now returns a
 * {@link MiddlewareClass}. Function-based middleware will be removed in a
 * future release.
 */
export const simpleLoggingMiddleware: Middleware = (
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> => {
  const instance = new LoggingMiddleware(next);
  return instance.call(request);
};
