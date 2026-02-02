/**
 * Alexi Admin App
 *
 * Main admin application component using HTML Props.
 * This is the root component for the admin SPA.
 *
 * Uses Django-style URL routing with resolve() and views.ts lazy-loading.
 *
 * @module
 */

import { HTMLPropsMixin, prop } from "@html-props/core";
import { Anchor, Div, Nav, Span } from "@html-props/built-ins";
import { Column, Container, Row } from "@html-props/layout";

// Import URL resolution and patterns
import { resolve, reverse, type SPAResolveResult } from "./spa_urls.ts";
import { urlpatterns } from "./urls.ts";
import type { ViewContext } from "./types.ts";

// Import navigation (re-export for backward compatibility)
import { navigateTo } from "./navigation.ts";
export { navigateTo };

// Import auth service
import { type AdminUser, getAuthState, logout } from "./services/auth.ts";

// =============================================================================
// Types
// =============================================================================

interface RouteInfo {
  /** Route name (e.g., "admin:model_changelist") */
  name?: string;
  /** URL parameters */
  params: Record<string, string>;
  /** Current path */
  path: string;
}

// =============================================================================
// AdminApp Component
// =============================================================================

/**
 * AdminApp - Root component for the admin SPA
 *
 * Handles:
 * - Routing between dashboard, model list, and model detail views using resolve()
 * - Authentication state (admin-only access)
 * - Global error handling
 */
