/**
 * UI urls.ts template generator
 *
 * @module @alexi/create/templates/ui/urls_ts
 */

/**
 * Generate urls.ts content for the UI app
 */
export function generateUiUrlsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} UI URLs
 *
 * URL patterns for the frontend SPA.
 *
 * @module ${name}-ui/urls
 */

import { path } from "@alexi/urls";
import type { URLPattern } from "@alexi/urls";
import * as views from "@${name}-ui/views.ts";
import { getSessionId, getSessionIdFromUrl, setSessionId } from "@${name}-ui/session.ts";

/**
 * Redirect to session URL
 *
 * If the user visits the root URL, redirect to their session URL.
 * This enables shareable todo lists via URL.
 */
async function redirectToSession(): Promise<Node> {
  const pathname = globalThis.location?.pathname ?? "/";

  // Check if URL already contains a valid session ID
  const urlSessionId = getSessionIdFromUrl(pathname);
  if (urlSessionId) {
    // Adopt the session from URL (for shared links)
    setSessionId(urlSessionId);
    // Continue to home view with this session
    return views.home({} as any, { sessionId: urlSessionId });
  }

  // No session in URL - redirect to user's session
  const sessionId = getSessionId();
  globalThis.history?.replaceState(null, "", "/" + sessionId);
  return views.home({} as any, { sessionId });
}

/**
 * URL patterns for the UI app
 */
export const urlpatterns: URLPattern[] = [
  // Root redirects to session URL
  path("", redirectToSession, { name: "redirect" }),
  // Session-based home page
  path(":sessionId/", views.home, { name: "home" }),
];
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
