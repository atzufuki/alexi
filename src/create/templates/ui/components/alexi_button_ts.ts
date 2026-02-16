/**
 * UI components/alexi_button.ts template generator
 *
 * Generates the AlexiButton component that implements the Alexi Design System.
 *
 * @module @alexi/create/templates/ui/components/alexi_button_ts
 */

/**
 * Generate components/alexi_button.ts content for the UI app
 */
export function generateAlexiButtonTs(): string {
  return `/**
 * Alexi Button Component
 *
 * A playful, bouncy button implementing the Alexi Design System.
 *
 * @module components/alexi_button
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

/**
 * Button variant types
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger";

/**
 * Button size types
 */
export type ButtonSize = "sm" | "md" | "lg";

/**
 * AlexiButton - A styled button component
 *
 * @example
 * \`\`\`typescript
 * new AlexiButton({
 *   variant: "primary",
 *   size: "md",
 *   content: ["Click me"],
 *   onclick: () => console.log("Clicked!"),
 * });
 * \`\`\`
 */
export class AlexiButton extends HTMLPropsMixin(HTMLElement, {
  /** Button style variant */
  variant: prop<ButtonVariant>("primary"),
  /** Button size */
  size: prop<ButtonSize>("md"),
  /** Disabled state */
  disabled: prop(false),
  /** Button type (submit, button, reset) */
  type: prop<"submit" | "button" | "reset">("button"),
}) {
  override connectedCallback(): void {
    this.attachShadow({ mode: "open" });
    super.connectedCallback();
  }

  override render(): Node {
    const button = document.createElement("button");
    button.type = this.type;
    button.disabled = this.disabled;
    button.className = this.getButtonClasses();

    // Create slot for content
    const slot = document.createElement("slot");
    button.appendChild(slot);

    // Add styles
    const style = document.createElement("style");
    style.textContent = this.getStyles();

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(button);

    return fragment;
  }

  private getButtonClasses(): string {
    const classes = ["alexi-btn"];
    classes.push(\`alexi-btn-\${this.variant}\`);
    classes.push(\`alexi-btn-\${this.size}\`);
    return classes.join(" ");
  }

  private getStyles(): string {
    return \`
      /* Import fonts */
      @import url("https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap");

      :host {
        display: inline-block;
      }

      /* Base button styles */
      .alexi-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        font-family: "Nunito", system-ui, -apple-system, sans-serif;
        font-weight: 600;
        line-height: 1;
        text-decoration: none;
        border: 2px solid transparent;
        border-radius: 1rem;
        cursor: pointer;
        transition: all 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
        user-select: none;
        white-space: nowrap;
        position: relative;
        overflow: hidden;
      }

      .alexi-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.4);
      }

      .alexi-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
      }

      .alexi-btn:active:not(:disabled) {
        transform: scale(0.96);
      }

      /* Size variants */
      .alexi-btn-sm {
        padding: 0.5rem 1rem;
        font-size: 0.75rem;
        border-radius: 0.75rem;
      }

      .alexi-btn-md {
        padding: 0.75rem 1.25rem;
        font-size: 0.875rem;
      }

      .alexi-btn-lg {
        padding: 1rem 1.75rem;
        font-size: 1rem;
        border-radius: 1.25rem;
      }

      /* Primary button */
      .alexi-btn-primary {
        background: linear-gradient(135deg, #10b981, #059669);
        color: #ffffff;
        box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.15), 0 2px 0 #047857;
      }

      .alexi-btn-primary:hover:not(:disabled) {
        background: linear-gradient(135deg, #34d399, #10b981);
        transform: translateY(-2px);
        box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.2), 0 4px 0 #047857;
      }

      .alexi-btn-primary:active:not(:disabled) {
        transform: translateY(0) scale(0.98);
        box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.15), 0 1px 0 #047857;
      }

      /* Secondary button */
      .alexi-btn-secondary {
        background: #ffffff;
        color: #059669;
        border-color: #d4d4d8;
        box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.15);
      }

      .alexi-btn-secondary:hover:not(:disabled) {
        background: #d1fae5;
        border-color: #059669;
        transform: translateY(-2px);
        box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.2);
      }

      /* Ghost button */
      .alexi-btn-ghost {
        background: transparent;
        color: #059669;
        border-color: transparent;
      }

      .alexi-btn-ghost:hover:not(:disabled) {
        background: #d1fae5;
      }

      /* Accent button */
      .alexi-btn-accent {
        background: linear-gradient(135deg, #7e57c2, #673ab7);
        color: #ffffff;
        box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.15), 0 2px 0 #512da8;
      }

      .alexi-btn-accent:hover:not(:disabled) {
        background: linear-gradient(135deg, #b39ddb, #7e57c2);
        transform: translateY(-2px);
        box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.2), 0 4px 0 #512da8;
      }

      .alexi-btn-accent:active:not(:disabled) {
        transform: translateY(0) scale(0.98);
        box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.15), 0 1px 0 #512da8;
      }

      /* Danger button */
      .alexi-btn-danger {
        background: linear-gradient(135deg, #fb7185, #f43f5e);
        color: #ffffff;
        box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.15), 0 2px 0 #be123c;
      }

      .alexi-btn-danger:hover:not(:disabled) {
        background: linear-gradient(135deg, #fda4af, #fb7185);
        transform: translateY(-2px);
        box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.2), 0 4px 0 #be123c;
      }

      .alexi-btn-danger:active:not(:disabled) {
        transform: translateY(0) scale(0.98);
        box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.15), 0 1px 0 #be123c;
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .alexi-btn-secondary {
          background: #27272a;
          color: #34d399;
          border-color: #3f3f46;
        }

        .alexi-btn-secondary:hover:not(:disabled) {
          background: #064e3b;
          border-color: #10b981;
        }

        .alexi-btn-ghost {
          color: #34d399;
        }

        .alexi-btn-ghost:hover:not(:disabled) {
          background: #064e3b;
        }
      }
    \`;
  }
}

// Register the custom element
AlexiButton.define("alexi-button");
`;
}
