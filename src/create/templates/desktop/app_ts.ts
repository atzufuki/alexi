/**
 * Desktop app.ts template generator
 *
 * @module @alexi/create/templates/desktop/app_ts
 */

/**
 * Generate app.ts content for the desktop app
 */
export function generateDesktopAppTs(name: string): string {
  const appName = toPascalCase(name);

  return `/**
 * ${appName} Desktop App Configuration
 *
 * @module ${name}-desktop/app
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "${name}-desktop",
  verboseName: "${appName} Desktop",
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
