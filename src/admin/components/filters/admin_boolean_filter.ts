/**
 * AdminBooleanFilter component for Alexi Admin
 *
 * A filter widget for boolean fields with Yes/No/All options.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// AdminBooleanFilter Component
// =============================================================================

/**
 * AdminBooleanFilter - A filter widget for boolean fields.
 *
 * @example
 * ```typescript
 * new AdminBooleanFilter({
 *   field: "isActive",
 *   label: "Is Active",
 *   value: true,
 *   onchange: (value) => console.log("Filter changed:", value),
 * });
 * ```
 */
export class AdminBooleanFilter extends HTMLPropsMixin(HTMLElement, {
  /** Field name */
  field: prop(""),
  /** Display label */
  label: prop(""),
  /** Current filter value (true, false, or undefined for "All") */
  value: prop<boolean | undefined>(undefined),
}) {
  static styles = `
    :host {
      display: block;
    }

    .admin-filter {
      margin-bottom: 16px;
    }

    .admin-filter-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #333333;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .admin-filter-options {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .admin-filter-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.15s ease;
      font-size: 14px;
      color: #333333;
    }

    .admin-filter-option:hover {
      background-color: #f0f0f0;
    }

    .admin-filter-option.selected {
      background-color: #e8f4f8;
      color: #417690;
      font-weight: 500;
    }

    .admin-filter-radio {
      width: 16px;
      height: 16px;
      accent-color: #417690;
      cursor: pointer;
    }

    .admin-filter-option-label {
      flex: 1;
      cursor: pointer;
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminBooleanFilter.styles;

    const container = document.createElement("div");
    container.className = "admin-filter";
    container.dataset.key = `filter-${this.field}`;

    // Label
    const label = document.createElement("label");
    label.className = "admin-filter-label";
    label.textContent = this.label;
    container.appendChild(label);

    // Options
    const options = document.createElement("div");
    options.className = "admin-filter-options";

    // All option
    options.appendChild(
      this._createOption("all", "All", this.value === undefined),
    );

    // Yes option
    options.appendChild(this._createOption("true", "Yes", this.value === true));

    // No option
    options.appendChild(
      this._createOption("false", "No", this.value === false),
    );

    container.appendChild(options);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(container);

    return fragment;
  }

  private _createOption(
    value: string,
    label: string,
    selected: boolean,
  ): HTMLElement {
    const option = document.createElement("div");
    option.className = `admin-filter-option${selected ? " selected" : ""}`;
    option.dataset.key = `option-${value}`;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.className = "admin-filter-radio";
    radio.name = `filter-${this.field}`;
    radio.value = value;
    radio.checked = selected;

    radio.addEventListener("change", () => {
      this._handleChange(value);
    });

    const labelSpan = document.createElement("span");
    labelSpan.className = "admin-filter-option-label";
    labelSpan.textContent = label;

    labelSpan.addEventListener("click", () => {
      radio.checked = true;
      this._handleChange(value);
    });

    option.appendChild(radio);
    option.appendChild(labelSpan);

    return option;
  }

  private _handleChange(value: string): void {
    let newValue: boolean | undefined;

    if (value === "true") {
      newValue = true;
    } else if (value === "false") {
      newValue = false;
    } else {
      newValue = undefined;
    }

    this.dispatchEvent(
      new CustomEvent("filter-change", {
        bubbles: true,
        composed: true,
        detail: {
          field: this.field,
          value: newValue,
        },
      }),
    );
  }

  mountedCallback(): void {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }
}

// Register the custom element
AdminBooleanFilter.define("admin-boolean-filter");
