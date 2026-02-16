/**
 * Desktop mod.ts template generator
 *
 * @module @alexi/create/templates/desktop/mod_ts
 */

/**
 * Generate mod.ts content for the desktop app
 */
export function generateDesktopModTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Desktop App Module
 *
 * WebUI desktop application wrapper.
 *
 * @module ${name}-desktop
 */

export { default } from "@${name}-desktop/app.ts";
export * from "@${name}-desktop/bindings.ts";
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
