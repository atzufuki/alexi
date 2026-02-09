/**
 * Alexi WebUI Application
 *
 * Desktop application support using WebUI.
 * Wraps web applications in native desktop windows.
 *
 * @module alexi_webui
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  /**
   * App name. Must match the name in INSTALLED_APPS.
   */
  name: "alexi_webui",

  /**
   * Human-readable name.
   */
  verboseName: "Alexi WebUI",

  /**
   * Commands module for desktop app management.
   */
  commandsModule: "./commands/mod.ts",
  commandsImport: () => import("./commands/mod.ts"),
};

export default config;
