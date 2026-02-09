/**
 * Admin Navigation
 *
 * Shared navigation utilities for the admin SPA.
 *
 * @module alexi_admin/app/navigation
 */

/**
 * Navigate to an admin route
 *
 * Ensures the path starts with /admin and uses the History API
 * to trigger client-side navigation.
 *
 * @param path - Path to navigate to (with or without /admin prefix)
 *
 * @example
 * ```ts
 * navigateTo("/admin/users/");
 * navigateTo("/users/");  // Will be prefixed with /admin
 * navigateTo("users/");   // Will be prefixed with /admin
 * ```
 */
export function navigateTo(path: string): void {
  // Ensure path starts with /admin
  let adminPath: string;

  if (path.startsWith("/admin")) {
    adminPath = path;
  } else if (path.startsWith("/")) {
    adminPath = `/admin${path}`;
  } else {
    adminPath = `/admin/${path}`;
  }

  // Ensure trailing slash for consistency (Django-style)
  if (!adminPath.endsWith("/") && !adminPath.includes(".")) {
    adminPath = `${adminPath}/`;
  }

  // Use history API
  globalThis.history.pushState({}, "", adminPath);

  // Dispatch popstate to trigger route update
  globalThis.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Navigate and replace current history entry
 *
 * Same as navigateTo but replaces the current history entry
 * instead of pushing a new one.
 *
 * @param path - Path to navigate to (with or without /admin prefix)
 */
export function replaceLocation(path: string): void {
  // Ensure path starts with /admin
  let adminPath: string;

  if (path.startsWith("/admin")) {
    adminPath = path;
  } else if (path.startsWith("/")) {
    adminPath = `/admin${path}`;
  } else {
    adminPath = `/admin/${path}`;
  }

  // Ensure trailing slash for consistency (Django-style)
  if (!adminPath.endsWith("/") && !adminPath.includes(".")) {
    adminPath = `${adminPath}/`;
  }

  // Use history API with replace
  globalThis.history.replaceState({}, "", adminPath);

  // Dispatch popstate to trigger route update
  globalThis.dispatchEvent(new PopStateEvent("popstate"));
}
