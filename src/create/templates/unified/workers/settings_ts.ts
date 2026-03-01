/**
 * Worker settings.ts template generator
 *
 * @module @alexi/create/templates/unified/workers/settings_ts
 */

/**
 * Generate workers/<name>/settings.ts content
 */
export function generateWorkerSettingsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Worker Settings
 *
 * Client-side DATABASES config for the Service Worker context.
 *
 * @module ${name}/workers/${name}/settings
 */

// import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
// import { RestBackend } from "@alexi/db/backends/rest";
//
// export const DATABASES = {
//   default: new IndexedDBBackend({ name: "${name}" }),
//   rest: new RestBackend({ apiUrl: "http://localhost:8000/api" }),
// };
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
