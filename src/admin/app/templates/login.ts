/**
 * Admin Login View
 *
 * Django-style login page for the admin panel.
 * Requires admin privileges to access the admin interface.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import {
  Anchor,
  Button,
  Div,
  Form,
  Heading1,
  Input,
  Label,
  Paragraph,
  Span,
} from "@html-props/built-ins";
import { Column, Container } from "@html-props/layout";
import { login } from "../services/auth.ts";

// =============================================================================
// AdminLogin Component
// =============================================================================

/**
 * AdminLogin - Login page for admin access
 */
export default class AdminLogin extends HTMLPropsMixin(HTMLElement, {
  // Form state
  email: prop(""),
  password: prop(""),

  // UI state
  isLoading: prop(false),
  errorMessage: prop(""),

  // Callback for successful login
  onLoginSuccess: prop<(() => void) | null>(null),

  // Styling
  style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#417690",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
}) {
  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  private handleEmailInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.email = input.value;
    this.errorMessage = "";
  };

  private handlePasswordInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.password = input.value;
    this.errorMessage = "";
  };

  private handleSubmit = async (event: Event): Promise<void> => {
    event.preventDefault();

    if (!this.email || !this.password) {
      this.errorMessage = "Please enter both email and password.";
      return;
    }

    this.isLoading = true;
    this.errorMessage = "";

    try {
      await login({
        email: this.email,
        password: this.password,
      });

      // Clear form
      this.email = "";
      this.password = "";

      // Notify parent of successful login
      if (this.onLoginSuccess) {
        this.onLoginSuccess();
      }
    } catch (error) {
      console.error("[AdminLogin] Login failed:", error);
      this.errorMessage = error instanceof Error
        ? error.message
        : "Login failed. Please try again.";
    } finally {
      this.isLoading = false;
    }
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" && !this.isLoading) {
      this.handleSubmit(event);
    }
  };

  // ===========================================================================
  // Render
  // ===========================================================================

  render(): Node | Node[] | null {
    return new Container({
      dataset: { key: "login-container" },
      style: {
        width: "100%",
        maxWidth: "400px",
        margin: "0 auto",
        padding: "20px",
      },
      content: new Column({
        gap: "0",
        content: [
          // Header
          this.renderHeader(),
          // Login form
          this.renderForm(),
          // Footer
          this.renderFooter(),
        ],
      }),
    });
  }

  private renderHeader(): Node {
    return new Container({
      dataset: { key: "login-header" },
      style: {
        backgroundColor: "#205067",
        padding: "20px 30px",
        borderRadius: "8px 8px 0 0",
        textAlign: "center",
      },
      content: new Column({
        gap: "8px",
        crossAxisAlignment: "center",
        content: [
          new Heading1({
            dataset: { key: "title" },
            textContent: "CoMachine Admin",
            style: {
              color: "#ffffff",
              fontSize: "24px",
              fontWeight: "600",
              margin: "0",
            },
          }),
          new Paragraph({
            dataset: { key: "subtitle" },
            textContent: "Sign in to manage your site",
            style: {
              color: "#79aec8",
              fontSize: "14px",
              margin: "0",
            },
          }),
        ],
      }),
    });
  }

  private renderForm(): Node {
    return new Container({
      dataset: { key: "login-form" },
      style: {
        backgroundColor: "#ffffff",
        padding: "30px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      },
      content: new Form({
        dataset: { key: "form" },
        onsubmit: this.handleSubmit,
        content: new Column({
          gap: "20px",
          content: [
            // Error message
            this.errorMessage ? this.renderError() : null,

            // Email field
            this.renderEmailField(),

            // Password field
            this.renderPasswordField(),

            // Submit button
            this.renderSubmitButton(),
          ].filter(Boolean) as Node[],
        }),
      }),
    });
  }

  private renderError(): Node {
    return new Container({
      dataset: { key: "error" },
      style: {
        backgroundColor: "#ffebee",
        border: "1px solid #ef5350",
        borderRadius: "4px",
        padding: "12px 16px",
      },
      content: new Span({
        dataset: { key: "error-text" },
        textContent: this.errorMessage,
        style: {
          color: "#c62828",
          fontSize: "14px",
        },
      }),
    });
  }

  private renderEmailField(): Node {
    return new Column({
      dataset: { key: "email-field" },
      gap: "6px",
      content: [
        new Label({
          dataset: { key: "email-label" },
          htmlFor: "admin-email",
          textContent: "Email address",
          style: {
            color: "#333333",
            fontSize: "14px",
            fontWeight: "500",
          },
        }),
        new Input({
          dataset: { key: "email-input" },
          id: "admin-email",
          type: "email",
          name: "email",
          placeholder: "admin@example.com",
          value: this.email,
          oninput: this.handleEmailInput,
          onkeydown: this.handleKeyDown,
          disabled: this.isLoading,
          autocomplete: "email",
          required: true,
          style: {
            width: "100%",
            padding: "12px 14px",
            fontSize: "14px",
            border: "1px solid #cccccc",
            borderRadius: "4px",
            boxSizing: "border-box",
            outline: "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
          },
        }),
      ],
    });
  }

  private renderPasswordField(): Node {
    return new Column({
      dataset: { key: "password-field" },
      gap: "6px",
      content: [
        new Label({
          dataset: { key: "password-label" },
          htmlFor: "admin-password",
          textContent: "Password",
          style: {
            color: "#333333",
            fontSize: "14px",
            fontWeight: "500",
          },
        }),
        new Input({
          dataset: { key: "password-input" },
          id: "admin-password",
          type: "password",
          name: "password",
          placeholder: "Enter your password",
          value: this.password,
          oninput: this.handlePasswordInput,
          onkeydown: this.handleKeyDown,
          disabled: this.isLoading,
          autocomplete: "current-password",
          required: true,
          style: {
            width: "100%",
            padding: "12px 14px",
            fontSize: "14px",
            border: "1px solid #cccccc",
            borderRadius: "4px",
            boxSizing: "border-box",
            outline: "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
          },
        }),
      ],
    });
  }

  private renderSubmitButton(): Node {
    return new Button({
      dataset: { key: "submit-button" },
      type: "submit",
      disabled: this.isLoading,
      style: {
        width: "100%",
        padding: "14px 20px",
        fontSize: "16px",
        fontWeight: "600",
        color: "#ffffff",
        backgroundColor: this.isLoading ? "#6c8a98" : "#417690",
        border: "none",
        borderRadius: "4px",
        cursor: this.isLoading ? "not-allowed" : "pointer",
        transition: "background-color 0.2s",
        marginTop: "8px",
      },
      textContent: this.isLoading ? "Signing in..." : "Sign in",
    });
  }

  private renderFooter(): Node {
    return new Container({
      dataset: { key: "login-footer" },
      style: {
        backgroundColor: "#f5f5f5",
        padding: "16px 30px",
        borderRadius: "0 0 8px 8px",
        textAlign: "center",
        borderTop: "1px solid #eeeeee",
      },
      content: new Anchor({
        dataset: { key: "back-link" },
        href: "/",
        textContent: "← Back to site",
        style: {
          color: "#417690",
          textDecoration: "none",
          fontSize: "14px",
        },
      }),
    });
  }
}

// Register the custom element
AdminLogin.define("admin-login");
