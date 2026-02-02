/**
 * Admin Model Detail View
 *
 * Displays a single model instance with editable fields.
 * Supports both viewing/editing existing records and creating new ones.
 * Fetches model configuration from the REST API dynamically.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import {
  Anchor,
  Button,
  Div,
  Form,
  Heading2,
  Input,
  Label,
  Span,
  Textarea,
} from "@html-props/built-ins";
import { Column, Container, Row } from "@html-props/layout";
import {
  fetchModelConfig,
  type FieldConfig,
  type ModelConfig,
} from "../services/admin_config.ts";
import { authenticatedFetch } from "../services/auth.ts";
import { navigateTo } from "../navigation.ts";

// =============================================================================
// AdminModelDetail Component
// =============================================================================

/**
 * AdminModelDetail - Detail view for viewing/editing a single model instance
 */
export default class AdminModelDetail extends HTMLPropsMixin(HTMLElement, {
  modelName: prop(""),
  objectId: prop(""), // Empty = add mode

  // Config loaded from API
  config: prop<ModelConfig | null>(null),

  // Form data
  formData: prop<Record<string, unknown>>({}),

  // State
  isLoading: prop(true),
  isSaving: prop(false),
  errorMessage: prop(""),
  successMessage: prop(""),

  // Styling
  style: {
    display: "block",
    flex: "1",
  },
}) {
  // ===========================================================================
  // Computed
  // ===========================================================================

  get isAddMode(): boolean {
    return !this.objectId;
  }

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
      // First, load the model config from API
      const config = await fetchModelConfig(this.modelName);

      if (!config) {
        this.errorMessage = `Unknown model: ${this.modelName}`;
        this.isLoading = false;
        return;
      }

      this.config = config;

      // If editing, load the object data
      if (!this.isAddMode) {
        await this.loadObjectData();
      } else {
        // Initialize empty form for add mode
        this.formData = {};
        this.isLoading = false;
      }
    } catch (error) {
      console.error("[AdminModelDetail] Failed to load config:", error);
      this.errorMessage = error instanceof Error
        ? error.message
        : "Failed to load configuration";
      this.isLoading = false;
    }
  }

  private async loadObjectData(): Promise<void> {
    const config = this.config;
    if (!config) return;

    try {
      const url = `${config.apiEndpoint}${this.objectId}/`;

      const response = await authenticatedFetch(url, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`${config.verboseName} not found`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.formData = await response.json();
    } catch (error) {
      console.error("[AdminModelDetail] Failed to load data:", error);
      this.errorMessage = error instanceof Error
        ? error.message
        : "Failed to load data";
    } finally {
      this.isLoading = false;
    }
  }

  // ===========================================================================
  // Form Handling
  // ===========================================================================

  private handleFieldChange = (fieldName: string, value: unknown): void => {
    this.formData = {
      ...this.formData,
      [fieldName]: value,
    };
  };

  private handleSubmit = async (event: Event): Promise<void> => {
    event.preventDefault();

    const config = this.config;
    if (!config) return;

    this.isSaving = true;
    this.errorMessage = "";
    this.successMessage = "";

    try {
      // Prepare data - exclude readonly fields
      const data: Record<string, unknown> = {};
      for (const field of config.fields) {
        if (!field.readOnly && field.type !== "readonly") {
          data[field.name] = this.formData[field.name];
        }
      }

      const url = this.isAddMode
        ? config.apiEndpoint
        : `${config.apiEndpoint}${this.objectId}/`;

      const response = await authenticatedFetch(url, {
        method: this.isAddMode ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
            errorData.message ||
            `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const result = await response.json();

      if (this.isAddMode) {
        // Navigate to the new record
        const newId = result.id;
        navigateTo(`/admin/${this.modelName}/${newId}/`);
      } else {
        this.formData = result;
        this.successMessage = "Changes saved successfully";
      }
    } catch (error) {
      console.error("[AdminModelDetail] Failed to save:", error);
      this.errorMessage = error instanceof Error
        ? error.message
        : "Failed to save";
    } finally {
      this.isSaving = false;
    }
  };

  private handleDelete = async (): Promise<void> => {
    const config = this.config;
    if (!config || this.isAddMode) return;

    if (
      !confirm(
        `Are you sure you want to delete this ${config.verboseName.toLowerCase()}?`,
      )
    ) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = "";

    try {
      const url = `${config.apiEndpoint}${this.objectId}/`;

      const response = await authenticatedFetch(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Navigate back to list
      navigateTo(`/admin/${this.modelName}/`);
    } catch (error) {
      console.error("[AdminModelDetail] Failed to delete:", error);
      this.errorMessage = error instanceof Error
        ? error.message
        : "Failed to delete";
      this.isSaving = false;
    }
  };

  private handleCancel = (event: Event): void => {
    event.preventDefault();
    navigateTo(`/admin/${this.modelName}/`);
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
      dataset: { key: "model-detail" },
      padding: "24px",
      style: {
        maxWidth: "800px",
        margin: "0 auto",
      },
      content: new Column({
        gap: "24px",
        content: [
          this.renderHeader(),
          this.renderMessages(),
          this.renderForm(),
        ],
      }),
    });
  }

  private renderHeader(): Node {
    const config = this.config!;
    const title = this.isAddMode
      ? `Add ${config.verboseName.toLowerCase()}`
      : `Change ${config.verboseName.toLowerCase()}`;

    return new Heading2({
      dataset: { key: "title" },
      textContent: title,
      style: {
        fontSize: "24px",
        fontWeight: "600",
        margin: "0",
        color: "#333333",
      },
    });
  }

  private renderMessages(): Node {
    const messages: Node[] = [];

    if (this.errorMessage) {
      messages.push(
        new Container({
          dataset: { key: "error-message" },
          padding: "12px 16px",
          radius: "4px",
          style: {
            backgroundColor: "#fff5f5",
            border: "1px solid #ffcccc",
          },
          content: new Span({
            style: { color: "#ba2121" },
            textContent: this.errorMessage,
          }),
        }),
      );
    }

    if (this.successMessage) {
      messages.push(
        new Container({
          dataset: { key: "success-message" },
          padding: "12px 16px",
          radius: "4px",
          style: {
            backgroundColor: "#f0fff0",
            border: "1px solid #99cc99",
          },
          content: new Span({
            style: { color: "#006600" },
            textContent: this.successMessage,
          }),
        }),
      );
    }

    return new Column({
      dataset: { key: "messages" },
      gap: "8px",
      content: messages,
    });
  }

  private renderForm(): Node {
    const config = this.config!;

    return new Container({
      dataset: { key: "form-container" },
      padding: "24px",
      radius: "8px",
      color: "#ffffff",
      style: {
        border: "1px solid #cccccc",
      },
      content: new Form({
        dataset: { key: "form" },
        onsubmit: this.handleSubmit,
        content: new Column({
          gap: "20px",
          content: [
            // Fields
            ...config.fields.map((field) => this.renderField(field)),
            // Actions
            this.renderActions(),
          ],
        }),
      }),
    });
  }

  private renderField(field: FieldConfig): Node {
    const value = this.formData[field.name];
    const isReadonly = field.readOnly || field.type === "readonly";

    return new Column({
      dataset: { key: `field-${field.name}` },
      gap: "6px",
      content: [
        // Label
        new Label({
          htmlFor: `field-${field.name}`,
          style: {
            fontSize: "13px",
            fontWeight: "600",
            color: "#333333",
          },
          textContent: field.label + (field.required ? " *" : ""),
        }),
        // Input based on type
        this.renderFieldInput(field, value, isReadonly),
      ],
    });
  }

  private renderFieldInput(
    field: FieldConfig,
    value: unknown,
    isReadonly: boolean,
  ): Node {
    const commonStyle = {
      width: "100%",
      padding: "8px 12px",
      fontSize: "14px",
      border: "1px solid #cccccc",
      borderRadius: "4px",
      backgroundColor: isReadonly ? "#f5f5f5" : "#ffffff",
    };

    // Map API field types to input types
    const fieldType = field.type.toLowerCase();

    if (fieldType === "readonly" || isReadonly) {
      return new Div({
        dataset: { key: `input-${field.name}` },
        style: {
          ...commonStyle,
          color: "#666666",
        },
        textContent: this.formatValue(value),
      });
    }

    if (fieldType === "textarea") {
      return new Textarea({
        id: `field-${field.name}`,
        dataset: { key: `input-${field.name}` },
        value: String(value ?? ""),
        disabled: this.isSaving,
        rows: 4,
        style: {
          ...commonStyle,
          resize: "vertical",
        },
        oninput: (e: Event) => {
          const target = e.target as HTMLTextAreaElement;
          this.handleFieldChange(field.name, target.value);
        },
      } as Record<string, unknown>);
    }

    if (fieldType === "boolean") {
      return new Row({
        dataset: { key: `input-${field.name}` },
        gap: "8px",
        crossAxisAlignment: "center",
        content: [
          new Input({
            id: `field-${field.name}`,
            type: "checkbox",
            checked: Boolean(value),
            disabled: this.isSaving,
            style: {
              width: "18px",
              height: "18px",
              accentColor: "#417690",
            },
            onchange: (e: Event) => {
              const target = e.target as HTMLInputElement;
              this.handleFieldChange(field.name, target.checked);
            },
          } as Record<string, unknown>),
          new Span({
            style: { color: "#666666", fontSize: "13px" },
            textContent: value ? "Yes" : "No",
          }),
        ],
      });
    }

    if (fieldType === "select" && field.choices) {
      const select = document.createElement("select");
      select.id = `field-${field.name}`;
      select.disabled = this.isSaving;
      Object.assign(select.style, commonStyle);

      // Empty option
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "---------";
      select.appendChild(emptyOption);

      // Options from choices
      for (const choice of field.choices) {
        const option = document.createElement("option");
        option.value = choice.value;
        option.textContent = choice.label;
        option.selected = value === choice.value;
        select.appendChild(option);
      }

      select.addEventListener("change", () => {
        this.handleFieldChange(field.name, select.value || null);
      });

      return select;
    }

    if (fieldType === "datetime" || fieldType === "date") {
      return new Input({
        id: `field-${field.name}`,
        dataset: { key: `input-${field.name}` },
        type: fieldType === "datetime" ? "datetime-local" : "date",
        value: value
          ? String(value).slice(0, fieldType === "datetime" ? 16 : 10)
          : "",
        disabled: this.isSaving,
        style: commonStyle,
        oninput: (e: Event) => {
          const target = e.target as HTMLInputElement;
          this.handleFieldChange(
            field.name,
            target.value ? new Date(target.value).toISOString() : null,
          );
        },
      } as Record<string, unknown>);
    }

    if (fieldType === "number") {
      return new Input({
        id: `field-${field.name}`,
        dataset: { key: `input-${field.name}` },
        type: "number",
        value: value !== undefined && value !== null ? String(value) : "",
        disabled: this.isSaving,
        style: commonStyle,
        oninput: (e: Event) => {
          const target = e.target as HTMLInputElement;
          this.handleFieldChange(
            field.name,
            target.value ? Number(target.value) : null,
          );
        },
      } as Record<string, unknown>);
    }

    if (fieldType === "email") {
      return new Input({
        id: `field-${field.name}`,
        dataset: { key: `input-${field.name}` },
        type: "email",
        value: String(value ?? ""),
        disabled: this.isSaving,
        required: field.required,
        style: commonStyle,
        oninput: (e: Event) => {
          const target = e.target as HTMLInputElement;
          this.handleFieldChange(field.name, target.value);
        },
      } as Record<string, unknown>);
    }

    // Default: text input
    return new Input({
      id: `field-${field.name}`,
      dataset: { key: `input-${field.name}` },
      type: "text",
      value: String(value ?? ""),
      disabled: this.isSaving,
      required: field.required,
      style: commonStyle,
      oninput: (e: Event) => {
        const target = e.target as HTMLInputElement;
        this.handleFieldChange(field.name, target.value);
      },
    } as Record<string, unknown>);
  }

  private renderActions(): Node {
    return new Row({
      dataset: { key: "actions" },
      mainAxisAlignment: "spaceBetween",
      crossAxisAlignment: "center",
      style: {
        marginTop: "16px",
        paddingTop: "16px",
        borderTop: "1px solid #eeeeee",
      },
      content: [
        // Delete button (only for existing records)
        this.isAddMode
          ? new Div({ dataset: { key: "delete-spacer" } })
          : new Button({
            dataset: { key: "delete-button" },
            type: "button",
            onclick: this.handleDelete,
            disabled: this.isSaving,
            style: {
              padding: "8px 16px",
              borderRadius: "4px",
              border: "none",
              backgroundColor: "#ba2121",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            },
            textContent: "Delete",
          } as Record<string, unknown>),
        // Save/Cancel buttons
        new Row({
          dataset: { key: "save-cancel" },
          gap: "12px",
          content: [
            new Anchor({
              dataset: { key: "cancel-button" },
              href: `/admin/${this.modelName}/`,
              onclick: this.handleCancel,
              style: {
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 16px",
                borderRadius: "4px",
                backgroundColor: "#f0f0f0",
                color: "#333333",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "500",
              },
              textContent: "Cancel",
            }),
            new Button({
              dataset: { key: "save-button" },
              type: "submit",
              disabled: this.isSaving,
              style: {
                padding: "8px 16px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "#417690",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
              },
              textContent: this.isSaving ? "Saving..." : "Save",
            } as Record<string, unknown>),
          ],
        }),
      ],
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
        maxWidth: "800px",
        margin: "24px auto",
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
        maxWidth: "800px",
        margin: "24px auto",
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
          new Anchor({
            dataset: { key: "back-link" },
            href: `/admin/${this.modelName}/`,
            onclick: this.handleCancel,
            style: {
              color: "#417690",
              textDecoration: "none",
            },
            textContent: "← Back to list",
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
      return value ? "Yes" : "No";
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
AdminModelDetail.define("admin-model-detail");
