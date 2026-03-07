/**
 * Alexi's middleware primitives and built-in HTTP middleware.
 *
 * `@alexi/middleware` provides the `Middleware` and `NextFunction` contracts
 * used by `Application`, plus production-ready middleware for CORS, request
 * logging, and HTTP error handling. It covers the most common cross-cutting
 * concerns in Alexi apps without forcing a framework-specific request object.
 *
 * Start with `loggingMiddleware()`, `corsMiddleware()`, and
 * `errorHandlerMiddleware()` when assembling an application. The exported
 * `HttpError` subclasses help plain views, viewsets, and custom middleware
 * communicate consistent HTTP failures.
 *
 * The package is runtime-neutral and works anywhere the standard Web Request
 * and Response APIs are available.
 *
 * @module @alexi/middleware
 *
 * @example Apply common middleware to an application
 * ```ts
 * import {
 *   corsMiddleware,
 *   errorHandlerMiddleware,
 *   loggingMiddleware,
 * } from "@alexi/middleware";
 *
 * const middleware = [
 *   loggingMiddleware(),
 *   corsMiddleware({ origins: ["http://localhost:5173"] }),
 *   errorHandlerMiddleware(),
 * ];
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type { Middleware, NextFunction } from "./types.ts";

// ============================================================================
// CORS Middleware
// ============================================================================

export { allowAllOriginsMiddleware, corsMiddleware } from "./cors.ts";

export type { CorsOptions } from "./cors.ts";

// ============================================================================
// Logging Middleware
// ============================================================================

export { loggingMiddleware, simpleLoggingMiddleware } from "./logging.ts";

export type { LoggingOptions } from "./logging.ts";

// ============================================================================
// Error Handler Middleware
// ============================================================================

export {
  // Error classes
  BadRequestError,
  ConflictError,
  // Middleware
  debugErrorHandler,
  errorHandlerMiddleware,
  ForbiddenError,
  HttpError,
  InternalServerError,
  MethodNotAllowedError,
  NotFoundError,
  simpleErrorHandler,
  UnauthorizedError,
  ValidationError,
} from "./error.ts";

export type { ErrorHandlerOptions } from "./error.ts";
