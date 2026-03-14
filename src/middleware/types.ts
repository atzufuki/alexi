/**
 * Type definitions for Alexi Middleware
 *
 * @module @alexi/middleware/types
 */

import type { URLPattern } from "@alexi/urls";

// ============================================================================
// Next Function
// ============================================================================

/**
 * Next function to call the next middleware or view in the chain.
 *
 * Optionally accepts a replacement request (e.g., to pass a modified request
 * to the next layer).
 */
export type NextFunction = (request?: Request) => Promise<Response>;

// ============================================================================
// Class-based Middleware (Django-style)
// ============================================================================

/**
 * Abstract base class for Django-style class-based middleware.
 *
 * Mirrors Django's class-based middleware contract:
 * - Constructor receives `getResponse` (the next layer) — called **once** at
 *   startup, not per request.
 * - `call(request)` is called **once per request** and must invoke
 *   `this.getResponse(request)` and return a `Response`.
 *
 * Optionally implement `processView` and/or `processException` hooks.
 *
 * @example Basic middleware
 * ```ts
 * import { BaseMiddleware } from "@alexi/middleware";
 *
 * class TimingMiddleware extends BaseMiddleware {
 *   async call(request: Request): Promise<Response> {
 *     const start = Date.now();
 *     const response = await this.getResponse(request);
 *     console.log(`${request.method} ${request.url} — ${Date.now() - start}ms`);
 *     return response;
 *   }
 * }
 *
 * // Use in settings:
 * export const MIDDLEWARE = [TimingMiddleware];
 * ```
 *
 * @example Short-circuiting middleware
 * ```ts
 * class MaintenanceModeMiddleware extends BaseMiddleware {
 *   async call(request: Request): Promise<Response> {
 *     if (Deno.env.get("MAINTENANCE") === "1") {
 *       return Response.json({ error: "Service unavailable" }, { status: 503 });
 *     }
 *     return this.getResponse(request);
 *   }
 * }
 * ```
 */
export abstract class BaseMiddleware {
  /**
   * The next layer in the middleware/view chain.
   *
   * Call `this.getResponse(request)` inside `call()` to continue processing.
   * The `request` argument is optional — pass a modified request to replace the
   * original for downstream layers.
   */
  protected getResponse: NextFunction;

  /**
   * Create a new middleware instance.
   *
   * This constructor is called **once** at application startup (not per
   * request), equivalent to Django's `__init__(get_response)`.
   *
   * @param getResponse The next layer in the middleware chain.
   */
  constructor(getResponse: NextFunction) {
    this.getResponse = getResponse;
  }

  /**
   * Handle an incoming request.
   *
   * Called **once per request**, equivalent to Django's `__call__(request)`.
   * Must call `this.getResponse(request)` and return a `Response`.
   *
   * @param request The incoming HTTP request.
   * @returns The HTTP response.
   */
  abstract call(request: Request): Promise<Response>;

  /**
   * Hook called just before the view is dispatched.
   *
   * Return a `Response` to short-circuit the view; return `null` to continue
   * with normal view dispatch.
   *
   * Equivalent to Django's `process_view()`.
   *
   * @param request The incoming HTTP request.
   * @param view The view function that will be called.
   * @param params URL path parameters extracted by the router.
   * @returns A `Response` to skip the view, or `null` to continue.
   */
  processView?(
    request: Request,
    view: (
      request: Request,
      params: Record<string, string>,
    ) => Promise<Response>,
    params: Record<string, string>,
  ): Promise<Response | null> | Response | null;

  /**
   * Hook called when a view raises an exception.
   *
   * Return a `Response` to handle the exception; return `null` for default
   * error handling.
   *
   * Equivalent to Django's `process_exception()`.
   *
   * @param request The incoming HTTP request.
   * @param exception The exception thrown by the view.
   * @returns A `Response` to handle the error, or `null` for default handling.
   */
  processException?(
    request: Request,
    exception: unknown,
  ): Promise<Response | null> | Response | null;
}

// ============================================================================
// MiddlewareClass type
// ============================================================================

/**
 * Constructor type for class-based middleware.
 *
 * A `MiddlewareClass` is a class whose constructor accepts a `NextFunction`
 * (the next layer in the chain) and produces a `BaseMiddleware` instance.
 *
 * @example
 * ```ts
 * import type { MiddlewareClass } from "@alexi/middleware";
 *
 * export const MIDDLEWARE: MiddlewareClass[] = [
 *   CorsMiddleware,
 *   LoggingMiddleware,
 *   ErrorHandlerMiddleware,
 * ];
 * ```
 */
export type MiddlewareClass = new (getResponse: NextFunction) => BaseMiddleware;

// ============================================================================
// Legacy function-based middleware (kept for backwards compatibility)
// ============================================================================

/**
 * Function-based middleware (legacy).
 *
 * Middleware receives a `Request` and a `next()` function. It can:
 * - Modify the request before passing to `next()`
 * - Short-circuit and return a response directly
 * - Modify the response after calling `next()`
 *
 * @deprecated Use class-based middleware ({@link BaseMiddleware} /
 * {@link MiddlewareClass}) instead. Function-based middleware will be removed
 * in a future release.
 *
 * @example Logging middleware (legacy)
 * ```ts
 * const loggingMiddleware: Middleware = async (request, next) => {
 *   const start = Date.now();
 *   console.log(`→ ${request.method} ${request.url}`);
 *   const response = await next();
 *   console.log(`← ${response.status} (${Date.now() - start}ms)`);
 *   return response;
 * };
 * ```
 */
export type Middleware = (
  request: Request,
  next: NextFunction,
) => Promise<Response>;

// ============================================================================
// View type (used by processView hook)
// ============================================================================

export type { URLPattern };
