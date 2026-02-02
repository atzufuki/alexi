/**
 * Built-in Commands for Alexi Core
 *
 * Core management commands. Other commands are provided by their respective modules:
 * - bundle, collectstatic, runserver (static) → @alexi/staticfiles
 * - runserver (web) → @alexi/web
 * - runserver (desktop) → @alexi/webui
 * - createsuperuser → @alexi/auth
 * - flush → @alexi/db
 *
 * @module @alexi/core/commands
 */

export { HelpCommand } from "./help.ts";
export { TestCommand } from "./test.ts";
export type { TestConfig } from "./test.ts";
