/**
 * Unified app.ts template generator
 *
 * @module @alexi/create/templates/unified/app_ts
 */

/**
 * Generate app.ts content for the unified app (server-side)
 */
export function generateAppTs(name: string): string {
  const appName = toPascalCase(name);

  return `/**
 * ${appName} App Configuration
 *
 * @module ${name}/app
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "${name}",
  verboseName: "${appName}",
  staticDir: "static",
};

export default config;
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
