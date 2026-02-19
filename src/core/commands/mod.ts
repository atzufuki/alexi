/**
 * Built-in Commands for Alexi Core
 *
 * Core management commands. Other commands are provided by their respective modules:
 * - bundle, collectstatic, runserver (static) → @alexi/staticfiles
 * - runserver (web) → @alexi/web
 * - runserver (desktop) → @alexi/webui
 * - createsuperuser → @alexi/auth
 *
 * @module @alexi/core/commands
 */

export { HelpCommand } from "./help.ts";
export { TestCommand } from "./test.ts";
export type { TestConfig } from "./test.ts";
export { StartAppCommand } from "./startapp.ts";
export type { AppType } from "./startapp.ts";
export { FlushCommand } from "./flush.ts";

// Migration commands (moved from @alexi/db to break circular dependency)
export { MakemigrationsCommand } from "./makemigrations.ts";
export { MigrateCommand } from "./migrate.ts";
export { ShowmigrationsCommand } from "./showmigrations.ts";
export { SqlmigrateCommand } from "./sqlmigrate.ts";
