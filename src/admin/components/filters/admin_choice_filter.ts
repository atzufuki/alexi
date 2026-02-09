/**
 * AdminChoiceFilter component for Alexi Admin
 *
 * A filter widget for fields with predefined choices.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// AdminChoiceFilter Component
// =============================================================================

/**
 * AdminChoiceFilter - A filter widget for choice fields.
 *
 * @example
 * ```typescript
 * new AdminChoiceFilter({
 *   field: "status",
 *   label: "Status",
 *   choices: [["draft", "Draft"], ["published", "Published"]],
 *   value: "published",
 *   onchange: (value) => console.log("Filter changed:", value),
 * });
 * ```
 */
export class AdminChoiceFilter extends HTMLPropsMixin(HTMLElement, {
  /** Field name */
  field: prop(""),
  /** Display label */
  label: prop(""),
  /** Available choices as [value, label] pairs */
  choices: prop<[unknown, string][]>([]),
  /** Current filter value (undefined for "All") */
  value: prop<string | undefined>(undefined),
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

    /* Scrollable container for many choices */
    .admin-filter-options.scrollable {
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #eeeeee;
      border-radius: 4px;
      padding: 4px;
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminChoiceFilter.styles;

    const container = document.createElement("div");
    container.className = "admin-filter";
    container.dataset.key = `filter-${this.field}`;

    // Label
    const label = document.createElement("label");
    label.className = "admin-filter-label";
    label.textContent = this.label;
    container.appendChild(label);

    // Options container
    const options = document.createElement("div");
    options.className = "admin-filter-options";

    // Make scrollable if many choices
    if (this.choices.length > 8) {
      options.classList.add("scrollable");
    }

    // "All" option
    options.appendChild(
      this._createOption(
        "",
        "All",
        this.value === undefined || this.value === "",
      ),
    );

    // Choice options
    for (const [choiceValue, choiceLabel] of this.choices) {
      const valueStr = String(choiceValue);
      options.appendChild(
        this._createOption(valueStr, choiceLabel, this.value === valueStr),
      );
    }

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
    option.dataset.key = `option-${value || "all"}`;

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
    const newValue = value === "" ? undefined : value;

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
AdminChoiceFilter.define("admin-choice-filter");
