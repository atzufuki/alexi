/**
 * UI components/ds_theme_toggle.ts template generator
 *
 * Generates the DSThemeToggle component for switching between light and dark themes.
 *
 * @module @alexi/create/templates/ui/components/ds_theme_toggle_ts
 */

/**
 * Generate components/ds_theme_toggle.ts content for the UI app
 */
export function generateDSThemeToggleTs(): string {
  return `/**
 * Design System Theme Toggle Component
 *
 * A toggle button for switching between light and dark themes.
 *
 * @module components/ds_theme_toggle
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import { Style } from "@html-props/built-ins";

/**
 * Theme type
 */
export type Theme = "light" | "dark" | "system";

/**
 * DSThemeToggle - A theme toggle button
 *
 * @example
 * \`\`\`typescript
 * new DSThemeToggle({
 *   theme: "system",
 *   onchange: (e) => console.log(e.detail.theme),
 * });
 * \`\`\`
 */
export class DSThemeToggle extends HTMLPropsMixin(HTMLElement, {
  /** Current theme */
  theme: prop<Theme>("system"),
}) {
  override connectedCallback(): void {
    this.attachShadow({ mode: "open" });
    super.connectedCallback();
  }

  override mountedCallback(): void {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem("alexi-theme") as Theme | null;
    if (savedTheme) {
      this.theme = savedTheme;
      this.applyTheme(savedTheme);
    } else {
      this.applyTheme("system");
    }
  }

  private handleClick = (): void => {
    // Cycle through themes: system -> light -> dark -> system
    const nextTheme: Theme = this.theme === "system" ? "light" : this.theme === "light" ? "dark" : "system";
    this.theme = nextTheme;
    this.applyTheme(nextTheme);
    localStorage.setItem("alexi-theme", nextTheme);
    this.dispatchEvent(new CustomEvent("change", { detail: { theme: nextTheme }, bubbles: true }));
  };

  private applyTheme(theme: Theme): void {
    const root = document.documentElement;

    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }

  private getIcon(): string {
    switch (this.theme) {
      case "light":
        return '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';
      case "dark":
        return '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
      default:
        return '<circle cx="12" cy="12" r="4"/><path d="M12 8a2 2 0 1 0 0 4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';
    }
  }

  override render(): Node[] {
    const button = document.createElement("button");
    button.className = "ds-theme-toggle";
    button.type = "button";
    button.setAttribute("aria-label", \`Current theme: \${this.theme}. Click to change.\`);
    button.onclick = this.handleClick;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.classList.add("ds-theme-icon");
    svg.innerHTML = this.getIcon();

    button.appendChild(svg);

    const style = document.createElement("style");
    style.textContent = TOGGLE_STYLES;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(button);

    return [fragment];
  }
}

// Register the custom element
DSThemeToggle.define("ds-theme-toggle");

/**
 * Theme toggle component styles
 */
const TOGGLE_STYLES = \`
  :host {
    display: inline-flex;
  }

  .ds-theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    border: 2px solid var(--alexi-border, #e4e4e7);
    border-radius: 0.75rem;
    background: var(--alexi-surface, #ffffff);
    color: var(--alexi-text-secondary, #52525b);
    cursor: pointer;
    transition: all 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .ds-theme-toggle:hover {
    border-color: var(--alexi-primary, #10b981);
    color: var(--alexi-primary, #10b981);
    transform: scale(1.05);
  }

  .ds-theme-toggle:active {
    transform: scale(0.95);
  }

  .ds-theme-toggle:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.4);
  }

  .ds-theme-icon {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .ds-theme-toggle:hover .ds-theme-icon {
    transform: rotate(15deg);
  }

  /* Dark mode specific styling */
  @media (prefers-color-scheme: dark) {
    .ds-theme-toggle {
      border-color: var(--alexi-border, #3f3f46);
      background: var(--alexi-surface, #27272a);
      color: var(--alexi-text-secondary, #a1a1aa);
    }

    .ds-theme-toggle:hover {
      border-color: var(--alexi-primary, #34d399);
      color: var(--alexi-primary, #34d399);
    }
  }

  :host-context([data-theme="dark"]) .ds-theme-toggle {
    border-color: #3f3f46;
    background: #27272a;
    color: #a1a1aa;
  }

  :host-context([data-theme="dark"]) .ds-theme-toggle:hover {
    border-color: #34d399;
    color: #34d399;
  }

  :host-context([data-theme="light"]) .ds-theme-toggle {
    border-color: #e4e4e7;
    background: #ffffff;
    color: #52525b;
  }

  :host-context([data-theme="light"]) .ds-theme-toggle:hover {
    border-color: #10b981;
    color: #10b981;
  }
\`;
`;
}
