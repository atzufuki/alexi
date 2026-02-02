/**
 * Admin Model List View
 *
 * Displays a list of model instances with sorting, filtering, and pagination.
 * Fetches model configuration from the REST API dynamically.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import {
  Anchor,
  Div,
  Heading2,
  Span,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@html-props/built-ins";
import { Column, Container, Row } from "@html-props/layout";
import { fetchModelConfig, type ModelConfig } from "../services/admin_config.ts";
import { authenticatedFetch } from "../services/auth.ts";
import { navigateTo } from "../navigation.ts";

// =============================================================================
// AdminModelList Component
// =============================================================================

/**
 * AdminModelList - List view for a model's instances
 */
export default class AdminModelList extends HTMLPropsMixin(HTMLElement, {
  modelName: prop(""),

  // Config loaded from API
  config: prop<ModelConfig | null>(null),

  // Data state
  data: prop<Record<string, unknown>[]>([]),

  // Loading & errors
  isLoading: prop(true),
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
    this.loadData();
  }

  // ===========================================================================
  // Data Loading
  // ===========================================================================

  private async loadData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = "";

    try {
      // First, load the model config from API
      const config = await fetchModelConfig(this.modelName);

      if (!config) {
        this.errorMessage = `Unknown model: ${this.modelName}`;
        this.isLoading = false;
        return;
      }

      this.config = config;

      // Then load the data using authenticated fetch
      const url = new URL(config.apiEndpoint, globalThis.location.origin);

      const response = await authenticatedFetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Handle paginated response or array
      if (Array.isArray(result)) {
        this.data = result;
      } else if (result.results) {
        this.data = result.results;
      } else {
        this.data = [];
      }
    } catch (error) {
      console.error("[AdminModelList] Failed to load data:", error);
      this.errorMessage = error instanceof Error ? error.message : "Failed to load data";
    } finally {
      this.isLoading = false;
    }
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  private handleRowClick = (id: string): void => {
    navigateTo(`/admin/${this.modelName}/${id}/`);
  };

  private handleAddClick = (event: Event): void => {
    event.preventDefault();
    navigateTo(`/admin/${this.modelName}/add/`);
  };

  // ===========================================================================
  // Render
  // ===========================================================================

  render(): Node | Node[] | null {
    if (this.isLoading) {
      return this.renderLoading();
    }

    if (this.errorMessage && !this.config) {
      return this.renderError(this.errorMessage);
    }

    if (!this.config) {
      return this.renderError(`Unknown model: ${this.modelName}`);
    }

    return new Container({
      dataset: { key: "model-list" },
      padding: "24px",
      style: {
        maxWidth: "1400px",
        margin: "0 auto",
      },
      content: new Column({
        gap: "24px",
        content: [
          this.renderHeader(),
          this.renderContent(),
        ],
      }),
    });
  }

  private renderHeader(): Node {
    const config = this.config!;

    return new Row({
      dataset: { key: "header" },
      mainAxisAlignment: "spaceBetween",
      crossAxisAlignment: "center",
      content: [
        new Heading2({
          dataset: { key: "title" },
          textContent: `Select ${config.verboseName.toLowerCase()} to change`,
          style: {
            fontSize: "24px",
            fontWeight: "600",
            margin: "0",
            color: "#333333",
          },
        }),
        new Anchor({
          dataset: { key: "add-button" },
          href: `/admin/${this.modelName}/add/`,
          onclick: this.handleAddClick,
          style: {
            display: "inline-flex",
            alignItems: "center",
            padding: "8px 16px",
            borderRadius: "4px",
            backgroundColor: "#417690",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: "500",
          },
          textContent: `+ Add ${config.verboseName.toLowerCase()}`,
        }),
      ],
    });
  }

  private renderContent(): Node {
    const config = this.config!;

    if (this.errorMessage) {
      return this.renderError(this.errorMessage);
    }

    if (this.data.length === 0) {
      return this.renderEmpty();
    }

    return this.renderTable();
  }

  private renderTable(): Node {
    const config = this.config!;

    return new Container({
      dataset: { key: "table-container" },
      style: {
        backgroundColor: "#ffffff",
        border: "1px solid #cccccc",
        borderRadius: "8px",
        overflow: "hidden",
      },
      content: new Table({
        dataset: { key: "table" },
        style: {
          width: "100%",
          borderCollapse: "collapse",
        },
        content: [
          // Table header
          new Thead({
            dataset: { key: "thead" },
            style: {
              backgroundColor: "#f8f8f8",
            },
            content: new Tr({
              dataset: { key: "header-row" },
              content: config.columns.map((col) =>
                new Th({
                  dataset: { key: `th-${col.field}` },
                  style: {
                    padding: "12px 16px",
                    textAlign: "left",
                    fontWeight: "600",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    color: "#333333",
                    borderBottom: "2px solid #cccccc",
                  },
                  textContent: col.label,
                })
              ),
            }),
          }),
          // Table body
          new Tbody({
            dataset: { key: "tbody" },
            content: this.data.map((row) => this.renderRow(row)),
          }),
        ],
      }),
    });
  }

  private renderRow(row: Record<string, unknown>): Node {
    const config = this.config!;
    const id = String(row.id ?? "");

    return new Tr({
      dataset: { key: `row-${id}` },
      style: {
        cursor: "pointer",
      },
      onclick: () => this.handleRowClick(id),
      content: config.columns.map((col) => {
        const value = row[col.field];
        const displayValue = this.formatValue(value);

        return new Td({
          dataset: { key: `td-${col.field}` },
          style: {
            padding: "12px 16px",
            borderBottom: "1px solid #eeeeee",
            color: "#333333",
          },
          content: col.isLink
            ? new Anchor({
              href: `/admin/${this.modelName}/${id}/`,
              onclick: (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleRowClick(id);
              },
              style: {
                color: "#417690",
                fontWeight: "500",
                textDecoration: "none",
              },
              textContent: displayValue,
            })
            : new Span({
              textContent: displayValue,
            }),
        });
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
        backgroundColor: "#ffffff",
        borderRadius: "8px",
        border: "1px solid #cccccc",
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

  private renderEmpty(): Node {
    const config = this.config!;

    return new Container({
      dataset: { key: "empty" },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        borderRadius: "8px",
        border: "1px solid #cccccc",
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
            textContent: "📋",
          }),
          new Span({
            dataset: { key: "empty-message" },
            style: {
              color: "#666666",
              fontSize: "14px",
            },
            textContent: `No ${config.verboseNamePlural.toLowerCase()} found`,
          }),
        ],
      }),
    });
  }

  private renderError(message: string): Node {
    return new Container({
      dataset: { key: "error" },
      padding: "48px",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff5f5",
        borderRadius: "8px",
        border: "1px solid #ffcccc",
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
            },
            textContent: message,
          }),
        ],
      }),
    });
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "-";
    }

    if (typeof value === "boolean") {
      return value ? "✓" : "✗";
    }

    if (value instanceof Date) {
      return value.toLocaleString();
    }

    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return new Date(value).toLocaleString();
    }

    return String(value);
  }
}

// Register the custom element
AdminModelList.define("admin-model-list");
