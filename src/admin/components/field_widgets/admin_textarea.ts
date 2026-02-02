/**
 * AdminTextarea component for Alexi Admin
 *
 * A styled textarea component for multi-line text fields.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// AdminTextarea Component
// =============================================================================

/**
 * AdminTextarea - A styled textarea component for the admin interface.
 *
 * @example
 * ```typescript
 * new AdminTextarea({
 *   label: "Description",
 *   name: "description",
 *   value: "Some text...",
 *   rows: 5,
 *   oninput: (e) => console.log(e.detail.value),
 * });
 * ```
 */
export class AdminTextarea extends HTMLPropsMixin(HTMLElement, {
  /** Textarea label text */
  label: prop(""),
  /** Input name attribute */
  name: prop(""),
  /** Current value */
  value: prop(""),
  /** Placeholder text */
  placeholder: prop(""),
  /** Whether the field is required */
  required: prop(false),
  /** Whether the field is disabled */
  disabled: prop(false),
  /** Whether the field is readonly */
  readonly: prop(false),
  /** Number of visible text rows */
  rows: prop(4),
  /** Number of visible text columns */
  cols: prop<number | null>(null),
  /** Maximum length of text */
  maxLength: prop<number | null>(null),
  /** Minimum length of text */
  minLength: prop<number | null>(null),
  /** Help text shown below the textarea */
  helpText: prop(""),
  /** Error message to display */
  error: prop(""),
  /** Resize behavior */
  resize: prop<"none" | "vertical" | "horizontal" | "both">("vertical"),
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

    .admin-textarea {
      width: 100%;
      min-height: 80px;
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

    .admin-textarea::placeholder {
      color: #999999;
    }

    .admin-textarea:hover:not(:disabled):not(:focus) {
      border-color: #999999;
    }

    .admin-textarea:focus {
      outline: none;
      border-color: #417690;
      box-shadow: 0 0 0 2px rgba(65, 118, 144, 0.2);
    }

    .admin-textarea:disabled {
      background-color: #f8f8f8;
      color: #999999;
      cursor: not-allowed;
    }

    .admin-textarea:read-only {
      background-color: #f8f8f8;
    }

    .admin-textarea-error {
      border-color: #ba2121;
    }

    .admin-textarea-error:focus {
      border-color: #ba2121;
      box-shadow: 0 0 0 2px rgba(186, 33, 33, 0.2);
    }

    .admin-textarea-resize-none {
      resize: none;
    }

    .admin-textarea-resize-vertical {
      resize: vertical;
    }

    .admin-textarea-resize-horizontal {
      resize: horizontal;
    }

    .admin-textarea-resize-both {
      resize: both;
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

    .admin-char-count {
      font-size: 11px;
      color: #999999;
      text-align: right;
      margin-top: 2px;
    }

    .admin-char-count-warning {
      color: #cc9900;
    }

    .admin-char-count-error {
      color: #ba2121;
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminTextarea.styles;

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
      label.htmlFor = `textarea-${this.name}`;
      label.textContent = this.label;
      wrapper.appendChild(label);
    }

    // Textarea
    const textarea = document.createElement("textarea");
    textarea.className = `admin-textarea admin-textarea-resize-${this.resize}`;
    textarea.id = `textarea-${this.name}`;
    textarea.name = this.name;
    textarea.value = this.value ?? "";
    textarea.placeholder = this.placeholder;
    textarea.required = this.required;
    textarea.disabled = this.disabled;
    textarea.readOnly = this.readonly;
    textarea.rows = this.rows;

    if (this.cols !== null) {
      textarea.cols = this.cols;
    }

    if (this.maxLength !== null) {
      textarea.maxLength = this.maxLength;
    }

    if (this.minLength !== null) {
      textarea.minLength = this.minLength;
    }

    if (this.error) {
      textarea.classList.add("admin-textarea-error");
    }

    // Character count element (for maxLength)
    let charCountEl: HTMLDivElement | null = null;
    if (this.maxLength !== null) {
      charCountEl = document.createElement("div");
      charCountEl.className = "admin-char-count";
      this._updateCharCount(charCountEl, this.value?.length ?? 0);
    }

    // Event listeners
    textarea.addEventListener("input", (e) => {
      const target = e.target as HTMLTextAreaElement;

      // Update character count
      if (charCountEl) {
        this._updateCharCount(charCountEl, target.value.length);
      }

      this.dispatchEvent(
        new CustomEvent("admin-input", {
          bubbles: true,
          composed: true,
          detail: {
            value: target.value,
            name: this.name,
          },
        }),
      );
    });

    textarea.addEventListener("change", (e) => {
      const target = e.target as HTMLTextAreaElement;
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
    });

    textarea.addEventListener("blur", () => {
      this.dispatchEvent(
        new CustomEvent("admin-blur", {
          bubbles: true,
          composed: true,
          detail: { name: this.name },
        }),
      );
    });

    wrapper.appendChild(textarea);

    // Character count
    if (charCountEl) {
      wrapper.appendChild(charCountEl);
    }

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

  private _updateCharCount(el: HTMLDivElement, currentLength: number): void {
    if (this.maxLength === null) return;

    el.textContent = `${currentLength} / ${this.maxLength}`;

    // Update styling based on how close to limit
    el.classList.remove("admin-char-count-warning", "admin-char-count-error");

    const percentage = currentLength / this.maxLength;
    if (percentage >= 1) {
      el.classList.add("admin-char-count-error");
    } else if (percentage >= 0.9) {
      el.classList.add("admin-char-count-warning");
    }
  }

  mountedCallback(): void {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }

  /**
   * Focus the textarea element
   */
  focus(): void {
    const textarea = this.shadowRoot?.querySelector("textarea");
    textarea?.focus();
  }

  /**
   * Get the current textarea value
   */
  getValue(): string {
    const textarea = this.shadowRoot?.querySelector("textarea");
    return textarea?.value ?? "";
  }

  /**
   * Set the textarea value
   */
  setValue(value: string): void {
    const textarea = this.shadowRoot?.querySelector("textarea");
    if (textarea) {
      textarea.value = value;

      // Update character count if present
      const charCountEl = this.shadowRoot?.querySelector(
        ".admin-char-count",
      ) as HTMLDivElement | null;
      if (charCountEl) {
        this._updateCharCount(charCountEl, value.length);
      }
    }
  }

  /**
   * Clear the textarea
   */
  clear(): void {
    this.setValue("");
  }

  /**
   * Select all text in the textarea
   */
  selectAll(): void {
    const textarea = this.shadowRoot?.querySelector("textarea");
    if (textarea) {
      textarea.select();
    }
  }
}

// Register the custom element
AdminTextarea.define("admin-textarea");
