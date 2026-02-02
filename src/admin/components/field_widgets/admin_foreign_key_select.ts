/**
 * AdminForeignKeySelect component for Alexi Admin
 *
 * A select widget for ForeignKey and OneToOneField relations.
 * Supports autocomplete search for large datasets.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// Types
// =============================================================================

/**
 * Option for the foreign key select
 */
export interface ForeignKeyOption {
  /** The primary key value */
  id: string | number;
  /** Display label */
  label: string;
}

// =============================================================================
// AdminForeignKeySelect Component
// =============================================================================

/**
 * AdminForeignKeySelect - A select widget for ForeignKey fields.
 *
 * @example
 * ```typescript
 * new AdminForeignKeySelect({
 *   name: "category",
 *   label: "Category",
 *   value: "123",
 *   options: [
 *     { id: "123", label: "News" },
 *     { id: "456", label: "Blog" },
 *   ],
 *   required: true,
 * });
 * ```
 */
export class AdminForeignKeySelect extends HTMLPropsMixin(HTMLElement, {
  /** Field name */
  name: prop(""),
  /** Display label */
  label: prop(""),
  /** Current selected value (ID) */
  value: prop<string | number | null>(null),
  /** Available options */
  options: prop<ForeignKeyOption[]>([]),
  /** Whether this field is required */
  required: prop(false),
  /** Whether this field is disabled */
  disabled: prop(false),
  /** Whether this field is readonly */
  readonly: prop(false),
  /** Help text shown below the field */
  helpText: prop(""),
  /** Error message to display */
  error: prop(""),
  /** Placeholder text for empty selection */
  placeholder: prop("Select..."),
  /** Whether to enable search/autocomplete */
  searchable: prop(true),
  /** Minimum characters to trigger search */
  minSearchLength: prop(1),
  /** Whether options are being loaded */
  loading: prop(false),
  /** Search query for autocomplete */
  searchQuery: prop(""),
  /** Callback URL for loading options dynamically */
  optionsUrl: prop(""),
  /** Name of the related model (for display) */
  relatedModelName: prop(""),
}) {
  static styles = `
    :host {
      display: block;
    }

    .admin-fk-select {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .admin-fk-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #333333;
      margin-bottom: 4px;
    }

    .admin-fk-required {
      color: #ba2121;
      margin-left: 2px;
    }

    .admin-fk-input-container {
      position: relative;
    }

    .admin-fk-select-input {
      width: 100%;
      padding: 8px 32px 8px 10px;
      font-size: 14px;
      color: #333333;
      background-color: #ffffff;
      border: 1px solid #cccccc;
      border-radius: 4px;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      appearance: none;
      cursor: pointer;
    }

    .admin-fk-select-input:hover:not(:disabled) {
      border-color: #999999;
    }

    .admin-fk-select-input:focus {
      outline: none;
      border-color: #417690;
      box-shadow: 0 0 0 2px rgba(65, 118, 144, 0.2);
    }

    .admin-fk-select-input:disabled {
      background-color: #f5f5f5;
      color: #999999;
      cursor: not-allowed;
    }

    .admin-fk-select-input.readonly {
      background-color: #f5f5f5;
      cursor: default;
    }

    .admin-fk-select-input.error {
      border-color: #ba2121;
    }

    .admin-fk-select-input.error:focus {
      box-shadow: 0 0 0 2px rgba(186, 33, 33, 0.2);
    }

    /* Dropdown arrow */
    .admin-fk-arrow {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      font-size: 10px;
      color: #666666;
    }

    /* Loading spinner */
    .admin-fk-loading {
      position: absolute;
      right: 30px;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      border: 2px solid #eeeeee;
      border-top-color: #417690;
      border-radius: 50%;
      animation: admin-fk-spin 0.6s linear infinite;
    }

    @keyframes admin-fk-spin {
      to {
        transform: translateY(-50%) rotate(360deg);
      }
    }

    /* Searchable input */
    .admin-fk-search-container {
      position: relative;
    }

    .admin-fk-search-input {
      width: 100%;
      padding: 8px 32px 8px 10px;
      font-size: 14px;
      color: #333333;
      background-color: #ffffff;
      border: 1px solid #cccccc;
      border-radius: 4px;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .admin-fk-search-input:focus {
      outline: none;
      border-color: #417690;
      box-shadow: 0 0 0 2px rgba(65, 118, 144, 0.2);
    }

    .admin-fk-search-input:disabled {
      background-color: #f5f5f5;
      color: #999999;
      cursor: not-allowed;
    }

    /* Dropdown */
    .admin-fk-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      max-height: 250px;
      overflow-y: auto;
      background-color: #ffffff;
      border: 1px solid #cccccc;
      border-top: none;
      border-radius: 0 0 4px 4px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      display: none;
    }

    .admin-fk-dropdown.open {
      display: block;
    }

    .admin-fk-option {
      padding: 8px 10px;
      font-size: 14px;
      color: #333333;
      cursor: pointer;
      transition: background-color 0.1s ease;
    }

    .admin-fk-option:hover {
      background-color: #f0f0f0;
    }

    .admin-fk-option.selected {
      background-color: #e8f4f8;
      color: #417690;
      font-weight: 500;
    }

    .admin-fk-option.highlighted {
      background-color: #f0f0f0;
    }

    .admin-fk-no-results {
      padding: 12px 10px;
      font-size: 13px;
      color: #999999;
      text-align: center;
    }

    /* Clear button */
    .admin-fk-clear {
      position: absolute;
      right: 28px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      padding: 0;
      border: none;
      background: none;
      color: #999999;
      font-size: 14px;
      cursor: pointer;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.1s ease, color 0.1s ease;
    }

    .admin-fk-clear:hover {
      background-color: #f0f0f0;
      color: #333333;
    }

    /* Help text */
    .admin-fk-help {
      font-size: 12px;
      color: #666666;
      margin-top: 4px;
    }

    /* Error message */
    .admin-fk-error {
      font-size: 12px;
      color: #ba2121;
      margin-top: 4px;
    }

    /* View link */
    .admin-fk-view-link {
      font-size: 12px;
      color: #417690;
      text-decoration: none;
      margin-left: 8px;
    }

    .admin-fk-view-link:hover {
      text-decoration: underline;
    }
  `;

  private _isOpen = false;
  private _highlightedIndex = -1;
  private _filteredOptions: ForeignKeyOption[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminForeignKeySelect.styles;

    const container = document.createElement("div");
    container.className = "admin-fk-select";
    container.dataset.key = `fk-${this.name}`;

    // Label
    if (this.label) {
      const label = document.createElement("label");
      label.className = "admin-fk-label";
      label.setAttribute("for", `fk-input-${this.name}`);
      label.textContent = this.label;

      if (this.required) {
        const requiredSpan = document.createElement("span");
        requiredSpan.className = "admin-fk-required";
        requiredSpan.textContent = "*";
        label.appendChild(requiredSpan);
      }

      container.appendChild(label);
    }

    // Input container
    if (this.searchable && !this.readonly) {
      container.appendChild(this._renderSearchableInput());
    } else {
      container.appendChild(this._renderNativeSelect());
    }

    // Help text
    if (this.helpText && !this.error) {
      const help = document.createElement("div");
      help.className = "admin-fk-help";
      help.textContent = this.helpText;
      container.appendChild(help);
    }

    // Error message
    if (this.error) {
      const errorDiv = document.createElement("div");
      errorDiv.className = "admin-fk-error";
      errorDiv.textContent = this.error;
      container.appendChild(errorDiv);
    }

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(container);

    return fragment;
  }

  private _renderNativeSelect(): HTMLElement {
    const inputContainer = document.createElement("div");
    inputContainer.className = "admin-fk-input-container";

    const select = document.createElement("select");
    select.className = `admin-fk-select-input${this.error ? " error" : ""}${
      this.readonly ? " readonly" : ""
    }`;
    select.id = `fk-input-${this.name}`;
    select.name = this.name;
    select.disabled = this.disabled || this.readonly;
    select.required = this.required;

    // Empty option
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = this.placeholder;
    if (this.value === null || this.value === "") {
      emptyOption.selected = true;
    }
    select.appendChild(emptyOption);

    // Options
    for (const opt of this.options) {
      const option = document.createElement("option");
      option.value = String(opt.id);
      option.textContent = opt.label;
      if (String(this.value) === String(opt.id)) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener("change", () => {
      this._handleChange(select.value || null);
    });

    inputContainer.appendChild(select);

    // Arrow
    const arrow = document.createElement("span");
    arrow.className = "admin-fk-arrow";
    arrow.textContent = "▼";
    inputContainer.appendChild(arrow);

    // Loading indicator
    if (this.loading) {
      const loadingSpinner = document.createElement("div");
      loadingSpinner.className = "admin-fk-loading";
      inputContainer.appendChild(loadingSpinner);
    }

    return inputContainer;
  }

  private _renderSearchableInput(): HTMLElement {
    const searchContainer = document.createElement("div");
    searchContainer.className = "admin-fk-search-container";

    // Search input
    const input = document.createElement("input");
    input.type = "text";
    input.className = `admin-fk-search-input${this.error ? " error" : ""}`;
    input.id = `fk-input-${this.name}`;
    input.placeholder = this.placeholder;
    input.disabled = this.disabled;
    input.autocomplete = "off";

    // Show selected value label or search query
    const selectedOption = this.options.find(
      (o) => String(o.id) === String(this.value),
    );
    input.value = this._isOpen
      ? this.searchQuery
      : (selectedOption?.label ?? "");

    input.addEventListener("focus", () => {
      this._isOpen = true;
      this.searchQuery = "";
      this._updateFilteredOptions();
      this.mountedCallback();
    });

    input.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this._updateFilteredOptions();
      this._highlightedIndex = -1;
      this.mountedCallback();
    });

    input.addEventListener("keydown", (e) => {
      this._handleKeydown(e);
    });

    input.addEventListener("blur", () => {
      // Delay to allow click on option
      setTimeout(() => {
        this._isOpen = false;
        this.searchQuery = "";
        this.mountedCallback();
      }, 200);
    });

    searchContainer.appendChild(input);

    // Clear button
    if (this.value !== null && this.value !== "" && !this.required) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "admin-fk-clear";
      clearBtn.textContent = "×";
      clearBtn.title = "Clear selection";
      clearBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this._handleChange(null);
      });
      searchContainer.appendChild(clearBtn);
    }

    // Arrow
    const arrow = document.createElement("span");
    arrow.className = "admin-fk-arrow";
    arrow.textContent = "▼";
    searchContainer.appendChild(arrow);

    // Loading indicator
    if (this.loading) {
      const loadingSpinner = document.createElement("div");
      loadingSpinner.className = "admin-fk-loading";
      searchContainer.appendChild(loadingSpinner);
    }

    // Dropdown
    const dropdown = document.createElement("div");
    dropdown.className = `admin-fk-dropdown${this._isOpen ? " open" : ""}`;

    this._updateFilteredOptions();

    if (this._filteredOptions.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "admin-fk-no-results";
      noResults.textContent = this.searchQuery.length > 0
        ? "No results found"
        : "No options";
      dropdown.appendChild(noResults);
    } else {
      for (let i = 0; i < this._filteredOptions.length; i++) {
        const opt = this._filteredOptions[i];
        const optionDiv = document.createElement("div");
        optionDiv.className = `admin-fk-option${
          String(this.value) === String(opt.id) ? " selected" : ""
        }${i === this._highlightedIndex ? " highlighted" : ""}`;
        optionDiv.dataset.value = String(opt.id);
        optionDiv.textContent = opt.label;

        optionDiv.addEventListener("mousedown", (e) => {
          e.preventDefault();
          this._handleChange(String(opt.id));
          this._isOpen = false;
          this.searchQuery = "";
          this.mountedCallback();
        });

        dropdown.appendChild(optionDiv);
      }
    }

    searchContainer.appendChild(dropdown);

    return searchContainer;
  }

  private _updateFilteredOptions(): void {
    if (!this.searchQuery || this.searchQuery.length < this.minSearchLength) {
      this._filteredOptions = this.options;
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this._filteredOptions = this.options.filter((opt) =>
      opt.label.toLowerCase().includes(query)
    );
  }

  private _handleKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!this._isOpen) {
          this._isOpen = true;
          this.mountedCallback();
        } else if (this._highlightedIndex < this._filteredOptions.length - 1) {
          this._highlightedIndex++;
          this.mountedCallback();
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (this._highlightedIndex > 0) {
          this._highlightedIndex--;
          this.mountedCallback();
        }
        break;

      case "Enter":
        e.preventDefault();
        if (
          this._isOpen && this._highlightedIndex >= 0 &&
          this._highlightedIndex < this._filteredOptions.length
        ) {
          const opt = this._filteredOptions[this._highlightedIndex];
          this._handleChange(String(opt.id));
          this._isOpen = false;
          this.searchQuery = "";
          this.mountedCallback();
        }
        break;

      case "Escape":
        e.preventDefault();
        this._isOpen = false;
        this.searchQuery = "";
        this.mountedCallback();
        break;
    }
  }

  private _handleChange(value: string | null): void {
    this.dispatchEvent(
      new CustomEvent("change", {
        bubbles: true,
        composed: true,
        detail: {
          name: this.name,
          value: value,
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
  getValue(): string | number | null {
    return this.value;
  }

  /**
   * Set the value programmatically
   */
  setValue(value: string | number | null): void {
    this.value = value;
    this.mountedCallback();
  }

  /**
   * Set options dynamically
   */
  setOptions(options: ForeignKeyOption[]): void {
    this.options = options;
    this.mountedCallback();
  }

  /**
   * Clear the selection
   */
  clear(): void {
    this._handleChange(null);
  }
}

// Register the custom element
AdminForeignKeySelect.define("admin-foreign-key-select");
