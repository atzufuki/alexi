/**
 * Admin Dashboard View
 *
 * Main dashboard page showing all registered models as cards.
 * Fetches model configuration from the REST API dynamically.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import { Anchor, Div, Heading2, Span } from "@html-props/built-ins";
import { Column, Container } from "@html-props/layout";
import {
  type AdminConfig,
  fetchAdminConfig,
  type ModelConfig,
} from "../services/admin_config.ts";
import { navigateTo } from "../navigation.ts";

// =============================================================================
// AdminDashboard Component
// =============================================================================

/**
 * AdminDashboard - Main dashboard showing registered models
 */
export default class AdminDashboard extends HTMLPropsMixin(HTMLElement, {
  // Config loaded from API
  config: prop<AdminConfig | null>(null),

  // Loading state
  isLoading: prop(true),

  // Error message
  errorMessage: prop(""),

  // Styling
  style: {
    display: "block",
    flex: "1",
  },
}) {
  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  mountedCallback(): void {
    this.loadConfig();
  }

  // ===========================================================================
  // Data Loading
  // ===========================================================================

  private async loadConfig(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = "";

    try {
      const config = await fetchAdminConfig();
      this.config = config;
    } catch (error) {
      console.error("[AdminDashboard] Failed to load config:", error);
      this.errorMessage = error instanceof Error
        ? error.message
        : "Failed to load admin configuration";
    } finally {
      this.isLoading = false;
    }
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  private handleModelClick = (modelName: string): void => {
    navigateTo(`/admin/${modelName}/`);
  };

  private handleAddClick = (modelName: string, event: Event): void => {
    event.stopPropagation();
    event.preventDefault();
    navigateTo(`/admin/${modelName}/add/`);
  };

  // ===========================================================================
  // Render
  // ===========================================================================

  render(): Node | Node[] | null {
    if (this.isLoading) {
      return this.renderLoading();
    }

    if (this.errorMessage) {
      return this.renderError();
    }

    if (!this.config || this.config.models.length === 0) {
      return this.renderEmpty();
    }

    return new Container({
      dataset: { key: "dashboard" },
      padding: "24px",
      style: {
        maxWidth: "1400px",
        margin: "0 auto",
      },
      content: new Column({
        gap: "24px",
        content: [
          new Heading2({
            dataset: { key: "title" },
            textContent: "Site Administration",
            style: {
              fontSize: "24px",
              fontWeight: "600",
              margin: "0",
              color: "#333333",
            },
          }),
          this.renderModelGrid(),
        ],
      }),
    });
  }

  private renderModelGrid(): Node {
    const models = this.config?.models ?? [];

    return new Div({
      dataset: { key: "model-grid" },
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "24px",
      },
      content: models.map((model) => this.renderModelCard(model)),
    });
  }

  private renderModelCard(model: ModelConfig): Node {
    return new Container({
      dataset: { key: `model-${model.name}` },
      style: {
        backgroundColor: "#ffffff",
        border: "1px solid #cccccc",
        borderRadius: "8px",
        overflow: "hidden",
      },
      content: new Column({
        content: [
          // Header
          new Div({
            dataset: { key: `header-${model.name}` },
            style: {
              backgroundColor: "#417690",
              color: "#ffffff",
              padding: "12px 16px",
              fontWeight: "600",
              fontSize: "16px",
            },
            textContent: model.verboseNamePlural,
          }),
          // Body with links
          new Div({
            dataset: { key: `body-${model.name}` },
            style: {
              padding: "16px",
            },
            content: [
              // View all link
              new Anchor({
                dataset: { key: `view-${model.name}` },
                href: `/admin/${model.name}/`,
                onclick: (e: Event) => {
                  e.preventDefault();
                  this.handleModelClick(model.name);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 12px",
                  margin: "4px 0",
                  borderRadius: "4px",
                  color: "#333333",
                  textDecoration: "none",
                },
                content: [
                  new Div({
                    style: {
                      width: "24px",
                      marginRight: "12px",
                      color: "#666666",
                    },
                    textContent: "📋",
                  }),
                  new Div({
                    textContent:
                      `View all ${model.verboseNamePlural.toLowerCase()}`,
                  }),
                ],
              }),
              // Add new link
              new Anchor({
                dataset: { key: `add-${model.name}` },
                href: `/admin/${model.name}/add/`,
                onclick: (e: Event) => {
                  this.handleAddClick(model.name, e);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 12px",
                  margin: "4px 0",
                  borderRadius: "4px",
                  color: "#333333",
                  textDecoration: "none",
                },
                content: [
                  new Div({
                    style: {
                      width: "24px",
                      marginRight: "12px",
                      color: "#666666",
                    },
                    textContent: "➕",
                  }),
                  new Div({
                    textContent: `Add new ${model.verboseName.toLowerCase()}`,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    });
  }

  private renderLoading(): Node {
    return new Container({
      dataset: { key: "loading" },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "1",
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Div({
            dataset: { key: "spinner" },
            style: {
              width: "32px",
              height: "32px",
              border: "3px solid #eeeeee",
              borderTopColor: "#417690",
              borderRadius: "50%",
              animation: "admin-spin 0.8s linear infinite",
            },
          }),
          new Span({
            dataset: { key: "loading-text" },
            style: {
              color: "#666666",
              fontSize: "14px",
            },
            textContent: "Loading...",
          }),
        ],
      }),
    });
  }

  private renderError(): Node {
    return new Container({
      dataset: { key: "error" },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "1",
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Span({
            dataset: { key: "error-icon" },
            style: {
              fontSize: "48px",
            },
            textContent: "⚠️",
          }),
          new Span({
            dataset: { key: "error-message" },
            style: {
              color: "#ba2121",
              fontSize: "14px",
              textAlign: "center",
            },
            textContent: this.errorMessage,
          }),
          new Anchor({
            dataset: { key: "retry-link" },
            href: "#",
            onclick: (e: Event) => {
              e.preventDefault();
              this.loadConfig();
            },
            style: {
              color: "#417690",
              textDecoration: "none",
            },
            textContent: "Try again",
          }),
        ],
      }),
    });
  }

  private renderEmpty(): Node {
    return new Container({
      dataset: { key: "empty" },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "1",
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Span({
            dataset: { key: "empty-icon" },
            style: {
              fontSize: "48px",
            },
            textContent: "📭",
          }),
          new Span({
            dataset: { key: "empty-message" },
            style: {
              color: "#666666",
              fontSize: "14px",
            },
            textContent: "No models registered",
          }),
        ],
      }),
    });
  }
}

// Register the custom element
AdminDashboard.define("admin-dashboard");
