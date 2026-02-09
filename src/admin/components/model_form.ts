/**
 * AdminModelForm component for Alexi Admin
 *
 * A dynamic form component for creating and editing model instances.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import type { FieldInfo } from "../introspection.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Fieldset configuration for grouping form fields.
 */
export interface FormFieldset {
  /** Fieldset title */
  name: string;
  /** Field names to include in this fieldset */
  fields: string[];
  /** Whether the fieldset is initially collapsed */
  collapsed?: boolean;
  /** Description text */
  description?: string;
}

/**
 * Form field configuration.
 */
export interface FormField {
  /** Field name */
  name: string;
  /** Display label */
  label: string;
  /** Field type for widget selection */
  type: string;
  /** Current value */
  value: unknown;
  /** Whether the field is required */
  required: boolean;
  /** Whether the field is readonly */
  readonly: boolean;
  /** Help text */
  helpText?: string;
  /** Error message */
  error?: string;
  /** Maximum length (for text fields) */
  maxLength?: number;
  /** Minimum value (for number fields) */
  min?: number;
  /** Maximum value (for number fields) */
  max?: number;
  /** Choices for select fields */
  choices?: Array<[unknown, string]>;
}

/**
 * Form validation result.
 */
export interface FormValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
}

// =============================================================================
// AdminModelForm Component
// =============================================================================

/**
 * AdminModelForm - A dynamic form component for the admin interface.
 *
 * @example
 * ```typescript
 * new AdminModelForm({
 *   fields: [
 *     { name: "name", label: "Name", type: "CharField", value: "", required: true },
 *     { name: "price", label: "Price", type: "IntegerField", value: 0, required: true },
 *   ],
 *   onSubmit: (data) => console.log("Form submitted:", data),
 * });
 * ```
 */
