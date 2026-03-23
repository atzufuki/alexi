/**
 * Alexi's authentication package.
 *
 * `@alexi/auth` provides the framework's authentication app configuration,
 * its Django-style `AbstractUser` base model, JWT utilities for issuing and
 * verifying signed access and refresh tokens, and
 * {@link AuthenticationMiddleware} for automatic request-level user resolution.
 * `BaseMiddleware` and `NextFunction` are available from `@alexi/middleware`.
 *
 * Most projects import `AbstractUser` from this package, extend it with
 * application-specific fields, and register the resulting model in settings as
 * the active user model. Authentication-related commands are exposed from the
 * `@alexi/auth/commands` subpath rather than this root entrypoint.
 *
 * @module @alexi/auth
 *
 * @example Define a project user model
 * ```ts
 * import { AbstractUser } from "@alexi/auth";
 * import { Manager } from "@alexi/db";
 *
 * export class UserModel extends AbstractUser {
 *   static objects = new Manager(UserModel);
 *   static meta = { dbTable: "users" };
 * }
 * ```
 *
 * @example Issue a token pair on login
 * ```ts
 * import { createTokenPair } from "@alexi/auth";
 *
 * const tokens = await createTokenPair(user.id.get(), user.email.get(), user.isAdmin.get());
 * return Response.json(tokens);
 * ```
 *
 * @example Verify a token
 * ```ts
 * import { verifyToken } from "@alexi/auth";
 *
 * const payload = await verifyToken(accessToken);
 * if (!payload) return Response.json({ error: "Unauthorized" }, { status: 401 });
 * ```
 *
 * @example Protect a view with login_required
 * ```ts
 * import { loginRequired, getRequestUser } from "@alexi/auth";
 *
 * export const profileView = loginRequired(async (request, _params) => {
 *   const user = getRequestUser(request)!;
 *   return Response.json({ id: user.id, email: user.email });
 * });
 * ```
 *
 * @example Use AuthenticationMiddleware for automatic user resolution
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
 */

// =============================================================================
// Exports
// =============================================================================

// App configuration
import type { AppConfig } from "@alexi/types";

/**
 * App configuration for `@alexi/auth`.
 *
 * Add to `INSTALLED_APPS` in your project settings to enable the authentication
 * system and the `createsuperuser` management command.
 *
 * @example
 * ```ts
 * import { AuthConfig } from "@alexi/auth";
 *
 * export const INSTALLED_APPS = [AuthConfig];
 * ```
 *
 * @category Configuration
 */
export const AuthConfig: AppConfig = {
  name: "alexi_auth",
  verboseName: "Alexi Authentication",
  appPath: new URL("./", import.meta.url).href,
};

// Abstract base user model
export { AbstractUser } from "./models/mod.ts";

// JWT utilities
export { createTokenPair, decodeToken, verifyToken } from "./jwt.ts";
export type { TokenPair, TokenPayload } from "./jwt.ts";

// View decorators
export {
  getRequestUser,
  getRequestUserInstance,
  loginRequired,
  permissionRequired,
} from "./decorators.ts";
export type { AuthenticatedUser, ViewFunction } from "./decorators.ts";

// Authentication middleware
export { AuthenticationMiddleware } from "./middleware.ts";
export type {
  AuthenticationMiddlewareOptions,
  UserModelClass,
} from "./middleware.ts";

// Commands are contributed via AuthConfig.appPath — the management loader
// discovers commands/mod.ts relative to the app directory.
