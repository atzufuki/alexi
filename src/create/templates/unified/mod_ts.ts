/**
 * Unified mod.ts template generator
 *
 * @module @alexi/create/templates/unified/mod_ts
 */

/**
 * Generate mod.ts content for the unified app
 */
export function generateModTs(name: string): string {
  const appName = toPascalCase(name);

  return `/**
 * ${appName} Module Exports
 *
 * @module ${name}
 */

import type { AppConfig } from "@alexi/types";

/**
 * App configuration for the ${appName} app.
 *
 * Add to \`INSTALLED_APPS\` in your project settings.
 *
 * @example
 * \`\`\`ts
 * import { ${appName}Config } from "@${name}/mod.ts";
 *
 * export const INSTALLED_APPS = [${appName}Config];
 * \`\`\`
 */
export const ${appName}Config: AppConfig = {
  name: "${name}",
  verboseName: "${appName}",
};

export * from "./models.ts";
export * from "./views.ts";
export * from "./urls.ts";
export * from "./serializers.ts";
export * from "./viewsets.ts";
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
