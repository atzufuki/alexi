/**
 * UI components/ds_text.ts template generator
 *
 * Generates the DSText typography component for the Alexi Design System.
 *
 * @module @alexi/create/templates/ui/components/ds_text_ts
 */

/**
 * Generate components/ds_text.ts content for the UI app
 */
export function generateDSTextTs(): string {
  return `/**
 * Design System Text Component
 *
 * Typography component implementing the Alexi Design System.
 *
 * @module components/ds_text
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import { Slot, Style } from "@html-props/built-ins";

/**
 * Text variant types
 */
export type TextVariant =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "body"
  | "body-lg"
  | "body-sm"
  | "caption"
  | "label"
  | "overline";

/**
 * Text color types
 */
export type TextColor = "default" | "secondary" | "muted" | "primary" | "accent" | "success" | "warning" | "error";

/**
 * Text weight types
 */
export type TextWeight = "normal" | "medium" | "semibold" | "bold" | "extrabold";

/**
 * Text align types
 */
export type TextAlign = "left" | "center" | "right";

/**
 * DSText - A typography component
 *
 * @example
 * \\\`\\\`\\\`typescript
 * new DSText({
 *   variant: "h1",
 *   color: "primary",
 *   content: ["Hello World"],
 * });
 * \\\`\\\`\\\`
 */
export class DSText extends HTMLPropsMixin(HTMLElement, {
  /** Typography variant */
  variant: prop<TextVariant>("body"),
  /** Text color */
  color: prop<TextColor>("default"),
  /** Font weight override */
  weight: prop<TextWeight | null>(null),
  /** Text alignment */
  align: prop<TextAlign>("left"),
  /** Whether to use gradient effect (for headings) */
  gradient: prop(false),
  /** Whether to truncate with ellipsis */
  truncate: prop(false),
}) {
  override connectedCallback(): void {
    this.attachShadow({ mode: "open" });
    super.connectedCallback();
  }

  override render(): Node[] {
    const element = document.createElement(this.getTag());
    element.className = this.getClasses();

    const slot = document.createElement("slot");
    element.appendChild(slot);

    const style = document.createElement("style");
    style.textContent = TEXT_STYLES;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(element);

    return [fragment];
  }

  private getTag(): string {
    switch (this.variant) {
      case "h1": return "h1";
      case "h2": return "h2";
      case "h3": return "h3";
      case "h4": return "h4";
      case "h5": return "h5";
      case "h6": return "h6";
      case "caption":
      case "overline":
        return "span";
      default: return "p";
    }
  }

  private getClasses(): string {
    const classes = ["ds-text", \`ds-text-\${this.variant}\`];

    if (this.color !== "default") {
      classes.push(\`ds-text-\${this.color}\`);
    }

    if (this.weight) {
      classes.push(\`ds-text-\${this.weight}\`);
    }

    if (this.align !== "left") {
      classes.push(\`ds-text-\${this.align}\`);
    }

    if (this.gradient) {
      classes.push("ds-text-gradient");
    }

    if (this.truncate) {
      classes.push("ds-text-truncate");
    }

    return classes.join(" ");
  }
}

// Register the custom element
DSText.define("ds-text");

/**
 * Typography styles
 */
const TEXT_STYLES = \`
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap");

  :host {
    display: block;
    --ds-text: #18181b;
    --ds-text-secondary: #52525b;
    --ds-text-muted: #a1a1aa;
    --ds-primary: #059669;
    --ds-primary-light: #34d399;
    --ds-accent: #673ab7;
    --ds-accent-light: #7e57c2;
    --ds-success: #10b981;
    --ds-warning: #f59e0b;
    --ds-error: #f43f5e;
  }

  .ds-text {
    margin: 0;
    font-family: "Nunito", system-ui, -apple-system, sans-serif;
    color: var(--ds-text);
    line-height: 1.5;
  }

  /* Heading variants - use display font */
  .ds-text-h1,
  .ds-text-h2,
  .ds-text-h3,
  .ds-text-h4,
  .ds-text-h5,
  .ds-text-h6 {
    font-family: "Fredoka", system-ui, sans-serif;
    line-height: 1.2;
  }

  .ds-text-h1 {
    font-size: 2.5rem;
    font-weight: 600;
  }

  .ds-text-h2 {
    font-size: 2rem;
    font-weight: 600;
  }

  .ds-text-h3 {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .ds-text-h4 {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .ds-text-h5 {
    font-size: 1.125rem;
    font-weight: 600;
  }

  .ds-text-h6 {
    font-size: 1rem;
    font-weight: 600;
  }

  /* Body variants */
  .ds-text-body {
    font-size: 1rem;
  }

  .ds-text-body-lg {
    font-size: 1.125rem;
  }

  .ds-text-body-sm {
    font-size: 0.875rem;
  }

  /* Caption */
  .ds-text-caption {
    font-size: 0.75rem;
    color: var(--ds-text-muted);
  }

  /* Label */
  .ds-text-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ds-text-secondary);
  }

  /* Overline */
  .ds-text-overline {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ds-text-muted);
  }

  /* Colors */
  .ds-text-secondary {
    color: var(--ds-text-secondary);
  }

  .ds-text-muted {
    color: var(--ds-text-muted);
  }

  .ds-text-primary {
    color: var(--ds-primary);
  }

  .ds-text-accent {
    color: var(--ds-accent);
  }

  .ds-text-success {
    color: var(--ds-success);
  }

  .ds-text-warning {
    color: var(--ds-warning);
  }

  .ds-text-error {
    color: var(--ds-error);
  }

  /* Weights */
  .ds-text-normal {
    font-weight: 400;
  }

  .ds-text-medium {
    font-weight: 500;
  }

  .ds-text-semibold {
    font-weight: 600;
  }

  .ds-text-bold {
    font-weight: 700;
  }

  .ds-text-extrabold {
    font-weight: 800;
  }

  /* Alignment */
  .ds-text-center {
    text-align: center;
  }

  .ds-text-right {
    text-align: right;
  }

  /* Gradient effect */
  .ds-text-gradient {
    background: linear-gradient(135deg, var(--ds-primary-light), var(--ds-accent-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Truncate */
  .ds-text-truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    :host {
      --ds-text: #fafafa;
      --ds-text-secondary: #a1a1aa;
      --ds-text-muted: #71717a;
      --ds-primary: #34d399;
      --ds-primary-light: #6ee7b7;
      --ds-accent-light: #b39ddb;
    }
  }

  :host-context([data-theme="dark"]) {
    --ds-text: #fafafa;
    --ds-text-secondary: #a1a1aa;
    --ds-text-muted: #71717a;
    --ds-primary: #34d399;
    --ds-primary-light: #6ee7b7;
    --ds-accent-light: #b39ddb;
  }

  :host-context([data-theme="light"]) {
    --ds-text: #18181b;
    --ds-text-secondary: #52525b;
    --ds-text-muted: #a1a1aa;
    --ds-primary: #059669;
    --ds-primary-light: #34d399;
    --ds-accent-light: #7e57c2;
  }
\`;
`;
}
