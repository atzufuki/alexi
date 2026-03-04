/**
 * Alexi Admin Application
 *
 * Django-style admin panel for managing application data.
 * Provides automatic CRUD interfaces for registered models.
 *
 * @module alexi_admin
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  /**
   * App name. Must match the name in INSTALLED_APPS.
   */
  name: "alexi_admin",

  /**
   * Human-readable name.
   */
  verboseName: "Alexi Admin",

  /**
   * Explicit app path using import.meta.url so the path resolves correctly
   * whether the package is loaded from JSR cache, a local path, or any other
   * location.
   */
  appPath: new URL("./", import.meta.url).href,
};

export default config;
