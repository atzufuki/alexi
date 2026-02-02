/**
 * Type definitions for Alexi Middleware
 *
 * @module @alexi/middleware/types
 */

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Next function to call the next middleware or view in the chain
 */
export type NextFunction = () => Promise<Response>;

/**
 * Middleware function that can intercept and modify requests/responses
 *
 * Middleware receives a Request and a next() function. It can:
 * - Modify the request before passing to next()
 * - Short-circuit and return a response directly
 * - Modify the response after calling next()
 *
 * @example Logging middleware
 * ```ts
 * const loggingMiddleware: Middleware = async (request, next) => {
 *   const start = Date.now();
 *   console.log(`→ ${request.method} ${request.url}`);
 *
 *   const response = await next();
 *
 *   const duration = Date.now() - start;
 *   console.log(`← ${response.status} (${duration}ms)`);
 *
 *   return response;
 * };
 * ```
 *
 * @example Auth middleware
 * ```ts
 * const authMiddleware: Middleware = async (request, next) => {
 *   const token = request.headers.get("Authorization");
 *
 *   if (!token) {
 *     return Response.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 *
 *   // Token is valid, continue to next middleware/view
 *   return next();
 * };
 * ```
 */
export type Middleware = (
  request: Request,
  next: NextFunction,
) => Promise<Response>;
