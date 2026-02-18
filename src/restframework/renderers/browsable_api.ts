/**
 * Browsable API Renderer for Alexi REST Framework
 *
 * Provides a web-based HTML interface for exploring and interacting with the API,
 * similar to Django REST Framework's browsable API.
 *
 * @module @alexi/restframework/renderers/browsable_api
 */

import { BaseRenderer, type RenderContext } from "./renderers.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the BrowsableAPIRenderer
 */
export interface BrowsableAPIRendererOptions {
  /** API title shown in the page header */
  title?: string;
  /** Token storage key in localStorage (default: "alexi_auth_tokens") */
  tokenStorageKey?: string;
  /** Login URL for the login form (default: "/api/auth/login/") */
  loginUrl?: string;
  /** Logout URL (default: "/api/auth/logout/") */
  logoutUrl?: string;
  /** "Me" URL to fetch current user info (default: "/api/auth/me/") */
  meUrl?: string;
}

/**
 * Render context passed from the ViewSet to the renderer
 */
export interface BrowsableAPIContext {
  /** HTTP request that produced this response */
  request?: Request;
  /** HTTP method */
  method?: string;
  /** Allowed HTTP methods for the current URL */
  allowedMethods?: string[];
  /** Response status code */
  statusCode?: number;
  /** Name of the current action */
  action?: string;
  /** URL path parameters */
  params?: Record<string, string>;
  /** Extra renderer context */
  [key: string]: unknown;
}

// ============================================================================
// BrowsableAPIRenderer
// ============================================================================

/**
 * Browsable API Renderer
 *
 * Produces an HTML page that allows developers to browse and interact with the
 * REST API directly from a web browser, similar to DRF's browsable API.
 *
 * Features:
 * - Formatted JSON response with syntax highlighting
 * - Auto-generated forms for POST/PUT/PATCH requests
 * - Login/logout with JWT token management
 * - Pagination controls (next/previous)
 * - Responsive design
 *
 * @example
 * ```ts
 * class MyViewSet extends ModelViewSet {
 *   renderer_classes = [JSONRenderer, BrowsableAPIRenderer];
 * }
 * // Browser request (Accept: text/html) → HTML interface
 * // API request (Accept: application/json) → JSON response
 * ```
 */
export class BrowsableAPIRenderer extends BaseRenderer {
  readonly mediaType = "text/html";
  readonly format = "api";
  override charset = "utf-8";

  /** API title shown in the page header */
  title = "Alexi REST Framework";

  /** localStorage key for JWT tokens */
  tokenStorageKey = "alexi_auth_tokens";

  /** Login URL */
  loginUrl = "/api/auth/login/";

  /** Logout URL */
  logoutUrl = "/api/auth/logout/";

  /** Current user "me" URL */
  meUrl = "/api/auth/me/";

  constructor(options?: BrowsableAPIRendererOptions) {
    super();
    if (options?.title) this.title = options.title;
    if (options?.tokenStorageKey) {
      this.tokenStorageKey = options.tokenStorageKey;
    }
    if (options?.loginUrl) this.loginUrl = options.loginUrl;
    if (options?.logoutUrl) this.logoutUrl = options.logoutUrl;
    if (options?.meUrl) this.meUrl = options.meUrl;
  }

  override render(data: unknown, context?: RenderContext): string {
    const method = context?.method ?? "GET";
    const url = context?.request?.url ?? "";
    const urlPath = url ? new URL(url).pathname : "";
    const statusCode = context?.statusCode ?? 200;
    const allowedMethods = context?.allowedMethods ?? ["GET"];

    const jsonString = JSON.stringify(data, null, 2);
    const paginated = isPaginatedResponse(data);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(urlPath)} – ${escapeHtml(this.title)}</title>
  <style>${CSS}</style>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <span class="site-title">${escapeHtml(this.title)}</span>
      <div class="auth-controls" id="auth-controls">
        <span class="user-info" id="user-info"></span>
        <button class="btn btn-sm btn-outline" id="login-btn" onclick="showLoginForm()">Log in</button>
        <button class="btn btn-sm btn-danger" id="logout-btn" onclick="doLogout()" style="display:none">Log out</button>
      </div>
    </div>
  </header>

