/**
 * Alexi's middleware primitives and built-in HTTP middleware.
 *
 * `@alexi/middleware` provides the `BaseMiddleware` class and `MiddlewareClass`
 * type for Django-style class-based middleware, plus production-ready
 * middleware for CORS, request logging, and HTTP error handling.
 *
 * The preferred way to write middleware is to extend {@link BaseMiddleware}
 * and implement the `call(request)` method. Factory functions such as
 * {@link corsMiddleware}, {@link loggingMiddleware}, and
 * {@link errorHandlerMiddleware} return configured `MiddlewareClass`
 * constructors ready to drop into the `MIDDLEWARE` setting.
 *
 * The `Middleware` function type and related convenience constants
 * (`simpleLoggingMiddleware`, `simpleErrorHandler`, etc.) remain exported for
 * backwards compatibility but are deprecated. Prefer class-based middleware.
 *
 * The package is runtime-neutral and works anywhere the standard Web `Request`
 * and `Response` APIs are available.
 *
 * @module @alexi/middleware
 *
 * @example Class-based middleware (recommended)
 * ```ts
 * import {
 *   corsMiddleware,
 *   errorHandlerMiddleware,
 *   loggingMiddleware,
 * } from "@alexi/middleware";
 *
 * export const MIDDLEWARE = [
 *   loggingMiddleware(),
 *   corsMiddleware({ origins: ["http://localhost:5173"] }),
 *   errorHandlerMiddleware(),
 * ];
 * ```
 *
 * @example Custom class-based middleware
 * ```ts
 * import { BaseMiddleware } from "@alexi/middleware";
 *
 * class TimingMiddleware extends BaseMiddleware {
 *   async call(request: Request): Promise<Response> {
 *     const start = Date.now();
 *     const response = await this.getResponse(request);
 *     console.log(`${Date.now() - start}ms`);
 *     return response;
 *   }
 * }
 *
 * export const MIDDLEWARE = [TimingMiddleware];
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export { BaseMiddleware } from "./types.ts";
export type { Middleware, MiddlewareClass, NextFunction } from "./types.ts";

// ============================================================================
// CORS Middleware
// ============================================================================

export {
  AllowAllOriginsCorsMiddleware,
  allowAllOriginsMiddleware,
  CorsMiddleware,
  corsMiddleware,
} from "./cors.ts";

export type { CorsOptions } from "./cors.ts";

// ============================================================================
// Logging Middleware
// ============================================================================

export {
  LoggingMiddleware,
  loggingMiddleware,
  simpleLoggingMiddleware,
} from "./logging.ts";

export type { LoggingOptions } from "./logging.ts";

// ============================================================================
// Error Handler Middleware
// ============================================================================

export {
  // Error classes
  BadRequestError,
  ConflictError,
  // Middleware classes
  debugErrorHandler,
  ErrorHandlerMiddleware,
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
