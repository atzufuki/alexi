/**
 * Alexi Admin Dashboard View
 *
 * Renders the admin index / dashboard page (GET /admin/).
 * Uses the MPA base template and requires a valid JWT in the
 * Authorization header (injected by admin.js on every HTMX request).
 *
 * If no valid token is present the response redirects to /admin/login/.
 *
 * @module
 */

import type { AdminSite } from "../site.ts";
import type { ModelClass } from "../options.ts";
import { baseTemplate } from "../templates/mpa/base.ts";
import { verifyAdminToken } from "./auth_guard.ts";

// =============================================================================
// Types
// =============================================================================

export interface DashboardViewContext {
  request: Request;
  params: Record<string, string>;
  adminSite: AdminSite;
  /** Optional settings — used for SECRET_KEY when verifying JWT */
  settings?: Record<string, unknown>;
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

/**
 * Build the sidebar nav items from the registered models.
 */
function buildNavItems(
  site: AdminSite,
  currentPath: string,
): Array<{ name: string; url: string; active: boolean }> {
  const items: Array<{ name: string; url: string; active: boolean }> = [
    {
      name: "Dashboard",
      url: `${site.urlPrefix}/`,
      active: currentPath === `${site.urlPrefix}/`,
    },
  ];

  for (const model of site.getRegisteredModels()) {
    const admin = site.getModelAdmin(model);
    const url = admin.getListUrl();
    items.push({
      name: admin.getVerboseNamePlural(),
      url,
      active: currentPath.startsWith(url),
    });
  }

  return items;
}

/**
 * Render one "app group" section (Django Admin style).
 * Currently all models are grouped under a single "Models" section.
 */
function renderAppGroup(
  site: AdminSite,
  models: ModelClass[],
): string {
  if (models.length === 0) {
    return `<p class="admin-dashboard-empty">No models registered.</p>`;
  }

  const rows = models
    .map((model) => {
      const admin = site.getModelAdmin(model);
      const listUrl = admin.getListUrl();
      const addUrl = admin.getAddUrl();
      const name = admin.getVerboseNamePlural();

      return `
      <tr>
        <th scope="row">
          <a href="${escapeHtml(listUrl)}">${escapeHtml(name)}</a>
        </th>
        <td>
          <a href="${escapeHtml(addUrl)}" class="admin-addlink">Add</a>
        </td>
        <td>
          <a href="${escapeHtml(listUrl)}" class="admin-changelink">Change</a>
        </td>
      </tr>`;
    })
    .join("\n");

  return `
  <div class="admin-app-listing">
    <div class="admin-app-listing-header">
      <h2>Models</h2>
    </div>
    <table class="admin-model-table">
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>`;
}

// =============================================================================
// Dashboard View
// =============================================================================

/**
 * Render the admin dashboard (GET /admin/).
 *
 * Verifies the JWT from the Authorization header. If missing or invalid,
 * returns a redirect response to /admin/login/.
 */
export async function renderDashboard(
  context: DashboardViewContext,
): Promise<Response> {
  const { request, adminSite, settings } = context;
  const urlPrefix = adminSite.urlPrefix.replace(/\/$/, "");

  // --- Auth guard ---
  const authResult = await verifyAdminToken(request, settings);
  if (!authResult.authenticated) {
    const loginUrl = `${urlPrefix}/login/`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: loginUrl,
        "HX-Redirect": loginUrl,
      },
    });
  }

  const userEmail = authResult.email;
  const url = new URL(request.url);
  const models = adminSite.getRegisteredModels();
  const navItems = buildNavItems(adminSite, url.pathname);

  const appGroupHtml = renderAppGroup(adminSite, models);

  const content = `
    <div class="admin-dashboard">
      <div class="admin-breadcrumbs">
        <a href="${escapeHtml(urlPrefix)}/">Home</a>
      </div>
      <h1 class="admin-page-title">Site administration</h1>
      ${appGroupHtml}
    </div>`;

  const html = baseTemplate({
    title: "Site administration",
    siteTitle: adminSite.title,
    urlPrefix,
    userEmail,
    navItems,
    content,
  });

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