  <main class="container">
    <div class="endpoint-header">
      <div class="breadcrumb">${buildBreadcrumb(urlPath)}</div>
      <div class="method-url">
        <span class="badge badge-${method.toLowerCase()}">${
      escapeHtml(method)
    }</span>
        <span class="url-path">${escapeHtml(urlPath)}</span>
        <span class="status-code status-${
      Math.floor(statusCode / 100)
    }xx">${statusCode}</span>
      </div>
    </div>

    ${paginated ? buildPaginationControls(data as PaginatedData) : ""}

    <div class="panel">
      <div class="panel-header">
        <h3>Response</h3>
        <button class="btn btn-sm btn-copy" onclick="copyJson()">Copy</button>
      </div>
      <pre class="json-display" id="json-display"><code id="json-code">${
      syntaxHighlight(jsonString)
    }</code></pre>
    </div>

    ${buildRequestForms(urlPath, allowedMethods, data)}

    <div class="panel" id="login-panel" style="display:none">
      <div class="panel-header"><h3>Log in</h3></div>
      <form class="api-form" onsubmit="doLogin(event)">
        <div class="form-group">
          <label for="login-email">Email</label>
          <input id="login-email" type="email" class="form-input" required autocomplete="username">
        </div>
        <div class="form-group">
          <label for="login-password">Password</label>
          <input id="login-password" type="password" class="form-input" required autocomplete="current-password">
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Log in</button>
          <button type="button" class="btn btn-outline" onclick="hideLoginForm()">Cancel</button>
        </div>
        <div class="form-error" id="login-error"></div>
      </form>
    </div>
  </main>

  <script>
    const TOKEN_KEY = ${JSON.stringify(this.tokenStorageKey)};
    const LOGIN_URL = ${JSON.stringify(this.loginUrl)};
    const LOGOUT_URL = ${JSON.stringify(this.logoutUrl)};
    const ME_URL = ${JSON.stringify(this.meUrl)};

    ${JAVASCRIPT}
  </script>
</body>
</html>`;
  }
}

// ============================================================================
// HTML helpers
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

interface PaginatedData {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: unknown[];
  cursor?: string;
}

function isPaginatedResponse(data: unknown): data is PaginatedData {
  if (data === null || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return "results" in d && Array.isArray(d.results);
}

function buildBreadcrumb(urlPath: string): string {
  const parts = urlPath.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
  if (parts.length === 0) return '<a href="/">/</a>';

  let accumulated = "";
  const links = parts.map((part) => {
    accumulated += `/${part}`;
    const href = accumulated + "/";
    return `<a href="${escapeHtml(href)}">${escapeHtml(part)}</a>`;
  });

  return '<a href="/">/</a> ' + links.join(" / ");
}

function buildPaginationControls(data: PaginatedData): string {
  const count = data.count ?? 0;
  const hasPrev = Boolean(data.previous);
  const hasNext = Boolean(data.next);
  if (!hasPrev && !hasNext) return "";

  const prevBtn = hasPrev
    ? `<a class="btn btn-sm btn-outline" href="${
      escapeHtml(data.previous!)
    }">← Previous</a>`
    : `<button class="btn btn-sm btn-outline" disabled>← Previous</button>`;

  const nextBtn = hasNext
    ? `<a class="btn btn-sm btn-outline" href="${
      escapeHtml(data.next!)
    }">Next →</a>`
    : `<button class="btn btn-sm btn-outline" disabled>Next →</button>`;

  return `<div class="pagination-bar">
    <span class="pagination-count">${count} result${
    count !== 1 ? "s" : ""
  }</span>
    <div class="pagination-btns">${prevBtn}${nextBtn}</div>
  </div>`;
}

/**
 * Build form panels for writable HTTP methods
 */
function buildRequestForms(
  _urlPath: string,
  allowedMethods: string[],
  _responseData: unknown,
): string {
  const writableMethods = allowedMethods.filter((m) =>
    ["POST", "PUT", "PATCH"].includes(m)
  );

  if (writableMethods.length === 0) return "";

  const forms = writableMethods.map((m, i) => buildRawForm(m, i === 0)).join(
    "\n",
  );

  return `<div class="panel">
    <div class="panel-header">
      <h3>Request</h3>
    </div>
    <div class="form-tabs" id="form-tabs">
      ${
    writableMethods
      .map(
        (m, i) =>
          `<button class="form-tab${
            i === 0 ? " active" : ""
          }" onclick="switchTab(this,'${m}-form')">${m}</button>`,
      )
      .join("")
  }
    </div>
    ${forms}
  </div>`;
}

function buildRawForm(method: string, isFirst: boolean): string {
  const display = isFirst ? "" : " style='display:none'";
  return `<div class="tab-panel" id="${method}-form"${display}>
    <form class="api-form" onsubmit="submitRequest(event,'${method}')">
      <div class="form-group">
        <label for="raw-body-${method}">Content (JSON)</label>
        <textarea id="raw-body-${method}" class="form-input code-input" rows="8" placeholder='{\n  "field": "value"\n}'></textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${
    escapeHtml(method)
  }</button>
      </div>
      <div class="form-error" id="error-${method}"></div>
      <div class="form-success" id="success-${method}"></div>
    </form>
  </div>`;
}

// ============================================================================
// Syntax highlighter
// ============================================================================

/**
 * Server-side syntax highlight of JSON string using HTML spans
 */
function syntaxHighlight(json: string): string {
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "json-key";
        } else {
          cls = "json-string";
        }
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${escapeHtml(match)}</span>`;
    },
  );
}