export class AdminModelForm extends HTMLPropsMixin(HTMLElement, {
  /** Form fields configuration */
  fields: prop<FormField[]>([]),
  /** Fieldset groupings (optional) */
  fieldsets: prop<FormFieldset[]>([]),
  /** Current form data */
  data: prop<Record<string, unknown>>({}),
  /** Validation errors */
  errors: prop<Record<string, string[]>>({}),
  /** Whether the form is in submitting state */
  submitting: prop(false),
  /** Whether this is an edit form (vs. create) */
  isEdit: prop(false),
  /** Whether to show "Save and continue" button */
  showSaveContinue: prop(true),
  /** Whether to show "Save as new" button */
  showSaveAsNew: prop(false),
  /** Whether to show delete button */
  showDelete: prop(false),
  /** Form title */
  title: prop(""),
  /** Submit button text */
  submitText: prop("Save"),
}) {
  static styles = `
    :host {
      display: block;
    }

    .admin-model-form {
      max-width: 800px;
    }

    .admin-form-header {
      margin-bottom: 24px;
    }

    .admin-form-title {
      font-size: 24px;
      font-weight: 600;
      color: #333333;
      margin: 0 0 8px 0;
    }

    .admin-form-subtitle {
      font-size: 14px;
      color: #666666;
      margin: 0;
    }

    /* Fieldset */
    .admin-fieldset {
      border: 1px solid #eeeeee;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 20px;
      background-color: #ffffff;
    }

    .admin-fieldset-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eeeeee;
    }

    .admin-fieldset-title {
      font-size: 16px;
      font-weight: 600;
      color: #333333;
      margin: 0;
    }

    .admin-fieldset-toggle {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border: none;
      background: none;
      color: #666666;
      font-size: 12px;
      cursor: pointer;
      border-radius: 4px;
    }

    .admin-fieldset-toggle:hover {
      background-color: #f0f0f0;
    }

    .admin-fieldset-description {
      font-size: 13px;
      color: #666666;
      margin-bottom: 16px;
    }

    .admin-fieldset-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .admin-fieldset.collapsed .admin-fieldset-content {
      display: none;
    }

    .admin-fieldset.collapsed .admin-fieldset-header {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }

    /* Form row */
    .admin-form-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    /* Field */
    .admin-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .admin-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #333333;
    }

    .admin-label-required::after {
      content: " *";
      color: #ba2121;
    }

    .admin-input,
    .admin-textarea,
    .admin-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #cccccc;
      border-radius: 4px;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.5;
      color: #333333;
      background-color: #ffffff;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      box-sizing: border-box;
    }

    .admin-input:focus,
    .admin-textarea:focus,
    .admin-select:focus {
      outline: none;
      border-color: #417690;
      box-shadow: 0 0 0 2px rgba(65, 118, 144, 0.2);
    }

    .admin-input:disabled,
    .admin-textarea:disabled,
    .admin-select:disabled {
      background-color: #f8f8f8;
      color: #999999;
      cursor: not-allowed;
    }

    .admin-input:read-only {
      background-color: #f8f8f8;
    }

    .admin-input-error,
    .admin-textarea-error,
    .admin-select-error {
      border-color: #ba2121;
    }

    .admin-textarea {
      min-height: 100px;
      resize: vertical;
    }

    .admin-checkbox-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .admin-checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: #417690;
    }

    .admin-checkbox-label {
      font-size: 14px;
      color: #333333;
      cursor: pointer;
    }

    .admin-help-text {
      font-size: 12px;
      color: #999999;
    }

    .admin-error-text {
      font-size: 12px;
      color: #ba2121;
    }

    .admin-error-list {
      margin: 4px 0 0 0;
      padding-left: 16px;
      font-size: 12px;
      color: #ba2121;
    }

    /* Form actions */
    .admin-form-actions {
      display: flex;
      gap: 8px;
      padding-top: 16px;
      border-top: 1px solid #eeeeee;
      margin-top: 24px;
      flex-wrap: wrap;
    }

    .admin-form-actions-left {
      display: flex;
      gap: 8px;
      flex: 1;
    }

    .admin-form-actions-right {
      display: flex;
      gap: 8px;
    }

    .admin-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s ease;
      white-space: nowrap;
    }

    .admin-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .admin-btn-primary {
      background-color: #417690;
      color: #ffffff;
    }

    .admin-btn-primary:hover:not(:disabled) {
      background-color: #205067;
    }

    .admin-btn-secondary {
      background-color: #f8f8f8;
      color: #333333;
      border: 1px solid #cccccc;
    }

    .admin-btn-secondary:hover:not(:disabled) {
      background-color: #f0f0f0;
    }

    .admin-btn-danger {
      background-color: #ba2121;
      color: #ffffff;
    }

    .admin-btn-danger:hover:not(:disabled) {
      background-color: #a01c1c;
    }

    /* Form error banner */
    .admin-form-error-banner {
      padding: 12px 16px;
      background-color: #fde8e8;
      border: 1px solid #ba2121;
      border-radius: 4px;
      margin-bottom: 20px;
      color: #ba2121;
      font-size: 14px;
    }

    /* Loading spinner in button */
    .admin-btn-loading {
      position: relative;
      color: transparent !important;
    }

    .admin-btn-loading::after {
      content: "";
      position: absolute;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: admin-btn-spin 0.8s linear infinite;
    }

    @keyframes admin-btn-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  private _collapsedFieldsets: Set<string> = new Set();

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminModelForm.styles;

    const form = document.createElement("form");
    form.className = "admin-model-form";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this._handleSubmit();
    });

    // Title
    if (this.title) {
      const header = document.createElement("div");
      header.className = "admin-form-header";

      const title = document.createElement("h1");
      title.className = "admin-form-title";
      title.textContent = this.title;
      header.appendChild(title);

      form.appendChild(header);
    }

    // Global error banner
    const globalErrors = this.errors["__all__"] ||
      this.errors["non_field_errors"];
    if (globalErrors && globalErrors.length > 0) {
      const errorBanner = document.createElement("div");
      errorBanner.className = "admin-form-error-banner";
      errorBanner.textContent = globalErrors.join(", ");
      form.appendChild(errorBanner);
    }

    // Render fields (with or without fieldsets)
    if (this.fieldsets.length > 0) {
      form.appendChild(this._renderFieldsets());
    } else {
      form.appendChild(this._renderFields(this.fields));
    }

    // Form actions
    form.appendChild(this._renderActions());

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(form);

    return fragment;
  }

  private _renderFieldsets(): DocumentFragment {
    const fragment = document.createDocumentFragment();

    for (const fieldset of this.fieldsets) {
      const fieldsetEl = document.createElement("div");
      fieldsetEl.className = "admin-fieldset";
      fieldsetEl.dataset.key = `fieldset-${fieldset.name}`;

      const isCollapsed = this._collapsedFieldsets.has(fieldset.name);
      if (isCollapsed) {
        fieldsetEl.classList.add("collapsed");
      }

      // Header
      const header = document.createElement("div");
      header.className = "admin-fieldset-header";

      const title = document.createElement("h2");
      title.className = "admin-fieldset-title";
      title.textContent = fieldset.name;
      header.appendChild(title);

      // Toggle button
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "admin-fieldset-toggle";
      toggle.textContent = isCollapsed ? "Show" : "Hide";
      toggle.addEventListener("click", () => {
        this._toggleFieldset(fieldset.name);
      });
      header.appendChild(toggle);

      fieldsetEl.appendChild(header);

      // Description
      if (fieldset.description) {
        const desc = document.createElement("p");
        desc.className = "admin-fieldset-description";
        desc.textContent = fieldset.description;
        fieldsetEl.appendChild(desc);
      }

      // Content
      const content = document.createElement("div");
      content.className = "admin-fieldset-content";

      const fieldsetFields = this.fields.filter((f) =>
        fieldset.fields.includes(f.name)
      );
      for (const field of fieldsetFields) {
        content.appendChild(this._renderField(field));
      }

      fieldsetEl.appendChild(content);
      fragment.appendChild(fieldsetEl);
    }

    return fragment;
  }

  private _renderFields(fields: FormField[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const container = document.createElement("div");
    container.className = "admin-fieldset";

    const content = document.createElement("div");
    content.className = "admin-fieldset-content";

    for (const field of fields) {
      content.appendChild(this._renderField(field));
    }

    container.appendChild(content);
    fragment.appendChild(container);

    return fragment;
  }

  private _renderField(field: FormField): HTMLElement {
    const row = document.createElement("div");
    row.className = "admin-form-row";
    row.dataset.key = `field-${field.name}`;

    const fieldErrors = this.errors[field.name] || [];
    const hasError = fieldErrors.length > 0;

    // Special handling for boolean fields (checkbox)
    if (field.type === "BooleanField") {
      return this._renderCheckboxField(field, hasError, fieldErrors);
    }

    // Label
    const label = document.createElement("label");
    label.className = "admin-label";
    if (field.required) {
      label.classList.add("admin-label-required");
    }
    label.htmlFor = `field-input-${field.name}`;
    label.textContent = field.label;
    row.appendChild(label);

    // Input element
    const input = this._createInputElement(field, hasError);
    row.appendChild(input);

    // Help text or errors
    if (hasError) {
      const errorList = document.createElement("ul");
      errorList.className = "admin-error-list";
      for (const error of fieldErrors) {
        const li = document.createElement("li");
        li.textContent = error;
        errorList.appendChild(li);
      }
      row.appendChild(errorList);
    } else if (field.helpText) {
      const help = document.createElement("div");
      help.className = "admin-help-text";
      help.textContent = field.helpText;
      row.appendChild(help);
    }

    return row;
  }

  private _renderCheckboxField(
    field: FormField,
    hasError: boolean,
    fieldErrors: string[],
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "admin-form-row";
    row.dataset.key = `field-${field.name}`;

    const wrapper = document.createElement("label");
    wrapper.className = "admin-checkbox-wrapper";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "admin-checkbox";
    checkbox.id = `field-input-${field.name}`;
    checkbox.name = field.name;
    checkbox.checked = Boolean(field.value);
    checkbox.disabled = field.readonly || this.submitting;

    checkbox.addEventListener("change", () => {
      this._handleFieldChange(field.name, checkbox.checked);
    });

    const labelText = document.createElement("span");
    labelText.className = "admin-checkbox-label";
    labelText.textContent = field.label;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(labelText);
    row.appendChild(wrapper);

    if (hasError) {
      const errorList = document.createElement("ul");
      errorList.className = "admin-error-list";
      for (const error of fieldErrors) {
        const li = document.createElement("li");
        li.textContent = error;
        errorList.appendChild(li);
      }
      row.appendChild(errorList);
    } else if (field.helpText) {
      const help = document.createElement("div");
      help.className = "admin-help-text";
      help.textContent = field.helpText;
      row.appendChild(help);
    }

    return row;
  }

  private _createInputElement(
    field: FormField,
    hasError: boolean,
  ): HTMLElement {
    let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

    // TextField -> textarea
    if (field.type === "TextField" || field.type === "JSONField") {
      input = document.createElement("textarea");
      input.className = "admin-textarea";
      (input as HTMLTextAreaElement).rows = 4;
      input.value = String(field.value ?? "");
    } // Select for choices
    else if (field.choices && field.choices.length > 0) {
      input = document.createElement("select");
      input.className = "admin-select";

      // Placeholder option
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "-- Select --";
      if (field.required) {
        placeholder.disabled = true;
      }
      input.appendChild(placeholder);

      for (const [value, label] of field.choices) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = label;
        option.selected = field.value === value;
        input.appendChild(option);
      }
    } // Regular input
    else {
      input = document.createElement("input");
      input.className = "admin-input";

      // Determine input type
      switch (field.type) {
        case "IntegerField":
        case "FloatField":
        case "DecimalField":
          input.type = "number";
          if (field.min !== undefined) input.min = String(field.min);
          if (field.max !== undefined) input.max = String(field.max);
          break;
        case "DateField":
          input.type = "date";
          break;
        case "DateTimeField":
          input.type = "datetime-local";
          break;
        case "AutoField":
          input.type = "text";
          input.readOnly = true;
          break;
        default:
          input.type = "text";
          if (field.maxLength) input.maxLength = field.maxLength;
      }

      input.value = field.value != null ? String(field.value) : "";
    }

    input.id = `field-input-${field.name}`;
    input.name = field.name;
    input.required = field.required && !field.readonly;
    input.disabled = this.submitting;

    if (field.readonly) {
      if ("readOnly" in input) {
        input.readOnly = true;
      } else {
        input.disabled = true;
      }
    }

    if (hasError) {
      input.classList.add(
        input.tagName === "TEXTAREA"
          ? "admin-textarea-error"
          : input.tagName === "SELECT"
          ? "admin-select-error"
          : "admin-input-error",
      );
    }

    // Event listener
    input.addEventListener("input", () => {
      let value: unknown = input.value;

      // Convert to appropriate type
      if (input.type === "number") {
        value = input.value ? Number(input.value) : null;
      }

      this._handleFieldChange(field.name, value);
    });

    return input;
  }

  private _renderActions(): HTMLElement {
    const actions = document.createElement("div");
    actions.className = "admin-form-actions";

    const leftActions = document.createElement("div");
    leftActions.className = "admin-form-actions-left";

    const rightActions = document.createElement("div");
    rightActions.className = "admin-form-actions-right";

    // Save button
    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "admin-btn admin-btn-primary";
    if (this.submitting) {
      saveBtn.classList.add("admin-btn-loading");
    }
    saveBtn.disabled = this.submitting;
    saveBtn.textContent = this.submitText;
    saveBtn.dataset.key = "save-button";
    leftActions.appendChild(saveBtn);

    // Save and continue button
    if (this.showSaveContinue) {
      const saveContinueBtn = document.createElement("button");
      saveContinueBtn.type = "button";
      saveContinueBtn.className = "admin-btn admin-btn-secondary";
      saveContinueBtn.disabled = this.submitting;
      saveContinueBtn.textContent = "Save and continue editing";
      saveContinueBtn.dataset.key = "save-continue-button";
      saveContinueBtn.addEventListener("click", () => {
        this._handleSubmit("continue");
      });
      leftActions.appendChild(saveContinueBtn);
    }

    // Save as new button
    if (this.showSaveAsNew && this.isEdit) {
      const saveAsNewBtn = document.createElement("button");
      saveAsNewBtn.type = "button";
      saveAsNewBtn.className = "admin-btn admin-btn-secondary";
      saveAsNewBtn.disabled = this.submitting;
      saveAsNewBtn.textContent = "Save as new";
      saveAsNewBtn.dataset.key = "save-as-new-button";
      saveAsNewBtn.addEventListener("click", () => {
        this._handleSubmit("new");
      });
      leftActions.appendChild(saveAsNewBtn);
    }

    // Delete button
    if (this.showDelete && this.isEdit) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "admin-btn admin-btn-danger";
      deleteBtn.disabled = this.submitting;
      deleteBtn.textContent = "Delete";
      deleteBtn.dataset.key = "delete-button";
      deleteBtn.addEventListener("click", () => {
        this._handleDelete();
      });
      rightActions.appendChild(deleteBtn);
    }

    actions.appendChild(leftActions);
    actions.appendChild(rightActions);

    return actions;
  }

  private _toggleFieldset(name: string): void {
    if (this._collapsedFieldsets.has(name)) {
      this._collapsedFieldsets.delete(name);
    } else {
      this._collapsedFieldsets.add(name);
    }

    // Re-render
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }

  private _handleFieldChange(name: string, value: unknown): void {
    this.dispatchEvent(
      new CustomEvent("field-change", {
        bubbles: true,
        composed: true,
        detail: { name, value },
      }),
    );
  }

  private _handleSubmit(action: "save" | "continue" | "new" = "save"): void {
    // Collect form data
    const formData = this._collectFormData();

    this.dispatchEvent(
      new CustomEvent("form-submit", {
        bubbles: true,
        composed: true,
        detail: { data: formData, action },
      }),
    );
  }

  private _handleDelete(): void {
    this.dispatchEvent(
      new CustomEvent("form-delete", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _collectFormData(): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    for (const field of this.fields) {
      const input = this.shadowRoot?.querySelector(
        `#field-input-${field.name}`,
      ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;

      if (input) {
        if (input.type === "checkbox") {
          data[field.name] = (input as HTMLInputElement).checked;
        } else if (input.type === "number") {
          data[field.name] = input.value ? Number(input.value) : null;
        } else {
          data[field.name] = input.value;
        }
      }
    }

    return data;
  }

  mountedCallback(): void {
    // Initialize collapsed fieldsets from config
    for (const fieldset of this.fieldsets) {
      if (fieldset.collapsed) {
        this._collapsedFieldsets.add(fieldset.name);
      }
    }

    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }

  /**
   * Get current form data
   */
  getData(): Record<string, unknown> {
    return this._collectFormData();
  }

  /**
   * Set form errors
   */
  setErrors(errors: Record<string, string[]>): void {
    this.errors = errors;
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors = {};
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }

  /**
   * Focus the first field
   */
  focusFirst(): void {
    const firstInput = this.shadowRoot?.querySelector(
      "input:not([type=hidden]):not([readonly]), textarea, select",
    ) as HTMLElement | null;
    firstInput?.focus();
  }

  /**
   * Focus a specific field
   */
  focusField(name: string): void {
    const input = this.shadowRoot?.querySelector(
      `#field-input-${name}`,
    ) as HTMLElement | null;
    input?.focus();
  }
}

// Register the custom element
AdminModelForm.define("admin-model-form");
