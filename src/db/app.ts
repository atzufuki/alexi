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
  // Note: FlushCommand is in @alexi/core (like Django's flush command)
};

export default config;
