/**
 * Alexi Admin Base Template
 *
 * Base HTML template for the admin MPA.
 * All other templates use this as their outer shell.
 *
 * @module
 */

// =============================================================================
// Types
// =============================================================================

export interface BaseTemplateContext {
  /** Page title (e.g. "Dashboard") */
  title: string;
  /** Admin site title (e.g. "Alexi Administration") */
  siteTitle: string;
  /** URL prefix for the admin (e.g. "/admin") */
  urlPrefix: string;
  /** Currently logged-in user's email, if any */
  userEmail?: string;
  /** Flash messages to display */
  messages?: Array<
    { level: "success" | "error" | "warning" | "info"; text: string }
  >;
  /** Navigation items for the sidebar */
  navItems?: Array<{ name: string; url: string; active?: boolean }>;
  /** Inner HTML content for the <main> region */
  content: string;
}

// =============================================================================
// Helpers
// =============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function renderMessages(
  messages?: BaseTemplateContext["messages"],
): string {
  if (!messages || messages.length === 0) return "";
  return messages
    .map(
      (m) =>
        `<div class="admin-alert admin-alert-${
          escapeHtml(m.level)
        }" role="alert">${escapeHtml(m.text)}</div>`,
    )
    .join("\n");
}

function renderNavItems(
  items: BaseTemplateContext["navItems"],
  urlPrefix: string,
): string {
  if (!items || items.length === 0) return "";
  return items
    .map(
      (item) =>
        `<a href="${escapeHtml(item.url)}" class="admin-sidebar-item${
          item.active ? " active" : ""
        }">${escapeHtml(item.name)}</a>`,
    )
    .join("\n");
}

// =============================================================================
// Base Template
// =============================================================================

/**
 * Render the base admin page template.
 */
export function baseTemplate(ctx: BaseTemplateContext): string {
  const {
    title,
    siteTitle,
    urlPrefix,
    userEmail,
    messages,
    navItems,
    content,
  } = ctx;

  return `<!DOCTYPE html>
<html lang="en" data-theme="auto">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ${escapeHtml(siteTitle)}</title>
  <!-- Restore saved theme before first paint to avoid flash -->
  <script>(function(){var t=localStorage.getItem("adminTheme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);})()</script>
  <link rel="stylesheet" href="${escapeHtml(urlPrefix)}/static/css/admin.css">
  <script src="https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js" defer></script>
  <script src="${escapeHtml(urlPrefix)}/static/js/admin.js" defer></script>
</head>
<body hx-boost="true">
  <div class="admin-layout">

    <!-- Header -->
    <header class="admin-header">
      <div class="admin-header-brand">
        <a href="${escapeHtml(urlPrefix)}/" class="admin-header-title">${
    escapeHtml(siteTitle)
  }</a>
      </div>
      <nav class="admin-header-nav">
        <button
          class="admin-theme-toggle"
          title="Toggle color theme"
          aria-label="Toggle color theme"
          onclick="window.adminTheme && window.adminTheme.toggle()"
        >&#9680;</button>
        ${
    userEmail
      ? `<span class="admin-header-link">${escapeHtml(userEmail)}</span>
        <a href="${escapeHtml(urlPrefix)}/logout/" class="admin-header-link"
           hx-boost="false"
           onclick="window.adminAuth && window.adminAuth.removeToken(); return true;">Log out</a>`
      : `<a href="${
        escapeHtml(urlPrefix)
      }/login/" class="admin-header-link">Log in</a>`
  }
      </nav>
    </header>

    <div class="admin-main">

      <!-- Sidebar -->
      <nav class="admin-sidebar" aria-label="Admin navigation">
        <div class="admin-sidebar-nav">
          ${
    navItems && navItems.length > 0
      ? `<div class="admin-sidebar-section">
            <div class="admin-sidebar-section-title">Navigation</div>
            ${renderNavItems(navItems, urlPrefix)}
          </div>`
      : ""
  }
        </div>
      </nav>

      <!-- Content -->
      <div class="admin-content-wrapper">
        <main class="admin-content" id="main-content">
          ${renderMessages(messages)}
          ${content}
        </main>
      </div>

    </div><!-- /.admin-main -->
  </div><!-- /.admin-layout -->
</body>
</html>`;
}

// =============================================================================
// Login Template (no sidebar/header — standalone page)
// =============================================================================

export interface LoginTemplateContext {
  siteTitle: string;
  urlPrefix: string;
  error?: string;
  next?: string;
}

/**
 * Render the login page (standalone, no sidebar).
 */
export function loginTemplate(ctx: LoginTemplateContext): string {
  const { siteTitle, urlPrefix, error, next } = ctx;

  return `<!DOCTYPE html>
<html lang="en" data-theme="auto">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log in | ${escapeHtml(siteTitle)}</title>
  <!-- Restore saved theme before first paint to avoid flash -->
  <script>(function(){var t=localStorage.getItem("adminTheme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);})()</script>
  <link rel="stylesheet" href="${escapeHtml(urlPrefix)}/static/css/admin.css">
  <script src="https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js" defer></script>
  <script src="${escapeHtml(urlPrefix)}/static/js/admin.js" defer></script>
</head>
<body>
  <div class="admin-login-wrapper">
    <div class="admin-login-box">
      <div class="admin-login-header">
        <h1 class="admin-login-title">${escapeHtml(siteTitle)}</h1>
        <p class="admin-login-subtitle">Please log in to continue.</p>
      </div>
      ${
    error
      ? `<div class="admin-alert admin-alert-error">${escapeHtml(error)}</div>`
      : ""
  }
      <form
        method="POST"
        action="${escapeHtml(urlPrefix)}/login/"
        hx-post="${escapeHtml(urlPrefix)}/login/"
        hx-target="body"
        hx-swap="outerHTML"
      >
        ${
    next ? `<input type="hidden" name="next" value="${escapeHtml(next)}">` : ""
  }
        <div class="admin-form-row">
          <label class="admin-label admin-label-required" for="email">Email address</label>
          <input
            class="admin-input"
            type="email"
            id="email"
            name="email"
            autocomplete="email"
            required
            autofocus
          >
        </div>
        <div class="admin-form-row">
          <label class="admin-label admin-label-required" for="password">Password</label>
          <input
            class="admin-input"
            type="password"
            id="password"
            name="password"
            autocomplete="current-password"
            required
          >
        </div>
        <div class="admin-form-actions">
          <button type="submit" class="admin-btn admin-btn-primary" style="width:100%;">Log in</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;
}