export default class AdminApp extends HTMLPropsMixin(HTMLElement, {
  // Current route info
  currentPath: prop("/admin/"),
  routeInfo: prop<RouteInfo>({ params: {}, path: "/admin/" }),

  // Content rendered by current view
  viewContent: prop<Node | null>(null),

  // Auth state
  isAuthenticated: prop(false),
  currentUser: prop<AdminUser | null>(null),

  // Loading state
  isLoading: prop(true),

  // Error message
  errorMessage: prop(""),

  // Site title
  siteTitle: prop("Admin"),

  // Styling
  style: {
    display: "block",
    width: "100%",
    height: "100%",
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
}) {
  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  mountedCallback(): void {
    // Check auth state
    this.checkAuth();

    // Handle initial route
    this.handleRoute();

    // Listen for navigation
    globalThis.addEventListener("popstate", this.handlePopState);
  }

  unmountedCallback(): void {
    globalThis.removeEventListener("popstate", this.handlePopState);
  }

  // ===========================================================================
  // Auth
  // ===========================================================================

  /**
   * Check authentication state from storage
   */
  private checkAuth(): void {
    const authState = getAuthState();
    this.isAuthenticated = authState.isAuthenticated && authState.isAdmin;
    this.currentUser = authState.user;
  }

  // ===========================================================================
  // Routing
  // ===========================================================================

  private handlePopState = (): void => {
    this.handleRoute();
  };

  /**
   * Handle current route using resolve() and views.ts
   */
  private async handleRoute(): Promise<void> {
    const path = globalThis.location.pathname;

    // Normalize path (remove /admin prefix for resolution)
    const adminPath = path.replace(/^\/admin\/?/, "").replace(/\/$/, "");
    const normalizedPath = adminPath || "";

    this.currentPath = path;
    this.isLoading = true;
    this.errorMessage = "";

    // Check authentication - redirect to login if not authenticated
    if (!this.isAuthenticated && normalizedPath !== "login") {
      this.routeInfo = { params: {}, path, name: "admin:login" };
      await this.renderLoginView();
      return;
    }

    // Resolve the route using URL patterns
    const result = resolve(normalizedPath, urlpatterns);

    if (!result) {
      // 404 - No matching route
      console.warn(`[AdminApp] No route found for: ${normalizedPath}`);
      this.viewContent = this.renderNotFound();
      this.isLoading = false;
      return;
    }

    // Update route info
    this.routeInfo = {
      name: result.name,
      params: result.params,
      path,
    };

    // Create view context
    const viewCtx: ViewContext = {
      path,
      params: result.params,
      query: new URLSearchParams(globalThis.location.search),
      navigate: navigateTo,
      reverse: (name: string, params?: Record<string, string>) =>
        "/admin" + reverse(name, params ?? {}, urlpatterns),
    };

    // Call the view function (which lazy-loads the template)
    try {
      const content = await result.view(viewCtx);
      this.viewContent = content;
    } catch (error) {
      console.error(`[AdminApp] Error rendering view:`, error);
      this.errorMessage = error instanceof Error ? error.message : "Failed to render view";
      this.viewContent = this.renderError();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Render login view (special case - doesn't require auth)
   */
  private async renderLoginView(): Promise<void> {
    try {
      const { default: AdminLogin } = await import("./templates/login.ts");
      this.viewContent = new AdminLogin({
        onLoginSuccess: this.handleLoginSuccess,
      });
    } catch (error) {
      console.error("[AdminApp] Failed to load login view:", error);
      this.errorMessage = "Failed to load login page";
      this.viewContent = this.renderError();
    } finally {
      this.isLoading = false;
    }
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  private handleLoginSuccess = (): void => {
    this.checkAuth();
    navigateTo("/admin/");
  };

  private handleLogout = async (event: Event): Promise<void> => {
    event.preventDefault();
    await logout();
    this.isAuthenticated = false;
    this.currentUser = null;
    navigateTo("/admin/login/");
  };

  private handleNavClick = (href: string, event: Event): void => {
    event.preventDefault();
    navigateTo(href);
  };

  private handleBackToSite = (event: Event): void => {
    event.preventDefault();
    globalThis.location.href = "/";
  };

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private humanize(str: string): string {
    return str
      .replace(/([A-Z])/g, " $1")
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Check if current route is login page
   */
  private get isLoginPage(): boolean {
    return this.routeInfo.name === "admin:login" ||
      this.currentPath.includes("/login");
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  render(): Node | Node[] | null {
    // Login page gets full-page treatment (no header/breadcrumb)
    if (this.isLoginPage) {
      return this.isLoading ? this.renderLoading() : this.viewContent;
    }

    return new Column({
      style: {
        minHeight: "100vh",
      },
      content: [
        this.renderHeader(),
        this.renderBreadcrumb(),
        this.isLoading ? this.renderLoading() : this.viewContent,
      ],
    });
  }

  private renderHeader(): Node {
    return new Container({
      dataset: { key: "header" },
      style: {
        background: "linear-gradient(to bottom, #417690 0%, #205067 100%)",
        color: "#ffffff",
        padding: "12px 24px",
      },
      content: new Row({
        mainAxisAlignment: "spaceBetween",
        crossAxisAlignment: "center",
        content: [
          // Site title (link to dashboard)
          new Anchor({
            dataset: { key: "site-title" },
            href: "/admin/",
            onclick: (e: Event) => this.handleNavClick("/admin/", e),
            style: {
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "20px",
              fontWeight: "600",
            },
            textContent: this.siteTitle,
          }),
          // Right side: user info and links
          new Row({
            dataset: { key: "header-right" },
            gap: "16px",
            crossAxisAlignment: "center",
            content: [
              // User info (if logged in)
              this.currentUser
                ? new Span({
                  dataset: { key: "user-info" },
                  textContent: `Welcome, ${this.currentUser.firstName || this.currentUser.email}`,
                  style: {
                    color: "#79aec8",
                    fontSize: "14px",
                  },
                })
                : null,
              // Logout link (if logged in)
              this.isAuthenticated
                ? new Anchor({
                  dataset: { key: "logout-link" },
                  href: "#",
                  onclick: this.handleLogout,
                  style: {
                    color: "#79aec8",
                    textDecoration: "none",
                    fontSize: "14px",
                  },
                  textContent: "Log out",
                })
                : null,
              // Back to site link
              new Anchor({
                dataset: { key: "back-link" },
                href: "/",
                onclick: this.handleBackToSite,
                style: {
                  color: "#79aec8",
                  textDecoration: "none",
                  fontSize: "14px",
                },
                textContent: "← Back to Site",
              }),
            ].filter(Boolean) as Node[],
          }),
        ],
      }),
    });
  }

  private renderBreadcrumb(): Node {
    const breadcrumbs: { label: string; href?: string }[] = [
      { label: "Home", href: "/admin/" },
    ];

    const { params, name } = this.routeInfo;

    // Add model name if on model page
    if (params.model) {
      const modelLabel = this.humanize(params.model);

      if (name === "admin:model_changelist") {
        breadcrumbs.push({ label: modelLabel });
      } else {
        breadcrumbs.push({
          label: modelLabel,
          href: `/admin/${params.model}/`,
        });

        if (name === "admin:model_change" && params.id) {
          breadcrumbs.push({ label: `#${params.id}` });
        } else if (name === "admin:model_add") {
          breadcrumbs.push({ label: "Add" });
        } else if (name === "admin:model_delete" && params.id) {
          breadcrumbs.push({ label: `Delete #${params.id}` });
        }
      }
    }

    const crumbNodes: Node[] = [];

    breadcrumbs.forEach((crumb, index) => {
      // Separator
      if (index > 0) {
        crumbNodes.push(
          new Span({
            dataset: { key: `sep-${index}` },
            style: {
              color: "#666666",
              margin: "0 8px",
            },
            textContent: "›",
          }),
        );
      }

      // Crumb link or text
      if (crumb.href && index < breadcrumbs.length - 1) {
        crumbNodes.push(
          new Anchor({
            dataset: { key: `crumb-${index}` },
            href: crumb.href,
            onclick: (e: Event) => this.handleNavClick(crumb.href!, e),
            style: {
              color: "#666666",
              textDecoration: "none",
            },
            textContent: crumb.label,
          }),
        );
      } else {
        crumbNodes.push(
          new Span({
            dataset: { key: `crumb-${index}` },
            style: {
              color: "#333333",
            },
            textContent: crumb.label,
          }),
        );
      }
    });

    return new Nav({
      dataset: { key: "breadcrumb" },
      style: {
        backgroundColor: "#ffffff",
        padding: "12px 24px",
        borderBottom: "1px solid #cccccc",
        fontSize: "13px",
      },
      content: crumbNodes,
    });
  }

  private renderLoading(): Node {
    return new Container({
      dataset: { key: "loading" },
      padding: "48px",
      style: {
        flex: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
        flex: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
            textContent: this.errorMessage,
          }),
        ],
      }),
    });
  }

  private renderNotFound(): Node {
    return new Container({
      dataset: { key: "not-found" },
      padding: "48px",
      style: {
        flex: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
      content: new Column({
        gap: "16px",
        crossAxisAlignment: "center",
        content: [
          new Span({
            dataset: { key: "404-code" },
            style: {
              color: "#999999",
              fontSize: "48px",
            },
            textContent: "404",
          }),
          new Span({
            dataset: { key: "404-message" },
            style: {
              color: "#666666",
              fontSize: "14px",
            },
            textContent: "Page not found",
          }),
        ],
      }),
    });
  }
}

// Register the custom element
AdminApp.define("admin-app");
