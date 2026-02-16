/**
 * UI components/ds_card.ts template generator
 *
 * Generates the DSCard component for the Alexi Design System.
 *
 * @module @alexi/create/templates/ui/components/ds_card_ts
 */

/**
 * Generate components/ds_card.ts content for the UI app
 */
export function generateDSCardTs(): string {
  return `/**
 * Design System Card Component
 *
 * A styled card container implementing the Alexi Design System.
 *
 * @module components/ds_card
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import { Slot, Style } from "@html-props/built-ins";

/**
 * Card variant types
 */
export type CardVariant = "default" | "outlined" | "elevated" | "filled";

/**
 * Card padding types
 */
export type CardPadding = "none" | "sm" | "md" | "lg" | "xl";

/**
 * DSCard - A styled card container component
 *
 * @example
 * \\\`\\\`\\\`typescript
 * new DSCard({
 *   variant: "elevated",
 *   padding: "lg",
 *   content: [new DSText({ variant: "h3", content: ["Card Title"] })],
 * });
 * \\\`\\\`\\\`
 */
export class DSCard extends HTMLPropsMixin(HTMLElement, {
  /** Card style variant */
  variant: prop<CardVariant>("default"),
  /** Card padding */
  padding: prop<CardPadding>("md"),
  /** Interactive hover effect */
  interactive: prop(false),
  /** Full width */
  fullWidth: prop(false),
}) {
  override connectedCallback(): void {
    this.attachShadow({ mode: "open" });
    super.connectedCallback();
  }

  override render(): Node[] {
    const div = document.createElement("div");
    div.className = this.getClasses();

    const slot = document.createElement("slot");
    div.appendChild(slot);

    const style = document.createElement("style");
    style.textContent = CARD_STYLES;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(div);

    return [fragment];
  }

  private getClasses(): string {
    const classes = ["ds-card", \`ds-card-\${this.variant}\`, \`ds-card-p-\${this.padding}\`];

    if (this.interactive) {
      classes.push("ds-card-interactive");
    }

    if (this.fullWidth) {
      classes.push("ds-card-full-width");
    }

    return classes.join(" ");
  }
}

// Register the custom element
DSCard.define("ds-card");

/**
 * Card component styles
 */
const CARD_STYLES = \`
  :host {
    display: block;
    --ds-surface: #ffffff;
    --ds-surface-dim: #fafafa;
    --ds-border: #e4e4e7;
    --ds-shadow-sm: 0 2px 8px -2px rgba(0, 0, 0, 0.08);
    --ds-shadow-md: 0 4px 16px -4px rgba(0, 0, 0, 0.12);
    --ds-shadow-lg: 0 8px 24px -6px rgba(0, 0, 0, 0.16);
  }

  .ds-card {
    border-radius: 1rem;
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Variants */
  .ds-card-default {
    background: var(--ds-surface);
    border: 1px solid var(--ds-border);
    box-shadow: var(--ds-shadow-sm);
  }

  .ds-card-outlined {
    background: var(--ds-surface);
    border: 2px solid var(--ds-border);
  }

  .ds-card-elevated {
    background: var(--ds-surface);
    border: 1px solid transparent;
    box-shadow: var(--ds-shadow-md);
  }

  .ds-card-filled {
    background: var(--ds-surface-dim);
    border: 1px solid transparent;
  }

  /* Padding */
  .ds-card-p-none {
    padding: 0;
  }

  .ds-card-p-sm {
    padding: 0.75rem;
  }

  .ds-card-p-md {
    padding: 1.25rem;
  }

  .ds-card-p-lg {
    padding: 1.5rem;
  }

  .ds-card-p-xl {
    padding: 2rem;
  }

  /* Interactive */
  .ds-card-interactive {
    cursor: pointer;
  }

  .ds-card-interactive:hover {
    transform: translateY(-2px);
    box-shadow: var(--ds-shadow-lg);
  }

  .ds-card-interactive:active {
    transform: translateY(0);
    box-shadow: var(--ds-shadow-sm);
  }

  /* Full width */
  .ds-card-full-width {
    width: 100%;
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    :host {
      --ds-surface: #27272a;
      --ds-surface-dim: #18181b;
      --ds-border: #3f3f46;
      --ds-shadow-sm: 0 2px 8px -2px rgba(0, 0, 0, 0.3);
      --ds-shadow-md: 0 4px 16px -4px rgba(0, 0, 0, 0.4);
      --ds-shadow-lg: 0 8px 24px -6px rgba(0, 0, 0, 0.5);
    }
  }

  :host-context([data-theme="dark"]) {
    --ds-surface: #27272a;
    --ds-surface-dim: #18181b;
    --ds-border: #3f3f46;
    --ds-shadow-sm: 0 2px 8px -2px rgba(0, 0, 0, 0.3);
    --ds-shadow-md: 0 4px 16px -4px rgba(0, 0, 0, 0.4);
    --ds-shadow-lg: 0 8px 24px -6px rgba(0, 0, 0, 0.5);
  }

  :host-context([data-theme="light"]) {
    --ds-surface: #ffffff;
    --ds-surface-dim: #fafafa;
    --ds-border: #e4e4e7;
    --ds-shadow-sm: 0 2px 8px -2px rgba(0, 0, 0, 0.08);
    --ds-shadow-md: 0 4px 16px -4px rgba(0, 0, 0, 0.12);
    --ds-shadow-lg: 0 8px 24px -6px rgba(0, 0, 0, 0.16);
  }
\`;
`;
}
