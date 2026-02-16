/**
 * UI components/mod.ts template generator
 *
 * @module @alexi/create/templates/ui/components/mod_ts
 */

/**
 * Generate components/mod.ts content for the UI app
 */
export function generateUiComponentsModTs(): string {
  return `/**
 * UI Components Module
 *
 * Import this module to register all custom elements.
 *
 * @module components
 */

// Alexi Design System components
import "./alexi_button.ts";

// Re-export for convenience
export { AlexiButton } from "./alexi_button.ts";
`;
}
