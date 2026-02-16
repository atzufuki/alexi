/**
 * UI components/ds_checkbox.ts template generator
 *
 * Generates the DSCheckbox component that implements the Alexi Design System.
 *
 * @module @alexi/create/templates/ui/components/ds_checkbox_ts
 */

/**
 * Generate components/ds_checkbox.ts content for the UI app
 */
export function generateDSCheckboxTs(): string {
  return `/**
 * Design System Checkbox Component
 *
 * A styled checkbox implementing the Alexi Design System.
 *
 * @module components/ds_checkbox
 */

import { HTMLPropsMixin, prop, ref } from "@html-props/core";
import { Div, Input, Label, Span, Style } from "@html-props/built-ins";

/**
 * Checkbox size types
 */
export type CheckboxSize = "sm" | "md" | "lg";

/**
 * DSCheckbox - A styled checkbox component
 *
 * @example
 * \`\`\`typescript
 * new DSCheckbox({
 *   label: "Accept terms",
 *   checked: false,
 *   onchange: (e) => console.log(e.detail.checked),
 * });
 * \`\`\`
 */
export class DSCheckbox extends HTMLPropsMixin(HTMLElement, {
  /** Checkbox label */
  label: prop(""),
  /** Checked state */
  checked: prop(false),
  /** Checkbox size */
  size: prop<CheckboxSize>("md"),
  /** Disabled state */
  disabled: prop(false),
}) {
  private inputRef = ref<HTMLInputElement>(null);

  override connectedCallback(): void {
    this.attachShadow({ mode: "open" });
    super.connectedCallback();
  }

  override mountedCallback(): void {
    if (this.inputRef.current) {
      this.inputRef.current.checked = this.checked;
    }
  }

  override requestUpdate(): void {
    if (this.inputRef.current) {
      this.inputRef.current.checked = this.checked;
    }
    super.requestUpdate();
  }

  private handleChange = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    this.checked = target.checked;
    this.dispatchEvent(new CustomEvent("change", { detail: { checked: target.checked }, bubbles: true }));
  };

  override render(): Node[] {
    return [
      new Style({ textContent: CHECKBOX_STYLES }),
      new Label({
        className: \`ds-checkbox-wrapper ds-checkbox-\${this.size}\${this.disabled ? " ds-checkbox-disabled" : ""}\`,
        content: [
          new Div({
            className: "ds-checkbox-box",
            content: [
              new Input({
                ref: this.inputRef,
                type: "checkbox",
                disabled: this.disabled,
                className: "ds-checkbox-input",
                onchange: this.handleChange,
              }),
              new Div({
                className: "ds-checkbox-checkmark",
                content: [
                  new Span({ className: "ds-checkbox-icon", textContent: "✓" }),
                ],
              }),
            ],
          }),
          ...(this.label ? [new Span({ className: "ds-checkbox-label", textContent: this.label })] : []),
        ],
      }),
    ];
  }
}

// Register the custom element
DSCheckbox.define("ds-checkbox");

/**
 * Checkbox component styles
 */
const CHECKBOX_STYLES = \`
  @import url("https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap");

  :host {
    display: inline-block;
  }

  .ds-checkbox-wrapper {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-family: "Nunito", system-ui, -apple-system, sans-serif;
    user-select: none;
  }

  .ds-checkbox-box {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ds-checkbox-input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    margin: 0;
  }

  .ds-checkbox-checkmark {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #d4d4d8;
    border-radius: 0.375rem;
    background: #ffffff;
    transition: all 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .ds-checkbox-icon {
    opacity: 0;
    color: #ffffff;
    font-weight: 700;
    transform: scale(0);
    transition: all 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* Checked state */
  .ds-checkbox-input:checked + .ds-checkbox-checkmark {
    background: linear-gradient(135deg, #10b981, #059669);
    border-color: #059669;
  }

  .ds-checkbox-input:checked + .ds-checkbox-checkmark .ds-checkbox-icon {
    opacity: 1;
    transform: scale(1);
  }

  /* Focus state */
  .ds-checkbox-input:focus-visible + .ds-checkbox-checkmark {
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.4);
  }

  /* Hover state */
  .ds-checkbox-wrapper:hover .ds-checkbox-checkmark {
    border-color: #a1a1aa;
  }

  .ds-checkbox-wrapper:hover .ds-checkbox-input:checked + .ds-checkbox-checkmark {
    background: linear-gradient(135deg, #34d399, #10b981);
    border-color: #10b981;
  }

  /* Size variants */
  .ds-checkbox-sm .ds-checkbox-checkmark {
    width: 1rem;
    height: 1rem;
    border-radius: 0.25rem;
  }

  .ds-checkbox-sm .ds-checkbox-icon {
    font-size: 0.625rem;
  }

  .ds-checkbox-sm .ds-checkbox-label {
    font-size: 0.875rem;
  }

  .ds-checkbox-md .ds-checkbox-checkmark {
    width: 1.25rem;
    height: 1.25rem;
  }

  .ds-checkbox-md .ds-checkbox-icon {
    font-size: 0.75rem;
  }

  .ds-checkbox-md .ds-checkbox-label {
    font-size: 1rem;
  }

  .ds-checkbox-lg .ds-checkbox-checkmark {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.5rem;
  }

  .ds-checkbox-lg .ds-checkbox-icon {
    font-size: 0.875rem;
  }

  .ds-checkbox-lg .ds-checkbox-label {
    font-size: 1.125rem;
  }

  /* Label */
  .ds-checkbox-label {
    color: #3f3f46;
    font-weight: 500;
  }

  /* Disabled state */
  .ds-checkbox-disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .ds-checkbox-disabled .ds-checkbox-input {
    cursor: not-allowed;
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .ds-checkbox-checkmark {
      background: #27272a;
      border-color: #52525b;
    }

    .ds-checkbox-wrapper:hover .ds-checkbox-checkmark {
      border-color: #71717a;
    }

    .ds-checkbox-input:checked + .ds-checkbox-checkmark {
      background: linear-gradient(135deg, #34d399, #10b981);
      border-color: #10b981;
    }

    .ds-checkbox-input:focus-visible + .ds-checkbox-checkmark {
      box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.3);
    }

    .ds-checkbox-label {
      color: #d4d4d8;
    }
  }
\`;
`;
}
