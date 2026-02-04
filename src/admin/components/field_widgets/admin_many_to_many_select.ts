/**
 * AdminManyToManySelect component for Alexi Admin
 *
 * A multi-select widget for ManyToManyField relations.
 * Supports checkbox list or dual-list selector modes.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// Types
// =============================================================================

/**
 * Option for the many-to-many select
 */
export interface ManyToManyOption {
  /** The primary key value */
  id: string | number;
  /** Display label */
  label: string;
}

// =============================================================================
// AdminManyToManySelect Component
// =============================================================================

/**
 * AdminManyToManySelect - A multi-select widget for ManyToMany fields.
 *
 * @example
 * ```typescript
 * new AdminManyToManySelect({
 *   name: "tags",
 *   label: "Tags",
 *   value: ["1", "3"],
 *   options: [
 *     { id: "1", label: "JavaScript" },
 *     { id: "2", label: "TypeScript" },
 *     { id: "3", label: "Deno" },
 *   ],
 * });
 * ```
 */
export class AdminManyToManySelect extends HTMLPropsMixin(HTMLElement, {
  /** Field name */
  name: prop(""),
  /** Display label */
  label: prop(""),
  /** Currently selected values (IDs) */
  value: prop<(string | number)[]>([]),
  /** Available options */
  options: prop<ManyToManyOption[]>([]),
  /** Whether this field is disabled */
  disabled: prop(false),
  /** Whether this field is readonly */
  readonly: prop(false),
  /** Help text shown below the field */
  helpText: prop(""),
  /** Error message to display */
  error: prop(""),
  /** Display mode: "checkbox" or "dual-list" */
  mode: prop<"checkbox" | "dual-list">("checkbox"),
  /** Whether options are being loaded */
  loading: prop(false),
  /** Search query for filtering options */
  searchQuery: prop(""),
  /** Maximum height for the options container */
  maxHeight: prop("250px"),
  /** Name of the related model (for display) */
  relatedModelName: prop(""),
}) {
  static styles = `
    :host {
      display: block;
    }

    .admin-m2m-select {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .admin-m2m-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #333333;
      margin-bottom: 4px;
    }

    .admin-m2m-count {
      font-weight: normal;
      color: #666666;
      font-size: 12px;
      margin-left: 8px;
    }

    /* Search input */
    .admin-m2m-search {
      padding: 8px 10px;
      font-size: 14px;
      color: #333333;
      background-color: #ffffff;
      border: 1px solid #cccccc;
      border-bottom: none;
      border-radius: 4px 4px 0 0;
      box-sizing: border-box;
    }

    .admin-m2m-search:focus {
      outline: none;
      border-color: #417690;
    }

    .admin-m2m-search:disabled {
      background-color: #f5f5f5;
      color: #999999;
    }

    /* Checkbox mode */
    .admin-m2m-options {
      display: flex;
      flex-direction: column;
      gap: 0;
      max-height: var(--max-height, 250px);
      overflow-y: auto;
      border: 1px solid #cccccc;
      border-radius: 4px;
      background-color: #ffffff;
    }

    .admin-m2m-options.has-search {
      border-radius: 0 0 4px 4px;
    }

    .admin-m2m-options.error {
      border-color: #ba2121;
    }

    .admin-m2m-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      font-size: 14px;
      color: #333333;
      cursor: pointer;
      transition: background-color 0.1s ease;
      border-bottom: 1px solid #eeeeee;
    }

    .admin-m2m-option:last-child {
      border-bottom: none;
    }

    .admin-m2m-option:hover:not(.disabled) {
      background-color: #f0f0f0;
    }

    .admin-m2m-option.selected {
      background-color: #e8f4f8;
    }

    .admin-m2m-option.disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .admin-m2m-checkbox {
      width: 16px;
      height: 16px;
      accent-color: #417690;
      cursor: pointer;
    }

    .admin-m2m-checkbox:disabled {
      cursor: not-allowed;
    }

    .admin-m2m-option-label {
      flex: 1;
      cursor: pointer;
    }

    .admin-m2m-no-options {
      padding: 16px;
      text-align: center;
      color: #999999;
      font-size: 13px;
    }

    /* Dual-list mode */
    .admin-m2m-dual-list {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 8px;
      align-items: stretch;
    }

    .admin-m2m-list-container {
      display: flex;
      flex-direction: column;
      border: 1px solid #cccccc;
      border-radius: 4px;
      background-color: #ffffff;
      overflow: hidden;
    }

    .admin-m2m-list-header {
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 600;
      color: #333333;
      background-color: #f8f8f8;
      border-bottom: 1px solid #cccccc;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .admin-m2m-list {
      flex: 1;
      max-height: var(--max-height, 200px);
      overflow-y: auto;
      min-height: 150px;
    }

    .admin-m2m-list-item {
      padding: 6px 10px;
      font-size: 13px;
      color: #333333;
      cursor: pointer;
      transition: background-color 0.1s ease;
    }

    .admin-m2m-list-item:hover {
      background-color: #f0f0f0;
    }

    .admin-m2m-list-item.selected {
      background-color: #e8f4f8;
    }

    .admin-m2m-list-empty {
      padding: 16px;
      text-align: center;
      color: #999999;
      font-size: 12px;
    }

    /* Transfer buttons */
    .admin-m2m-actions {
      display: flex;
      flex-direction: column;
      gap: 4px;
      justify-content: center;
    }

    .admin-m2m-action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      font-size: 14px;
      color: #333333;
      background-color: #ffffff;
      border: 1px solid #cccccc;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.1s ease, border-color 0.1s ease;
    }

    .admin-m2m-action-btn:hover:not(:disabled) {
      background-color: #f0f0f0;
      border-color: #999999;
    }

    .admin-m2m-action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Loading state */
    .admin-m2m-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      border: 1px solid #cccccc;
      border-radius: 4px;
      background-color: #ffffff;
    }

    .admin-m2m-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #eeeeee;
      border-top-color: #417690;
      border-radius: 50%;
      animation: admin-m2m-spin 0.6s linear infinite;
    }

    @keyframes admin-m2m-spin {
      to {
        transform: rotate(360deg);
      }
    }

    /* Help text */
    .admin-m2m-help {
      font-size: 12px;
      color: #666666;
      margin-top: 4px;
    }

    /* Error message */
    .admin-m2m-error {
      font-size: 12px;
      color: #ba2121;
      margin-top: 4px;
    }

    /* Select all / deselect all */
    .admin-m2m-bulk-actions {
      display: flex;
      gap: 12px;
      padding: 6px 10px;
      border-bottom: 1px solid #eeeeee;
      background-color: #f8f8f8;
    }

    .admin-m2m-bulk-btn {
      font-size: 12px;
      color: #417690;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-decoration: none;
    }

    .admin-m2m-bulk-btn:hover {
      text-decoration: underline;
    }

    .admin-m2m-bulk-btn:disabled {
      color: #999999;
      cursor: not-allowed;
      text-decoration: none;
    }
  `;

  private _highlightedAvailable: Set<string> = new Set();
  private _highlightedSelected: Set<string> = new Set();

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminManyToManySelect.styles;

    const container = document.createElement("div");
    container.className = "admin-m2m-select";
    container.dataset.key = `m2m-${this.name}`;
    container.style.setProperty("--max-height", this.maxHeight);

    // Label
    if (this.label) {
      const label = document.createElement("label");
      label.className = "admin-m2m-label";
      label.textContent = this.label;

      // Count badge
      if (this.value.length > 0) {
        const count = document.createElement("span");
        count.className = "admin-m2m-count";
        count.textContent = `(${this.value.length} selected)`;
        label.appendChild(count);
      }

      container.appendChild(label);
    }

    // Loading state
    if (this.loading) {
      const loadingDiv = document.createElement("div");
      loadingDiv.className = "admin-m2m-loading";
      const spinner = document.createElement("div");
      spinner.className = "admin-m2m-spinner";
      loadingDiv.appendChild(spinner);
      container.appendChild(loadingDiv);
    } else if (this.mode === "dual-list") {
      container.appendChild(this._renderDualList());
    } else {
      container.appendChild(this._renderCheckboxList());
    }

    // Help text
    if (this.helpText && !this.error) {
      const help = document.createElement("div");
      help.className = "admin-m2m-help";
      help.textContent = this.helpText;
      container.appendChild(help);
    }

    // Error message
    if (this.error) {
      const errorDiv = document.createElement("div");
      errorDiv.className = "admin-m2m-error";
      errorDiv.textContent = this.error;
      container.appendChild(errorDiv);
    }

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(container);

    return fragment;
  }

  private _renderCheckboxList(): HTMLElement {
    const wrapper = document.createElement("div");

    // Search input
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "admin-m2m-search";
    searchInput.placeholder = "Search...";
    searchInput.value = this.searchQuery;
    searchInput.disabled = this.disabled || this.readonly;

    searchInput.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.mountedCallback();
    });

    wrapper.appendChild(searchInput);

    // Options container
    const optionsContainer = document.createElement("div");
    optionsContainer.className = `admin-m2m-options has-search${
      this.error ? " error" : ""
    }`;

    // Bulk actions
    const bulkActions = document.createElement("div");
    bulkActions.className = "admin-m2m-bulk-actions";

    const selectAllBtn = document.createElement("button");
    selectAllBtn.type = "button";
    selectAllBtn.className = "admin-m2m-bulk-btn";
    selectAllBtn.textContent = "Select all";
    selectAllBtn.disabled = this.disabled || this.readonly;
    selectAllBtn.addEventListener("click", () => this._selectAll());

    const deselectAllBtn = document.createElement("button");
    deselectAllBtn.type = "button";
    deselectAllBtn.className = "admin-m2m-bulk-btn";
    deselectAllBtn.textContent = "Deselect all";
    deselectAllBtn.disabled = this.disabled || this.readonly ||
      this.value.length === 0;
    deselectAllBtn.addEventListener("click", () => this._deselectAll());

    bulkActions.appendChild(selectAllBtn);
    bulkActions.appendChild(deselectAllBtn);
    optionsContainer.appendChild(bulkActions);

    // Filtered options
    const filteredOptions = this._getFilteredOptions();

    if (filteredOptions.length === 0) {
      const noOptions = document.createElement("div");
      noOptions.className = "admin-m2m-no-options";
      noOptions.textContent = this.searchQuery
        ? "No matching options"
        : "No options available";
      optionsContainer.appendChild(noOptions);
    } else {
      for (const opt of filteredOptions) {
        const isSelected = this.value.includes(opt.id) ||
          this.value.includes(String(opt.id));

        const optionDiv = document.createElement("div");
        optionDiv.className = `admin-m2m-option${
          isSelected ? " selected" : ""
        }${this.disabled || this.readonly ? " disabled" : ""}`;
        optionDiv.dataset.key = `option-${opt.id}`;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "admin-m2m-checkbox";
        checkbox.checked = isSelected;
        checkbox.disabled = this.disabled || this.readonly;

        checkbox.addEventListener("change", () => {
          this._toggleOption(opt.id);
        });

        const labelSpan = document.createElement("span");
        labelSpan.className = "admin-m2m-option-label";
        labelSpan.textContent = opt.label;

        labelSpan.addEventListener("click", () => {
          if (!this.disabled && !this.readonly) {
            this._toggleOption(opt.id);
          }
        });

        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(labelSpan);
        optionsContainer.appendChild(optionDiv);
      }
    }

    wrapper.appendChild(optionsContainer);
    return wrapper;
  }

  private _renderDualList(): HTMLElement {
    const dualList = document.createElement("div");
    dualList.className = "admin-m2m-dual-list";

    // Available list
    const availableContainer = document.createElement("div");
    availableContainer.className = "admin-m2m-list-container";

    const availableHeader = document.createElement("div");
    availableHeader.className = "admin-m2m-list-header";
    availableHeader.textContent = "Available";
    availableContainer.appendChild(availableHeader);

    const availableList = document.createElement("div");
    availableList.className = "admin-m2m-list";

    const availableOptions = this.options.filter(
      (opt) =>
        !this.value.includes(opt.id) && !this.value.includes(String(opt.id)),
    );

    if (availableOptions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "admin-m2m-list-empty";
      empty.textContent = "No items available";
      availableList.appendChild(empty);
    } else {
      for (const opt of availableOptions) {
        const item = document.createElement("div");
        item.className = `admin-m2m-list-item${
          this._highlightedAvailable.has(String(opt.id)) ? " selected" : ""
        }`;
        item.dataset.id = String(opt.id);
        item.textContent = opt.label;

        item.addEventListener("click", () => {
          this._toggleHighlightAvailable(String(opt.id));
        });

        item.addEventListener("dblclick", () => {
          this._addOption(opt.id);
        });

        availableList.appendChild(item);
      }
    }

    availableContainer.appendChild(availableList);
    dualList.appendChild(availableContainer);

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "admin-m2m-actions";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "admin-m2m-action-btn";
    addBtn.textContent = "→";
    addBtn.title = "Add selected";
    addBtn.disabled = this.disabled || this.readonly ||
      this._highlightedAvailable.size === 0;
    addBtn.addEventListener("click", () => this._addHighlighted());

    const addAllBtn = document.createElement("button");
    addAllBtn.type = "button";
    addAllBtn.className = "admin-m2m-action-btn";
    addAllBtn.textContent = "⇒";
    addAllBtn.title = "Add all";
    addAllBtn.disabled = this.disabled || this.readonly ||
      availableOptions.length === 0;
    addAllBtn.addEventListener("click", () => this._selectAll());

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "admin-m2m-action-btn";
    removeBtn.textContent = "←";
    removeBtn.title = "Remove selected";
    removeBtn.disabled = this.disabled || this.readonly ||
      this._highlightedSelected.size === 0;
    removeBtn.addEventListener("click", () => this._removeHighlighted());

    const removeAllBtn = document.createElement("button");
    removeAllBtn.type = "button";
    removeAllBtn.className = "admin-m2m-action-btn";
    removeAllBtn.textContent = "⇐";
    removeAllBtn.title = "Remove all";
    removeAllBtn.disabled = this.disabled || this.readonly ||
      this.value.length === 0;
    removeAllBtn.addEventListener("click", () => this._deselectAll());

    actions.appendChild(addBtn);
    actions.appendChild(addAllBtn);
    actions.appendChild(removeAllBtn);
    actions.appendChild(removeBtn);
    dualList.appendChild(actions);

    // Selected list
    const selectedContainer = document.createElement("div");
    selectedContainer.className = "admin-m2m-list-container";

    const selectedHeader = document.createElement("div");
    selectedHeader.className = "admin-m2m-list-header";
    selectedHeader.textContent = `Selected (${this.value.length})`;
    selectedContainer.appendChild(selectedHeader);

    const selectedList = document.createElement("div");
    selectedList.className = "admin-m2m-list";

    const selectedOptions = this.options.filter(
      (opt) =>
        this.value.includes(opt.id) || this.value.includes(String(opt.id)),
    );

    if (selectedOptions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "admin-m2m-list-empty";
      empty.textContent = "No items selected";
      selectedList.appendChild(empty);
    } else {
      for (const opt of selectedOptions) {
        const item = document.createElement("div");
        item.className = `admin-m2m-list-item${
          this._highlightedSelected.has(String(opt.id)) ? " selected" : ""
        }`;
        item.dataset.id = String(opt.id);
        item.textContent = opt.label;

        item.addEventListener("click", () => {
          this._toggleHighlightSelected(String(opt.id));
        });

        item.addEventListener("dblclick", () => {
          this._removeOption(opt.id);
        });

        selectedList.appendChild(item);
      }
    }

    selectedContainer.appendChild(selectedList);
    dualList.appendChild(selectedContainer);

    return dualList;
  }

  private _getFilteredOptions(): ManyToManyOption[] {
    if (!this.searchQuery) {
      return this.options;
    }

    const query = this.searchQuery.toLowerCase();
    return this.options.filter((opt) =>
      opt.label.toLowerCase().includes(query)
    );
  }

  private _toggleOption(id: string | number): void {
    const idStr = String(id);
    const currentValue = this.value.map(String);
    const index = currentValue.indexOf(idStr);

    let newValue: (string | number)[];
    if (index === -1) {
      newValue = [...this.value, id];
    } else {
      newValue = this.value.filter((v) => String(v) !== idStr);
    }

    this._emitChange(newValue);
  }

  private _addOption(id: string | number): void {
    if (
      !this.value.includes(id) && !this.value.includes(String(id))
    ) {
      this._emitChange([...this.value, id]);
    }
    this._highlightedAvailable.delete(String(id));
  }

  private _removeOption(id: string | number): void {
    const idStr = String(id);
    const newValue = this.value.filter((v) => String(v) !== idStr);
    this._emitChange(newValue);
    this._highlightedSelected.delete(idStr);
  }

  private _selectAll(): void {
    const allIds = this.options.map((opt) => opt.id);
    this._emitChange(allIds);
    this._highlightedAvailable.clear();
  }

  private _deselectAll(): void {
    this._emitChange([]);
    this._highlightedSelected.clear();
  }

  private _toggleHighlightAvailable(id: string): void {
    if (this._highlightedAvailable.has(id)) {
      this._highlightedAvailable.delete(id);
    } else {
      this._highlightedAvailable.add(id);
    }
    this.mountedCallback();
  }

  private _toggleHighlightSelected(id: string): void {
    if (this._highlightedSelected.has(id)) {
      this._highlightedSelected.delete(id);
    } else {
      this._highlightedSelected.add(id);
    }
    this.mountedCallback();
  }

  private _addHighlighted(): void {
    const newValue = [...this.value];
    for (const id of this._highlightedAvailable) {
      if (!newValue.includes(id) && !newValue.map(String).includes(id)) {
        const opt = this.options.find((o) => String(o.id) === id);
        if (opt) {
          newValue.push(opt.id);
        }
      }
    }
    this._highlightedAvailable.clear();
    this._emitChange(newValue);
  }

  private _removeHighlighted(): void {
    const newValue = this.value.filter(
      (v) => !this._highlightedSelected.has(String(v)),
    );
    this._highlightedSelected.clear();
    this._emitChange(newValue);
  }

  private _emitChange(newValue: (string | number)[]): void {
    this.dispatchEvent(
      new CustomEvent("change", {
        bubbles: true,
        composed: true,
        detail: {
          name: this.name,
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

  /**
   * Get the current value
   */
  getValue(): (string | number)[] {
    return this.value;
  }

  /**
   * Set the value programmatically
   */
  setValue(value: (string | number)[]): void {
    this.value = value;
    this.mountedCallback();
  }

  /**
   * Set options dynamically
   */
  setOptions(options: ManyToManyOption[]): void {
    this.options = options;
    this.mountedCallback();
  }

  /**
   * Clear all selections
   */
  clear(): void {
    this._deselectAll();
  }
}

// Register the custom element
AdminManyToManySelect.define("admin-many-to-many-select");
