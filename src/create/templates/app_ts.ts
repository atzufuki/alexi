/**
 * app.ts template generator
 *
 * @module @alexi/create/templates/app_ts
 */

/**
 * Generate app.ts content for a new app
 */
export function generateAppTs(name: string): string {
  // Convert name to PascalCase for class name
  const className = name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  return `/**
 * ${className} App Configuration
 *
 * @module ${name}/app
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "${name}",
  verboseName: "${className}",
};

export default config;
`;
}
