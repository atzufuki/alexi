/**
 * Built-in Commands for Alexi Core
 *
 * Core management commands. Other commands are provided by their respective modules:
 * - bundle, collectstatic → @alexi/staticfiles
 * - runserver (desktop) → @alexi/webui
 * - createsuperuser → @alexi/auth
 *
 * @module @alexi/core/commands
 */

export { HelpCommand } from "./help.ts";
export { TestCommand } from "./test.ts";
export type { TestConfig } from "./test.ts";
export { StartAppCommand } from "./startapp.ts";
export { FlushCommand } from "./flush.ts";
export { RunServerCommand } from "./runserver.ts";

// Migration commands (moved from @alexi/db to break circular dependency)
export { MakemigrationsCommand } from "./makemigrations.ts";
export { MigrateCommand } from "./migrate.ts";
export { ShowmigrationsCommand } from "./showmigrations.ts";
export { SqlmigrateCommand } from "./sqlmigrate.ts";
