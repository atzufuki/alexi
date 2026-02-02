/**
 * AdminCheckbox component for Alexi Admin
 *
 * A styled checkbox component for boolean fields.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// AdminCheckbox Component
// =============================================================================

/**
 * AdminCheckbox - A styled checkbox component for the admin interface.
 *
 * @example
 * ```typescript
 * new AdminCheckbox({
 *   label: "Is Active",
 *   name: "isActive",
 *   checked: true,
 *   onchange: (e) => console.log(e.detail.checked),
 * });
 * ```
 */
export class AdminCheckbox extends HTMLPropsMixin(HTMLElement, {
  /** Checkbox label text */
  label: prop(""),
  /** Input name attribute */
  name: prop(""),
  /** Whether the checkbox is checked */
  checked: prop(false),
  /** Whether the checkbox is disabled */
  disabled: prop(false),
  /** Whether the field is required */
  required: prop(false),
  /** Help text shown below the checkbox */
  helpText: prop(""),
  /** Error message to display */
  error: prop(""),
}) {
  static styles = `
    :host {
      display: block;
    }

    .admin-checkbox-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .admin-checkbox-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .admin-checkbox-wrapper:has(:disabled) {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .admin-checkbox {
      width: 18px;
      height: 18px;
      margin: 0;
      cursor: pointer;
      accent-color: #417690;
    }

    .admin-checkbox:disabled {
      cursor: not-allowed;
    }

    .admin-checkbox:focus {
      outline: 2px solid #417690;
      outline-offset: 2px;
    }

    .admin-checkbox-label {
      font-size: 14px;
      color: #333333;
      user-select: none;
    }

    .admin-checkbox-label-required::after {
      content: " *";
      color: #ba2121;
    }

    .admin-help-text {
      font-size: 12px;
      color: #999999;
      margin-left: 26px;
    }

    .admin-error-text {
      font-size: 12px;
      color: #ba2121;
      margin-left: 26px;
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminCheckbox.styles;

    const wrapper = document.createElement("div");
    wrapper.className = "admin-checkbox-field";
    wrapper.dataset.key = `field-${this.name}`;

    // Checkbox wrapper (label wraps checkbox for click area)
    const checkboxWrapper = document.createElement("label");
    checkboxWrapper.className = "admin-checkbox-wrapper";

    // Checkbox input
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "admin-checkbox";
    input.id = `checkbox-${this.name}`;
    input.name = this.name;
    input.checked = this.checked;
    input.disabled = this.disabled;
    input.required = this.required;

    // Event listener
    input.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      this.dispatchEvent(
        new CustomEvent("admin-change", {
          bubbles: true,
          composed: true,
          detail: {
            checked: target.checked,
            name: this.name,
          },
        }),
      );
    });

    checkboxWrapper.appendChild(input);

    // Label text
    if (this.label) {
      const labelText = document.createElement("span");
      labelText.className = "admin-checkbox-label";
      if (this.required) {
        labelText.classList.add("admin-checkbox-label-required");
      }
      labelText.textContent = this.label;
      checkboxWrapper.appendChild(labelText);
    }

    wrapper.appendChild(checkboxWrapper);

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
   * Focus the checkbox element
   */
  focus(): void {
    const input = this.shadowRoot?.querySelector("input");
    input?.focus();
  }

  /**
   * Get the current checked state
   */
  getChecked(): boolean {
    const input = this.shadowRoot?.querySelector("input");
    return input?.checked ?? false;
  }

  /**
   * Set the checked state
   */
  setChecked(checked: boolean): void {
    const input = this.shadowRoot?.querySelector("input");
    if (input) {
      input.checked = checked;
    }
  }

  /**
   * Toggle the checked state
   */
  toggle(): void {
    const input = this.shadowRoot?.querySelector("input");
    if (input && !this.disabled) {
      input.checked = !input.checked;
      this.dispatchEvent(
        new CustomEvent("admin-change", {
          bubbles: true,
          composed: true,
          detail: {
            checked: input.checked,
            name: this.name,
          },
        }),
      );
    }
  }
}

// Register the custom element
AdminCheckbox.define("admin-checkbox");
