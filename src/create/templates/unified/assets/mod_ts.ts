/**
 * Assets mod.ts template generator (frontend entry point)
 *
 * @module @alexi/create/templates/unified/assets/mod_ts
 */

/**
 * Generate assets/<name>/mod.ts content
 */
export function generateAssetModTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Frontend Entry Point
 *
 * This file is bundled by @alexi/staticfiles into static/${name}/${name}.js.
 * Import your Web Components and client-side code here.
 *
 * @module ${name}/assets/${name}/mod
 */

// Import and register components
// import "./components/my_component.ts";

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
