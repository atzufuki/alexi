/**
 * AdminInput component for Alexi Admin
 *
 * A styled input component for text, number, date, and other input types.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// Types
// =============================================================================

export type InputType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "tel"
  | "url"
  | "date"
  | "time"
  | "datetime-local"
  | "search"
  | "hidden";

// =============================================================================
// AdminInput Component
// =============================================================================

/**
 * AdminInput - A styled input component for the admin interface.
 *
 * @example
 * ```typescript
 * new AdminInput({
 *   label: "Email",
 *   name: "email",
 *   type: "email",
 *   required: true,
 *   oninput: (e) => console.log(e.target.value),
 * });
 * ```
 */
export class AdminInput extends HTMLPropsMixin(HTMLElement, {
  /** Input label text */
  label: prop(""),
  /** Input name attribute */
  name: prop(""),
  /** Input type */
  type: prop<InputType>("text"),
  /** Current value */
  value: prop<string | number>(""),
  /** Placeholder text */
  placeholder: prop(""),
  /** Whether the field is required */
  required: prop(false),
  /** Whether the field is disabled */
  disabled: prop(false),
  /** Whether the field is readonly */
  readonly: prop(false),
  /** Maximum length for text inputs */
  maxLength: prop<number | null>(null),
  /** Minimum value for number inputs */
  min: prop<number | null>(null),
  /** Maximum value for number inputs */
  max: prop<number | null>(null),
  /** Step value for number inputs */
  step: prop<number | string | null>(null),
  /** Help text shown below the input */
  helpText: prop(""),
  /** Error message to display */
  error: prop(""),
  /** Autocomplete attribute */
  autocomplete: prop(""),
  /** Pattern for validation */
  pattern: prop(""),
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

    .admin-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #cccccc;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #333333;
      background-color: #ffffff;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      box-sizing: border-box;
    }

    .admin-input::placeholder {
      color: #999999;
    }

    .admin-input:hover:not(:disabled):not(:focus) {
      border-color: #999999;
    }

    .admin-input:focus {
      outline: none;
      border-color: #417690;
      box-shadow: 0 0 0 2px rgba(65, 118, 144, 0.2);
    }

    .admin-input:disabled {
      background-color: #f8f8f8;
      color: #999999;
      cursor: not-allowed;
    }

    .admin-input:read-only {
      background-color: #f8f8f8;
    }

    .admin-input-error {
      border-color: #ba2121;
    }

    .admin-input-error:focus {
      border-color: #ba2121;
      box-shadow: 0 0 0 2px rgba(186, 33, 33, 0.2);
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

    /* Remove spinners from number inputs by default */
    .admin-input[type="number"] {
      -moz-appearance: textfield;
    }

    .admin-input[type="number"]::-webkit-outer-spin-button,
    .admin-input[type="number"]::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminInput.styles;

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
      label.htmlFor = `input-${this.name}`;
      label.textContent = this.label;
      wrapper.appendChild(label);
    }

    // Input
    const input = document.createElement("input");
    input.className = "admin-input";
    input.id = `input-${this.name}`;
    input.type = this.type;
    input.name = this.name;
    input.value = String(this.value ?? "");
    input.placeholder = this.placeholder;
    input.required = this.required;
    input.disabled = this.disabled;
    input.readOnly = this.readonly;

    if (this.maxLength !== null) {
      input.maxLength = this.maxLength;
    }

    if (this.min !== null) {
      input.min = String(this.min);
    }

    if (this.max !== null) {
      input.max = String(this.max);
    }

    if (this.step !== null) {
      input.step = String(this.step);
    }

    if (this.autocomplete) {
      input.setAttribute("autocomplete", this.autocomplete);
    }

    if (this.pattern) {
      input.pattern = this.pattern;
    }

    if (this.error) {
      input.classList.add("admin-input-error");
    }

    // Event listeners
    input.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      this.dispatchEvent(
        new CustomEvent("admin-input", {
          bubbles: true,
          composed: true,
          detail: {
            value: this.type === "number" ? target.valueAsNumber : target.value,
            name: this.name,
          },
        }),
      );
    });

    input.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      this.dispatchEvent(
        new CustomEvent("admin-change", {
          bubbles: true,
          composed: true,
          detail: {
            value: this.type === "number" ? target.valueAsNumber : target.value,
            name: this.name,
          },
        }),
      );
    });

    input.addEventListener("blur", () => {
      this.dispatchEvent(
        new CustomEvent("admin-blur", {
          bubbles: true,
          composed: true,
          detail: { name: this.name },
        }),
      );
    });

    wrapper.appendChild(input);

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
   * Focus the input element
   */
  focus(): void {
    const input = this.shadowRoot?.querySelector("input");
    input?.focus();
  }

  /**
   * Get the current input value
   */
  getValue(): string | number {
    const input = this.shadowRoot?.querySelector("input");
    if (!input) return "";

    if (this.type === "number") {
      return input.valueAsNumber;
    }
    return input.value;
  }

  /**
   * Set the input value
   */
  setValue(value: string | number): void {
    const input = this.shadowRoot?.querySelector("input");
    if (input) {
      input.value = String(value);
    }
  }

  /**
   * Clear the input
   */
  clear(): void {
    const input = this.shadowRoot?.querySelector("input");
    if (input) {
      input.value = "";
    }
  }
}

// Register the custom element
AdminInput.define("admin-input");
