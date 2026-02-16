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
import "./ds_icon.ts";
import "./ds_text.ts";
import "./ds_card.ts";
import "./ds_theme_toggle.ts";

// Re-export for convenience
export { DSButton } from "./ds_button.ts";
export { DSInput } from "./ds_input.ts";
export { DSCheckbox } from "./ds_checkbox.ts";
export { DSIcon } from "./ds_icon.ts";
export { DSText } from "./ds_text.ts";
export { DSCard } from "./ds_card.ts";
export { DSThemeToggle } from "./ds_theme_toggle.ts";
`;
}
