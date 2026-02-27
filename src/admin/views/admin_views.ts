/**
 * Alexi Admin Views
 *
 * Server-side rendered admin views that return HTML pages.
 * These views handle the admin interface routes and render
 * the appropriate HTML for each page.
 *
 * @module
 */

import type { AdminSite } from "../site.ts";
import type { ModelAdmin } from "../model_admin.ts";
import { getModelFields, getModelMeta } from "../introspection.ts";
import { getFiltersForFields } from "../filters.ts";
import type { DatabaseBackend } from "@alexi/db";
import { getAdminUrls } from "../urls.ts";

// =============================================================================
// Types
// =============================================================================

export interface AdminViewContext {
  request: Request;
  params: Record<string, string>;
  adminSite: AdminSite;
  backend: DatabaseBackend;
}

export interface AdminViewResult {
  html: string;
  status?: number;
  headers?: Record<string, string>;
}

// =============================================================================
// HTML Templates
// =============================================================================

function baseTemplate(options: {
  title: string;
  siteTitle: string;
  content: string;
  styles?: string;
  scripts?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title} | ${options.siteTitle}</title>
  <style>
    :root {
      --admin-primary: #417690;
      --admin-primary-dark: #205067;
      --admin-secondary: #79aec8;
      --admin-accent: #f5dd5d;
      --admin-bg: #f5f5f5;
      --admin-surface: #ffffff;
      --admin-text: #333333;
      --admin-text-light: #666666;
      --admin-border: #cccccc;
      --admin-success: #44aa00;
      --admin-error: #ba2121;
      --admin-warning: #cc9900;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: var(--admin-text);
      background-color: var(--admin-bg);
    }

    a {
      color: var(--admin-primary);
      text-decoration: none;
    }

    a:hover {
      color: var(--admin-primary-dark);
      text-decoration: underline;
    }

    /* Header */
    .admin-header {
      background: linear-gradient(to bottom, var(--admin-primary) 0%, var(--admin-primary-dark) 100%);
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .admin-header h1 {
      font-size: 20px;
      font-weight: 600;
    }

    .admin-header a {
      color: var(--admin-secondary);
    }

    .admin-header a:hover {
      color: #ffffff;
    }

    /* Breadcrumb */
    .admin-breadcrumb {
      background-color: var(--admin-surface);
      padding: 12px 24px;
      border-bottom: 1px solid var(--admin-border);
      font-size: 13px;
    }

    .admin-breadcrumb a {
      color: var(--admin-text-light);
    }

    .admin-breadcrumb span {
      color: var(--admin-text);
      margin: 0 8px;
    }

    /* Main content */
    .admin-main {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Dashboard grid */
    .admin-dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }

    /* Model card */
    .admin-model-card {
      background-color: var(--admin-surface);
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      overflow: hidden;
    }

    .admin-model-card-header {
      background-color: var(--admin-primary);
      color: #ffffff;
      padding: 12px 16px;
      font-weight: 600;
      font-size: 16px;
    }

    .admin-model-card-body {
      padding: 16px;
    }

    .admin-model-card-link {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      margin: 4px 0;
      border-radius: 4px;
      color: var(--admin-text);
      transition: background-color 0.15s ease;
    }

    .admin-model-card-link:hover {
      background-color: var(--admin-bg);
      text-decoration: none;
    }

    .admin-model-card-link-icon {
      width: 24px;
      margin-right: 12px;
      color: var(--admin-text-light);
    }

    /* Table */
    .admin-table-container {
      background-color: var(--admin-surface);
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      overflow: hidden;
    }

    .admin-table {
      width: 100%;
      border-collapse: collapse;
    }

    .admin-table th {
      background-color: #f8f8f8;
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      color: var(--admin-text);
      border-bottom: 2px solid var(--admin-border);
    }

    .admin-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #eeeeee;
    }

    .admin-table tr:last-child td {
      border-bottom: none;
    }

    .admin-table tbody tr:hover {
      background-color: #f8f8f8;
    }

    .admin-table-link {
      color: var(--admin-primary);
      font-weight: 500;
    }

    /* Empty state */
    .admin-empty {
      padding: 48px;
      text-align: center;
      color: var(--admin-text-light);
    }

    /* Actions bar */
    .admin-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .admin-btn {
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: background-color 0.15s ease;
    }

    .admin-btn-primary {
      background-color: var(--admin-primary);
      color: #ffffff;
    }

    .admin-btn-primary:hover {
      background-color: var(--admin-primary-dark);
      color: #ffffff;
      text-decoration: none;
    }

    .admin-btn-secondary {
      background-color: #f0f0f0;
      color: var(--admin-text);
    }

    .admin-btn-secondary:hover {
      background-color: #e0e0e0;
      text-decoration: none;
    }

    /* Pagination */
    .admin-pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      padding: 16px;
      background-color: #f8f8f8;
      border-top: 1px solid var(--admin-border);
    }

    .admin-pagination-info {
      color: var(--admin-text-light);
      font-size: 13px;
    }

    /* Search */
    .admin-search {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .admin-search input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--admin-border);
      border-radius: 4px;
      font-size: 14px;
    }

    .admin-search input:focus {
      outline: none;
      border-color: var(--admin-primary);
    }

    /* Boolean icons */
    .admin-bool-yes { color: var(--admin-success); }
    .admin-bool-no { color: var(--admin-error); }

    /* Page title */
    .admin-page-title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 24px;
      color: var(--admin-text);
    }

    ${options.styles ?? ""}
  </style>
