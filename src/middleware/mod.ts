/**
 * Alexi Middleware - Django-style middleware framework
 *
 * Provides ready-to-use middleware for common use cases like CORS,
 * logging, and error handling.
 *
 * @module @alexi/middleware
 *
 * @example
 * ```ts
 * import {
 *   corsMiddleware,
 *   loggingMiddleware,
 *   errorHandlerMiddleware,
 * } from "@alexi/middleware";
 *
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [
 *     loggingMiddleware(),
 *     corsMiddleware({ origins: ["http://localhost:5173"] }),
 *     errorHandlerMiddleware(),
 *   ],
 * });
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
