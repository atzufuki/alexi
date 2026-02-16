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
 * Design System components for the application.
 *
 * @module components
 */

// Design System components
import "./ds_button.ts";
import "./ds_input.ts";
import "./ds_checkbox.ts";

// Re-export for convenience
export { DSButton } from "./ds_button.ts";
export { DSInput } from "./ds_input.ts";
export { DSCheckbox } from "./ds_checkbox.ts";
`;
}
