/**
 * Web app.ts template generator
 *
 * @module @alexi/create/templates/web/app_ts
 */

/**
 * Generate app.ts content for the web app
 */
export function generateWebAppTs(name: string): string {
  const appName = toPascalCase(name);

  return `/**
 * ${appName} Web App Configuration
 *
 * @module ${name}-web/app
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "${name}-web",
  verboseName: "${appName} Web",
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
