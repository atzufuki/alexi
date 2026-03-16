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
 * @example Basic usage (JWT payload only)
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
 * @example With AUTH_USER_MODEL — full ORM instance via getRequestUserInstance()
 * ```ts
 * import { AuthenticationMiddleware } from "@alexi/auth";
 * import { UserModel } from "@myapp/models";
 *
 * export const MIDDLEWARE = [
 *   AuthenticationMiddleware.configure({ userModel: UserModel }),
 * ];
 * ```
 *
 * @module
 */

import { BaseMiddleware } from "@alexi/middleware";
import type { NextFunction } from "@alexi/middleware";
import { decodeToken, verifyToken } from "./jwt.ts";
import { _requestUserInstances, _requestUsers } from "./_auth_store.ts";
import type { AuthenticatedUser } from "./decorators.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Minimal interface for a user model class that can be passed to
 * {@link AuthenticationMiddleware.configure}.
 *
 * Any `AbstractUser` subclass satisfies this interface automatically.
 *
 * @category Middleware
 */
export interface UserModelClass {
  /** ORM manager — must support `.filter({ id }).first()`. */
  objects: {
    filter(query: Record<string, unknown>): {
      first(): Promise<unknown>;
    };
  };
}

/**
 * Configuration options for {@link AuthenticationMiddleware.configure}.
 *
 * @category Middleware
 */
export interface AuthenticationMiddlewareOptions {
  /**
   * The user model class to use for database look-ups.
   *
   * When provided, the middleware fetches a full ORM instance from the
   * database for every authenticated request.  The instance is then available
   * via {@link getRequestUserInstance}.
   *
   * Pass the same class as `AUTH_USER_MODEL` in your project settings:
   *
   * ```ts
   * import { UserModel } from "@myapp/models";
   *
   * AuthenticationMiddleware.configure({ userModel: UserModel });
   * ```
   */
  userModel: UserModelClass;
}

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
 * When configured with a `userModel` via {@link AuthenticationMiddleware.configure},
 * the middleware additionally fetches the full ORM instance from the database
 * and stores it so it can be retrieved with {@link getRequestUserInstance}.
 *
 * Anonymous requests (missing or invalid token) pass through unchanged with no
 * user attached.  The middleware never rejects a request on its own; use
 * {@link loginRequired}, {@link permissionRequired}, or ViewSet
 * `permission_classes` to enforce access control.
 *
 * Place this middleware **after** logging/CORS middleware and **before** any
 * middleware or view that needs to know who the user is.
 *
 * @example Add to MIDDLEWARE in settings (JWT payload only)
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
 * @example Add to MIDDLEWARE with AUTH_USER_MODEL
 * ```ts
 * import { AuthenticationMiddleware } from "@alexi/auth";
 * import { UserModel } from "@myapp/models";
 *
 * export const MIDDLEWARE = [
 *   AuthenticationMiddleware.configure({ userModel: UserModel }),
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
 * @example Read the full ORM instance (requires configure({ userModel }))
 * ```ts
 * import { getRequestUser, getRequestUserInstance } from "@alexi/auth";
 * import type { UserModel } from "@myapp/models";
 *
 * export async function profileView(request: Request): Promise<Response> {
 *   const user = getRequestUser(request);
 *   if (!user) return Response.json({ detail: "Unauthorized" }, { status: 401 });
 *   const instance = getRequestUserInstance<UserModel>(request);
 *   return Response.json({ name: instance?.firstName.get() });
 * }
 * ```
 *
 * @category Middleware
 */
export class AuthenticationMiddleware extends BaseMiddleware {
  /**
   * Optional user model used for database look-ups.
   * Set by {@link configure} on the subclass; `null` on the base class.
   *
   * @internal
   */
  protected static _userModel: UserModelClass | null = null;

  /**
   * Create a new AuthenticationMiddleware instance.
   *
   * @param getResponse - The next layer in the middleware chain.
   */
  constructor(getResponse: NextFunction) {
    super(getResponse);
  }

  /**
   * Return a configured subclass of `AuthenticationMiddleware` that fetches a
   * full ORM user instance on every authenticated request.
   *
   * Use this factory when you want the middleware to load the complete user
   * object from the database, not just the JWT payload.  The fetched instance
   * is stored alongside the JWT payload and can be retrieved with
   * {@link getRequestUserInstance}.
   *
   * @param options - Configuration options, including the `userModel` class.
   * @returns A new middleware class (not an instance) ready to be included in
   *   the `MIDDLEWARE` setting.
   *
   * @example
   * ```ts
   * import { AuthenticationMiddleware } from "@alexi/auth";
   * import { UserModel } from "@myapp/models";
   *
   * export const MIDDLEWARE = [
   *   AuthenticationMiddleware.configure({ userModel: UserModel }),
   * ];
   * ```
   *
   * @category Middleware
   */
  static configure(
    options: AuthenticationMiddlewareOptions,
  ): typeof AuthenticationMiddleware {
    class ConfiguredAuthenticationMiddleware extends AuthenticationMiddleware {
      protected static override _userModel: UserModelClass | null =
        options.userModel;
    }
    return ConfiguredAuthenticationMiddleware;
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
      request.user = user;

      // If a userModel is configured, fetch the full ORM instance.
      const userModel = (this.constructor as typeof AuthenticationMiddleware)
        ._userModel;
      if (userModel) {
        const instance = await userModel.objects
          .filter({ id: user.id })
          .first();
        if (instance != null) {
          _requestUserInstances.set(request, instance);
        }
      }
    } else {
      request.user = null;
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
  // First try cryptographic verification (server). Fall back to
  // decode-only (Service Worker / browser) when verifyToken returns null
  // because the secret key is unavailable or the environment is a browser.
  const payload = (await verifyToken(token)) ?? decodeToken(token);
  if (!payload) return null;

  const userId = payload.userId ?? (payload as Record<string, unknown>).sub;
  if (userId == null) return null;

  // Spread all payload fields so that extra claims (e.g. firstName, lastName)
  // are accessible on AuthenticatedUser without a cast.
  const { userId: _uid, sub: _sub, ...rest } = payload as Record<
    string,
    unknown
  >;

  return {
    ...rest,
    id: userId as number | string,
    email: payload.email,
    isAdmin: payload.isAdmin ?? false,
  };
}
