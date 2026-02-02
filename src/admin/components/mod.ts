/**
 * Components module for Alexi Admin
 *
 * This module exports all admin UI components.
 *
 * @module
 */

// =============================================================================
// Core Components
// =============================================================================

export { AdminButton } from "./admin_button.ts";
export type { ButtonSize, ButtonType, ButtonVariant } from "./admin_button.ts";

export { AdminDataTable } from "./data_table.ts";
export type { DataTableColumn, SortConfig } from "./data_table.ts";

export { AdminModelForm } from "./model_form.ts";
export type { FormField, FormFieldset, FormValidationResult } from "./model_form.ts";

export { AdminPagination } from "./pagination.ts";
export type { PageInfo } from "./pagination.ts";

// =============================================================================
// Field Widgets
// =============================================================================

export {
  AdminCheckbox,
  AdminForeignKeySelect,
  AdminInput,
  AdminManyToManySelect,
  AdminSelect,
  AdminTextarea,
} from "./field_widgets/mod.ts";

export type {
  ForeignKeyOption,
  InputType,
  ManyToManyOption,
  SelectOption,
} from "./field_widgets/mod.ts";

// =============================================================================
// Filter Components
// =============================================================================

export {
  AdminBooleanFilter,
  AdminChoiceFilter,
  AdminDateRangeFilter,
  AdminFilterSidebar,
} from "./filters/mod.ts";

// =============================================================================
// Feedback Components
// =============================================================================

export { AdminToast } from "./toast.ts";
export type { ToastMessage, ToastType } from "./toast.ts";

export { AdminConfirmDialog } from "./confirm_dialog.ts";
export type { ConfirmDialogResult, ConfirmDialogType } from "./confirm_dialog.ts";
