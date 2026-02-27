/**
 * Alexi Admin Change List View
 *
 * Renders the model list / changelist page (GET /admin/<model>/).
 * Supports search, pagination, column sorting, list filters, and bulk actions.
 *
 * Uses the MPA base template and requires a valid JWT (injected by admin.js).
 *
 * @module
 */

import type { AdminSite } from "../site.ts";
import type { ModelAdmin } from "../model_admin.ts";
import type { DatabaseBackend } from "@alexi/db";
import { getModelFields, getModelMeta } from "../introspection.ts";
import { baseTemplate } from "../templates/mpa/base.ts";
import { verifyAdminToken } from "./auth_guard.ts";

// =============================================================================
// Types
// =============================================================================

export interface ChangeListViewContext {
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

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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
 * Build a URL that preserves existing query params but overrides specified ones.
 */
function buildUrl(
  baseUrl: string,
  params: URLSearchParams,
  overrides: Record<string, string | null>,
): string {
  const newParams = new URLSearchParams(params);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
  }
  const qs = newParams.toString();
  return qs ? `${baseUrl}?${qs}` : baseUrl;
}

// =============================================================================
// Render Filters Sidebar
// =============================================================================

function renderFilters(
  modelAdmin: ModelAdmin,
  listUrl: string,
  searchParams: URLSearchParams,
): string {
  const filterFields = modelAdmin.listFilter;
  if (filterFields.length === 0) return "";

  const modelFields = getModelFields(modelAdmin.model);

  const sections = filterFields
    .map((fieldName) => {
      const field = modelFields.find((f) => f.name === fieldName);
      if (!field) return "";

      const label = field.options.verboseName ?? humanize(fieldName);
      const activeValue = searchParams.get(fieldName);

      // For BooleanField or choices — render discrete links
      const choices = field.options.choices ?? [];
      let items = "";

      if (field.type === "BooleanField") {
        const allActive = !activeValue;
        const yesActive = activeValue === "true";
        const noActive = activeValue === "false";

        items = `
          <li${allActive ? ' class="admin-filter-item-active"' : ""}>
            <a href="${
          escapeHtml(
            buildUrl(listUrl, searchParams, { [fieldName]: null, p: null }),
          )
        }">All</a>
          </li>
          <li${yesActive ? ' class="admin-filter-item-active"' : ""}>
            <a href="${
          escapeHtml(
            buildUrl(listUrl, searchParams, { [fieldName]: "true", p: null }),
          )
        }">Yes</a>
          </li>
          <li${noActive ? ' class="admin-filter-item-active"' : ""}>
            <a href="${
          escapeHtml(
            buildUrl(listUrl, searchParams, { [fieldName]: "false", p: null }),
          )
        }">No</a>
          </li>`;
      } else if (choices.length > 0) {
        const allActive = !activeValue;
        items = `
          <li${allActive ? ' class="admin-filter-item-active"' : ""}>
            <a href="${
          escapeHtml(
            buildUrl(listUrl, searchParams, { [fieldName]: null, p: null }),
          )
        }">All</a>
          </li>`;
        for (const [value, display] of choices) {
          const isActive = activeValue === String(value);
          items += `
          <li${isActive ? ' class="admin-filter-item-active"' : ""}>
            <a href="${
            escapeHtml(
              buildUrl(listUrl, searchParams, {
                [fieldName]: String(value),
                p: null,
              }),
            )
          }">${escapeHtml(display)}</a>
          </li>`;
        }
      } else {
        // Generic text filter — skip rendering (no discrete values)
        return "";
      }

      return `
      <div class="admin-filter-section">
        <h3 class="admin-filter-title">By ${escapeHtml(label)}</h3>
        <ul class="admin-filter-list">
          ${items}
        </ul>
      </div>`;
    })
    .join("");

  if (!sections.trim()) return "";

  return `<div class="admin-filters">${sections}</div>`;
}

// =============================================================================
// Render Search Bar
// =============================================================================

