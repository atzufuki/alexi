/**
 * AdminDataTable component for Alexi Admin
 *
 * A data table component for displaying model records in list view.
 *
 * @module
 */

import { HTMLPropsMixin, prop, ref } from "@html-props/core";

// =============================================================================
// Types
// =============================================================================

/**
 * Column definition for the data table.
 */
export interface DataTableColumn {
  /** Field name in the data object */
  field: string;
  /** Display label for the column header */
  label: string;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Fixed width for the column */
  width?: string;
  /** Custom render function for cell content */
  render?: (value: unknown, row: Record<string, unknown>) => string | Node;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Whether this column is a link to detail view */
  isLink?: boolean;
}

/**
 * Sort configuration.
 */
export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

// =============================================================================
// AdminDataTable Component
// =============================================================================

/**
 * AdminDataTable - A data table component for the admin interface.
 *
 * @example
 * ```typescript
 * new AdminDataTable({
 *   columns: [
 *     { field: "id", label: "ID", sortable: true },
 *     { field: "name", label: "Name", sortable: true, isLink: true },
 *     { field: "status", label: "Status" },
 *   ],
 *   data: [
 *     { id: 1, name: "Item 1", status: "active" },
 *     { id: 2, name: "Item 2", status: "inactive" },
 *   ],
 *   onRowClick: (id) => console.log("Row clicked:", id),
 * });
 * ```
 */
