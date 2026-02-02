/**
 * AdminSelect component for Alexi Admin
 *
 * A styled select/dropdown component for choice fields.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// Types
// =============================================================================

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// =============================================================================
// AdminSelect Component
// =============================================================================

/**
 * AdminSelect - A styled select/dropdown component for the admin interface.
 *
 * @example
 * ```typescript
 * new AdminSelect({
 *   label: "Status",
 *   name: "status",
 *   options: [
 *     { value: "active", label: "Active" },
 *     { value: "inactive", label: "Inactive" },
 *   ],
 *   value: "active",
 *   onchange: (e) => console.log(e.detail.value),
 * });
 * ```
 */
export class AdminSelect extends HTMLPropsMixin(HTMLElement, {
  /** Select label text */
  label: prop(""),
  /** Input name attribute */
  name: prop(""),
  /** Current selected value */
  value: prop(""),
  /** Available options */
  options: prop<SelectOption[]>([]),
  /** Placeholder text for empty selection */
  placeholder: prop("-- Select --"),
  /** Whether the field is required */
  required: prop(false),
  /** Whether the field is disabled */
  disabled: prop(false),
  /** Whether to allow multiple selections */
  multiple: prop(false),
  /** Help text shown below the select */
  helpText: prop(""),
  /** Error message to display */
  error: prop(""),
}) {
  static styles = `
    :host {
      display: block;
    }

    .admin-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .admin-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #333333;
      margin-bottom: 4px;
    }

    .admin-label-required::after {
      content: " *";
      color: #ba2121;
    }

    .admin-select {
      width: 100%;
      padding: 8px 32px 8px 12px;
      border: 1px solid #cccccc;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #333333;
      background-color: #ffffff;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      appearance: none;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      box-sizing: border-box;
    }

    .admin-select:hover:not(:disabled):not(:focus) {
      border-color: #999999;
    }

    .admin-select:focus {
      outline: none;
      border-color: #417690;
      box-shadow: 0 0 0 2px rgba(65, 118, 144, 0.2);
    }

    .admin-select:disabled {
      background-color: #f8f8f8;
      color: #999999;
      cursor: not-allowed;
    }

    .admin-select-error {
      border-color: #ba2121;
    }

    .admin-select-error:focus {
      border-color: #ba2121;
      box-shadow: 0 0 0 2px rgba(186, 33, 33, 0.2);
    }

    .admin-select[multiple] {
      padding-right: 12px;
      background-image: none;
      min-height: 100px;
    }

    .admin-help-text {
      font-size: 12px;
      color: #999999;
      margin-top: 4px;
    }

    .admin-error-text {
      font-size: 12px;
      color: #ba2121;
      margin-top: 4px;
    }

    option {
      padding: 4px 8px;
    }

    option:disabled {
      color: #999999;
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminSelect.styles;

    const wrapper = document.createElement("div");
    wrapper.className = "admin-field";
    wrapper.dataset.key = `field-${this.name}`;

    // Label
    if (this.label) {
      const label = document.createElement("label");
      label.className = "admin-label";
      if (this.required) {
        label.classList.add("admin-label-required");
      }
      label.htmlFor = `select-${this.name}`;
      label.textContent = this.label;
      wrapper.appendChild(label);
    }

    // Select
    const select = document.createElement("select");
    select.className = "admin-select";
    select.id = `select-${this.name}`;
    select.name = this.name;
    select.required = this.required;
    select.disabled = this.disabled;
    select.multiple = this.multiple;

    if (this.error) {
      select.classList.add("admin-select-error");
    }

    // Placeholder option (for single select)
    if (!this.multiple) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = this.placeholder;
      if (this.required) {
        placeholder.disabled = true;
      }
      if (!this.value) {
        placeholder.selected = true;
      }
      select.appendChild(placeholder);
    }

    // Options
    for (const opt of this.options) {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      option.disabled = opt.disabled ?? false;
      option.selected = opt.value === this.value;
      option.dataset.key = `option-${opt.value}`;
      select.appendChild(option);
    }

    // Event listener
    select.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;

      if (this.multiple) {
        const selectedValues = Array.from(target.selectedOptions).map(
          (opt) => opt.value,
        );
        this.dispatchEvent(
          new CustomEvent("admin-change", {
            bubbles: true,
            composed: true,
            detail: {
              values: selectedValues,
              name: this.name,
            },
          }),
        );
      } else {
        this.dispatchEvent(
          new CustomEvent("admin-change", {
            bubbles: true,
            composed: true,
            detail: {
              value: target.value,
              name: this.name,
            },
          }),
        );
      }
    });

    wrapper.appendChild(select);

    // Error text
    if (this.error) {
      const errorEl = document.createElement("div");
      errorEl.className = "admin-error-text";
      errorEl.textContent = this.error;
      wrapper.appendChild(errorEl);
    } else if (this.helpText) {
      // Help text (only show if no error)
      const help = document.createElement("div");
      help.className = "admin-help-text";
      help.textContent = this.helpText;
      wrapper.appendChild(help);
    }

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(wrapper);

    return fragment;
  }

  mountedCallback(): void {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }

  /**
   * Focus the select element
   */
  focus(): void {
    const select = this.shadowRoot?.querySelector("select");
    select?.focus();
  }

  /**
   * Get the current selected value(s)
   */
  getValue(): string | string[] {
    const select = this.shadowRoot?.querySelector("select");
    if (!select) return this.multiple ? [] : "";

    if (this.multiple) {
      return Array.from(select.selectedOptions).map((opt) => opt.value);
    }
    return select.value;
  }

  /**
   * Set the selected value
   */
  setValue(value: string | string[]): void {
    const select = this.shadowRoot?.querySelector("select");
    if (!select) return;

    if (this.multiple && Array.isArray(value)) {
      for (const option of select.options) {
        option.selected = value.includes(option.value);
      }
    } else if (typeof value === "string") {
      select.value = value;
    }
  }

  /**
   * Clear the selection
   */
  clear(): void {
    const select = this.shadowRoot?.querySelector("select");
    if (select) {
      select.selectedIndex = 0;
    }
  }
}

// Register the custom element
AdminSelect.define("admin-select");
