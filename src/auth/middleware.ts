/**
 * Authentication middleware for Alexi.
 *
 * Provides {@link AuthenticationMiddleware}, a Django-style class-based
 * middleware that runs on every request and resolves the authenticated user
 * from a JWT bearer token.  The resolved user is attached to the request via
 * the shared auth store and can be retrieved anywhere in the request lifecycle
 * with {@link getRequestUser}.
 *
 * This is the Alexi equivalent of Django's
 * `django.contrib.auth.middleware.AuthenticationMiddleware`.  Add it to the
 * `MIDDLEWARE` setting to make authentication available in plain views, other
 * middleware, and service-worker handlers — not just in ViewSets.
 *
 * @example
 * ```ts
 * import { AuthenticationMiddleware } from "@alexi/auth";
 * import { LoggingMiddleware, CorsMiddleware, ErrorHandlerMiddleware } from "@alexi/middleware";
 *
 * export const MIDDLEWARE = [
 *   LoggingMiddleware,
 *   CorsMiddleware,
 *   AuthenticationMiddleware,   // populates request.user for all downstream handlers
 *   ErrorHandlerMiddleware,
 * ];
 * ```
 *
 * @module
 */

import { BaseMiddleware } from "@alexi/middleware";
import type { NextFunction } from "@alexi/middleware";
import { verifyToken } from "./jwt.ts";
import { _requestUsers } from "./_auth_store.ts";
import type { AuthenticatedUser } from "./decorators.ts";

// =============================================================================
// AuthenticationMiddleware
// =============================================================================

/**
 * Django-style middleware that resolves the authenticated user on every request.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the JWT using
 * {@link verifyToken}, and attaches the resolved {@link AuthenticatedUser} to
 * the request.  The user is then available via {@link getRequestUser} anywhere
 * downstream — in views, other middleware, and ViewSet permission checks.
 *
 * Anonymous requests (missing or invalid token) pass through unchanged with no
 * user attached.  The middleware never rejects a request on its own; use
 * {@link loginRequired}, {@link permissionRequired}, or ViewSet
 * `permission_classes` to enforce access control.
 *
 * Place this middleware **after** logging/CORS middleware and **before** any
 * middleware or view that needs to know who the user is.
 *
 * @example Add to MIDDLEWARE in settings
 * ```ts
 * import { AuthenticationMiddleware } from "@alexi/auth";
 * import { LoggingMiddleware, CorsMiddleware, ErrorHandlerMiddleware } from "@alexi/middleware";
 *
 * export const MIDDLEWARE = [
 *   LoggingMiddleware,
 *   CorsMiddleware,
 *   AuthenticationMiddleware,
 *   ErrorHandlerMiddleware,
 * ];
 * ```
 *
 * @example Read the authenticated user in a plain view
 * ```ts
 * import { getRequestUser } from "@alexi/auth";
 *
 * export async function profileView(request: Request): Promise<Response> {
 *   const user = getRequestUser(request);
 *   if (!user) return Response.json({ detail: "Unauthorized" }, { status: 401 });
 *   return Response.json({ id: user.id, email: user.email });
 * }
 * ```
 *
 * @category Middleware
 */
export class AuthenticationMiddleware extends BaseMiddleware {
  /**
   * Create a new AuthenticationMiddleware instance.
   *
   * @param getResponse - The next layer in the middleware chain.
   */
  constructor(getResponse: NextFunction) {
    super(getResponse);
  }

  /**
   * Resolve the authenticated user and attach it to the request, then pass
   * the request to the next middleware or view.
   *
   * @param request - The incoming HTTP request.
   * @returns The HTTP response from the next layer.
   */
  override async call(request: Request): Promise<Response> {
    const user = await _resolveUser(request);
    if (user) {
      _requestUsers.set(request, user);
    }
    return this.getResponse(request);
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract and verify the JWT bearer token from the `Authorization` header.
 *
 * @param request - Incoming HTTP request.
 * @returns The decoded {@link AuthenticatedUser}, or `null` if the token is
 *   absent or invalid.
 *
 * @internal
 */
async function _resolveUser(
  request: Request,
): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return null;

  const token = match[1];
  const payload = await verifyToken(token);
  if (!payload) return null;

  const userId = payload.userId ?? (payload as Record<string, unknown>).sub;
  if (userId == null) return null;

  return {
    id: userId as number | string,
    email: payload.email,
    isAdmin: payload.isAdmin ?? false,
  };
}
