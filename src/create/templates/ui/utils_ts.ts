/**
 * UI utils.ts template generator
 *
 * @module @alexi/create/templates/ui/utils_ts
 */

/**
 * Generate utils.ts content for the UI app
 */
export function generateUiUtilsTs(): string {
  return `/**
 * UI Utilities
 *
 * Helper functions for navigation and view context.
 *
 * @module utils
 */

/**
 * View context passed to view functions
 */
export interface ViewContext {
  path: string;
  query: URLSearchParams;
}

/**
 * Navigate to a new path
 */
export function navigate(path: string, options?: { replace?: boolean }): void {
  if (options?.replace) {
    globalThis.history.replaceState({}, "", path);
  } else {
    globalThis.history.pushState({}, "", path);
  }
  globalThis.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Check if a link is internal (same origin)
 */
export function isInternalLink(link: HTMLAnchorElement): boolean {
  return (
    link.origin === globalThis.location.origin &&
    !link.hasAttribute("target") &&
    !link.hasAttribute("download")
  );
}

/**
 * Normalize path to always end with a slash (unless it has an extension)
 */
export function normalizePath(path: string): string {
  return path.endsWith("/") || path.includes(".") ? path : \`\${path}/\`;
}
`;
}
