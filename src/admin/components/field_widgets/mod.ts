/**
 * Field Widgets module for Alexi Admin
 *
 * This module exports all field widget components.
 *
 * @module
 */

export { AdminInput } from "./admin_input.ts";
export type { InputType } from "./admin_input.ts";

export { AdminCheckbox } from "./admin_checkbox.ts";

export { AdminSelect } from "./admin_select.ts";
export type { SelectOption } from "./admin_select.ts";

export { AdminTextarea } from "./admin_textarea.ts";

// Relation widgets
export { AdminForeignKeySelect } from "./admin_foreign_key_select.ts";
export type { ForeignKeyOption } from "./admin_foreign_key_select.ts";

export { AdminManyToManySelect } from "./admin_many_to_many_select.ts";
export type { ManyToManyOption } from "./admin_many_to_many_select.ts";
