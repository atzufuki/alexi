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

  appPath: new URL("./", import.meta.url).href,
};

export default config;
