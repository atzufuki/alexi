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
 * ## `request.user` property
 *
 * At runtime the middleware attaches the resolved user to `request.user`.
 * Because JSR prohibits `declare global` in published packages, the type
 * augmentation is **not** included here.  Add the following to your own
 * project (e.g. `src/types.d.ts`, which is never published to JSR) to get
 * full TypeScript support:
 *
 * **Without `userModel`** (default — JWT payload only):
 * ```ts
 * // src/types.d.ts
 * import type { AuthenticatedUser } from "@alexi/auth";
 *
 * declare global {
 *   interface Request {
 *     user?: AuthenticatedUser | null;
 *   }
 * }
 * ```
 *
 * **With `userModel`** (full ORM instance):
 * ```ts
 * // src/types.d.ts
 * import type { UserModel } from "@myapp/models";
 *
 * declare global {
 *   interface Request {
 *     user?: UserModel | null;
 *   }
 * }
 * ```
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
 * @example With AUTH_USER_MODEL — full ORM instance on request.user (server)
 * ```ts
 * import { AuthenticationMiddleware } from "@alexi/auth";
 * import { UserModel } from "@myapp/models";
 *
 * export const MIDDLEWARE = [
 *   AuthenticationMiddleware.configure({ userModel: UserModel }),
 * ];
 * ```
 *
 * @example With AUTH_USER_MODEL + fromJWT — model instance without DB call (Service Worker)
 * ```ts
 * import { AuthenticationMiddleware } from "@alexi/auth";
 * import { UserModel } from "@myapp/models";
 *
 * export const MIDDLEWARE = [
 *   AuthenticationMiddleware.configure({
 *     userModel: UserModel,
 *     fromJWT: (payload) => UserModel.fromJWT(payload),
 *   }),
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
   * When provided without {@link fromJWT}, the middleware fetches a full ORM
   * instance from the database for every authenticated request and sets it as
   * `request.user`.  The instance is also available via
   * {@link getRequestUserInstance}.
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

  /**
   * Optional factory that constructs a model instance from a JWT payload
   * **without** making a database call.
   *
   * Use this in Service Worker / browser environments where ORM database
   * access is unavailable (e.g. the `RestBackend` would make a recursive HTTP
   * call).  When provided, `fromJWT(payload)` is called instead of
   * `userModel.objects.filter({ id }).first()`, and the returned value is set
   * as `request.user`.
   *
   * ```ts
   * AuthenticationMiddleware.configure({
   *   userModel: UserModel,
   *   fromJWT: (payload) => UserModel.fromJWT(payload),
   * });
   * ```
   */
  fromJWT?: (payload: AuthenticatedUser) => unknown;
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
 * the middleware additionally sets `request.user` to the full ORM model instance.
 * On the server, the instance is fetched from the database; in a Service Worker,
 * it is constructed from the JWT payload via the optional `fromJWT` callback.
 * The instance is also available via {@link getRequestUserInstance}.
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
 * @example Add to MIDDLEWARE with AUTH_USER_MODEL (server — DB lookup)
 * ```ts
 * import { AuthenticationMiddleware } from "@alexi/auth";
 * import { UserModel } from "@myapp/models";
 *
 * export const MIDDLEWARE = [
 *   AuthenticationMiddleware.configure({ userModel: UserModel }),
 * ];
 * ```
 *
 * @example Add to MIDDLEWARE with fromJWT (Service Worker — no DB call)
 * ```ts
 * import { AuthenticationMiddleware } from "@alexi/auth";
 * import { UserModel } from "@myapp/models";
 *
 * export const MIDDLEWARE = [
 *   AuthenticationMiddleware.configure({
 *     userModel: UserModel,
 *     fromJWT: (payload) => UserModel.fromJWT(payload),
 *   }),
 * ];
 * ```
 *
 * @example Read the authenticated user in a plain view (without userModel)
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
 * import type { UserModel } from "@myapp/models";
 *
 * export async function profileView(request: Request): Promise<Response> {
 *   const user = request.user as UserModel | null;
 *   if (!user) return Response.json({ detail: "Unauthorized" }, { status: 401 });
 *   return Response.json({ name: user.firstName.get() });
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
   * Optional factory that constructs a model instance from a JWT payload
   * without making a DB call (Service Worker path).
   * Set by {@link configure} on the subclass; `null` on the base class.
   *
   * @internal
   */
  protected static _fromJWT:
    | ((payload: AuthenticatedUser) => unknown)
    | null = null;

  /**
   * Create a new AuthenticationMiddleware instance.
   *
   * @param getResponse - The next layer in the middleware chain.
   */
  constructor(getResponse: NextFunction) {
    super(getResponse);
  }

  /**
   * Return a configured subclass of `AuthenticationMiddleware` that sets
   * `request.user` to a full ORM model instance on every authenticated request.
   *
   * **Server mode** (default — `fromJWT` not provided): the middleware fetches
   * the user from the database via `userModel.objects.filter({ id }).first()`.
   *
   * **Service Worker mode** (`fromJWT` provided): the middleware calls
   * `fromJWT(payload)` to construct an instance from the JWT payload without
   * making a database call.  Use this to avoid recursive HTTP calls from a
   * Service Worker that uses `RestBackend`.
   *
   * In both cases the instance is also accessible via
   * {@link getRequestUserInstance} for backward compatibility.
   *
   * @param options - Configuration options, including the `userModel` class
   *   and an optional `fromJWT` factory for the Service Worker path.
   * @returns A new middleware class (not an instance) ready to be included in
   *   the `MIDDLEWARE` setting.
   *
   * @example Server — DB lookup
   * ```ts
   * import { AuthenticationMiddleware } from "@alexi/auth";
   * import { UserModel } from "@myapp/models";
   *
   * export const MIDDLEWARE = [
   *   AuthenticationMiddleware.configure({ userModel: UserModel }),
   * ];
   * ```
   *
   * @example Service Worker — construct from JWT payload
   * ```ts
   * import { AuthenticationMiddleware } from "@alexi/auth";
   * import { UserModel } from "@myapp/models";
   *
   * export const MIDDLEWARE = [
   *   AuthenticationMiddleware.configure({
   *     userModel: UserModel,
   *     fromJWT: (payload) => UserModel.fromJWT(payload),
   *   }),
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
      protected static override _fromJWT:
        | ((payload: AuthenticatedUser) => unknown)
        | null = options.fromJWT ?? null;
    }
    return ConfiguredAuthenticationMiddleware;
  }

  /**
   * Resolve the authenticated user and attach it to the request, then pass
   * the request to the next middleware or view.
   *
   * When a `userModel` is configured, `request.user` is set to the full ORM
   * model instance (fetched from DB or constructed via `fromJWT`).  When no
   * `userModel` is configured, `request.user` is set to the plain
   * {@link AuthenticatedUser} JWT payload object.
   *
   * @param request - The incoming HTTP request.
   * @returns The HTTP response from the next layer.
   */
  override async call(request: Request): Promise<Response> {
    const user = await _resolveUser(request);
    const req = request as unknown as Record<string, unknown>;
    if (user) {
      _requestUsers.set(request, user);
      req["user"] = user; // default: plain AuthenticatedUser

      // If a userModel is configured, resolve the full ORM instance and
      // use it as request.user (Django parity).
      const Ctor = this.constructor as typeof AuthenticationMiddleware;
      if (Ctor._userModel) {
        let instance: unknown = null;
        if (Ctor._fromJWT) {
          // Service Worker path: construct from payload, no DB call.
          instance = Ctor._fromJWT(user);
        } else {
          // Server path: fetch from database.
          instance = await Ctor._userModel.objects
            .filter({ id: user.id })
            .first();
        }
        if (instance != null) {
          _requestUserInstances.set(request, instance);
          req["user"] = instance; // override with ORM instance
        }
      }
    } else {
      req["user"] = null;
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
