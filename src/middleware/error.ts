/**
 * Error handler middleware for Alexi
 *
 * Catches errors thrown by views and returns appropriate error responses.
 *
 * @module @alexi/middleware/error
 */

import { BaseMiddleware } from "./types.ts";
import type { MiddlewareClass, NextFunction } from "./types.ts";

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

  /**
   * Creates a new HTTP error.
   *
   * @param status - HTTP status code
   * @param message - Error message
   * @param details - Optional additional error details
   */
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
  /**
   * Creates a 400 Bad Request error.
   *
   * @param message - Error message. Defaults to `"Bad Request"`.
   * @param details - Optional additional error details.
   */
  constructor(message = "Bad Request", details?: Record<string, unknown>) {
    super(400, message, details);
    this.name = "BadRequestError";
  }
}

/**
 * 401 Unauthorized error
 */
export class UnauthorizedError extends HttpError {
  /**
   * Creates a 401 Unauthorized error.
   *
   * @param message - Error message. Defaults to `"Unauthorized"`.
   * @param details - Optional additional error details.
   */
  constructor(message = "Unauthorized", details?: Record<string, unknown>) {
    super(401, message, details);
    this.name = "UnauthorizedError";
  }
}

/**
 * 403 Forbidden error
 */
export class ForbiddenError extends HttpError {
  /**
   * Creates a 403 Forbidden error.
   *
   * @param message - Error message. Defaults to `"Forbidden"`.
   * @param details - Optional additional error details.
   */
  constructor(message = "Forbidden", details?: Record<string, unknown>) {
    super(403, message, details);
    this.name = "ForbiddenError";
  }
}

/**
 * 404 Not Found error
 */
export class NotFoundError extends HttpError {
  /**
   * Creates a 404 Not Found error.
   *
   * @param message - Error message. Defaults to `"Not Found"`.
   * @param details - Optional additional error details.
   */
  constructor(message = "Not Found", details?: Record<string, unknown>) {
    super(404, message, details);
    this.name = "NotFoundError";
  }
}

/**
 * 405 Method Not Allowed error
 */
export class MethodNotAllowedError extends HttpError {
  /**
   * Creates a 405 Method Not Allowed error.
   *
   * @param message - Error message. Defaults to `"Method Not Allowed"`.
   * @param details - Optional additional error details.
   */
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
  /**
   * Creates a 409 Conflict error.
   *
   * @param message - Error message. Defaults to `"Conflict"`.
   * @param details - Optional additional error details.
   */
  constructor(message = "Conflict", details?: Record<string, unknown>) {
    super(409, message, details);
    this.name = "ConflictError";
  }
}

/**
 * 422 Unprocessable Entity error (validation error)
 */
export class ValidationError extends HttpError {
  /**
   * Creates a 422 Validation Error.
   *
   * @param message - Error message. Defaults to `"Validation Error"`.
   * @param details - Optional additional error details.
   */
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
  /**
   * Creates a 500 Internal Server Error.
   *
   * @param message - Error message. Defaults to `"Internal Server Error"`.
   * @param details - Optional additional error details.
   */
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
// Helpers
// ============================================================================

/**
 * Default error response formatter
 */
function defaultFormatError(
  error: unknown,
  _request: Request,
  options: ErrorHandlerOptions,
): Response {
  if (error instanceof HttpError) {
    const body: Record<string, unknown> = { error: error.message };
    if (error.details) body.details = error.details;
    if (options.includeStack && error.stack) body.stack = error.stack;
    return Response.json(body, { status: error.status });
  }

  if (error instanceof Error) {
    const body: Record<string, unknown> = {
      error: options.includeStack ? error.message : "Internal Server Error",
    };
    if (options.includeStack && error.stack) body.stack = error.stack;
    return Response.json(body, { status: 500 });
  }

  return Response.json({ error: "Internal Server Error" }, { status: 500 });
}

/**
 * Default error logger
 */
function defaultLogger(error: unknown, request: Request): void {
  const url = new URL(request.url);
  console.error(`[ERROR] ${request.method} ${url.pathname}:`, error);
}

// ============================================================================
// ErrorHandlerMiddleware — class-based
// ============================================================================

/**
 * Django-style class-based error handler middleware.
 *
 * Catches exceptions thrown by downstream middleware and views, and converts
 * them to appropriate HTTP error responses. Uses the {@link HttpError}
 * hierarchy for structured error handling.
 *
 * Use the {@link errorHandlerMiddleware} factory for a one-liner with custom
 * options.
 *
 * @example Using the factory (recommended)
 * ```ts
 * import { errorHandlerMiddleware } from "@alexi/middleware";
 *
 * export const MIDDLEWARE = [errorHandlerMiddleware()];
 * ```
 *
 * @example With stack traces (development)
 * ```ts
 * export const MIDDLEWARE = [errorHandlerMiddleware({ includeStack: true })];
 * ```
 *
 * @example Subclassing directly
 * ```ts
 * import { ErrorHandlerMiddleware } from "@alexi/middleware";
 * import type { NextFunction } from "@alexi/middleware";
 *
 * class MyErrorHandler extends ErrorHandlerMiddleware {
 *   constructor(getResponse: NextFunction) {
 *     super(getResponse, {
 *       formatError: (error) =>
 *         Response.json({ success: false, message: String(error) }, { status: 500 }),
 *     });
 *   }
 * }
 *
 * export const MIDDLEWARE = [MyErrorHandler];
 * ```
 */
export class ErrorHandlerMiddleware extends BaseMiddleware {
  /** Whether to include stack traces in error responses. */
  protected includeStack: boolean;
  /** Error logger function. */
  protected logger: (error: unknown, request: Request) => void;
  /** Error response formatter. */
  protected formatError: (
    error: unknown,
    request: Request,
    options: ErrorHandlerOptions,
  ) => Response;

