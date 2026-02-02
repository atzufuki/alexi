/**
 * Alexi Auth App Configuration
 *
 * Django-style app configuration for authentication.
 * Similar to Django's django.contrib.auth.
 *
 * @module @alexi/auth
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "alexi_auth",
  verboseName: "Alexi Authentication",
  commandsModule: "./commands/mod.ts",
};

export default config;
