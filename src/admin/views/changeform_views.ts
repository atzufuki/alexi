/**
 * Alexi Admin Change Form View
 *
 * Renders the add/change form page for a model instance.
 * Handles both GET (render form) and POST (save data).
 *
 * - GET  /admin/<model>/add/       → blank add form
 * - GET  /admin/<model>/<id>/      → edit form pre-filled with instance data
 * - POST /admin/<model>/add/       → create new instance
 * - POST /admin/<model>/<id>/      → update existing instance
 *
 * @module
 */

import type { DatabaseBackend } from "@alexi/db";
import type { AdminSite } from "../site.ts";
import type { ModelAdmin } from "../model_admin.ts";
import type { FieldInfo } from "../introspection.ts";
import {
  getEditableFields,
  getModelFields,
  getModelMeta,
  getWidgetForField,
} from "../introspection.ts";
import { baseTemplate } from "../templates/mpa/base.ts";
import { verifyAdminToken } from "./auth_guard.ts";

// =============================================================================
// Types
// =============================================================================

export interface ChangeFormViewContext {
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

function humanize(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
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

/**
 * Format a raw field value for display in an HTML form input.
 * Dates become ISO strings suitable for date/datetime-local inputs.
 */
function formatForInput(
  fieldInfo: FieldInfo,
  value: unknown,
): string {
  if (value === null || value === undefined) return "";
  if (fieldInfo.type === "DateTimeField" && value instanceof Date) {
    // datetime-local requires "YYYY-MM-DDTHH:MM"
    return value.toISOString().slice(0, 16);
  }
  if (fieldInfo.type === "DateField" && value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

// =============================================================================
// Widget rendering
// =============================================================================

function renderWidget(
  fieldInfo: FieldInfo,
  value: unknown,
  errors: string[],
): string {
  const name = fieldInfo.name;
  const label = fieldInfo.options.verboseName ?? humanize(name);
  const required = fieldInfo.isRequired;
  const helpText = fieldInfo.options.helpText ?? "";
  const widget = getWidgetForField(fieldInfo);
  const hasError = errors.length > 0;

  const errorHtml = hasError
    ? `<ul class="admin-errorlist">${
      errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")
    }</ul>`
    : "";

  const helpHtml = helpText
    ? `<p class="admin-help">${escapeHtml(helpText)}</p>`
    : "";

  let inputHtml = "";

  if (widget === "admin-checkbox") {
    // BooleanField → checkbox
    const checked = value ? " checked" : "";
    inputHtml = `<input type="checkbox" name="${escapeHtml(name)}" id="id_${
      escapeHtml(name)
    }"${checked} class="admin-checkbox">`;
  } else if (widget === "admin-select") {
    // Field with choices → <select>
    const choices = fieldInfo.options.choices ?? [];
    const options = choices
      .map(([v, display]) => {
        const selected = String(v) === String(value) ? " selected" : "";
        return `<option value="${escapeHtml(String(v))}"${selected}>${
          escapeHtml(display)
        }</option>`;
      })
      .join("");
    const req = required ? " required" : "";
    inputHtml = `<select name="${escapeHtml(name)}" id="id_${
      escapeHtml(name)
    }" class="admin-select"${req}>
      ${required ? "" : '<option value="">---------</option>'}
      ${options}
    </select>`;
  } else if (widget === "admin-textarea") {
    // TextField / JSONField → <textarea>
    const req = required ? " required" : "";
    inputHtml = `<textarea name="${escapeHtml(name)}" id="id_${
      escapeHtml(name)
    }" class="admin-textarea" rows="10"${req}>${
      escapeHtml(String(value ?? ""))
    }</textarea>`;
  } else if (widget === "admin-input[readonly]") {
    // AutoField → readonly text input
    inputHtml = `<input type="text" name="${escapeHtml(name)}" id="id_${
      escapeHtml(name)
    }" value="${
      escapeHtml(String(value ?? ""))
    }" class="admin-input" readonly>`;
  } else if (widget === "admin-input[type=number]") {
    const req = required ? " required" : "";
    inputHtml = `<input type="number" name="${escapeHtml(name)}" id="id_${
      escapeHtml(name)
    }" value="${escapeHtml(String(value ?? ""))}" class="admin-input"${req}>`;
  } else if (widget === "admin-input[type=date]") {
    const req = required ? " required" : "";
    inputHtml = `<input type="date" name="${escapeHtml(name)}" id="id_${
      escapeHtml(name)
    }" value="${
      escapeHtml(formatForInput(fieldInfo, value))
    }" class="admin-input"${req}>`;
  } else if (widget === "admin-input[type=datetime-local]") {
    const req = required ? " required" : "";
    inputHtml = `<input type="datetime-local" name="${
      escapeHtml(name)
    }" id="id_${escapeHtml(name)}" value="${
      escapeHtml(formatForInput(fieldInfo, value))
    }" class="admin-input"${req}>`;
  } else if (widget === "admin-foreign-key-select") {
    // ForeignKey — render a number input (select would need related choices)
    const req = required ? " required" : "";
    const rawId =
      value && typeof value === "object" && "id" in (value as object)
        ? (value as { id: unknown }).id
        : value;
    inputHtml = `<input type="number" name="${escapeHtml(name)}" id="id_${
      escapeHtml(name)
    }" value="${
      escapeHtml(String(rawId ?? ""))
    }" class="admin-input" placeholder="ID"${req}>`;
  } else {
    // Default text input
    const req = required ? " required" : "";
    const maxLen = fieldInfo.options.maxLength
      ? ` maxlength="${fieldInfo.options.maxLength}"`
      : "";
    inputHtml = `<input type="text" name="${escapeHtml(name)}" id="id_${
      escapeHtml(name)
    }" value="${
      escapeHtml(String(value ?? ""))
    }" class="admin-input"${req}${maxLen}>`;
  }

  const requiredMark = required ? ' <span class="required">*</span>' : "";

  return `
  <div class="admin-form-row${hasError ? " admin-error" : ""}">
    <label for="id_${escapeHtml(name)}" class="admin-label">
      ${escapeHtml(label)}${requiredMark}
    </label>
    <div class="admin-form-field">
      ${errorHtml}
      ${inputHtml}
      ${helpHtml}
    </div>
  </div>`;
}

// =============================================================================
// Parse POST body → flat record
// =============================================================================

async function parseFormData(
  request: Request,
): Promise<Record<string, string>> {
  const data: Record<string, string> = {};
  try {
    const formData = await request.formData();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        data[key] = value;
      }
    }
  } catch {
    // Unable to parse body
  }
  return data;
}

// =============================================================================
// Validate and coerce form data to model values
// =============================================================================

interface ValidationResult {
  data: Record<string, unknown>;
  errors: Record<string, string[]>;
  isValid: boolean;
}

function validateFormData(
  fields: FieldInfo[],
  formData: Record<string, string>,
): ValidationResult {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string[]> = {};

  for (const field of fields) {
    if (!field.isEditable || field.isPrimaryKey) continue;

    const raw = formData[field.name];
    const fieldErrors: string[] = [];

    // BooleanField — checkbox is absent when unchecked
    if (field.type === "BooleanField") {
      data[field.name] = raw === "on" || raw === "true" || raw === "1";
      continue;
    }

    // Empty value handling
    if (raw === undefined || raw === "") {
      if (field.isRequired) {
        fieldErrors.push("This field is required.");
        errors[field.name] = fieldErrors;
        continue;
      }
      // Allow null/blank
      data[field.name] = field.options.null
        ? null
        : (field.options.default ?? "");
      continue;
    }

    // Type coercion
    if (
      field.type === "IntegerField" ||
      field.type === "AutoField" ||
      field.type === "ForeignKey" ||
      field.type === "OneToOneField"
    ) {
      const num = parseInt(raw, 10);
      if (isNaN(num)) {
        fieldErrors.push("Enter a whole number.");
        errors[field.name] = fieldErrors;
        continue;
      }
      data[field.name] = num;
    } else if (field.type === "FloatField" || field.type === "DecimalField") {
      const num = parseFloat(raw);
      if (isNaN(num)) {
        fieldErrors.push("Enter a number.");
        errors[field.name] = fieldErrors;
        continue;
      }
      data[field.name] = num;
    } else if (
      field.type === "DateTimeField" ||
      field.type === "DateField"
    ) {
      const d = new Date(raw);
      if (isNaN(d.getTime())) {
        fieldErrors.push("Enter a valid date/time.");
        errors[field.name] = fieldErrors;
        continue;
      }
      data[field.name] = d;
    } else if (field.type === "JSONField") {
      try {
        data[field.name] = JSON.parse(raw);
      } catch {
        fieldErrors.push("Enter valid JSON.");
        errors[field.name] = fieldErrors;
        continue;
      }
    } else {
      // CharField, TextField, UUIDField, etc.
      if (
        field.options.maxLength !== undefined &&
        raw.length > field.options.maxLength
      ) {
        fieldErrors.push(
          `Ensure this value has at most ${field.options.maxLength} characters.`,
        );
        errors[field.name] = fieldErrors;
        continue;
      }
      data[field.name] = raw;
    }
  }

  return {
    data,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

// =============================================================================
// Fetch instance data from backend
// =============================================================================

async function fetchInstance(
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
// Save instance to backend
// =============================================================================

async function saveInstance(
  modelAdmin: ModelAdmin,
  backend: DatabaseBackend,
  data: Record<string, unknown>,
  existingId?: string,
): Promise<{ success: boolean; id?: unknown; error?: string }> {
  try {
    const manager = (modelAdmin.model as unknown as {
      objects: {
        using: (b: DatabaseBackend) => {
          create(data: Record<string, unknown>): Promise<unknown>;
          get(q: Record<string, unknown>): Promise<unknown>;
        };
      };
    }).objects;

    if (existingId) {
      // Update existing — fetch then mutate and save
      const instance = await manager.using(backend).get({
        id: parseInt(existingId, 10),
      });
      if (!instance) {
        return { success: false, error: "Instance not found" };
      }

      const r = instance as Record<string, { set(v: unknown): void }>;
      for (const [key, value] of Object.entries(data)) {
        if (r[key] && typeof r[key].set === "function") {
          r[key].set(value);
        }
      }

      await (instance as { save(): Promise<void> }).save();
      const id = (instance as Record<string, { get(): unknown }>).id?.get();
      return { success: true, id };
    } else {
      // Create new
      const instance = await manager.using(backend).create(data);
      const id = (instance as Record<string, { get(): unknown }>).id?.get();
      return { success: true, id };
    }
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// =============================================================================
// Render the form HTML
// =============================================================================

function renderFormHtml(
  fields: FieldInfo[],
  values: Record<string, unknown>,
  errors: Record<string, string[]>,
): string {
  return fields
    .filter((f) => f.isEditable)
    .map((f) => renderWidget(f, values[f.name], errors[f.name] ?? []))
    .join("\n");
}

// =============================================================================
// Change Form View (GET + POST)
// =============================================================================

/**
 * Render the add/change form for a model instance.
 *
 * @param context  - View context
 * @param modelName - Lowercase model name from the URL
 * @param objectId  - Object PK for edit, undefined for add
 */
export async function renderChangeForm(
  context: ChangeFormViewContext,
  modelName: string,
  objectId?: string,
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
  const allFields = getModelFields(modelAdmin.model);
  const editableFields = getEditableFields(modelAdmin.model);

  const isAdd = !objectId;
  const listUrl = modelAdmin.getListUrl();
  const formAction = isAdd
    ? modelAdmin.getAddUrl()
    : modelAdmin.getDetailUrl(objectId);

  const url = new URL(request.url);
  const currentPath = url.pathname;
  const navItems = buildNavItems(adminSite, currentPath);

  // --- Breadcrumbs ---
  const breadcrumbs = `
  <div class="admin-breadcrumbs">
    <a href="${escapeHtml(urlPrefix)}/">Home</a> ›
    <a href="${escapeHtml(listUrl)}">${escapeHtml(meta.verboseNamePlural)}</a> ›
    ${
    isAdd ? `Add ${escapeHtml(meta.verboseName)}` : escapeHtml(meta.verboseName)
  }
  </div>`;

  // =========================================================================
  // GET: Render form
  // =========================================================================

  if (request.method === "GET") {
    let values: Record<string, unknown> = {};

    if (!isAdd && objectId) {
      const instance = await fetchInstance(modelAdmin, backend, objectId);
      if (!instance) {
        return new Response("Object not found", { status: 404 });
      }
      values = instance;
    } else {
      // Populate defaults
      for (const f of allFields) {
        if (f.options.default !== undefined) {
          values[f.name] = f.options.default;
        }
      }
    }

    const formHtml = renderFormHtml(editableFields, values, {});
    const title = isAdd
      ? `Add ${meta.verboseName}`
      : `Change ${meta.verboseName}`;

    const content = buildPageContent({
      breadcrumbs,
      title,
      formAction,
      formHtml,
      isAdd,
      objectId,
      modelAdmin,
      modelName,
      urlPrefix,
    });

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
  // POST: Save and redirect
  // =========================================================================

  if (request.method === "POST") {
    const formData = await parseFormData(request);
    const validation = validateFormData(editableFields, formData);

    if (!validation.isValid) {
      // Re-render form with errors
      const displayValues: Record<string, unknown> = { ...formData };
      const formHtml = renderFormHtml(
        editableFields,
        displayValues,
        validation.errors,
      );
      const title = isAdd
        ? `Add ${meta.verboseName}`
        : `Change ${meta.verboseName}`;

      const content = buildPageContent({
        breadcrumbs,
        title,
        formAction,
        formHtml,
        isAdd,
        objectId,
        modelAdmin,
        modelName,
        urlPrefix,
        globalError: "Please correct the errors below.",
      });

      const html = baseTemplate({
        title,
        siteTitle: adminSite.title,
        urlPrefix,
        userEmail,
        navItems,
        content,
      });

      return new Response(html, {
        status: 422,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const result = await saveInstance(
      modelAdmin,
      backend,
      validation.data,
      isAdd ? undefined : objectId,
    );

    if (!result.success) {
      const displayValues: Record<string, unknown> = { ...formData };
      const formHtml = renderFormHtml(editableFields, displayValues, {});
      const title = isAdd
        ? `Add ${meta.verboseName}`
        : `Change ${meta.verboseName}`;

      const content = buildPageContent({
        breadcrumbs,
        title,
        formAction,
        formHtml,
        isAdd,
        objectId,
        modelAdmin,
        modelName,
        urlPrefix,
        globalError: result.error ?? "An error occurred while saving.",
      });

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

    // Redirect to change list on success
    const redirectUrl = listUrl;
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl, "HX-Redirect": redirectUrl },
    });
  }

  return new Response("Method not allowed", { status: 405 });
}

// =============================================================================
// Page content builder
// =============================================================================

interface PageContentOptions {
  breadcrumbs: string;
  title: string;
  formAction: string;
  formHtml: string;
  isAdd: boolean;
  objectId?: string;
  modelAdmin: ModelAdmin;
  modelName: string;
  urlPrefix: string;
  globalError?: string;
}

function buildPageContent(opts: PageContentOptions): string {
  const {
    breadcrumbs,
    title,
    formAction,
    formHtml,
    isAdd,
    objectId,
    modelAdmin,
    modelName,
    urlPrefix,
    globalError,
  } = opts;

  const globalErrorHtml = globalError
    ? `<p class="admin-error-message">${escapeHtml(globalError)}</p>`
    : "";

  const deleteBtn = !isAdd && objectId
    ? `<a href="${
      escapeHtml(`${urlPrefix}/${modelName}/${objectId}/delete/`)
    }" class="admin-btn admin-btn-danger admin-delete-btn">Delete</a>`
    : "";

  const saveContinue = modelAdmin.saveContinue
    ? `<input type="submit" name="_continue" value="Save and continue editing" class="admin-btn admin-btn-default">`
    : "";

  const saveAsNew = !isAdd && modelAdmin.saveAsNew
    ? `<input type="submit" name="_saveasnew" value="Save as new" class="admin-btn admin-btn-default">`
    : "";

  return `
  ${breadcrumbs}
  <div class="admin-changeform">
    <div class="admin-content-title">
      <h1>${escapeHtml(title)}</h1>
    </div>

    ${globalErrorHtml}

    <form method="post" action="${escapeHtml(formAction)}" id="changeform">
      <div class="admin-form-fields">
        ${formHtml}
      </div>

      <div class="admin-submit-row">
        <input type="submit" name="_save" value="Save" class="admin-btn admin-btn-primary admin-save-btn">
        ${saveContinue}
        ${saveAsNew}
        ${deleteBtn}
      </div>
    </form>
  </div>`;
}
