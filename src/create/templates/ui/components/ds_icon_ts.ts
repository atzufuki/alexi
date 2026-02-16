/**
 * UI components/ds_icon.ts template generator
 *
 * Generates the DSIcon component that implements Lucide icons for the Alexi Design System.
 *
 * @module @alexi/create/templates/ui/components/ds_icon_ts
 */

/**
 * Generate components/ds_icon.ts content for the UI app
 */
export function generateDSIconTs(): string {
  return `/**
 * Design System Icon Component
 *
 * SVG icons using Lucide icon set for the Alexi Design System.
 *
 * @module components/ds_icon
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import { Style } from "@html-props/built-ins";

/**
 * Available icon names
 */
export type IconName =
  | "sun"
  | "moon"
  | "plus"
  | "minus"
  | "x"
  | "check"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "chevron-up"
  | "search"
  | "settings"
  | "heart"
  | "star"
  | "download"
  | "upload"
  | "trash"
  | "edit"
  | "copy"
  | "external-link"
  | "menu"
  | "more-horizontal"
  | "clipboard"
  | "clipboard-check"
  | "alert-circle"
  | "info"
  | "check-circle"
  | "x-circle"
  | "loader"
  | "sparkles";

/**
 * Icon size types
 */
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Icon paths (Lucide icons - MIT License)
 */
const ICON_PATHS: Record<IconName, string> = {
  "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  "moon": '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  "plus": '<path d="M12 5v14M5 12h14"/>',
  "minus": '<path d="M5 12h14"/>',
  "x": '<path d="M18 6 6 18M6 6l12 12"/>',
  "check": '<path d="M20 6 9 17l-5-5"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "chevron-left": '<path d="m15 18-6-6 6-6"/>',
  "chevron-up": '<path d="m18 15-6-6-6 6"/>',
  "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  "settings": '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  "heart": '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  "star": '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  "upload": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  "trash": '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  "edit": '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  "copy": '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  "external-link": '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
  "menu": '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  "more-horizontal": '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  "clipboard": '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  "clipboard-check": '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  "alert-circle": '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  "check-circle": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  "x-circle": '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
  "loader": '<line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/>',
  "sparkles": '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M19 17v4M3 5h4M17 19h4"/>',
};

/**
 * DSIcon - An SVG icon component
 *
 * @example
 * \`\`\`typescript
 * new DSIcon({
 *   name: "check",
 *   size: "md",
 * });
 * \`\`\`
 */
export class DSIcon extends HTMLPropsMixin(HTMLElement, {
  /** Icon name */
  name: prop<IconName>("check"),
  /** Icon size */
  size: prop<IconSize>("md"),
  /** Custom color (CSS color value) */
  color: prop("currentColor"),
}) {
  override connectedCallback(): void {
    this.attachShadow({ mode: "open" });
    super.connectedCallback();
  }

  override render(): Node[] {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", this.color);
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.classList.add("ds-icon", \`ds-icon-\${this.size}\`);
    svg.innerHTML = ICON_PATHS[this.name] || ICON_PATHS["check"];

    const style = document.createElement("style");
    style.textContent = ICON_STYLES;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(svg);

    return [fragment];
  }
}

// Register the custom element
DSIcon.define("ds-icon");

/**
 * Icon component styles
 */
const ICON_STYLES = \`
  :host {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
  }

  .ds-icon {
    display: block;
    flex-shrink: 0;
  }

  /* Size variants */
  .ds-icon-xs {
    width: 0.875rem;
    height: 0.875rem;
  }

  .ds-icon-sm {
    width: 1rem;
    height: 1rem;
  }

  .ds-icon-md {
    width: 1.25rem;
    height: 1.25rem;
  }

  .ds-icon-lg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .ds-icon-xl {
    width: 2rem;
    height: 2rem;
  }

  /* Spinning animation for loader */
  :host([name="loader"]) .ds-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
\`;
`;
}
