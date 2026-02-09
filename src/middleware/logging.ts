/**
 * Logging middleware for Alexi HTTP
 *
 * Logs incoming requests and outgoing responses with timing information.
 *
 * @module @alexi/http/middleware/logging
 */

import type { Middleware } from "./types.ts";

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

// ============================================================================
// Logging Middleware
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

/**
 * Create a logging middleware
 *
 * @param options - Logging options
 * @returns Middleware function
 *
 * @example Basic usage
 * ```ts
 * import { loggingMiddleware } from "@alexi/middleware";
 *
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [loggingMiddleware()],
 * });
 * ```
 *
 * @example With options
 * ```ts
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [
 *     loggingMiddleware({
 *       colors: true,
 *       logHeaders: true,
 *       skip: (req) => req.url.includes("/health"),
 *     }),
 *   ],
 * });
 * ```
 */
export function loggingMiddleware(options: LoggingOptions = {}): Middleware {
  const {
    colors: useColors = true,
    logHeaders = false,
    logger = console.log,
    skip,
  } = options;

  return async (request, next) => {
    // Check if we should skip logging
    if (skip && skip(request)) {
      return next();
    }

    const start = performance.now();
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname + url.search;

    // Log request
    if (useColors) {
      const methodColor = getMethodColor(method);
      logger(
        `${colors.dim}→${colors.reset} ${methodColor}${method}${colors.reset} ${path}`,
      );
    } else {
      logger(`→ ${method} ${path}`);
    }

    // Log headers if enabled
    if (logHeaders) {
      request.headers.forEach((value, key) => {
        logger(`  ${key}: ${value}`);
      });
    }

    // Call next middleware/view
    let response: Response;
    let error: unknown;

    try {
      response = await next();
    } catch (e) {
      error = e;
      // Re-throw after logging
      throw e;
    } finally {
      const duration = performance.now() - start;
      const durationStr = formatDuration(duration);

      if (error) {
        // Log error
        if (useColors) {
          logger(
            `${colors.dim}←${colors.reset} ${colors.red}ERROR${colors.reset} ${colors.dim}(${durationStr})${colors.reset}`,
          );
        } else {
          logger(`← ERROR (${durationStr})`);
        }
      }
    }

    // Log response
    const status = response!.status;
    const statusText = response!.statusText || getStatusText(status);

    if (useColors) {
      const statusColor = getStatusColor(status);
      const duration = performance.now() - start;
      const durationStr = formatDuration(duration);
      logger(
        `${colors.dim}←${colors.reset} ${statusColor}${status}${colors.reset} ${statusText} ${colors.dim}(${durationStr})${colors.reset}`,
      );
    } else {
      const duration = performance.now() - start;
      const durationStr = formatDuration(duration);
      logger(`← ${status} ${statusText} (${durationStr})`);
    }

    return response!;
  };
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

/**
 * Simple logging middleware with default options
 *
 * Use this for quick setup. For more control, use loggingMiddleware().
 *
 * @example
 * ```ts
 * import { simpleLoggingMiddleware } from "@alexi/middleware";
 *
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [simpleLoggingMiddleware],
 * });
 * ```
 */
export const simpleLoggingMiddleware: Middleware = loggingMiddleware();
