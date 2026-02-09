/**
 * AdminButton component for Alexi Admin
 *
 * A simple button component following the admin styling.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// Types
// =============================================================================

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "success"
  | "link";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonType = "button" | "submit" | "reset";

// =============================================================================
// AdminButton Component
// =============================================================================

/**
 * AdminButton - A styled button component for the admin interface.
 *
 * @example
 * ```typescript
 * new AdminButton({
 *   variant: "primary",
 *   content: ["Save"],
 *   onclick: () => console.log("clicked"),
 * });
 * ```
 */
export class AdminButton extends HTMLPropsMixin(HTMLElement, {
  /** Button variant/style */
  variant: prop<ButtonVariant>("primary"),
  /** Button size */
  size: prop<ButtonSize>("md"),
  /** Button type attribute */
  type: prop<ButtonType>("button"),
  /** Whether the button is disabled */
  disabled: prop(false),
  /** Whether the button is in loading state */
  loading: prop(false),
  /** Icon to show before text (emoji or text) */
  icon: prop(""),
  /** Icon to show after text */
  iconEnd: prop(""),
}) {
  static styles = `
    :host {
      display: inline-block;
    }

    .admin-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      white-space: nowrap;
      text-decoration: none;
    }

    .admin-btn:focus {
      outline: 2px solid #417690;
      outline-offset: 2px;
    }

    .admin-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Primary */
    .admin-btn-primary {
      background-color: #417690;
      color: #ffffff;
    }

    .admin-btn-primary:hover:not(:disabled) {
      background-color: #205067;
    }

    /* Secondary */
    .admin-btn-secondary {
      background-color: #f8f8f8;
      color: #333333;
      border: 1px solid #cccccc;
    }

    .admin-btn-secondary:hover:not(:disabled) {
      background-color: #f0f0f0;
      border-color: #999999;
    }

    /* Danger */
    .admin-btn-danger {
      background-color: #ba2121;
      color: #ffffff;
    }

    .admin-btn-danger:hover:not(:disabled) {
      background-color: #a01c1c;
    }

    /* Success */
    .admin-btn-success {
      background-color: #44aa00;
      color: #ffffff;
    }

    .admin-btn-success:hover:not(:disabled) {
      background-color: #3a9000;
    }

    /* Link */
    .admin-btn-link {
      background: none;
      color: #417690;
      padding: 4px 8px;
    }

    .admin-btn-link:hover:not(:disabled) {
      color: #205067;
      text-decoration: underline;
    }

    /* Sizes */
    .admin-btn-sm {
      padding: 4px 8px;
      font-size: 12px;
    }

    .admin-btn-lg {
      padding: 12px 20px;
      font-size: 16px;
    }

    /* Loading state */
    .admin-btn-loading {
      position: relative;
      color: transparent !important;
    }

    .admin-btn-loading::after {
      content: "";
      position: absolute;
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: admin-btn-spin 0.8s linear infinite;
    }

    .admin-btn-primary.admin-btn-loading::after,
    .admin-btn-danger.admin-btn-loading::after,
    .admin-btn-success.admin-btn-loading::after {
      border-color: rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
    }

    @keyframes admin-btn-spin {
      to {
        transform: rotate(360deg);
      }
    }

    .admin-btn-icon {
      display: inline-flex;
      align-items: center;
      font-size: 1em;
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminButton.styles;

    const button = document.createElement("button");

    // Build class names
    const classes = ["admin-btn", `admin-btn-${this.variant}`];

    if (this.size !== "md") {
      classes.push(`admin-btn-${this.size}`);
    }

    if (this.loading) {
      classes.push("admin-btn-loading");
    }

    button.className = classes.join(" ");
    button.type = this.type;
    button.disabled = this.disabled || this.loading;

    // Add icon before text
    if (this.icon) {
      const iconSpan = document.createElement("span");
      iconSpan.className = "admin-btn-icon";
      iconSpan.textContent = this.icon;
      button.appendChild(iconSpan);
    }

    // Add slot for content
    const slot = document.createElement("slot");
    button.appendChild(slot);

    // Add icon after text
    if (this.iconEnd) {
      const iconSpan = document.createElement("span");
      iconSpan.className = "admin-btn-icon";
      iconSpan.textContent = this.iconEnd;
      button.appendChild(iconSpan);
    }

    // Forward click events (only when not disabled)
    button.addEventListener("click", (e) => {
      if (this.disabled || this.loading) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Dispatch custom event
      this.dispatchEvent(
        new CustomEvent("admin-click", {
          bubbles: true,
          composed: true,
          detail: { originalEvent: e },
        }),
      );
    });

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(button);

    return fragment;
  }

  mountedCallback(): void {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }
}

// Register the custom element
AdminButton.define("admin-button");