// ============================================================================
// Inline CSS
// ============================================================================

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f8f9fa;
    --surface: #ffffff;
    --border: #e1e4e8;
    --text: #24292e;
    --text-muted: #6a737d;
    --primary: #0366d6;
    --primary-dark: #0256c0;
    --danger: #d73a49;
    --success: #22863a;
    --radius: 6px;
    --shadow: 0 1px 3px rgba(0,0,0,.1);
  }

  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; }

  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Header */
  .site-header { background: #24292e; color: #fff; padding: 0 1rem; position: sticky; top: 0; z-index: 100; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
  .header-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 48px; }
  .site-title { font-weight: 600; font-size: 16px; color: #fff; }
  .auth-controls { display: flex; align-items: center; gap: .5rem; }
  .user-info { color: #ccc; font-size: 13px; }

  /* Container */
  .container { max-width: 1200px; margin: 0 auto; padding: 1.5rem 1rem; }

  /* Endpoint header */
  .endpoint-header { margin-bottom: 1rem; }
  .breadcrumb { color: var(--text-muted); font-size: 13px; margin-bottom: .5rem; }
  .breadcrumb a { color: var(--text-muted); }
  .method-url { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
  .url-path { font-family: monospace; font-size: 16px; font-weight: 500; }

  /* Badges */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .badge-get { background: #0075ca; color: #fff; }
  .badge-post { background: #28a745; color: #fff; }
  .badge-put { background: #6f42c1; color: #fff; }
  .badge-patch { background: #fd7e14; color: #fff; }
  .badge-delete { background: #dc3545; color: #fff; }
  .badge-options, .badge-head { background: #6c757d; color: #fff; }
  .status-code { font-family: monospace; font-weight: 700; }
  .status-2xx { color: var(--success); }
  .status-3xx { color: #6f42c1; }
  .status-4xx { color: #e36209; }
  .status-5xx { color: var(--danger); }

  /* Panel */
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 1rem; overflow: hidden; }
  .panel-header { display: flex; align-items: center; justify-content: space-between; padding: .6rem 1rem; border-bottom: 1px solid var(--border); background: #f6f8fa; }
  .panel-header h3 { font-size: 14px; font-weight: 600; }

  /* JSON display */
  .json-display { padding: 1rem; overflow: auto; font-size: 13px; line-height: 1.6; background: #1e1e1e; color: #d4d4d4; max-height: 60vh; }
  .json-key { color: #9cdcfe; }
  .json-string { color: #ce9178; }
  .json-number { color: #b5cea8; }
  .json-boolean { color: #569cd6; }
  .json-null { color: #569cd6; }

  /* Pagination */
  .pagination-bar { display: flex; align-items: center; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: .5rem 1rem; margin-bottom: 1rem; box-shadow: var(--shadow); }
  .pagination-count { color: var(--text-muted); font-size: 13px; }
  .pagination-btns { display: flex; gap: .5rem; }

  /* Forms */
  .form-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); padding: 0 1rem; background: #f6f8fa; }
  .form-tab { background: none; border: none; border-bottom: 2px solid transparent; padding: .6rem .75rem; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--text-muted); margin-bottom: -1px; }
  .form-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
  .tab-panel { padding: 1rem; }
  .api-form { display: flex; flex-direction: column; gap: .75rem; padding: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: .25rem; }
  .form-group label { font-size: 13px; font-weight: 600; }
  .form-input { padding: .5rem .75rem; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; font-family: inherit; background: var(--surface); color: var(--text); }
  .form-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(3,102,214,.15); }
  .code-input { font-family: monospace; resize: vertical; }
  .form-actions { display: flex; gap: .5rem; }
  .form-error { color: var(--danger); font-size: 13px; min-height: 1.2em; }
  .form-success { color: var(--success); font-size: 13px; min-height: 1.2em; }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; justify-content: center; padding: .375rem .75rem; border: 1px solid transparent; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s, border-color .15s; }
  .btn-sm { padding: .25rem .5rem; font-size: 12px; }
  .btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
  .btn-primary:hover { background: var(--primary-dark); border-color: var(--primary-dark); }
  .btn-outline { background: transparent; color: var(--text); border-color: var(--border); }
  .btn-outline:hover { background: var(--bg); }
  .btn-danger { background: var(--danger); color: #fff; border-color: var(--danger); }
  .btn-danger:hover { background: #cb2431; }
  .btn-copy { background: transparent; color: var(--text-muted); border-color: var(--border); font-size: 12px; }
  .btn-copy:hover { background: var(--bg); }
  button:disabled { opacity: .5; cursor: not-allowed; }

  @media (max-width: 640px) {
    .method-url { flex-direction: column; align-items: flex-start; }
    .header-inner { flex-wrap: wrap; height: auto; padding: .5rem 0; gap: .5rem; }
  }
`;

// ============================================================================
// Inline JavaScript
// ============================================================================

const JAVASCRIPT = `
  // ---- Auth ----
  function getTokens() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null"); } catch { return null; }
  }
  function setTokens(tokens) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  }
  function clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
  }
  function getAccessToken() {
    const t = getTokens();
    return t && t.accessToken ? t.accessToken : null;
  }

  // ---- UI updates ----
  function updateAuthUI(user) {
    const info = document.getElementById("user-info");
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    if (user) {
      info.textContent = user.email || ("User #" + (user.id || ""));
      loginBtn.style.display = "none";
      logoutBtn.style.display = "";
    } else {
      info.textContent = "";
      loginBtn.style.display = "";
      logoutBtn.style.display = "none";
    }
  }

  async function fetchCurrentUser() {
    const token = getAccessToken();
    if (!token) { updateAuthUI(null); return; }
    try {
      const res = await fetch(ME_URL, { headers: { Authorization: "Bearer " + token } });
      if (res.ok) { updateAuthUI(await res.json()); }
      else { updateAuthUI(null); }
    } catch { updateAuthUI(null); }
  }

  // ---- Login / Logout ----
  function showLoginForm() {
    document.getElementById("login-panel").style.display = "";
    document.getElementById("login-btn").style.display = "none";
  }
  function hideLoginForm() {
    document.getElementById("login-panel").style.display = "none";
    const token = getAccessToken();
    document.getElementById("login-btn").style.display = token ? "none" : "";
  }

  async function doLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";
    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setTokens(data);
        hideLoginForm();
        fetchCurrentUser();
      } else {
        errorEl.textContent = data.detail || data.error || "Login failed";
      }
    } catch (err) {
      errorEl.textContent = "Network error: " + err.message;
    }
  }

  async function doLogout() {
    const token = getAccessToken();
    if (token) {
      try {
        await fetch(LOGOUT_URL, {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        });
      } catch {}
    }
    clearTokens();
    updateAuthUI(null);
  }

  // ---- Form tabs ----
  function switchTab(btn, panelId) {
    document.querySelectorAll(".form-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.style.display = "none");
    btn.classList.add("active");
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = "";
  }

  // ---- Submit request ----
  async function submitRequest(e, method) {
    e.preventDefault();
    const bodyEl = document.getElementById("raw-body-" + method);
    const errorEl = document.getElementById("error-" + method);
    const successEl = document.getElementById("success-" + method);
    errorEl.textContent = "";
    successEl.textContent = "";

    let body;
    try {
      body = bodyEl.value.trim() ? JSON.parse(bodyEl.value) : undefined;
    } catch {
      errorEl.textContent = "Invalid JSON";
      return;
    }

    const headers = { "Content-Type": "application/json" };
    const token = getAccessToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    try {
      const res = await fetch(window.location.href.split("?")[0], {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (res.ok) {
        successEl.textContent = method + " " + res.status + " OK";
        // Refresh page to show updated data
        setTimeout(() => window.location.reload(), 800);
      } else {
        errorEl.textContent = res.status + ": " + (data.detail || data.error || JSON.stringify(data));
      }
    } catch (err) {
      errorEl.textContent = "Network error: " + err.message;
    }
  }

  // ---- Copy JSON ----
  function copyJson() {
    const code = document.getElementById("json-code");
    const text = code ? code.textContent : "";
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector(".btn-copy");
      if (btn) { btn.textContent = "Copied!"; setTimeout(() => btn.textContent = "Copy", 1500); }
    }).catch(() => {});
  }

  // ---- Init ----
  fetchCurrentUser();
`;
