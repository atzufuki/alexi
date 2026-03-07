/**
 * Alexi's authentication package.
 *
 * `@alexi/auth` provides the framework's authentication app configuration and
 * its Django-style `AbstractUser` base model. It is the starting point for apps
 * that want a conventional user model with email identity, admin flags, and
 * password hashing behavior compatible with Alexi's admin and auth workflows.
 *
 * Most projects import `AbstractUser` from this package, extend it with
 * application-specific fields, and register the resulting model in settings as
 * the active user model. Authentication-related commands are exposed from the
 * `@alexi/auth/commands` subpath rather than this root entrypoint.
 *
 * This package is primarily model-focused. Runtime behavior such as admin login
 * flows or command execution depends on server-side Alexi integrations.
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
 */

// =============================================================================
// Exports
// =============================================================================

// App configuration
export { default } from "./app.ts";
export { default as config } from "./app.ts";

// Abstract base user model
export { AbstractUser } from "./models/mod.ts";

// Commands are loaded dynamically via app.ts commandsModule
