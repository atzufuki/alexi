/**
 * Worker models.ts template generator
 *
 * @module @alexi/create/templates/unified/workers/models_ts
 */

/**
 * Generate workers/<name>/models.ts content
 */
export function generateWorkerModelsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Worker Models
 *
 * Client-side ORM models (IndexedDB / REST backends).
 *
 * @module ${name}/workers/${name}/models
 */

// Re-export server models that should be available in the browser
// import { PostModel } from "../../models.ts";
// export { PostModel };

// Or define browser-only models here
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
