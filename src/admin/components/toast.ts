/**
 * AdminToast component for Alexi Admin
 *
 * A toast notification component for displaying temporary messages.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";

// =============================================================================
// Types
// =============================================================================

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// =============================================================================
// AdminToast Component
// =============================================================================

/**
 * AdminToast - A toast notification component for the admin interface.
 *
 * @example
 * ```typescript
 * const toast = new AdminToast();
 * document.body.appendChild(toast);
 *
 * toast.show({ type: "success", message: "Record saved successfully!" });
 * toast.show({ type: "error", message: "Failed to save", duration: 5000 });
 * ```
 */
export class AdminToast extends HTMLPropsMixin(HTMLElement, {
  /** Current messages to display */
  messages: prop<ToastMessage[]>([]),
  /** Default duration in ms (0 = no auto-dismiss) */
  defaultDuration: prop(4000),
  /** Position of the toast container */
  position: prop<"top-right" | "top-left" | "bottom-right" | "bottom-left">(
    "top-right",
  ),
}) {
  static styles = `
    :host {
      display: block;
      position: fixed;
      z-index: 9999;
      pointer-events: none;
    }

    :host(.top-right) {
      top: 16px;
      right: 16px;
    }

    :host(.top-left) {
      top: 16px;
      left: 16px;
    }

    :host(.bottom-right) {
      bottom: 16px;
      right: 16px;
    }

    :host(.bottom-left) {
      bottom: 16px;
      left: 16px;
    }

    .admin-toast-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 400px;
    }

    .admin-toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 6px;
      background-color: #ffffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      animation: admin-toast-slide-in 0.3s ease;
      border-left: 4px solid;
    }

    .admin-toast.removing {
      animation: admin-toast-slide-out 0.3s ease forwards;
    }

    @keyframes admin-toast-slide-in {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes admin-toast-slide-out {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100%);
      }
    }

    :host(.top-left) .admin-toast,
    :host(.bottom-left) .admin-toast {
      animation-name: admin-toast-slide-in-left;
    }

    :host(.top-left) .admin-toast.removing,
    :host(.bottom-left) .admin-toast.removing {
      animation-name: admin-toast-slide-out-left;
    }

    @keyframes admin-toast-slide-in-left {
      from {
        opacity: 0;
        transform: translateX(-100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes admin-toast-slide-out-left {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(-100%);
      }
    }

    /* Toast types */
    .admin-toast-success {
      border-left-color: #44aa00;
    }

    .admin-toast-success .admin-toast-icon {
      color: #44aa00;
    }

    .admin-toast-error {
      border-left-color: #ba2121;
    }

    .admin-toast-error .admin-toast-icon {
      color: #ba2121;
    }

    .admin-toast-warning {
      border-left-color: #cc9900;
    }

    .admin-toast-warning .admin-toast-icon {
      color: #cc9900;
    }

    .admin-toast-info {
      border-left-color: #417690;
    }

    .admin-toast-info .admin-toast-icon {
      color: #417690;
    }

    .admin-toast-icon {
      flex-shrink: 0;
      font-size: 18px;
      line-height: 1;
    }

    .admin-toast-content {
      flex: 1;
      min-width: 0;
    }

    .admin-toast-message {
      font-size: 14px;
      color: #333333;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .admin-toast-close {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      background: none;
      color: #999999;
      cursor: pointer;
      border-radius: 4px;
      font-size: 16px;
      line-height: 1;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .admin-toast-close:hover {
      background-color: #f0f0f0;
      color: #333333;
    }

    .admin-toast-close:focus {
      outline: 2px solid #417690;
      outline-offset: 2px;
    }
  `;

  private _timeouts: Map<string, number> = new Map();

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this.classList.add(this.position);
  }

  private _getIcon(type: ToastType): string {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
        return "ℹ";
      default:
        return "ℹ";
    }
  }

  render(): Node {
    const style = document.createElement("style");
    style.textContent = AdminToast.styles;

    const container = document.createElement("div");
    container.className = "admin-toast-container";

    for (const msg of this.messages) {
      const toast = document.createElement("div");
      toast.className = `admin-toast admin-toast-${msg.type}`;
      toast.dataset.key = `toast-${msg.id}`;
      toast.dataset.toastId = msg.id;

      // Icon
      const icon = document.createElement("span");
      icon.className = "admin-toast-icon";
      icon.textContent = this._getIcon(msg.type);
      toast.appendChild(icon);

      // Content
      const content = document.createElement("div");
      content.className = "admin-toast-content";

      const message = document.createElement("div");
      message.className = "admin-toast-message";
      message.textContent = msg.message;
      content.appendChild(message);

      toast.appendChild(content);

      // Close button
      const closeBtn = document.createElement("button");
      closeBtn.className = "admin-toast-close";
      closeBtn.type = "button";
      closeBtn.textContent = "×";
      closeBtn.title = "Dismiss";
      closeBtn.addEventListener("click", () => {
        this.dismiss(msg.id);
      });
      toast.appendChild(closeBtn);

      container.appendChild(toast);
    }

    const fragment = document.createDocumentFragment();
    fragment.appendChild(style);
    fragment.appendChild(container);

    return fragment;
  }

  mountedCallback(): void {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }

  /**
   * Show a new toast message
   */
  show(options: Omit<ToastMessage, "id"> & { id?: string }): string {
    const id = options.id ||
      `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const duration = options.duration ?? this.defaultDuration;

    const message: ToastMessage = {
      id,
      type: options.type,
      message: options.message,
      duration,
    };

    this.messages = [...this.messages, message];

    // Re-render
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }

    // Set auto-dismiss timeout
    if (duration > 0) {
      const timeout = window.setTimeout(() => {
        this.dismiss(id);
      }, duration);
      this._timeouts.set(id, timeout);
    }

    // Dispatch event
    this.dispatchEvent(
      new CustomEvent("toast-show", {
        bubbles: true,
        composed: true,
        detail: { id, message: options.message, type: options.type },
      }),
    );

    return id;
  }

  /**
   * Dismiss a toast by ID
   */
  dismiss(id: string): void {
    // Clear timeout if exists
    const timeout = this._timeouts.get(id);
    if (timeout) {
      window.clearTimeout(timeout);
      this._timeouts.delete(id);
    }

    // Add removing class for animation
    const toastEl = this.shadowRoot?.querySelector(
      `[data-toast-id="${id}"]`,
    ) as HTMLElement | null;

    if (toastEl) {
      toastEl.classList.add("removing");

      // Wait for animation to complete
      setTimeout(() => {
        this.messages = this.messages.filter((m) => m.id !== id);

        // Re-render
        if (this.shadowRoot) {
          this.shadowRoot.innerHTML = "";
          this.shadowRoot.appendChild(this.render());
        }

        // Dispatch event
        this.dispatchEvent(
          new CustomEvent("toast-dismiss", {
            bubbles: true,
            composed: true,
            detail: { id },
          }),
        );
      }, 300);
    } else {
      // No element found, just remove from array
      this.messages = this.messages.filter((m) => m.id !== id);

      if (this.shadowRoot) {
        this.shadowRoot.innerHTML = "";
        this.shadowRoot.appendChild(this.render());
      }
    }
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    // Clear all timeouts
    for (const timeout of this._timeouts.values()) {
      window.clearTimeout(timeout);
    }
    this._timeouts.clear();

    this.messages = [];

    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this.render());
    }
  }

  /**
   * Convenience method for success toast
   */
  success(message: string, duration?: number): string {
    return this.show({ type: "success", message, duration });
  }

  /**
   * Convenience method for error toast
   */
  error(message: string, duration?: number): string {
    return this.show({ type: "error", message, duration });
  }

  /**
   * Convenience method for warning toast
   */
  warning(message: string, duration?: number): string {
    return this.show({ type: "warning", message, duration });
  }

  /**
   * Convenience method for info toast
   */
  info(message: string, duration?: number): string {
    return this.show({ type: "info", message, duration });
  }

  disconnectedCallback(): void {
    // Clear all timeouts when component is removed
    for (const timeout of this._timeouts.values()) {
      window.clearTimeout(timeout);
    }
    this._timeouts.clear();
  }
}

// Register the custom element
AdminToast.define("admin-toast");