  /**
   * Create a new ErrorHandlerMiddleware.
   *
   * @param getResponse The next layer in the middleware chain.
   * @param options Error handler configuration options.
   */
  constructor(getResponse: NextFunction, options: ErrorHandlerOptions = {}) {
    super(getResponse);
    const {
      includeStack = false,
      logger = defaultLogger,
      formatError = defaultFormatError,
    } = options;
    this.includeStack = includeStack;
    this.logger = logger;
    this.formatError = formatError;
  }

  /**
   * Call the next layer; catch and format any errors as HTTP responses.
   *
   * @param request The incoming HTTP request.
   */
  override async call(request: Request): Promise<Response> {
    try {
      return await this.getResponse(request);
    } catch (error) {
      this.logger(error, request);
      return this.formatError(error, request, {
        includeStack: this.includeStack,
        logger: this.logger,
        formatError: this.formatError,
      });
    }
  }
}

// ============================================================================
// Factory function (backwards compatible + options passing)
// ============================================================================

/**
 * Create an error handler middleware class configured with the given options.
 *
 * Returns a {@link MiddlewareClass} (constructor) that can be added directly
 * to the `MIDDLEWARE` setting.
 *
 * @param options - Error handler options
 * @returns A middleware class constructor configured with the given options.
 *
 * @example Basic usage
 * ```ts
 * import { errorHandlerMiddleware } from "@alexi/middleware";
 *
 * export const MIDDLEWARE = [errorHandlerMiddleware()];
 * ```
 *
 * @example With stack traces (development)
 * ```ts
 * export const MIDDLEWARE = [
 *   errorHandlerMiddleware({ includeStack: true }),
 * ];
 * ```
 *
 * @example Custom error formatting
 * ```ts
 * export const MIDDLEWARE = [
 *   errorHandlerMiddleware({
 *     formatError: (error, request, options) => {
 *       return Response.json({
 *         success: false,
 *         message: error instanceof Error ? error.message : "Unknown error",
 *       }, { status: 500 });
 *     },
 *   }),
 * ];
 * ```
 */
export function errorHandlerMiddleware(
  options: ErrorHandlerOptions = {},
): MiddlewareClass {
  return class extends ErrorHandlerMiddleware {
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
 * Simple error handler middleware with default options.
 *
 * @deprecated Use {@link errorHandlerMiddleware} which now returns a
 * {@link MiddlewareClass}. Function-based middleware will be removed in a
 * future release.
 */
export const simpleErrorHandler: Middleware = (
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> => {
  const instance = new ErrorHandlerMiddleware(next);
  return instance.call(request);
};

/**
 * Debug error handler that includes stack traces.
 *
 * @deprecated Use {@link errorHandlerMiddleware} with `{ includeStack: true }`.
 * Function-based middleware will be removed in a future release.
 */
export const debugErrorHandler: Middleware = (
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> => {
  const instance = new ErrorHandlerMiddleware(next, { includeStack: true });
  return instance.call(request);
};
