/**
 * AdminDateRangeFilter component for Alexi Admin
 *
 * A filter widget for date/datetime fields with from/to range inputs.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import type { DateRangeValue } from "../../filters.ts";

// =============================================================================
// AdminDateRangeFilter Component
// =============================================================================

/**
 * AdminDateRangeFilter - A filter widget for date range fields.
 *
 * @example
 * ```typescript
 * new AdminDateRangeFilter({
 *   field: "createdAt",
 *   label: "Created At",
 *   value: { gte: "2024-01-01", lte: "2024-12-31" },
 *   onchange: (value) => console.log("Filter changed:", value),
 * });
 * ```
 */
export class AdminDateRangeFilter extends HTMLPropsMixin(HTMLElement, {
  /** Field name */
  field: prop(""),
  /** Display label */
  label: prop(""),
  /** Current filter value with gte (from) and lte (to) */
  value: prop<DateRangeValue | undefined>(undefined),
  /** Whether to use datetime-local instead of date input */
  includeTime: prop(false),
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

    .admin-filter-date-range {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .admin-filter-date-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .admin-filter-date-label {
      font-size: 12px;
      color: #666666;
      min-width: 40px;
    }

    .admin-filter-date-input {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #cccccc;
      border-radius: 4px;
      font-size: 13px;
      color: #333333;
      background-color: #ffffff;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .admin-filter-date-input:hover {
      border-color: #999999;
    }

    .admin-filter-date-input:focus {
      outline: none;
      border-color: #417690;
      box-shadow: 0 0 0 2px rgba(65, 118, 144, 0.2);
    }

    .admin-filter-date-input::-webkit-calendar-picker-indicator {
      cursor: pointer;
      opacity: 0.6;
    }

    .admin-filter-date-input::-webkit-calendar-picker-indicator:hover {
      opacity: 1;
    }

    .admin-filter-clear {
      display: flex;
      justify-content: flex-end;
      margin-top: 4px;
    }

    .admin-filter-clear-btn {
      padding: 4px 8px;
      font-size: 12px;
      color: #666666;
      background: none;
      border: none;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .admin-filter-clear-btn:hover {
      background-color: #f0f0f0;
      color: #333333;
    }

    .admin-filter-clear-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminDateRangeFilter.styles;

    const container = document.createElement("div");
    container.className = "admin-filter";
    container.dataset.key = `filter-${this.field}`;

    // Label
    const label = document.createElement("label");
    label.className = "admin-filter-label";
    label.textContent = this.label;
    container.appendChild(label);

    // Date range inputs
    const dateRange = document.createElement("div");
    dateRange.className = "admin-filter-date-range";

    // From row
    const fromRow = document.createElement("div");
    fromRow.className = "admin-filter-date-row";
    fromRow.dataset.key = "from-row";

    const fromLabel = document.createElement("span");
    fromLabel.className = "admin-filter-date-label";
    fromLabel.textContent = "From:";

    const fromInput = document.createElement("input");
    fromInput.type = this.includeTime ? "datetime-local" : "date";
    fromInput.className = "admin-filter-date-input";
    fromInput.dataset.key = "from-input";
    fromInput.value = this.value?.gte ?? "";

    fromInput.addEventListener("change", () => {
      this._handleChange(fromInput.value, this.value?.lte);
    });

    fromRow.appendChild(fromLabel);
    fromRow.appendChild(fromInput);
    dateRange.appendChild(fromRow);

    // To row
    const toRow = document.createElement("div");
    toRow.className = "admin-filter-date-row";
    toRow.dataset.key = "to-row";

    const toLabel = document.createElement("span");
    toLabel.className = "admin-filter-date-label";
    toLabel.textContent = "To:";

    const toInput = document.createElement("input");
    toInput.type = this.includeTime ? "datetime-local" : "date";
    toInput.className = "admin-filter-date-input";
    toInput.dataset.key = "to-input";
    toInput.value = this.value?.lte ?? "";

    toInput.addEventListener("change", () => {
      this._handleChange(this.value?.gte, toInput.value);
    });

    toRow.appendChild(toLabel);
    toRow.appendChild(toInput);
    dateRange.appendChild(toRow);

    // Clear button
    const clearContainer = document.createElement("div");
    clearContainer.className = "admin-filter-clear";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "admin-filter-clear-btn";
    clearBtn.textContent = "Clear";
    clearBtn.disabled = !this.value?.gte && !this.value?.lte;

    clearBtn.addEventListener("click", () => {
      this._handleChange(undefined, undefined);
    });

    clearContainer.appendChild(clearBtn);
    dateRange.appendChild(clearContainer);

    container.appendChild(dateRange);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(container);

    return fragment;
  }

  private _handleChange(gte?: string, lte?: string): void {
    let newValue: DateRangeValue | undefined;

    // Only create value object if at least one date is set
    if ((gte && gte.length > 0) || (lte && lte.length > 0)) {
      newValue = {};
      if (gte && gte.length > 0) {
        newValue.gte = gte;
      }
      if (lte && lte.length > 0) {
        newValue.lte = lte;
      }
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
AdminDateRangeFilter.define("admin-date-range-filter");
