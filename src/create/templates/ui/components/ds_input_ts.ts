/**
 * UI components/ds_input.ts template generator
 *
 * Generates the DSInput component that implements the Alexi Design System.
 *
 * @module @alexi/create/templates/ui/components/ds_input_ts
 */

/**
 * Generate components/ds_input.ts content for the UI app
 */
export function generateDSInputTs(): string {
  return `/**
 * Design System Input Component
 *
 * A styled text input implementing the Alexi Design System.
 *
 * @module components/ds_input
 */

import { HTMLPropsMixin, prop, ref } from "@html-props/core";
import { Div, Input, Label, Span, Style } from "@html-props/built-ins";

/**
 * Input size types
 */
export type InputSize = "sm" | "md" | "lg";

/**
 * DSInput - A styled text input component
 *
 * @example
 * \`\`\`typescript
 * new DSInput({
 *   label: "Email",
 *   placeholder: "Enter your email",
 *   type: "email",
 *   size: "md",
 *   oninput: (e) => console.log(e.target.value),
 * });
 * \`\`\`
 */
export class DSInput extends HTMLPropsMixin(HTMLElement, {
  /** Input label */
  label: prop(""),
  /** Placeholder text */
  placeholder: prop(""),
  /** Input type */
  type: prop<"text" | "email" | "password" | "search" | "tel" | "url" | "number">("text"),
  /** Input size */
  size: prop<InputSize>("md"),
  /** Current value */
  value: prop(""),
  /** Disabled state */
  disabled: prop(false),
  /** Required field */
  required: prop(false),
  /** Error message */
  error: prop(""),
  /** Helper text */
  helper: prop(""),
}) {
  private inputRef = ref<HTMLInputElement>(null);
  private isHandlingInput = false;
  private lastPropValue = "";

  override connectedCallback(): void {
    this.attachShadow({ mode: "open" });
    super.connectedCallback();
  }

  override mountedCallback(): void {
    if (this.inputRef.current && this.value) {
      this.inputRef.current.value = this.value;
      this.lastPropValue = this.value;
    }
  }

  override requestUpdate(): void {
    if (!this.isHandlingInput && this.inputRef.current) {
      if (this.value !== this.lastPropValue) {
        this.inputRef.current.value = this.value;
        this.lastPropValue = this.value;
      }
    }
    super.requestUpdate();
  }

  private handleInput = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    this.isHandlingInput = true;
    this.value = target.value;
    this.lastPropValue = target.value;
    this.dispatchEvent(new CustomEvent("input", { detail: { value: target.value }, bubbles: true }));
    this.isHandlingInput = false;
  };

  private handleChange = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    this.dispatchEvent(new CustomEvent("change", { detail: { value: target.value }, bubbles: true }));
  };

  override render(): Node[] {
    return [
      new Style({ textContent: INPUT_STYLES }),
      new Div({
        className: \`ds-input-wrapper ds-input-\${this.size}\${this.error ? " ds-input-error" : ""}\${this.disabled ? " ds-input-disabled" : ""}\`,
        content: [
          ...(this.label
            ? [
                new Label({
                  className: "ds-input-label",
                  content: [
                    this.label,
                    ...(this.required ? [new Span({ className: "ds-input-required", textContent: " *" })] : []),
                  ],
                }),
              ]
            : []),
          new Input({
            ref: this.inputRef,
            type: this.type,
            placeholder: this.placeholder,
            disabled: this.disabled,
            required: this.required,
            className: "ds-input",
            oninput: this.handleInput,
            onchange: this.handleChange,
          }),
          ...(this.error
            ? [new Span({ className: "ds-input-error-text", textContent: this.error })]
            : this.helper
              ? [new Span({ className: "ds-input-helper", textContent: this.helper })]
              : []),
        ],
      }),
    ];
  }
}

// Register the custom element
DSInput.define("ds-input");

/**
 * Input component styles
 */
const INPUT_STYLES = \`
  @import url("https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap");

  :host {
    display: block;
    width: 100%;
  }

  .ds-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    width: 100%;
    font-family: "Nunito", system-ui, -apple-system, sans-serif;
  }

  .ds-input-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #3f3f46;
  }

  .ds-input-required {
    color: #f43f5e;
  }

  .ds-input {
    width: 100%;
    box-sizing: border-box;
    border: 2px solid #e4e4e7;
    border-radius: 0.75rem;
    font-family: inherit;
    font-size: 1rem;
    color: #18181b;
    background: #ffffff;
    transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ds-input:hover:not(:disabled) {
    border-color: #d4d4d8;
  }

  .ds-input:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  }

  .ds-input::placeholder {
    color: #a1a1aa;
  }

  .ds-input:disabled {
    background: #f4f4f5;
    color: #a1a1aa;
    cursor: not-allowed;
  }

  /* Size variants */
  .ds-input-sm .ds-input {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border-radius: 0.5rem;
  }

  .ds-input-md .ds-input {
    padding: 0.75rem 1rem;
    font-size: 1rem;
  }

  .ds-input-lg .ds-input {
    padding: 1rem 1.25rem;
    font-size: 1.125rem;
    border-radius: 1rem;
  }

  /* Error state */
  .ds-input-error .ds-input {
    border-color: #f43f5e;
  }

  .ds-input-error .ds-input:focus {
    border-color: #f43f5e;
    box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.2);
  }

  .ds-input-error-text {
    font-size: 0.75rem;
    color: #f43f5e;
  }

  .ds-input-helper {
    font-size: 0.75rem;
    color: #71717a;
  }

  /* Disabled state */
  .ds-input-disabled .ds-input-label {
    color: #a1a1aa;
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .ds-input-label {
      color: #d4d4d8;
    }

    .ds-input {
      background: #27272a;
      border-color: #3f3f46;
      color: #fafafa;
    }

    .ds-input:hover:not(:disabled) {
      border-color: #52525b;
    }

    .ds-input:focus {
      border-color: #34d399;
      box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.2);
    }

    .ds-input::placeholder {
      color: #71717a;
    }

    .ds-input:disabled {
      background: #18181b;
      color: #52525b;
    }

    .ds-input-helper {
      color: #a1a1aa;
    }

    .ds-input-disabled .ds-input-label {
      color: #52525b;
    }
  }
\`;
`;
}
