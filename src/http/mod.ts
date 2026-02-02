/**
 * Alexi HTTP - HTTP types and utilities
 *
 * This module provides HTTP-specific types and utilities.
 * For the main application framework, use @alexi/core.
 * For middleware, use @alexi/middleware.
 * For views, use @alexi/views.
 *
 * @module @alexi/http
 *
 * @example
 * ```ts
 * // Use the new module locations:
 * import { Application } from "@alexi/core";
 * import { corsMiddleware, loggingMiddleware } from "@alexi/middleware";
 * import { templateView } from "@alexi/views";
 * ```
 */

// ============================================================================
// Re-exports from @alexi/core (for backward compatibility)
// ============================================================================

export { Application } from "@alexi/core";
export type { ApplicationOptions, Handler, ServeOptions } from "@alexi/core";

// ============================================================================
// Re-exports from @alexi/middleware (for backward compatibility)
// ============================================================================

export {
  // CORS
  allowAllOriginsMiddleware,
  corsMiddleware,
  // Error handling
  debugErrorHandler,
  errorHandlerMiddleware,
  // Logging
  loggingMiddleware,
  simpleErrorHandler,
  simpleLoggingMiddleware,
} from "@alexi/middleware";

// Error classes
export {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  HttpError,
  InternalServerError,
  MethodNotAllowedError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@alexi/middleware";

// Types
export type {
  CorsOptions,
  ErrorHandlerOptions,
  LoggingOptions,
  Middleware,
  NextFunction,
} from "@alexi/middleware";

// ============================================================================
// Re-exports from @alexi/views (for backward compatibility)
// ============================================================================

export { clearTemplateCache, invalidateTemplate, templateView } from "@alexi/views";

export type { TemplateViewOptions } from "@alexi/views";

// ============================================================================
// Re-exports from @alexi/staticfiles (for backward compatibility)
// ============================================================================

export { serveBundleMiddleware, staticFilesMiddleware, staticServe } from "@alexi/staticfiles";

export type { StaticServeOptions } from "@alexi/staticfiles";
