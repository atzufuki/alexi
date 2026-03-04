/**
 * Alexi Staticfiles App Configuration
 *
 * Django-style app configuration for static files handling.
 *
 * @module @alexi/staticfiles
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "alexi_staticfiles",
  verboseName: "Alexi Static Files",
  appPath: new URL("./", import.meta.url).href,
};

export default config;
