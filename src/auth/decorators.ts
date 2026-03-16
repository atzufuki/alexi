/**
 * View decorators for Alexi authentication.
 *
 * Provides Django-equivalent view decorators that enforce authentication and
 * permission checks before a view handler is invoked.  The authenticated user
 * is stored on the request object via a `WeakMap` and can be retrieved inside
 * the decorated view with {@link getRequestUser}.
 *
 * @module
 */

import type { TokenPayload } from "./jwt.ts";
import { verifyToken } from "./jwt.ts";
import { _requestUserInstances, _requestUsers } from "./_auth_store.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * An authenticated user attached to a request by {@link loginRequired},
 * {@link permissionRequired}, or {@link AuthenticationMiddleware}.
 *
 * @category Decorators
 */
export interface AuthenticatedUser {
  /** The user's primary key. */
  id: number | string;
  /** The user's email address. */
  email?: string;
  /** Whether the user has admin privileges. */
  isAdmin?: boolean;
}

/**
 * Standard Alexi view function signature.
 *
 * @category Decorators
 */
export type ViewFunction = (
  request: Request,
  params: Record<string, string>,
) => Promise<Response>;

// =============================================================================
// Public API
// =============================================================================

/**
 * Return the {@link AuthenticatedUser} attached to `request` by
 * {@link loginRequired} or {@link permissionRequired}.
 *
 * Call this inside a view that has already been wrapped by one of the
 * decorators.  The user is guaranteed non-null when the decorator has
 * allowed the request through.
 *
 * @param request - The current HTTP request.
 * @returns The authenticated user, or `undefined` if the request was not
 *   processed by an auth decorator.
 *
 * @example
 * ```ts
 * import { getRequestUser, loginRequired } from "@alexi/auth";
 *
 * const profileView = loginRequired(async (request, _params) => {
 *   const user = getRequestUser(request)!;
 *   return Response.json({ id: user.id, email: user.email });
 * });
 * ```
 *
 * @category Decorators
 */
export function getRequestUser(
  request: Request,
): AuthenticatedUser | undefined {
  return _requestUsers.get(request);
}

/**
 * Return the full ORM model instance attached to `request` by
 * {@link AuthenticationMiddleware} when it is configured with a `userModel`.
 *
 * Returns `undefined` when the middleware was not configured with a
 * `userModel`, when the request is anonymous, or when the user was not found
 * in the database.
 *
 * Use a type parameter to cast the result to your project's user model type
 * without importing it in this package:
 *
 * ```ts
 * import { getRequestUserInstance } from "@alexi/auth";
 * import type { UserModel } from "@myapp/models";
 *
 * const user = getRequestUserInstance<UserModel>(request);
 * ```
 *
 * @param request - The current HTTP request.
 * @returns The ORM instance, or `undefined` if not available.
 *
 * @example
 * ```ts
 * import { getRequestUserInstance } from "@alexi/auth";
 * import type { UserModel } from "@myapp/models";
 *
 * export async function profileView(request: Request): Promise<Response> {
 *   const user = getRequestUserInstance<UserModel>(request);
 *   if (!user) return Response.json({ detail: "Unauthorized" }, { status: 401 });
 *   return Response.json({ name: user.firstName.get() });
 * }
 * ```
 *
 * @category Decorators
 */
export function getRequestUserInstance<T = unknown>(
  request: Request,
): T | undefined {
  return _requestUserInstances.get(request) as T | undefined;
}

/**
 * Wrap a view function so that it requires a valid JWT bearer token.
 *
 * Reads the token from the `Authorization: Bearer <token>` header and verifies
 * it using {@link verifyToken}.  On success the decoded user is stored on the
 * request (retrievable with {@link getRequestUser}) and the inner view is
 * called.  On failure a `401 Authentication required` JSON response is returned
 * immediately.
 *
 * @param view - The view function to protect.
 * @returns A new view function that enforces authentication.
 *
 * @example
 * ```ts
 * import { loginRequired } from "@alexi/auth";
 *
 * export const profileView = loginRequired(async (request, params) => {
 *   return Response.json({ ok: true });
 * });
 *
 * // In urls.ts:
 * path("profile/", profileView);
 * ```
 *
 * @category Decorators
 */
export function loginRequired(view: ViewFunction): ViewFunction {
  return async function (
    request: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    const user = await _resolveUser(request);
    if (!user) {
      return Response.json(
        { detail: "Authentication required." },
        { status: 401 },
      );
    }
    _requestUsers.set(request, user);
    return view(request, params);
  };
}

/**
 * Wrap a view function so that it requires both authentication and a specific
 * permission.
 *
 * Currently supports the `"admin"` permission, which requires `user.isAdmin`
 * to be truthy.  Additional permission strings are reserved for future use.
 *
 * On authentication failure a `401` response is returned; on permission
 * failure a `403` response is returned.
 *
 * @param perm - The required permission string (currently `"admin"`).
 * @param view - The view function to protect.
 * @returns A new view function that enforces authentication and the given
 *   permission.
 *
 * @example
 * ```ts
 * import { permissionRequired } from "@alexi/auth";
 *
 * export const dashboardView = permissionRequired("admin", async (request, params) => {
 *   return Response.json({ ok: true });
 * });
 *
 * // In urls.ts:
 * path("dashboard/", dashboardView);
 * ```
 *
 * @category Decorators
 */
export function permissionRequired(
  perm: string,
  view: ViewFunction,
): ViewFunction {
  return async function (
    request: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    const user = await _resolveUser(request);
    if (!user) {
      return Response.json(
        { detail: "Authentication required." },
        { status: 401 },
      );
    }
    if (!_hasPermission(user, perm)) {
      return Response.json(
        { detail: "Permission denied." },
        { status: 403 },
      );
    }
    _requestUsers.set(request, user);
    return view(request, params);
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract and verify the JWT bearer token from an `Authorization` header.
 *
 * @param request - Incoming HTTP request.
 * @returns The decoded user, or `null` if the token is absent or invalid.
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
  const payload: TokenPayload | null = await verifyToken(token);
  if (!payload) return null;

  const userId = payload.userId ?? (payload as Record<string, unknown>).sub;
  if (userId == null) return null;

  return {
    id: userId as number | string,
    email: payload.email,
    isAdmin: payload.isAdmin ?? false,
  };
}

/**
 * Return `true` if `user` satisfies the given permission string.
 *
 * @internal
 */
function _hasPermission(user: AuthenticatedUser, perm: string): boolean {
  if (perm === "admin") return user.isAdmin === true;
  // Future: look up app-level permissions, groups, etc.
  return false;
}
