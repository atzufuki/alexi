/**
 * Authentication classes for Alexi REST Framework
 *
 * Provides DRF-style authentication classes for ViewSet-level user identification.
 * Authentication runs before permission checks and populates context.user.
 *
 * @module @alexi/restframework/authentication/authentication
 */

import { verifyJWT } from "@alexi/auth/jwt";
import type { ViewSetContext } from "../viewsets/viewset.ts";

export type { ViewSetContext } from "../viewsets/viewset.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * The authenticated user shape populated by authentication classes
 */
export type AuthenticatedUser = {
  id: number | string;
  email?: string;
  isAdmin?: boolean;
  [key: string]: unknown;
};

/**
 * Authentication class constructor type
 */
export interface AuthenticationClass {
  /** Construct a new authentication instance. */
  new (): BaseAuthentication;
}

// ============================================================================
// Base Authentication
// ============================================================================

/**
 * Base authentication class
 *
 * All authentication classes should extend this class and implement
 * the authenticate method. Return a user object on success, or null
 * to indicate that this authenticator does not apply to the request
 * (allowing the next authenticator in the list to try).
 *
 * Authentication classes are tried in order. The first one that returns
 * a non-null user wins. If all return null, context.user remains undefined.
 *
 * @example
 * ```ts
 * class ApiKeyAuthentication extends BaseAuthentication {
 *   async authenticate(context: ViewSetContext): Promise<AuthenticatedUser | null> {
 *     const apiKey = context.request.headers.get("X-API-Key");
 *     if (!apiKey) return null;
 *
 *     const user = await UserModel.objects.filter({ apiKey }).first();
 *     if (!user) return null;
 *
 *     return {
 *       id: user.id.get(),
 *       email: user.email.get(),
 *       isAdmin: user.isAdmin.get(),
 *     };
 *   }
 * }
 * ```
 */
export abstract class BaseAuthentication {
  /**
   * Authenticate the request and return a user object, or null.
   *
   * Return null to indicate this authenticator does not apply — the
   * next authenticator in authentication_classes will be tried.
   *
   * Return a user object to indicate successful authentication.
   * The returned object will be set as context.user.
   *
   * @param context - The ViewSet context with request and params
   * @returns Authenticated user or null
   */
  abstract authenticate(
    context: ViewSetContext,
  ): Promise<AuthenticatedUser | null> | AuthenticatedUser | null;
}

// ============================================================================
// Built-in Authentication Classes
// ============================================================================

/**
 * JWT Bearer token authentication
 *
 * Reads a JWT from the `Authorization: Bearer <token>` header and
 * verifies it using the SECRET_KEY environment variable.
 *
 * The token payload must contain `userId` (or `sub`), and optionally
 * `email` and `isAdmin`.
 *
 * @example
 * ```ts
 * class ArticleViewSet extends ModelViewSet {
 *   authentication_classes = [JWTAuthentication];
 *   permission_classes = [IsAuthenticated];
 * }
 * ```
 *
 * @example With custom secret key
 * ```ts
 * class MyAuth extends JWTAuthentication {
 *   override secretKey = Deno.env.get("MY_SECRET_KEY") ?? "fallback";
 * }
 * ```
 */
export class JWTAuthentication extends BaseAuthentication {
  /**
   * Secret key used to verify JWT signatures.
   * Defaults to the SECRET_KEY environment variable.
   */
  secretKey: string = Deno.env.get("SECRET_KEY") ?? "";

  /** Attempt JWT bearer authentication for the current request. */
  async authenticate(
    context: ViewSetContext,
  ): Promise<AuthenticatedUser | null> {
    const authHeader = context.request.headers.get("Authorization");
    if (!authHeader) return null;

    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) return null;

    try {
      const payload = await verifyJWT(token, this.secretKey);
      if (!payload) return null;

      const userId = payload.userId ?? payload.sub;
      if (userId == null) return null;

      return {
        id: typeof userId === "number" ? userId : Number(userId) || userId,
        email: typeof payload.email === "string" ? payload.email : undefined,
        isAdmin: payload.isAdmin === true,
        ...payload,
      } as AuthenticatedUser;
    } catch {
      return null;
    }
  }
}
