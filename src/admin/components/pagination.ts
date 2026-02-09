/**
 * AdminPagination component for Alexi Admin
 *
 * A pagination component for navigating through paginated data.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// Types
// =============================================================================

/**
 * Page info for display.
 */
export interface PageInfo {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
  startIndex: number;
  endIndex: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// =============================================================================
// AdminPagination Component
// =============================================================================

/**
 * AdminPagination - A pagination component for the admin interface.
 *
 * @example
 * ```typescript
 * new AdminPagination({
 *   totalCount: 150,
 *   currentPage: 3,
 *   perPage: 25,
 *   onPageChange: (page) => console.log("Navigate to page:", page),
 * });
 * ```
 */
export class AdminPagination extends HTMLPropsMixin(HTMLElement, {
  /** Total number of items */
  totalCount: prop(0),
  /** Current page number (1-based) */
  currentPage: prop(1),
  /** Number of items per page */
  perPage: prop(25),
  /** Maximum number of page buttons to show */
  maxVisiblePages: prop(7),
  /** Whether to show the info text (e.g., "Showing 1-25 of 100") */
  showInfo: prop(true),
  /** Whether to show first/last page buttons */
  showFirstLast: prop(true),
}) {
  static styles = `
    :host {
      display: block;
    }

    .admin-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background-color: #f8f8f8;
      border-top: 1px solid #eeeeee;
      font-size: 14px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .admin-pagination-info {
      color: #666666;
      font-size: 13px;
    }

    .admin-pagination-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .admin-pagination-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 8px;
      border: 1px solid #cccccc;
      border-radius: 4px;
      background-color: #ffffff;
      color: #333333;
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      transition: border-color 0.15s ease, background-color 0.15s ease;
      text-decoration: none;
    }

    .admin-pagination-btn:hover:not(:disabled):not(.active) {
      border-color: #417690;
      background-color: #f0f0f0;
    }

    .admin-pagination-btn:focus {
      outline: 2px solid #417690;
      outline-offset: 2px;
    }

    .admin-pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .admin-pagination-btn.active {
      background-color: #417690;
      border-color: #417690;
      color: #ffffff;
    }

    .admin-pagination-ellipsis {
      padding: 0 8px;
      color: #999999;
      user-select: none;
    }

    .admin-pagination-nav {
      font-size: 16px;
      padding: 0 6px;
    }

    /* Per-page selector */
    .admin-pagination-per-page {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #666666;
    }

    .admin-pagination-per-page select {
      padding: 4px 24px 4px 8px;
      border: 1px solid #cccccc;
      border-radius: 4px;
      font-size: 13px;
      background-color: #ffffff;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 6px center;
      appearance: none;
      cursor: pointer;
    }

    .admin-pagination-per-page select:focus {
      outline: none;
      border-color: #417690;
    }

    @media (max-width: 768px) {
      .admin-pagination {
        flex-direction: column;
        align-items: stretch;
      }

      .admin-pagination-controls {
        justify-content: center;
      }

      .admin-pagination-info {
        text-align: center;
      }
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  /**
   * Calculate page info from current state.
   */
  getPageInfo(): PageInfo {
    const totalPages = Math.ceil(this.totalCount / this.perPage) || 1;
    const startIndex = (this.currentPage - 1) * this.perPage;
    const endIndex = Math.min(startIndex + this.perPage, this.totalCount);

    return {
      totalCount: this.totalCount,
      totalPages,
      currentPage: this.currentPage,
      perPage: this.perPage,
      startIndex,
      endIndex,
      hasNext: this.currentPage < totalPages,
      hasPrev: this.currentPage > 1,
    };
  }

  /**
   * Generate page numbers to display.
   */
  private _generatePageNumbers(): (number | "...")[] {
    const pageInfo = this.getPageInfo();
    const { totalPages, currentPage } = pageInfo;

    if (totalPages <= this.maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "...")[] = [];
    const half = Math.floor((this.maxVisiblePages - 3) / 2);

    // Always show first page
    pages.push(1);

    const start = Math.max(2, currentPage - half);
    const end = Math.min(totalPages - 1, currentPage + half);

    if (start > 2) {
      pages.push("...");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push("...");
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminPagination.styles;

    const container = document.createElement("div");
    container.className = "admin-pagination";

    const pageInfo = this.getPageInfo();

    // Info text
    if (this.showInfo && this.totalCount > 0) {
      const info = document.createElement("div");
      info.className = "admin-pagination-info";
      info.textContent = `Showing ${
        pageInfo.startIndex + 1
      }-${pageInfo.endIndex} of ${pageInfo.totalCount}`;
      container.appendChild(info);
    } else if (this.showInfo) {
      const info = document.createElement("div");
      info.className = "admin-pagination-info";
      info.textContent = "No results";
      container.appendChild(info);
    }

    // Controls
    if (pageInfo.totalPages > 1) {
      const controls = document.createElement("div");
      controls.className = "admin-pagination-controls";

      // First page button
      if (this.showFirstLast) {
        const firstBtn = this._createButton("«", 1, !pageInfo.hasPrev);
        firstBtn.title = "First page";
        firstBtn.classList.add("admin-pagination-nav");
        controls.appendChild(firstBtn);
      }

      // Previous button
      const prevBtn = this._createButton(
        "‹",
        this.currentPage - 1,
        !pageInfo.hasPrev,
      );
      prevBtn.title = "Previous page";
      prevBtn.classList.add("admin-pagination-nav");
      controls.appendChild(prevBtn);

      // Page numbers
      const pageNumbers = this._generatePageNumbers();
      for (const pageNum of pageNumbers) {
        if (pageNum === "...") {
          const ellipsis = document.createElement("span");
          ellipsis.className = "admin-pagination-ellipsis";
          ellipsis.textContent = "...";
          controls.appendChild(ellipsis);
        } else {
          const btn = this._createButton(
            String(pageNum),
            pageNum,
            false,
            pageNum === this.currentPage,
          );
          controls.appendChild(btn);
        }
      }

      // Next button
      const nextBtn = this._createButton(
        "›",
        this.currentPage + 1,
        !pageInfo.hasNext,
      );
      nextBtn.title = "Next page";
      nextBtn.classList.add("admin-pagination-nav");
      controls.appendChild(nextBtn);

      // Last page button
      if (this.showFirstLast) {
        const lastBtn = this._createButton(
          "»",
          pageInfo.totalPages,
          !pageInfo.hasNext,
        );
        lastBtn.title = "Last page";
        lastBtn.classList.add("admin-pagination-nav");
        controls.appendChild(lastBtn);
      }

      container.appendChild(controls);
    }

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(container);

    return fragment;
  }

  private _createButton(
    text: string,
    page: number,
    disabled: boolean,
    active: boolean = false,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "admin-pagination-btn";
    btn.textContent = text;
    btn.disabled = disabled;
    btn.dataset.page = String(page);

    if (active) {
      btn.classList.add("active");
      btn.setAttribute("aria-current", "page");
    }

    if (!disabled && !active) {
      btn.addEventListener("click", () => {
        this._handlePageChange(page);
      });
    }

    return btn;
  }

  private _handlePageChange(page: number): void {
    if (page === this.currentPage) return;
    if (page < 1 || page > this.getPageInfo().totalPages) return;

    this.dispatchEvent(
      new CustomEvent("page-change", {
        bubbles: true,
        composed: true,
        detail: { page },
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
   * Go to the next page
   */
  nextPage(): void {
    const pageInfo = this.getPageInfo();
    if (pageInfo.hasNext) {
      this._handlePageChange(this.currentPage + 1);
    }
  }

  /**
   * Go to the previous page
   */
  prevPage(): void {
    const pageInfo = this.getPageInfo();
    if (pageInfo.hasPrev) {
      this._handlePageChange(this.currentPage - 1);
    }
  }

  /**
   * Go to the first page
   */
  firstPage(): void {
    this._handlePageChange(1);
  }

  /**
   * Go to the last page
   */
  lastPage(): void {
    const pageInfo = this.getPageInfo();
    this._handlePageChange(pageInfo.totalPages);
  }

  /**
   * Go to a specific page
   */
  goToPage(page: number): void {
    this._handlePageChange(page);
  }
}

// Register the custom element
AdminPagination.define("admin-pagination");