</head>
<body>
  <header class="admin-header">
    <h1><a href="/admin/" style="color: inherit;">${options.siteTitle}</a></h1>
    <nav>
      <a href="/">← Back to Site</a>
    </nav>
  </header>

  ${options.content}

  ${options.scripts ?? ""}
</body>
</html>`;
}

// =============================================================================
// Dashboard View
// =============================================================================

export function renderDashboard(context: AdminViewContext): AdminViewResult {
  const { adminSite } = context;
  const models = adminSite.getRegisteredModels();

  const modelCards = models
    .map((model) => {
      const meta = getModelMeta(model);
      const modelName = model.name.toLowerCase();

      return `
        <div class="admin-model-card">
          <div class="admin-model-card-header">${meta.verboseNamePlural}</div>
          <div class="admin-model-card-body">
            <a href="/admin/${modelName}/" class="admin-model-card-link">
              <span class="admin-model-card-link-icon">📋</span>
              View all ${meta.verboseNamePlural.toLowerCase()}
            </a>
            <a href="/admin/${modelName}/add/" class="admin-model-card-link">
              <span class="admin-model-card-link-icon">➕</span>
              Add new ${meta.verboseName.toLowerCase()}
            </a>
          </div>
        </div>
      `;
    })
    .join("");

  const content = `
    <nav class="admin-breadcrumb">
      <a href="/admin/">Home</a>
    </nav>
    <main class="admin-main">
      <h2 class="admin-page-title">Site Administration</h2>
      <div class="admin-dashboard">
        ${modelCards}
      </div>
    </main>
  `;

  return {
    html: baseTemplate({
      title: "Dashboard",
      siteTitle: adminSite.title,
      content,
    }),
  };
}

// =============================================================================
// Model List View
// =============================================================================

export async function renderModelList(
  context: AdminViewContext,
  modelName: string,
): Promise<AdminViewResult> {
  const { adminSite, backend } = context;
  const modelAdmin = adminSite.getModelAdminByName(modelName);

  if (!modelAdmin) {
    return {
      html: baseTemplate({
        title: "Not Found",
        siteTitle: adminSite.title,
        content: `
          <nav class="admin-breadcrumb">
            <a href="/admin/">Home</a>
          </nav>
          <main class="admin-main">
            <h2 class="admin-page-title">Model Not Found</h2>
            <p>The model "${modelName}" was not found.</p>
          </main>
        `,
      }),
      status: 404,
    };
  }

  const meta = getModelMeta(modelAdmin.model);
  const fields = getModelFields(modelAdmin.model);

  // Get list display fields
  const listDisplay = modelAdmin.listDisplay.length > 0
    ? modelAdmin.listDisplay
    : fields.slice(0, 6).map((f) => f.name);

  // Load data
  let data: Record<string, unknown>[] = [];
  try {
    const manager = (modelAdmin.model as unknown as {
      objects: {
        using: (
          b: unknown,
        ) => { all: () => { fetch: () => Promise<unknown[]> } };
      };
    }).objects;

    const models = await manager.using(backend).all().fetch();

    data = models.map((model: unknown) => {
      const obj: Record<string, unknown> = {};
      const modelAny = model as Record<string, unknown>;

      for (const field of fields) {
        const fieldValue = modelAny[field.name];
        if (
          fieldValue && typeof fieldValue === "object" && "get" in fieldValue
        ) {
          obj[field.name] = (fieldValue as { get: () => unknown }).get();
        } else {
          obj[field.name] = fieldValue;
        }
      }

      return obj;
    });
  } catch (error) {
    console.error(`[Admin] Failed to load ${modelName}:`, error);
  }

  // Build table headers
  const headers = listDisplay
    .map((fieldName) => {
      const field = fields.find((f) => f.name === fieldName);
      const label = field?.options.verboseName ?? humanize(fieldName);
      return `<th>${escapeHtml(label)}</th>`;
    })
    .join("");

  // Build table rows
  const rows = data
    .map((item) => {
      const id = String(item.id ?? item[fields[0]?.name]);
      const cells = listDisplay
        .map((fieldName, index) => {
          const value = item[fieldName];
          const displayValue = formatValue(value);

          // First column is a link
          if (index === 0) {
            return `<td><a href="/admin/${modelName.toLowerCase()}/${id}/" class="admin-table-link">${
              escapeHtml(displayValue)
            }</a></td>`;
          }

          return `<td>${escapeHtml(displayValue)}</td>`;
        })
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  const tableContent = data.length > 0
    ? `
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>${headers}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="admin-pagination">
          <span class="admin-pagination-info">${data.length} ${
      data.length === 1
        ? meta.verboseName.toLowerCase()
        : meta.verboseNamePlural.toLowerCase()
    }</span>
        </div>
      </div>
    `
    : `
      <div class="admin-table-container">
        <div class="admin-empty">
          No ${meta.verboseNamePlural.toLowerCase()} found.
        </div>
      </div>
    `;

  const content = `
    <nav class="admin-breadcrumb">
      <a href="/admin/">Home</a>
      <span>›</span>
      ${meta.verboseNamePlural}
    </nav>
    <main class="admin-main">
      <div class="admin-actions">
        <h2 class="admin-page-title" style="margin-bottom: 0;">${meta.verboseNamePlural}</h2>
        <a href="/admin/${modelName.toLowerCase()}/add/" class="admin-btn admin-btn-primary">
          + Add ${meta.verboseName}
        </a>
      </div>
      ${tableContent}
    </main>
  `;

  return {
    html: baseTemplate({
      title: meta.verboseNamePlural,
      siteTitle: adminSite.title,
      content,
    }),
  };
}

// =============================================================================
// Model Detail View
// =============================================================================

export async function renderModelDetail(
  context: AdminViewContext,
  modelName: string,
  objectId: string,
): Promise<AdminViewResult> {
  const { adminSite, backend } = context;
  const modelAdmin = adminSite.getModelAdminByName(modelName);

  if (!modelAdmin) {
    return {
      html: baseTemplate({
        title: "Not Found",
        siteTitle: adminSite.title,
        content: `
          <nav class="admin-breadcrumb">
            <a href="/admin/">Home</a>
          </nav>
          <main class="admin-main">
            <h2 class="admin-page-title">Model Not Found</h2>
          </main>
        `,
      }),
      status: 404,
    };
  }

  const meta = getModelMeta(modelAdmin.model);
  const fields = getModelFields(modelAdmin.model);

  // Load object
  let obj: Record<string, unknown> | null = null;
  try {
    const manager = (modelAdmin.model as unknown as {
      objects: {
        using: (b: unknown) => {
          filter: (
            q: Record<string, unknown>,
          ) => { first: () => Promise<unknown> };
        };
      };
    }).objects;

    const model = await manager.using(backend).filter({ id: objectId }).first();

    if (model) {
      obj = {};
      const modelAny = model as Record<string, unknown>;

      for (const field of fields) {
        const fieldValue = modelAny[field.name];
        if (
          fieldValue && typeof fieldValue === "object" && "get" in fieldValue
        ) {
          obj[field.name] = (fieldValue as { get: () => unknown }).get();
        } else {
          obj[field.name] = fieldValue;
        }
      }
    }
  } catch (error) {
    console.error(`[Admin] Failed to load ${modelName} ${objectId}:`, error);
  }

  if (!obj) {
    return {
      html: baseTemplate({
        title: "Not Found",
        siteTitle: adminSite.title,
        content: `
          <nav class="admin-breadcrumb">
            <a href="/admin/">Home</a>
            <span>›</span>
            <a href="/admin/${modelName.toLowerCase()}/">${meta.verboseNamePlural}</a>
            <span>›</span>
            Not Found
          </nav>
          <main class="admin-main">
            <h2 class="admin-page-title">${meta.verboseName} Not Found</h2>
            <p>The ${meta.verboseName.toLowerCase()} with ID "${objectId}" was not found.</p>
            <a href="/admin/${modelName.toLowerCase()}/" class="admin-btn admin-btn-secondary">← Back to list</a>
          </main>
        `,
      }),
      status: 404,
    };
  }

  // Build field rows
  const fieldRows = fields
    .map((field) => {
      const value = obj![field.name];
      const displayValue = formatValue(value);
      const label = field.options.verboseName ?? humanize(field.name);

      return `
        <tr>
          <th style="width: 200px; background-color: #f8f8f8;">${
        escapeHtml(label)
      }</th>
          <td>${escapeHtml(displayValue)}</td>
        </tr>
      `;
    })
    .join("");

  const displayName = String(
    obj.name ?? obj.title ?? obj.email ?? obj.id ?? objectId,
  );

  const content = `
    <nav class="admin-breadcrumb">
      <a href="/admin/">Home</a>
      <span>›</span>
      <a href="/admin/${modelName.toLowerCase()}/">${meta.verboseNamePlural}</a>
      <span>›</span>
      ${escapeHtml(displayName)}
    </nav>
    <main class="admin-main">
      <div class="admin-actions">
        <h2 class="admin-page-title" style="margin-bottom: 0;">${
    escapeHtml(displayName)
  }</h2>
        <div>
          <a href="/admin/${modelName.toLowerCase()}/" class="admin-btn admin-btn-secondary">← Back to list</a>
        </div>
      </div>
      <div class="admin-table-container">
        <table class="admin-table">
          <tbody>
            ${fieldRows}
          </tbody>
        </table>
      </div>
    </main>
  `;

  return {
    html: baseTemplate({
      title: `${displayName} | ${meta.verboseName}`,
      siteTitle: adminSite.title,
      content,
    }),
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

function humanize(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "✓ Yes" : "✗ No";
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

// =============================================================================
// URL Pattern Creator (delegates to urls.ts)
// =============================================================================

/**
 * Create admin URL patterns with real SSR handlers.
 *
 * @deprecated Use `getAdminUrls(site, backend)` from `@alexi/admin/urls` directly.
 */
export function createAdminUrls(
  adminSite: AdminSite,
  backend: DatabaseBackend,
  settings?: Record<string, unknown>,
) {
  return getAdminUrls(adminSite, backend, settings);
}

/**
 * Create admin request handler.
 *
 * Builds the URL patterns via `getAdminUrls` and returns a dispatcher function
 * that matches incoming requests against those patterns.
 */
export function createAdminHandler(
  adminSite: AdminSite,
  backend: DatabaseBackend,
  settings?: Record<string, unknown>,
): (request: Request) => Promise<Response | null> {
  const patterns = getAdminUrls(adminSite, backend, settings);

  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Normalize path — ensure trailing slash for matching
    const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;

    for (const pattern of patterns) {
      if (pattern.match(normalizedPath)) {
        const params = pattern.extractParams(normalizedPath) ?? {};
        return await pattern.handler(request, params);
      }
    }

    return null;
  };
}
