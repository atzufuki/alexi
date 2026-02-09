/**
 * AdminFilterSidebar component for Alexi Admin
 *
 * A sidebar component that contains all filter widgets for a list view.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import type {
  DateRangeValue,
  FilterConfig,
  FilterValues,
} from "../../filters.ts";
import { AdminBooleanFilter } from "./admin_boolean_filter.ts";
import { AdminChoiceFilter } from "./admin_choice_filter.ts";
import { AdminDateRangeFilter } from "./admin_date_range_filter.ts";

// =============================================================================
// AdminFilterSidebar Component
// =============================================================================

/**
 * AdminFilterSidebar - A sidebar component containing all filter widgets.
 *
 * @example
 * ```typescript
 * new AdminFilterSidebar({
 *   filters: [
 *     { field: "status", type: "choice", label: "Status", choices: [["draft", "Draft"], ["published", "Published"]] },
 *     { field: "isActive", type: "boolean", label: "Is Active" },
 *     { field: "createdAt", type: "date_range", label: "Created At" },
 *   ],
 *   values: { status: "published", isActive: true },
 *   onFilterChange: (field, value) => console.log("Filter changed:", field, value),
 * });
 * ```
 */
export class AdminFilterSidebar extends HTMLPropsMixin(HTMLElement, {
  /** Filter configurations */
  filters: prop<FilterConfig[]>([]),
  /** Current filter values */
  values: prop<FilterValues>({}),
  /** Title text for the sidebar */
  title: prop("Filters"),
  /** Whether the sidebar is collapsible */
  collapsible: prop(true),
  /** Whether the sidebar is currently collapsed */
  collapsed: prop(false),
}) {
  static styles = `
    :host {
      display: block;
    }

    .admin-filter-sidebar {
      background-color: #f8f8f8;
      border: 1px solid #eeeeee;
      border-radius: 6px;
      min-width: 220px;
      max-width: 280px;
    }

    .admin-filter-sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #eeeeee;
      background-color: #ffffff;
      border-radius: 6px 6px 0 0;
    }

    .admin-filter-sidebar-title {
      font-size: 14px;
      font-weight: 600;
      color: #333333;
      margin: 0;
    }

    .admin-filter-sidebar-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
      color: #666666;
      font-size: 12px;
      transition: color 0.15s ease, transform 0.15s ease;
      border-radius: 4px;
    }

    .admin-filter-sidebar-toggle:hover {
      color: #333333;
      background-color: #f0f0f0;
    }

    .admin-filter-sidebar-toggle.collapsed {
      transform: rotate(-90deg);
    }

    .admin-filter-sidebar-content {
      padding: 16px;
    }

    .admin-filter-sidebar-content.collapsed {
      display: none;
    }

    .admin-filter-sidebar-actions {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid #eeeeee;
      background-color: #ffffff;
      border-radius: 0 0 6px 6px;
    }

    .admin-filter-sidebar-actions.collapsed {
      display: none;
    }

    .admin-filter-clear-all-btn {
      flex: 1;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 500;
      color: #666666;
      background-color: #ffffff;
      border: 1px solid #cccccc;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .admin-filter-clear-all-btn:hover:not(:disabled) {
      background-color: #f0f0f0;
      border-color: #999999;
      color: #333333;
    }

    .admin-filter-clear-all-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .admin-filter-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      margin-left: 8px;
      font-size: 11px;
      font-weight: 600;
      color: #ffffff;
      background-color: #417690;
      border-radius: 9px;
    }

    .admin-no-filters {
      padding: 16px;
      text-align: center;
      color: #999999;
      font-size: 13px;
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminFilterSidebar.styles;

    const sidebar = document.createElement("aside");
    sidebar.className = "admin-filter-sidebar";
    sidebar.dataset.key = "filter-sidebar";

    // Header
    sidebar.appendChild(this._renderHeader());

    // Content
    sidebar.appendChild(this._renderContent());

    // Actions (clear all)
    sidebar.appendChild(this._renderActions());

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(sidebar);

    return fragment;
  }

  private _renderHeader(): HTMLElement {
    const header = document.createElement("div");
    header.className = "admin-filter-sidebar-header";
    header.dataset.key = "sidebar-header";

    const titleContainer = document.createElement("div");
    titleContainer.style.display = "flex";
    titleContainer.style.alignItems = "center";

    const title = document.createElement("h3");
    title.className = "admin-filter-sidebar-title";
    title.textContent = this.title;
    titleContainer.appendChild(title);

    // Active filter count badge
    const activeCount = this._getActiveFilterCount();
    if (activeCount > 0) {
      const countBadge = document.createElement("span");
      countBadge.className = "admin-filter-count";
      countBadge.textContent = String(activeCount);
      titleContainer.appendChild(countBadge);
    }

    header.appendChild(titleContainer);

    // Collapse toggle
    if (this.collapsible) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = `admin-filter-sidebar-toggle${
        this.collapsed ? " collapsed" : ""
      }`;
      toggle.textContent = "▼";
      toggle.title = this.collapsed ? "Expand filters" : "Collapse filters";

      toggle.addEventListener("click", () => {
        this._handleToggleCollapse();
      });

      header.appendChild(toggle);
    }

    return header;
  }

  private _renderContent(): HTMLElement {
    const content = document.createElement("div");
    content.className = `admin-filter-sidebar-content${
      this.collapsed ? " collapsed" : ""
    }`;
    content.dataset.key = "sidebar-content";

    if (this.filters.length === 0) {
      const noFilters = document.createElement("div");
      noFilters.className = "admin-no-filters";
      noFilters.textContent = "No filters available";
      content.appendChild(noFilters);
      return content;
    }

    // Render filter widgets
    for (const filter of this.filters) {
      const widget = this._createFilterWidget(filter);
      if (widget) {
        content.appendChild(widget);
      }
    }

    return content;
  }

  private _createFilterWidget(filter: FilterConfig): HTMLElement | null {
    const currentValue = this.values[filter.field];

    switch (filter.type) {
      case "boolean": {
        const widget = new AdminBooleanFilter({
          field: filter.field,
          label: filter.label,
          value: currentValue as boolean | undefined,
        });
        widget.addEventListener(
          "filter-change",
          this._handleFilterChange.bind(this),
        );
        return widget;
      }

      case "choice": {
        const widget = new AdminChoiceFilter({
          field: filter.field,
          label: filter.label,
          choices: filter.choices ?? [],
          value: currentValue as string | undefined,
        });
        widget.addEventListener(
          "filter-change",
          this._handleFilterChange.bind(this),
        );
        return widget;
      }

      case "date_range": {
        const widget = new AdminDateRangeFilter({
          field: filter.field,
          label: filter.label,
          value: currentValue as DateRangeValue | undefined,
        });
        widget.addEventListener(
          "filter-change",
          this._handleFilterChange.bind(this),
        );
        return widget;
      }

      default:
        return null;
    }
  }

  private _renderActions(): HTMLElement {
    const actions = document.createElement("div");
    actions.className = `admin-filter-sidebar-actions${
      this.collapsed ? " collapsed" : ""
    }`;
    actions.dataset.key = "sidebar-actions";

    const clearAllBtn = document.createElement("button");
    clearAllBtn.type = "button";
    clearAllBtn.className = "admin-filter-clear-all-btn";
    clearAllBtn.textContent = "Clear All Filters";
    clearAllBtn.disabled = this._getActiveFilterCount() === 0;

    clearAllBtn.addEventListener("click", () => {
      this._handleClearAll();
    });

    actions.appendChild(clearAllBtn);

    return actions;
  }

  private _getActiveFilterCount(): number {
    let count = 0;

    for (const value of Object.values(this.values)) {
      if (value === undefined || value === null) {
        continue;
      }
      if (typeof value === "string" && value.length === 0) {
        continue;
      }
      if (typeof value === "object") {
        const dateRange = value as DateRangeValue;
        if (dateRange.gte || dateRange.lte) {
          count++;
        }
        continue;
      }
      count++;
    }

    return count;
  }

  private _handleFilterChange(event: Event): void {
    const customEvent = event as CustomEvent<{ field: string; value: unknown }>;
    const { field, value } = customEvent.detail;

    this.dispatchEvent(
      new CustomEvent("filter-change", {
        bubbles: true,
        composed: true,
        detail: { field, value },
      }),
    );
  }

  private _handleClearAll(): void {
    this.dispatchEvent(
      new CustomEvent("filters-clear", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleToggleCollapse(): void {
    this.collapsed = !this.collapsed;

    this.dispatchEvent(
      new CustomEvent("sidebar-toggle", {
        bubbles: true,
        composed: true,
        detail: { collapsed: this.collapsed },
      }),
    );

    // Re-render
    this.mountedCallback();
  }

  mountedCallback(): void {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }
}

// Register the custom element
AdminFilterSidebar.define("admin-filter-sidebar");
