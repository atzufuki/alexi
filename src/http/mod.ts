/**
 * Legacy HTTP compatibility entrypoint for Alexi.
 *
 * `@alexi/http` re-exports selected APIs that historically lived under a more
 * HTTP-centric package layout. It now exists mainly to preserve older imports
 * while Alexi's functionality is organized into focused packages such as
 * `@alexi/core`, `@alexi/middleware`, `@alexi/views`, and
 * `@alexi/staticfiles`.
 *
 * New code should prefer those package-specific entrypoints directly. This
 * module is still useful when maintaining older applications or when migrating
 * incrementally from previous Alexi versions.
 *
 * Because it is a compatibility layer, its runtime behavior and limitations are
 * inherited from the packages it re-exports.
 *
 * @module @alexi/http
 *
 * @example Prefer direct package imports in new code
 * ```ts
 * import { Application } from "@alexi/core/management";
 * import { corsMiddleware, loggingMiddleware } from "@alexi/middleware";
 * import { templateView } from "@alexi/views";
 * ```
 *
 * @example Existing code can continue using the compatibility layer
 * ```ts
 * import { Application, corsMiddleware, templateView } from "@alexi/http";
 * ```
 */

// ============================================================================
// Re-exports from @alexi/core/management (for backward compatibility)
// ============================================================================

export { Application } from "@alexi/core/management";
export type {
  ApplicationOptions,
  Handler,
  ServeOptions,
} from "@alexi/core/management";

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

export {
  clearTemplateCache,
  invalidateTemplate,
  templateView,
} from "@alexi/views";

export type { TemplateViewOptions } from "@alexi/views";

// ============================================================================
// Re-exports from @alexi/staticfiles (for backward compatibility)
// ============================================================================

export {
  serveBundleMiddleware,
  staticFilesMiddleware,
  staticServe,
} from "@alexi/staticfiles";

export type { StaticServeOptions } from "@alexi/staticfiles";