function renderSearch(
  modelAdmin: ModelAdmin,
  listUrl: string,
  searchParams: URLSearchParams,
  searchQuery: string,
): string {
  if (modelAdmin.searchFields.length === 0) return "";

  const placeholder = modelAdmin.searchPlaceholder ||
    `Search ${modelAdmin.getVerboseNamePlural().toLowerCase()}...`;

  return `
  <div class="admin-search-bar">
    <form method="get" action="${escapeHtml(listUrl)}">
      ${
    // Preserve non-search, non-page params
    Array.from(searchParams.entries())
      .filter(([k]) => k !== "q" && k !== "p")
      .map(([k, v]) =>
        `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`
      )
      .join("")}
      <div class="admin-search-row">
        <input
          type="search"
          name="q"
          value="${escapeHtml(searchQuery)}"
          placeholder="${escapeHtml(placeholder)}"
          class="admin-search-input"
        >
        <button type="submit" class="admin-btn admin-btn-default">Search</button>
        ${
    searchQuery
      ? `<a href="${
        escapeHtml(buildUrl(listUrl, searchParams, { q: null, p: null }))
      }" class="admin-btn admin-btn-default">Clear</a>`
      : ""
  }
      </div>
    </form>
  </div>`;
}

// =============================================================================
// Render Bulk Actions Bar
// =============================================================================

function renderBulkActions(
  modelAdmin: ModelAdmin,
  listUrl: string,
): string {
  const actions = modelAdmin.getActions();
  if (actions.length === 0) return "";

  const options = actions
    .map((a) =>
      `<option value="${escapeHtml(a.name)}">${escapeHtml(a.label)}</option>`
    )
    .join("");

  return `
  <div class="admin-bulk-actions">
    <label for="bulk-action-select" class="admin-bulk-action-label">Action:</label>
    <select id="bulk-action-select" name="action" class="admin-bulk-action-select">
      <option value="">---------</option>
      ${options}
    </select>
    <button type="submit" class="admin-btn admin-btn-default admin-bulk-action-go">Go</button>
  </div>`;
}

// =============================================================================
// Render Pagination
// =============================================================================

function renderPagination(
  total: number,
  page: number,
  perPage: number,
  listUrl: string,
  searchParams: URLSearchParams,
): string {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return "";

  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  const pageLinks: string[] = [];

  // Show page window: first, prev cluster, current cluster, next cluster, last
  const window = 2;
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (
    let i = Math.max(1, page - window);
    i <= Math.min(totalPages, page + window);
    i++
  ) {
    pages.add(i);
  }

  const sortedPages = Array.from(pages).sort((a, b) => a - b);
  let prev = 0;
  for (const p of sortedPages) {
    if (p - prev > 1) {
      pageLinks.push(`<span class="admin-pagination-ellipsis">…</span>`);
    }
    const isActive = p === page;
    pageLinks.push(
      `<a href="${
        escapeHtml(buildUrl(listUrl, searchParams, { p: String(p) }))
      }" class="admin-pagination-link${isActive ? " active" : ""}">${p}</a>`,
    );
    prev = p;
  }

  const prevLink = prevPage
    ? `<a href="${
      escapeHtml(buildUrl(listUrl, searchParams, { p: String(prevPage) }))
    }" class="admin-pagination-link">‹ Previous</a>`
    : `<span class="admin-pagination-disabled">‹ Previous</span>`;

  const nextLink = nextPage
    ? `<a href="${
      escapeHtml(buildUrl(listUrl, searchParams, { p: String(nextPage) }))
    }" class="admin-pagination-link">Next ›</a>`
    : `<span class="admin-pagination-disabled">Next ›</span>`;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return `
  <p class="admin-pagination-info">${start}–${end} of ${total}</p>
  <div class="admin-pagination">
    ${prevLink}
    ${pageLinks.join("")}
    ${nextLink}
  </div>`;
}

// =============================================================================
// Change List View
// =============================================================================

/**
 * Render the model change list (GET /admin/<model>/).
 *
 * Query parameters:
 *  - `q`        — search query
 *  - `p`        — page number (1-based)
 *  - `o`        — ordering field (prefix with `-` for descending)
 *  - `<field>`  — filter by field value (for listFilter fields)
 */
