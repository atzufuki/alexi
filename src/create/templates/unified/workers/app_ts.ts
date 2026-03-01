/**
 * Worker app.ts template generator
 *
 * The worker sub-directory is itself a valid Alexi app (listed in INSTALLED_APPS)
 * so the bundler can discover and bundle it.
 *
 * @module @alexi/create/templates/unified/workers/app_ts
 */

/**
 * Generate workers/<name>/app.ts content
 */
export function generateWorkerAppTs(name: string): string {
  const appName = toPascalCase(name);

  return `/**
 * ${appName} Worker App Configuration
 *
 * This is itself a valid Alexi app listed in INSTALLED_APPS
 * so the bundler can discover and bundle it.
 *
 * @module ${name}/workers/${name}/app
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "${name}-worker",
  verboseName: "${appName} Worker",
  staticfiles: [
    {
      entrypoint: "./workers/${name}/mod.ts",
      outputFile: "./static/${name}/worker.js",
      options: { minify: false, sourceMaps: true },
    },
    {
      entrypoint: "./assets/${name}/mod.ts",
      outputFile: "./static/${name}/${name}.js",
      options: { minify: false, sourceMaps: true },
    },
  ],
  staticDir: "static",
  templatesDir: "src/${name}/workers/${name}/templates",
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
