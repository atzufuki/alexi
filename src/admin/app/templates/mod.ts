/**
 * Admin Templates Module
 *
 * Exports all admin template components (web components).
 * Templates are lazy-loaded by view functions in views.ts.
 *
 * @module alexi_admin/app/templates
 */

export { default as AdminDashboard } from "./dashboard.ts";
export { default as AdminLogin } from "./login.ts";
export { default as AdminModelList } from "./model_list.ts";
export { default as AdminModelDetail } from "./model_detail.ts";
