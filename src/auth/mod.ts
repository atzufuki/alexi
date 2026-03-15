/**
 * Alexi's authentication package.
 *
 * `@alexi/auth` provides the framework's authentication app configuration,
 * its Django-style `AbstractUser` base model, and JWT utilities for issuing
 * and verifying signed access and refresh tokens.
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
 */

// =============================================================================
// Exports
// =============================================================================

// App configuration
export { default } from "./app.ts";
export { default as config } from "./app.ts";

// Abstract base user model
export { AbstractUser } from "./models/mod.ts";

// JWT utilities
export { createTokenPair, verifyToken } from "./jwt.ts";
export type { TokenPair, TokenPayload } from "./jwt.ts";

// Commands are loaded dynamically via app.ts commandsModule
