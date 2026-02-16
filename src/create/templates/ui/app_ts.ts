/**
 * UI app.ts template generator
 *
 * @module @alexi/create/templates/ui/app_ts
 */

/**
 * Generate app.ts content for the UI app
 */
export function generateUiAppTs(name: string): string {
  const appName = toPascalCase(name);

  return `/**
 * ${appName} UI App Configuration
 *
 * @module ${name}-ui/app
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "${name}-ui",
  verboseName: "${appName} UI",

  // Bundle configuration for esbuild
  bundle: {
    entrypoint: "./main.ts",
    outputDir: "./static/${name}-ui",
    outputName: "bundle.js",
    options: {
      minify: false,
      sourceMaps: true,
    },
  },
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
