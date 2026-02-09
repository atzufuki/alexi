/**
 * Alexi Admin View Functions
 *
 * Django-style view functions that lazy-load admin templates.
 * Each view function loads its template lazily and returns a web component.
 *
 * @module alexi_admin/app/views
 */

import type { ViewContext } from "./types.ts";

// =============================================================================
// Auth Views
// =============================================================================

/**
 * Login page view
 */
export async function login(ctx: ViewContext): Promise<Node> {
  const { default: AdminLogin } = await import("./templates/login.ts");
  return new AdminLogin({
    onLoginSuccess: () => {
      // Navigate to admin dashboard after login
      ctx.navigate("/admin/");
    },
  });
}

// =============================================================================
// Dashboard Views
// =============================================================================

/**
 * Admin dashboard (index) view
 */
export async function dashboard(_ctx: ViewContext): Promise<Node> {
  const { default: AdminDashboard } = await import("./templates/dashboard.ts");
  return new AdminDashboard({
    dataset: { key: "dashboard" },
  });
}

// =============================================================================
// Model Views
// =============================================================================

/**
 * Model list view (changelist)
 */
export async function modelList(ctx: ViewContext): Promise<Node> {
  const { default: AdminModelList } = await import("./templates/model_list.ts");
  return new AdminModelList({
    dataset: { key: `model-list-${ctx.params.model}` },
    modelName: ctx.params.model ?? "",
  });
}

/**
 * Model detail/edit view
 */
export async function modelDetail(ctx: ViewContext): Promise<Node> {
  const { default: AdminModelDetail } = await import(
    "./templates/model_detail.ts"
  );
  return new AdminModelDetail({
    dataset: { key: `model-detail-${ctx.params.model}-${ctx.params.id}` },
    modelName: ctx.params.model ?? "",
    objectId: ctx.params.id ?? "",
  });
}

/**
 * Model add view (create new)
 */
export async function modelAdd(ctx: ViewContext): Promise<Node> {
  const { default: AdminModelDetail } = await import(
    "./templates/model_detail.ts"
  );
  return new AdminModelDetail({
    dataset: { key: `model-add-${ctx.params.model}` },
    modelName: ctx.params.model ?? "",
    objectId: "", // Empty = add mode
  });
}

/**
 * Model delete confirmation view
 */
export async function modelDelete(ctx: ViewContext): Promise<Node> {
  // For now, use the same detail view with delete mode
  // In the future, this could be a dedicated delete confirmation page
  const { default: AdminModelDetail } = await import(
    "./templates/model_detail.ts"
  );
  return new AdminModelDetail({
    dataset: { key: `model-delete-${ctx.params.model}-${ctx.params.id}` },
    modelName: ctx.params.model ?? "",
    objectId: ctx.params.id ?? "",
    // deleteMode: true, // Future enhancement
  });
}
