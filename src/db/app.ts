/**
 * Alexi DB App Configuration
 *
 * Django-style app configuration for database/ORM.
 *
 * @module @alexi/db
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "alexi_db",
  verboseName: "Alexi Database",
  commandsModule: "./commands/mod.ts",
  commandsImport: () => import("./commands/mod.ts"),
};

export default config;
