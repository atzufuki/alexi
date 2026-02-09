/**
 * AdminConfirmDialog component for Alexi Admin
 *
 * A modal dialog component for confirming actions like delete.
 * Fully accessible with keyboard navigation and ARIA attributes.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// Types
// =============================================================================

export type ConfirmDialogType = "danger" | "warning" | "info";

export interface ConfirmDialogResult {
  confirmed: boolean;
}

// =============================================================================
// AdminConfirmDialog Component
// =============================================================================

/**
 * AdminConfirmDialog - A modal confirmation dialog for the admin interface.
 *
 * @example
 * ```typescript
 * const dialog = new AdminConfirmDialog({
 *   title: "Delete Item",
 *   message: "Are you sure you want to delete this item? This action cannot be undone.",
 *   confirmLabel: "Delete",
 *   cancelLabel: "Cancel",
 *   type: "danger",
 * });
 *
 * document.body.appendChild(dialog);
 *
 * dialog.show().then((result) => {
 *   if (result.confirmed) {
 *     // Perform delete
 *   }
 * });
 * ```
 */
export class AdminConfirmDialog extends HTMLPropsMixin(HTMLElement, {
  /** Dialog title */
  title: prop("Confirm Action"),
  /** Dialog message */
  message: prop("Are you sure you want to proceed?"),
  /** Additional details (optional) */
  details: prop(""),
  /** Confirm button label */
  confirmLabel: prop("Confirm"),
  /** Cancel button label */
  cancelLabel: prop("Cancel"),
  /** Dialog type affects styling */
  type: prop<ConfirmDialogType>("warning"),
  /** Whether the dialog is currently open */
  open: prop(false),
  /** Whether the confirm button is in loading state */
  loading: prop(false),
  /** Number of items affected (for bulk actions) */
  itemCount: prop(0),
}) {
  static styles = `
    :host {
      display: contents;
    }

    .admin-confirm-backdrop {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease, visibility 0.2s ease;
    }

    .admin-confirm-backdrop.open {
      opacity: 1;
      visibility: visible;
    }

    .admin-confirm-dialog {
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      max-width: 450px;
      width: 100%;
      transform: scale(0.95);
      opacity: 0;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }

    .admin-confirm-backdrop.open .admin-confirm-dialog {
      transform: scale(1);
      opacity: 1;
    }

    .admin-confirm-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 20px 20px 0;
    }

    .admin-confirm-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }

    .admin-confirm-icon.danger {
      background-color: #fdecea;
      color: #ba2121;
    }

    .admin-confirm-icon.warning {
      background-color: #fff8e6;
      color: #cc9900;
    }

    .admin-confirm-icon.info {
      background-color: #e8f4f8;
      color: #417690;
    }

    .admin-confirm-title-container {
      flex: 1;
      min-width: 0;
    }

    .admin-confirm-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333333;
      line-height: 1.3;
    }

    .admin-confirm-body {
      padding: 16px 20px;
    }

    .admin-confirm-message {
      margin: 0;
      font-size: 14px;
      color: #555555;
      line-height: 1.5;
    }

    .admin-confirm-details {
      margin: 12px 0 0;
      padding: 12px;
      background-color: #f8f8f8;
      border-radius: 4px;
      font-size: 13px;
      color: #666666;
      line-height: 1.4;
    }

    .admin-confirm-item-count {
      margin: 12px 0 0;
      padding: 8px 12px;
      background-color: #fdecea;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      color: #ba2121;
    }

    .admin-confirm-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px 20px;
      border-top: 1px solid #eeeeee;
      margin-top: 4px;
    }

    .admin-confirm-btn {
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 500;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      transition: background-color 0.15s ease, opacity 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .admin-confirm-btn:focus {
      outline: 2px solid #417690;
      outline-offset: 2px;
    }

    .admin-confirm-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .admin-confirm-btn-cancel {
      background-color: #f0f0f0;
      color: #333333;
    }

    .admin-confirm-btn-cancel:hover:not(:disabled) {
      background-color: #e0e0e0;
    }

    .admin-confirm-btn-confirm {
      background-color: #417690;
      color: #ffffff;
    }

    .admin-confirm-btn-confirm:hover:not(:disabled) {
      background-color: #356075;
    }

    .admin-confirm-btn-confirm.danger {
      background-color: #ba2121;
    }

    .admin-confirm-btn-confirm.danger:hover:not(:disabled) {
      background-color: #9a1b1b;
    }

    .admin-confirm-btn-confirm.warning {
      background-color: #cc9900;
    }

    .admin-confirm-btn-confirm.warning:hover:not(:disabled) {
      background-color: #b38600;
    }

    /* Loading spinner */
    .admin-confirm-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: admin-confirm-spin 0.6s linear infinite;
    }

    @keyframes admin-confirm-spin {
      to {
        transform: rotate(360deg);
      }
    }

    /* Close button */
    .admin-confirm-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      background: none;
      color: #999999;
      cursor: pointer;
      border-radius: 4px;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .admin-confirm-close:hover {
      background-color: #f0f0f0;
      color: #333333;
    }

    .admin-confirm-close:focus {
      outline: 2px solid #417690;
      outline-offset: 2px;
    }
  `;

  private _resolvePromise: ((result: ConfirmDialogResult) => void) | null =
    null;
  private _previouslyFocusedElement: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  private _getIcon(): string {
    switch (this.type) {
      case "danger":
        return "⚠";
      case "warning":
        return "⚠";
      case "info":
        return "ℹ";
      default:
        return "⚠";
    }
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminConfirmDialog.styles;

    const backdrop = document.createElement("div");
    backdrop.className = `admin-confirm-backdrop${this.open ? " open" : ""}`;
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "confirm-title");
    backdrop.setAttribute("aria-describedby", "confirm-message");

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        this._handleCancel();
      }
    });

    const dialog = document.createElement("div");
    dialog.className = "admin-confirm-dialog";
    dialog.setAttribute("role", "document");

    // Header
    const header = document.createElement("div");
    header.className = "admin-confirm-header";

    const icon = document.createElement("div");
    icon.className = `admin-confirm-icon ${this.type}`;
    icon.textContent = this._getIcon();
    header.appendChild(icon);

    const titleContainer = document.createElement("div");
    titleContainer.className = "admin-confirm-title-container";

    const title = document.createElement("h2");
    title.id = "confirm-title";
    title.className = "admin-confirm-title";
    title.textContent = this.title;
    titleContainer.appendChild(title);

    header.appendChild(titleContainer);
    dialog.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "admin-confirm-body";

    const message = document.createElement("p");
    message.id = "confirm-message";
    message.className = "admin-confirm-message";
    message.textContent = this.message;
    body.appendChild(message);

    if (this.details) {
      const details = document.createElement("div");
      details.className = "admin-confirm-details";
      details.textContent = this.details;
      body.appendChild(details);
    }

    if (this.itemCount > 0) {
      const itemCountDiv = document.createElement("div");
      itemCountDiv.className = "admin-confirm-item-count";
      itemCountDiv.textContent = `${this.itemCount} item${
        this.itemCount > 1 ? "s" : ""
      } will be affected`;
      body.appendChild(itemCountDiv);
    }

    dialog.appendChild(body);

    // Footer
    const footer = document.createElement("div");
    footer.className = "admin-confirm-footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "admin-confirm-btn admin-confirm-btn-cancel";
    cancelBtn.textContent = this.cancelLabel;
    cancelBtn.disabled = this.loading;
    cancelBtn.addEventListener("click", () => this._handleCancel());
    footer.appendChild(cancelBtn);

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className =
      `admin-confirm-btn admin-confirm-btn-confirm ${this.type}`;
    confirmBtn.disabled = this.loading;

    if (this.loading) {
      const spinner = document.createElement("span");
      spinner.className = "admin-confirm-spinner";
      confirmBtn.appendChild(spinner);
    }

    const confirmText = document.createElement("span");
    confirmText.textContent = this.confirmLabel;
    confirmBtn.appendChild(confirmText);

    confirmBtn.addEventListener("click", () => this._handleConfirm());
    footer.appendChild(confirmBtn);

    dialog.appendChild(footer);
    backdrop.appendChild(dialog);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(backdrop);

    return fragment;
  }

  mountedCallback(): void {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }

    // Set up keyboard listener
    if (this.open) {
      this._setupKeyboardHandler();
      this._focusFirstElement();
    }
  }

  private _setupKeyboardHandler(): void {
    const handler = (e: KeyboardEvent) => {
      if (!this.open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        this._handleCancel();
      }

      if (e.key === "Tab") {
        this._trapFocus(e);
      }
    };

    document.addEventListener("keydown", handler);

    // Store handler for cleanup
    (this as unknown as { _keyboardHandler: (e: KeyboardEvent) => void })
      ._keyboardHandler = handler;
  }

  private _trapFocus(e: KeyboardEvent): void {
    const focusableElements = this.shadowRoot?.querySelectorAll(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    if (e.shiftKey) {
      if (
        this.shadowRoot?.activeElement === firstElement ||
        document.activeElement === this
      ) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (this.shadowRoot?.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  private _focusFirstElement(): void {
    requestAnimationFrame(() => {
      const cancelBtn = this.shadowRoot?.querySelector(
        ".admin-confirm-btn-cancel",
      ) as HTMLElement | null;
      cancelBtn?.focus();
    });
  }

  private _handleConfirm(): void {
    if (this.loading) return;

    this.dispatchEvent(
      new CustomEvent("confirm", {
        bubbles: true,
        composed: true,
      }),
    );

    if (this._resolvePromise) {
      this._resolvePromise({ confirmed: true });
      this._resolvePromise = null;
    }

    this.close();
  }

  private _handleCancel(): void {
    if (this.loading) return;

    this.dispatchEvent(
      new CustomEvent("cancel", {
        bubbles: true,
        composed: true,
      }),
    );

    if (this._resolvePromise) {
      this._resolvePromise({ confirmed: false });
      this._resolvePromise = null;
    }

    this.close();
  }

  /**
   * Show the dialog and return a promise that resolves when closed
   */
  show(): Promise<ConfirmDialogResult> {
    return new Promise((resolve) => {
      this._resolvePromise = resolve;
      this._previouslyFocusedElement = document.activeElement as HTMLElement;
      this.open = true;
      this.mountedCallback();

      // Prevent body scroll
      document.body.style.overflow = "hidden";
    });
  }

  /**
   * Close the dialog
   */
  close(): void {
    this.open = false;
    this.loading = false;
    this.mountedCallback();

    // Remove keyboard handler
    const handler = (
      this as unknown as { _keyboardHandler?: (e: KeyboardEvent) => void }
    )._keyboardHandler;
    if (handler) {
      document.removeEventListener("keydown", handler);
    }

    // Restore body scroll
    document.body.style.overflow = "";

    // Restore focus
    if (this._previouslyFocusedElement) {
      this._previouslyFocusedElement.focus();
      this._previouslyFocusedElement = null;
    }
  }

  /**
   * Set loading state (for async confirm actions)
   */
  setLoading(loading: boolean): void {
    this.loading = loading;
    this.mountedCallback();
  }

  disconnectedCallback(): void {
    // Clean up keyboard handler
    const handler = (
      this as unknown as { _keyboardHandler?: (e: KeyboardEvent) => void }
    )._keyboardHandler;
    if (handler) {
      document.removeEventListener("keydown", handler);
    }

    // Ensure body scroll is restored
    document.body.style.overflow = "";

    // Reject any pending promise
    if (this._resolvePromise) {
      this._resolvePromise({ confirmed: false });
      this._resolvePromise = null;
    }
  }
}

// Register the custom element
AdminConfirmDialog.define("admin-confirm-dialog");
