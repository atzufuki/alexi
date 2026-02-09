/**
 * Alexi Web App Configuration
 *
 * Django-style app configuration for web API server.
 * Provides the HTTP runserver command for web applications.
 *
 * @module @alexi/web
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "alexi_web",
  verboseName: "Alexi Web Server",
  commandsModule: "./commands/mod.ts",
  commandsImport: () => import("./commands/mod.ts"),
};

export default config;
