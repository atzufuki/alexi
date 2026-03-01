/**
 * Type definitions for Alexi HTTP
 *
 * This module contains HTTP-specific types.
 * For middleware types, use @alexi/middleware.
 * For application types, use @alexi/core/management.
 *
 * @module @alexi/http/types
 */

import type { URLPattern } from "@alexi/urls";

// ============================================================================
// Re-exports from other modules (for backward compatibility)
// ============================================================================

// Re-export middleware types from @alexi/middleware
export type { Middleware, NextFunction } from "@alexi/middleware";

// Re-export application types from @alexi/core/management
export type {
  ApplicationOptions,
  Handler,
  ServeOptions,
} from "@alexi/core/management";

// ============================================================================
// HTTP-specific Types
// ============================================================================

/**
 * HTTP methods
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

/**
 * View function signature
 */
export type ViewFunction = (
  request: Request,
  params: Record<string, string>,
) => Promise<Response> | Response;

/**
 * HTTP status codes
 */
export const HttpStatus = {
  // 2xx Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // 3xx Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,

  // 4xx Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];