export class AdminDataTable extends HTMLPropsMixin(HTMLElement, {
  /** Column definitions */
  columns: prop<DataTableColumn[]>([]),
  /** Data rows to display */
  data: prop<Record<string, unknown>[]>([]),
  /** Whether rows are selectable with checkboxes */
  selectable: prop(true),
  /** Currently selected row IDs */
  selectedIds: prop<Set<string>>(new Set()),
  /** Current sort configuration */
  sortField: prop(""),
  /** Current sort direction */
  sortDirection: prop<"asc" | "desc">("asc"),
  /** Message to show when there's no data */
  emptyMessage: prop("No records found"),
  /** Field name to use as the row ID */
  idField: prop("id"),
  /** String to display for empty/null values */
  emptyValueDisplay: prop("-"),
  /** Whether the table is loading */
  loading: prop(false),
  /** Base URL for row links (e.g., "/admin/users/") */
  baseUrl: prop(""),
}) {
  static styles = `
    :host {
      display: block;
    }

    .admin-table-container {
      width: 100%;
      overflow-x: auto;
      background-color: #ffffff;
      border: 1px solid #eeeeee;
      border-radius: 6px;
    }

    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    /* Header */
    .admin-table thead {
      background-color: #f8f8f8;
    }

    .admin-table th {
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      color: #333333;
      border-bottom: 2px solid #cccccc;
      white-space: nowrap;
    }

    .admin-table th:first-child {
      padding-left: 16px;
    }

    .admin-table th:last-child {
      padding-right: 16px;
    }

    .admin-col-center {
      text-align: center;
    }

    .admin-col-right {
      text-align: right;
    }

    /* Sortable headers */
    .admin-sort-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0;
      border: none;
      background: none;
      font-weight: 600;
      font-size: 12px;
      color: #333333;
      cursor: pointer;
      transition: color 0.15s ease;
    }

    .admin-sort-btn:hover {
      color: #417690;
    }

    .admin-sort-indicator {
      font-size: 10px;
      color: #999999;
      opacity: 0.5;
    }

    .admin-sort-btn.sort-asc .admin-sort-indicator,
    .admin-sort-btn.sort-desc .admin-sort-indicator {
      opacity: 1;
      color: #417690;
    }

    /* Body */
    .admin-table tbody tr {
      border-bottom: 1px solid #eeeeee;
      transition: background-color 0.15s ease;
    }

    .admin-table tbody tr:hover {
      background-color: #f0f0f0;
    }

    .admin-table tbody tr:last-child {
      border-bottom: none;
    }

    .admin-table td {
      padding: 12px 16px;
      color: #333333;
      vertical-align: middle;
    }

    .admin-table td:first-child {
      padding-left: 16px;
    }

    .admin-table td:last-child {
      padding-right: 16px;
    }

    /* Clickable rows */
    .admin-row-clickable {
      cursor: pointer;
    }

    .admin-row-clickable:active {
      background-color: #e8f4f8;
    }

    /* Selected rows */
    .admin-row-selected {
      background-color: #e8f4f8;
    }

    .admin-row-selected:hover {
      background-color: #d0e8f0;
    }

    /* Links */
    .admin-table-link {
      color: #417690;
      text-decoration: none;
      font-weight: 500;
    }

    .admin-table-link:hover {
      color: #205067;
      text-decoration: underline;
    }

    /* Checkbox column */
    .admin-col-checkbox {
      width: 40px;
      padding-left: 16px;
      padding-right: 8px;
      text-align: center;
    }

    .admin-table-checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: #417690;
    }

    /* Boolean display */
    .admin-bool-yes {
      color: #44aa00;
    }

    .admin-bool-no {
      color: #ba2121;
    }

    /* Empty state */
    .admin-empty-state {
      padding: 48px 16px;
      text-align: center;
      color: #999999;
    }

    .admin-empty-state-message {
      font-size: 14px;
    }

    /* Loading state */
    .admin-table-loading {
      position: relative;
      min-height: 200px;
    }

    .admin-table-loading::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.8);
    }

    .admin-loading-spinner {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 32px;
      height: 32px;
      border: 3px solid #eeeeee;
      border-top-color: #417690;
      border-radius: 50%;
      animation: admin-spin 0.8s linear infinite;
      z-index: 1;
    }

    @keyframes admin-spin {
      to {
        transform: translate(-50%, -50%) rotate(360deg);
      }
    }

    /* Date columns */
    .admin-col-date {
      white-space: nowrap;
      color: #666666;
      font-size: 13px;
    }

    /* ID columns */
    .admin-col-id {
      font-family: ui-monospace, "Cascadia Code", monospace;
      font-size: 13px;
      color: #999999;
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminDataTable.styles;

    const container = document.createElement("div");
    container.className = "admin-table-container";

    if (this.loading) {
      container.classList.add("admin-table-loading");
      const spinner = document.createElement("div");
      spinner.className = "admin-loading-spinner";
      container.appendChild(spinner);
    }

    // Empty state
    if (this.data.length === 0 && !this.loading) {
      const emptyState = document.createElement("div");
      emptyState.className = "admin-empty-state";
      emptyState.dataset.key = "empty-state";

      const message = document.createElement("div");
      message.className = "admin-empty-state-message";
      message.textContent = this.emptyMessage;
      emptyState.appendChild(message);

      container.appendChild(emptyState);
    } else {
      // Table
      const table = document.createElement("table");
      table.className = "admin-table";

      // Header
      table.appendChild(this._renderHeader());

      // Body
      table.appendChild(this._renderBody());

      container.appendChild(table);
    }

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(container);

    return fragment;
  }

  private _renderHeader(): HTMLTableSectionElement {
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.dataset.key = "header-row";

    // Checkbox column
    if (this.selectable) {
      const th = document.createElement("th");
      th.className = "admin-col-checkbox";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "admin-table-checkbox";
      checkbox.dataset.key = "select-all";
      checkbox.checked = this.selectedIds.size === this.data.length &&
        this.data.length > 0;
      checkbox.indeterminate = this.selectedIds.size > 0 &&
        this.selectedIds.size < this.data.length;

      checkbox.addEventListener("change", () => {
        this._handleSelectAll(checkbox.checked);
      });

      th.appendChild(checkbox);
      headerRow.appendChild(th);
    }

    // Data columns
    for (const col of this.columns) {
      const th = document.createElement("th");

      if (col.width) {
        th.style.width = col.width;
      }

      if (col.align === "center") {
        th.classList.add("admin-col-center");
      } else if (col.align === "right") {
        th.classList.add("admin-col-right");
      }

      if (col.sortable) {
        const sortBtn = document.createElement("button");
        sortBtn.className = "admin-sort-btn";
        sortBtn.dataset.sortField = col.field;

        // Add sort indicator
        const isSorted = this.sortField === col.field;
        if (isSorted) {
          sortBtn.classList.add(`sort-${this.sortDirection}`);
        }

        const labelSpan = document.createElement("span");
        labelSpan.textContent = col.label;
        sortBtn.appendChild(labelSpan);

        const indicator = document.createElement("span");
        indicator.className = "admin-sort-indicator";
        if (isSorted) {
          indicator.textContent = this.sortDirection === "asc" ? "▲" : "▼";
        } else {
          indicator.textContent = "⇅";
        }
        sortBtn.appendChild(indicator);

        sortBtn.addEventListener("click", () => {
          this._handleSort(col.field);
        });

        th.appendChild(sortBtn);
      } else {
        th.textContent = col.label;
      }

      headerRow.appendChild(th);
    }

    thead.appendChild(headerRow);
    return thead;
  }

  private _renderBody(): HTMLTableSectionElement {
    const tbody = document.createElement("tbody");

    for (const row of this.data) {
      const id = String(row[this.idField]);
      const tr = document.createElement("tr");
      tr.dataset.key = `row-${id}`;

      const isSelected = this.selectedIds.has(id);
      if (isSelected) {
        tr.classList.add("admin-row-selected");
      }

      // Row click handler (if not clicking checkbox)
      tr.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (
          target.tagName !== "INPUT" &&
          target.tagName !== "A" &&
          target.tagName !== "BUTTON"
        ) {
          this._handleRowClick(id);
        }
      });

      // Checkbox column
      if (this.selectable) {
        const td = document.createElement("td");
        td.className = "admin-col-checkbox";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "admin-table-checkbox";
        checkbox.checked = isSelected;

        checkbox.addEventListener("change", (e) => {
          e.stopPropagation();
          this._handleSelect(id, checkbox.checked);
        });

        td.appendChild(checkbox);
        tr.appendChild(td);
      }

      // Data columns
      for (const col of this.columns) {
        const td = document.createElement("td");

        if (col.align === "center") {
          td.classList.add("admin-col-center");
        } else if (col.align === "right") {
          td.classList.add("admin-col-right");
        }

        const value = row[col.field];
        const content = this._renderCellContent(col, value, row, id);

        if (typeof content === "string") {
          td.textContent = content;
        } else {
          td.appendChild(content);
        }

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    return tbody;
  }

  private _renderCellContent(
    col: DataTableColumn,
    value: unknown,
    row: Record<string, unknown>,
    rowId: string,
  ): string | Node {
    // Custom render function
    if (col.render) {
      return col.render(value, row);
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
      return this.emptyValueDisplay;
    }

    // Handle boolean
    if (typeof value === "boolean") {
      const span = document.createElement("span");
      span.className = value ? "admin-bool-yes" : "admin-bool-no";
      span.textContent = value ? "✓" : "✗";
      return span;
    }

    // Handle Date
    if (value instanceof Date) {
      const span = document.createElement("span");
      span.className = "admin-col-date";
      span.textContent = value.toLocaleString();
      return span;
    }

    // Convert to string
    const strValue = String(value);

    // Handle link columns
    if (col.isLink && this.baseUrl) {
      const link = document.createElement("a");
      link.className = "admin-table-link";
      link.href = `${this.baseUrl}${rowId}/`;
      link.textContent = strValue;

      link.addEventListener("click", (e) => {
        e.preventDefault();
        this._handleRowClick(rowId);
      });

      return link;
    }

    // ID field styling
    if (col.field === this.idField || col.field === "id") {
      const span = document.createElement("span");
      span.className = "admin-col-id";
      span.textContent = strValue;
      return span;
    }

    return strValue;
  }

  private _handleSelectAll(checked: boolean): void {
    const newSelection = new Set<string>();

    if (checked) {
      for (const row of this.data) {
        newSelection.add(String(row[this.idField]));
      }
    }

    this.dispatchEvent(
      new CustomEvent("selection-change", {
        bubbles: true,
        composed: true,
        detail: { selectedIds: newSelection },
      }),
    );
  }

  private _handleSelect(id: string, checked: boolean): void {
    const newSelection = new Set(this.selectedIds);

    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }

    this.dispatchEvent(
      new CustomEvent("selection-change", {
        bubbles: true,
        composed: true,
        detail: { selectedIds: newSelection },
      }),
    );
  }

  private _handleSort(field: string): void {
    let newDirection: "asc" | "desc" = "asc";

    if (this.sortField === field) {
      newDirection = this.sortDirection === "asc" ? "desc" : "asc";
    }

    this.dispatchEvent(
      new CustomEvent("sort", {
        bubbles: true,
        composed: true,
        detail: { field, direction: newDirection },
      }),
    );
  }

  private _handleRowClick(id: string): void {
    this.dispatchEvent(
      new CustomEvent("row-click", {
        bubbles: true,
        composed: true,
        detail: { id },
      }),
    );
  }

  mountedCallback(): void {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.dispatchEvent(
      new CustomEvent("selection-change", {
        bubbles: true,
        composed: true,
        detail: { selectedIds: new Set() },
      }),
    );
  }

  /**
   * Select all rows
   */
  selectAll(): void {
    this._handleSelectAll(true);
  }

  /**
   * Get selected row IDs as an array
   */
  getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }
}

// Register the custom element
AdminDataTable.define("admin-data-table");
