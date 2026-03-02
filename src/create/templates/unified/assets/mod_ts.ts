/**
 * Assets entry point template generator (frontend entry point)
 *
 * @module @alexi/create/templates/unified/assets/mod_ts
 */

/**
 * Generate assets/<name>/<name>.ts content
 */
export function generateAssetModTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Frontend Entry Point
 *
 * This file is bundled by @alexi/staticfiles into static/${name}/${name}.js.
 * It runs in the Document context (the browser page itself, not the SW).
 * Use it for Web Components, DOM interactions, and client-side init.
 *
 * The Service Worker handles all routing and data access.
 *
 * @module ${name}/assets/${name}/${name}
 */

console.log("${toPascalCase(name)} frontend loaded");
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
