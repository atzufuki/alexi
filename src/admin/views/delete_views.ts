/**
 * Alexi Admin Delete Confirmation View
 *
 * Renders the delete confirmation page for a model instance.
 * Handles both GET (render confirmation) and POST (perform delete).
 *
 * - GET  /admin/<model>/<id>/delete/  → confirmation page
 * - POST /admin/<model>/<id>/delete/  → delete object, redirect to changelist
 *
 * @module
 */

import type { DatabaseBackend } from "@alexi/db";
import type { AdminSite } from "../site.ts";
import type { ModelAdmin } from "../model_admin.ts";
import { getModelFields, getModelMeta } from "../introspection.ts";
import { baseTemplate } from "../templates/mpa/base.ts";
import { verifyAdminToken } from "./auth_guard.ts";

// =============================================================================
// Types
// =============================================================================

export interface DeleteViewContext {
  request: Request;
  params: Record<string, string>;
  adminSite: AdminSite;
  backend: DatabaseBackend;
  settings?: Record<string, unknown>;
}

// =============================================================================
// Helpers
// =============================================================================

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

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

// =============================================================================
// Fetch instance summary for display
// =============================================================================

async function fetchInstanceSummary(
  modelAdmin: ModelAdmin,
  backend: DatabaseBackend,
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const manager = (modelAdmin.model as unknown as {
      objects: {
        using: (b: DatabaseBackend) => {
          get(q: Record<string, unknown>): Promise<unknown>;
        };
      };
    }).objects;

    const instance = await manager.using(backend).get({ id: parseInt(id, 10) });
    if (!instance) return null;

    // Serialize to plain object
    const fields = getModelFields(modelAdmin.model);
    const obj: Record<string, unknown> = {};
    const r = instance as Record<string, unknown>;
    for (const f of fields) {
      const v = r[f.name];
      obj[f.name] = v && typeof v === "object" && "get" in v
        ? (v as { get(): unknown }).get()
        : v;
    }
    return obj;
  } catch {
    return null;
  }
}

// =============================================================================
// Delete instance from backend
// =============================================================================

