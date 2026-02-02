/**
 * Error handler middleware for Alexi
 *
 * Catches errors thrown by views and returns appropriate error responses.
 *
 * @module @alexi/middleware/error
 */

import type { Middleware } from "./types.ts";

// ============================================================================
// HTTP Errors
// ============================================================================

/**
 * Base class for HTTP errors
 *
 * Extend this class to create custom HTTP errors with specific status codes.
 *
 * @example
 * ```ts
 * throw new HttpError(400, "Invalid request data");
 * ```
 */
export class HttpError extends Error {
  /**
   * HTTP status code
   */
  readonly status: number;

  /**
   * Additional error details
   */
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

/**
 * 400 Bad Request error
 */
export class BadRequestError extends HttpError {
  constructor(message = "Bad Request", details?: Record<string, unknown>) {
    super(400, message, details);
    this.name = "BadRequestError";
  }
}

/**
 * 401 Unauthorized error
 */
export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized", details?: Record<string, unknown>) {
    super(401, message, details);
    this.name = "UnauthorizedError";
  }
}

/**
 * 403 Forbidden error
 */
export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden", details?: Record<string, unknown>) {
    super(403, message, details);
    this.name = "ForbiddenError";
  }
}

/**
 * 404 Not Found error
 */
export class NotFoundError extends HttpError {
  constructor(message = "Not Found", details?: Record<string, unknown>) {
    super(404, message, details);
    this.name = "NotFoundError";
  }
}

/**
 * 405 Method Not Allowed error
 */
export class MethodNotAllowedError extends HttpError {
  constructor(
    message = "Method Not Allowed",
    details?: Record<string, unknown>,
  ) {
    super(405, message, details);
    this.name = "MethodNotAllowedError";
  }
}

/**
 * 409 Conflict error
 */
export class ConflictError extends HttpError {
  constructor(message = "Conflict", details?: Record<string, unknown>) {
    super(409, message, details);
    this.name = "ConflictError";
  }
}

/**
 * 422 Unprocessable Entity error (validation error)
 */
export class ValidationError extends HttpError {
  constructor(
    message = "Validation Error",
    details?: Record<string, unknown>,
  ) {
    super(422, message, details);
    this.name = "ValidationError";
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends HttpError {
  constructor(
    message = "Internal Server Error",
    details?: Record<string, unknown>,
  ) {
    super(500, message, details);
    this.name = "InternalServerError";
  }
}

// ============================================================================
// Error Handler Options
// ============================================================================

/**
 * Options for error handler middleware
 */
export interface ErrorHandlerOptions {
  /**
   * Include stack traces in error responses
   * @default false
   */
  includeStack?: boolean;

  /**
   * Custom error logger
   * @default console.error
   */
  logger?: (error: unknown, request: Request) => void;

  /**
   * Custom error response formatter
   */
  formatError?: (
    error: unknown,
    request: Request,
    options: ErrorHandlerOptions,
  ) => Response;
}

// ============================================================================
// Error Handler Middleware
// ============================================================================

/**
 * Default error response formatter
 */
function defaultFormatError(
  error: unknown,
  request: Request,
  options: ErrorHandlerOptions,
): Response {
  // Handle HttpError instances
  if (error instanceof HttpError) {
    const body: Record<string, unknown> = {
      error: error.message,
    };

    if (error.details) {
      body.details = error.details;
    }

    if (options.includeStack && error.stack) {
      body.stack = error.stack;
    }

    return Response.json(body, { status: error.status });
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    const body: Record<string, unknown> = {
      error: options.includeStack ? error.message : "Internal Server Error",
    };

    if (options.includeStack && error.stack) {
      body.stack = error.stack;
    }

    return Response.json(body, { status: 500 });
  }

  // Handle unknown errors
  return Response.json(
    { error: "Internal Server Error" },
    { status: 500 },
  );
}

/**
 * Default error logger
 */
function defaultLogger(error: unknown, request: Request): void {
  const url = new URL(request.url);
  console.error(`[ERROR] ${request.method} ${url.pathname}:`, error);
}

/**
 * Create an error handler middleware
 *
 * This middleware catches errors thrown by views and other middleware,
 * and returns appropriate error responses.
 *
 * @param options - Error handler options
 * @returns Middleware function
 *
 * @example Basic usage
 * ```ts
 * import { errorHandlerMiddleware } from "@alexi/middleware";
 *
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [errorHandlerMiddleware()],
 * });
 * ```
 *
 * @example With stack traces (development)
 * ```ts
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [
 *     errorHandlerMiddleware({
 *       includeStack: true,
 *     }),
 *   ],
 *   debug: true,
 * });
 * ```
 *
 * @example Custom error formatting
 * ```ts
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [
 *     errorHandlerMiddleware({
 *       formatError: (error, request, options) => {
 *         return Response.json({
 *           success: false,
 *           message: error instanceof Error ? error.message : "Unknown error",
 *         }, { status: 500 });
 *       },
 *     }),
 *   ],
 * });
 * ```
 */
export function errorHandlerMiddleware(
  options: ErrorHandlerOptions = {},
): Middleware {
  const {
    includeStack = false,
    logger = defaultLogger,
    formatError = defaultFormatError,
  } = options;

  return async (request, next) => {
    try {
      return await next();
    } catch (error) {
      // Log the error
      logger(error, request);

      // Format and return error response
      return formatError(error, request, { includeStack, logger, formatError });
    }
  };
}

/**
 * Simple error handler middleware with default options
 *
 * Use this for quick setup. For more control, use errorHandlerMiddleware().
 *
 * @example
 * ```ts
 * import { simpleErrorHandler } from "@alexi/middleware";
 *
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [simpleErrorHandler],
 * });
 * ```
 */
export const simpleErrorHandler: Middleware = errorHandlerMiddleware();

/**
 * Debug error handler that includes stack traces
 *
 * Use this during development to get detailed error information.
 *
 * @example
 * ```ts
 * import { debugErrorHandler } from "@alexi/middleware";
 *
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [debugErrorHandler],
 *   debug: true,
 * });
 * ```
 */
export const debugErrorHandler: Middleware = errorHandlerMiddleware({
  includeStack: true,
});