export async function renderChangeList(
  context: ChangeListViewContext,
  modelName: string,
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
  const fields = getModelFields(modelAdmin.model);
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const listUrl = modelAdmin.getListUrl();

  // --- Parse query params ---
  const searchQuery = searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("p") ?? "1", 10) || 1);
  const ordering = searchParams.get("o") ?? "";
  const perPage = modelAdmin.listPerPage;

  // --- Determine columns ---
  const listDisplay = modelAdmin.listDisplay.length > 0
    ? modelAdmin.listDisplay
    : fields.slice(0, 6).map((f) => f.name);

  // --- Load data via backend ---
  let allData: Record<string, unknown>[] = [];
  let totalCount = 0;

  try {
    // Build manager query
    const manager = (modelAdmin.model as unknown as {
      objects: {
        using: (b: DatabaseBackend) => {
          all(): {
            fetch(): Promise<{ array(): unknown[] }>;
          };
          filter(q: Record<string, unknown>): {
            fetch(): Promise<{ array(): unknown[] }>;
          };
        };
      };
    }).objects;

    // Build filter conditions from URL params
    const filterConditions: Record<string, unknown> = {};

    for (const fieldName of modelAdmin.listFilter) {
      const paramValue = searchParams.get(fieldName);
      if (paramValue !== null) {
        const field = fields.find((f) => f.name === fieldName);
        if (field?.type === "BooleanField") {
          filterConditions[fieldName] = paramValue === "true";
        } else {
          filterConditions[fieldName] = paramValue;
        }
      }
    }

    const hasFilters = Object.keys(filterConditions).length > 0;
    const qs = hasFilters
      ? manager.using(backend).filter(filterConditions)
      : manager.using(backend).all();

    const fetchedSet = await qs.fetch();
    let rows = fetchedSet.array() as unknown[];

    // Apply search (in-memory, since the backend query API doesn't expose
    // full-text search yet — #131 will add backend-level search)
    if (searchQuery && modelAdmin.searchFields.length > 0) {
      const lower = searchQuery.toLowerCase();
      rows = rows.filter((row) => {
        const r = row as Record<string, unknown>;
        return modelAdmin.searchFields.some((fieldName) => {
          const f = r[fieldName];
          const v = f && typeof f === "object" && "get" in f
            ? (f as { get(): unknown }).get()
            : f;
          return String(v ?? "").toLowerCase().includes(lower);
        });
      });
    }

    totalCount = rows.length;

    // Apply ordering
    if (ordering) {
      const desc = ordering.startsWith("-");
      const field = desc ? ordering.slice(1) : ordering;
      rows.sort((a, b) => {
        const ra = a as Record<string, unknown>;
        const rb = b as Record<string, unknown>;
        const va = ra[field] && typeof ra[field] === "object" &&
            "get" in (ra[field] as object)
          ? (ra[field] as { get(): unknown }).get()
          : ra[field];
        const vb = rb[field] && typeof rb[field] === "object" &&
            "get" in (rb[field] as object)
          ? (rb[field] as { get(): unknown }).get()
          : rb[field];
        const sa = String(va ?? "");
        const sb = String(vb ?? "");
        return desc ? sb.localeCompare(sa) : sa.localeCompare(sb);
      });
    } else if (modelAdmin.ordering.length > 0) {
      // Default ordering from ModelAdmin
      const defaultOrder = modelAdmin.ordering[0];
      const desc = defaultOrder.startsWith("-");
      const field = desc ? defaultOrder.slice(1) : defaultOrder;
      rows.sort((a, b) => {
        const ra = a as Record<string, unknown>;
        const rb = b as Record<string, unknown>;
        const va = ra[field] && typeof ra[field] === "object" &&
            "get" in (ra[field] as object)
          ? (ra[field] as { get(): unknown }).get()
          : ra[field];
        const vb = rb[field] && typeof rb[field] === "object" &&
            "get" in (rb[field] as object)
          ? (rb[field] as { get(): unknown }).get()
          : rb[field];
        const sa = String(va ?? "");
        const sb = String(vb ?? "");
        return desc ? sb.localeCompare(sa) : sa.localeCompare(sb);
      });
    }

    // Paginate
    const startIndex = (page - 1) * perPage;
    const pageRows = rows.slice(startIndex, startIndex + perPage);

    // Serialize to plain objects
    allData = pageRows.map((row) => {
      const obj: Record<string, unknown> = {};
      const r = row as Record<string, unknown>;
      for (const f of fields) {
        const v = r[f.name];
        obj[f.name] = v && typeof v === "object" && "get" in v
          ? (v as { get(): unknown }).get()
          : v;
      }
      return obj;
    });
  } catch (err) {
    console.error(`[Admin] Failed to load ${modelName} list:`, err);
  }

  // --- Build column headers ---
  const listDisplayLinks = modelAdmin.getListDisplayLinks();

  const headers = listDisplay
    .map((fieldName) => {
      const field = fields.find((f) => f.name === fieldName);
      const label = field?.options.verboseName ?? humanize(fieldName);
      const isOrdering = ordering === fieldName ||
        ordering === `-${fieldName}`;
      const isDesc = ordering === `-${fieldName}`;

      // Toggle direction on click
      const nextOrder = isOrdering && !isDesc ? `-${fieldName}` : fieldName;
      const sortUrl = escapeHtml(
        buildUrl(listUrl, searchParams, { o: nextOrder, p: null }),
      );

      const arrow = isOrdering ? (isDesc ? " ▾" : " ▴") : "";

      return `<th class="admin-col-header${isOrdering ? " sorted" : ""}">
        <a href="${sortUrl}">${escapeHtml(label)}${arrow}</a>
      </th>`;
    })
    .join("");

  // --- Build table rows ---
  const rows = allData.map((item) => {
    const id = String(item.id ?? item[fields[0]?.name] ?? "");

    const cells = listDisplay.map((fieldName) => {
      const value = item[fieldName];
      const display = formatValue(value);
      const isLink = listDisplayLinks.includes(fieldName);

      if (isLink) {
        const changeUrl = escapeHtml(`${urlPrefix}/${modelName}/${id}/`);
        return `<td><a href="${changeUrl}" class="admin-list-link">${
          escapeHtml(display)
        }</a></td>`;
      }
      return `<td>${escapeHtml(display)}</td>`;
    }).join("");

    return `<tr>
      <td class="admin-col-checkbox">
        <input type="checkbox" name="_selected_action" value="${
      escapeHtml(id)
    }" class="action-select">
      </td>
      ${cells}
    </tr>`;
  }).join("\n");

  // --- Table HTML ---
  // Always render the table with headers so column links are accessible even
  // when there are no rows. Show an empty message row when the result set is
  // empty.
  const tbodyContent = allData.length > 0
    ? rows
    : `<tr><td colspan="${
      listDisplay.length + 1
    }" class="admin-empty">0 ${meta.verboseNamePlural.toLowerCase()}</td></tr>`;

  const tableHtml = `
    <table id="result_list" class="admin-change-list-table">
      <thead>
        <tr>
          <th class="admin-col-checkbox">
            <input type="checkbox" id="action-toggle" title="Select all">
          </th>
          ${headers}
        </tr>
      </thead>
      <tbody>
        ${tbodyContent}
      </tbody>
    </table>`;

  // --- Filters sidebar ---
  const filtersHtml = renderFilters(modelAdmin, listUrl, searchParams);

  // --- Pagination ---
  const paginationHtml = renderPagination(
    totalCount,
    page,
    perPage,
    listUrl,
    searchParams,
  );

  // --- Search bar ---
  const searchHtml = renderSearch(
    modelAdmin,
    listUrl,
    searchParams,
    searchQuery,
  );

  // --- Breadcrumbs ---
  const breadcrumbs = `
  <div class="admin-breadcrumbs">
    <a href="${escapeHtml(urlPrefix)}/">Home</a> ›
    ${escapeHtml(meta.verboseNamePlural)}
  </div>`;

  // --- Count summary ---
  const countSummary = searchQuery
    ? `${totalCount} ${meta.verboseNamePlural.toLowerCase()} matching "${
      escapeHtml(searchQuery)
    }"`
    : `${totalCount} ${meta.verboseNamePlural.toLowerCase()}`;

  const content = `
  ${breadcrumbs}
  <div class="admin-changelist">
    <div class="admin-content-title">
      <h1>${escapeHtml(meta.verboseNamePlural)}</h1>
      <a href="${
    escapeHtml(modelAdmin.getAddUrl())
  }" class="admin-btn admin-addlink">
        Add ${escapeHtml(meta.verboseName)}
      </a>
    </div>

    <div class="admin-changelist-wrapper">
      ${
    filtersHtml
      ? `<aside class="admin-changelist-filters">${filtersHtml}</aside>`
      : ""
  }

      <div class="admin-changelist-content">
        ${searchHtml}

        <form id="changelist-form" method="post" action="${
    escapeHtml(listUrl)
  }">
          ${renderBulkActions(modelAdmin, listUrl)}

          <p class="admin-changelist-count">${countSummary}</p>

          <div class="admin-results">
            ${tableHtml}
          </div>

          ${paginationHtml}
        </form>
      </div>
    </div>
  </div>

  <script>
    // Select all / deselect all
    (function() {
      var toggle = document.getElementById('action-toggle');
      if (toggle) {
        toggle.addEventListener('change', function() {
          var checkboxes = document.querySelectorAll('input[name="_selected_action"]');
          checkboxes.forEach(function(cb) { cb.checked = toggle.checked; });
        });
      }
    })();
  </script>`;

  const navItems = buildNavItems(adminSite, url.pathname);

  const html = baseTemplate({
    title: meta.verboseNamePlural,
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