async function deleteInstance(
  modelAdmin: ModelAdmin,
  backend: DatabaseBackend,
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const manager = (modelAdmin.model as unknown as {
      objects: {
        using: (b: DatabaseBackend) => {
          get(q: Record<string, unknown>): Promise<unknown>;
        };
      };
    }).objects;

    const instance = await manager.using(backend).get({ id: parseInt(id, 10) });
    if (!instance) {
      return { success: false, error: "Object not found" };
    }

    await (instance as { delete(): Promise<void> }).delete();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// =============================================================================
// Render a summary row of the object being deleted
// =============================================================================

function renderObjectSummary(
  obj: Record<string, unknown>,
  modelAdmin: ModelAdmin,
): string {
  const meta = getModelMeta(modelAdmin.model);
  const pkField = meta.primaryKey ?? "id";
  const pkValue = obj[pkField];

  // Show the first meaningful text field for display
  const fields = getModelFields(modelAdmin.model);
  const displayField = fields.find((f) =>
    f.name !== pkField && (f.type === "CharField" || f.type === "TextField")
  );
  const displayValue = displayField
    ? String(obj[displayField.name] ?? "")
    : String(pkValue ?? "");

  return `<li><strong>${escapeHtml(meta.verboseName)}</strong>: ${
    escapeHtml(displayValue || `#${pkValue}`)
  }</li>`;
}

// =============================================================================
// Delete Confirmation View (GET + POST)
// =============================================================================

/**
 * Render the delete confirmation page for a model instance.
 *
 * @param context   - View context
 * @param modelName - Lowercase model name from the URL
 * @param objectId  - Object PK to delete
 */
export async function renderDeleteConfirmation(
  context: DeleteViewContext,
  modelName: string,
  objectId: string,
): Promise<Response> {
  const { request, adminSite, backend, settings } = context;
  const urlPrefix = adminSite.urlPrefix.replace(/\/$/, "");

  // --- Auth guard ---
  const authResult = await verifyAdminToken(request, settings);
  if (!authResult.authenticated) {
    const loginUrl = `${urlPrefix}/login/`;
    return new Response(null, {
      status: 302,
      headers: { Location: loginUrl, "HX-Redirect": loginUrl },
    });
  }

  const userEmail = authResult.email;

  // --- Find model admin ---
  const modelAdmin = adminSite.getModelAdminByName(modelName);
  if (!modelAdmin) {
    return new Response("Model not found", { status: 404 });
  }

  const meta = getModelMeta(modelAdmin.model);
  const listUrl = modelAdmin.getListUrl();
  const changeUrl = modelAdmin.getDetailUrl(objectId);
  const deleteAction = modelAdmin.getDeleteUrl(objectId);

  const url = new URL(request.url);
  const currentPath = url.pathname;
  const navItems = buildNavItems(adminSite, currentPath);

  // --- Breadcrumbs ---
  const breadcrumbs = `
  <div class="admin-breadcrumbs">
    <a href="${escapeHtml(urlPrefix)}/">Home</a> ›
    <a href="${escapeHtml(listUrl)}">${escapeHtml(meta.verboseNamePlural)}</a> ›
    <a href="${escapeHtml(changeUrl)}">${escapeHtml(meta.verboseName)} #${
    escapeHtml(objectId)
  }</a> ›
    Delete
  </div>`;

  const title = `Delete ${meta.verboseName}`;

  // =========================================================================
  // GET: Render confirmation page
  // =========================================================================

  if (request.method === "GET") {
    const instance = await fetchInstanceSummary(modelAdmin, backend, objectId);
    if (!instance) {
      return new Response("Object not found", { status: 404 });
    }

    const objectSummary = renderObjectSummary(instance, modelAdmin);

    const content = `
    ${breadcrumbs}
    <div class="admin-delete-confirmation">
      <div class="admin-content-title">
        <h1>${escapeHtml(title)}</h1>
      </div>

      <p>Are you sure you want to delete the ${
      escapeHtml(meta.verboseName)
    } below?</p>
      <p class="admin-delete-warning"><strong>Warning:</strong> This action cannot be undone.</p>

      <ul class="admin-delete-summary">
        ${objectSummary}
      </ul>

      <form method="post" action="${escapeHtml(deleteAction)}" id="deleteform">
        <div class="admin-submit-row">
          <a href="${
      escapeHtml(changeUrl)
    }" class="admin-btn admin-btn-default admin-cancel-btn">No, go back</a>
          <input type="submit" name="_delete" value="Yes, I'm sure" class="admin-btn admin-btn-danger admin-confirm-delete-btn">
        </div>
      </form>
    </div>`;

    const html = baseTemplate({
      title,
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

  // =========================================================================
  // POST: Perform deletion and redirect
  // =========================================================================

  if (request.method === "POST") {
    const result = await deleteInstance(modelAdmin, backend, objectId);

    if (!result.success) {
      // Re-render page with error message
      const instance = await fetchInstanceSummary(
        modelAdmin,
        backend,
        objectId,
      );
      const objectSummary = instance
        ? renderObjectSummary(instance, modelAdmin)
        : "";

      const content = `
      ${breadcrumbs}
      <div class="admin-delete-confirmation">
        <div class="admin-content-title">
          <h1>${escapeHtml(title)}</h1>
        </div>

        <p class="admin-error-message">${
        escapeHtml(result.error ?? "An error occurred while deleting.")
      }</p>

        <ul class="admin-delete-summary">
          ${objectSummary}
        </ul>

        <div class="admin-submit-row">
          <a href="${
        escapeHtml(changeUrl)
      }" class="admin-btn admin-btn-default admin-cancel-btn">Go back</a>
        </div>
      </div>`;

      const html = baseTemplate({
        title,
        siteTitle: adminSite.title,
        urlPrefix,
        userEmail,
        navItems,
        content,
      });

      return new Response(html, {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Redirect to changelist on success
    return new Response(null, {
      status: 302,
      headers: { Location: listUrl, "HX-Redirect": listUrl },
    });
  }

  return new Response("Method not allowed", { status: 405 });
}
