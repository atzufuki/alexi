/**
 * Alexi DB App Configuration
 *
 * Django-style app configuration for database/ORM.
 *
 * @module @alexi/db
 */

import type { AppConfig } from "@alexi/types";

/**
 * Django-style app configuration for the Alexi ORM package.
 */
const config = {
  name: "alexi_db",
  verboseName: "Alexi Database",
} satisfies AppConfig;

export default config;
