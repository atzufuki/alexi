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
  // Note: FlushCommand moved to @alexi/core to avoid circular dependency
};

export default config;
