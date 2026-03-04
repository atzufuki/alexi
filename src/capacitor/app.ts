/**
 * Alexi Capacitor Application
 *
 * Mobile application support using Capacitor.
 * Wraps web applications in native iOS and Android containers.
 *
 * @module alexi_capacitor
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  /**
   * App name. Must match the name in INSTALLED_APPS.
   */
  name: "alexi_capacitor",

  /**
   * Human-readable name.
   */
  verboseName: "Alexi Capacitor",

  appPath: new URL("./", import.meta.url).href,
};

export default config;
