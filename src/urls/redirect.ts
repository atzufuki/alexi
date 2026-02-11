/**
 * Redirect response utilities for SPA views
 *
 * Provides Django-style redirect() function for view functions.
 * When a view returns a redirect response, the router should navigate
 * to the specified path using replace strategy (no history entry).
 *
 * @module @alexi/urls/redirect
 *
 * @example Basic usage
 * ```ts
 * import { redirect, isRedirectResponse } from '@alexi/urls';
 *
 * // In a view function
 * export async function myProjects(ctx, params) {
 *   if (!isAuthenticated()) {
 *     return redirect('/auth/signin/');
 *   }
 *   // ... render the page
 * }
 *
 * // In the router (main.ts)
 * const view = await result.view(ctx, result.params);
 *
 * if (isRedirectResponse(view)) {
 *   navigate(view.path, { replace: true });
 *   return;
 * }
 *
 * root.replaceChildren(view);
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Options for redirect response
 */
export interface RedirectOptions {
  /**
   * If true, indicates a permanent redirect (HTTP 301).
   * In SPA context, this is mainly for semantic purposes.
   * @default false
   */
  permanent?: boolean;
}

/**
 * Redirect response type
 *
 * A special response object that indicates the router should navigate
 * to a different path instead of rendering a view.
 */
export interface RedirectResponse {
  /** Internal marker to identify redirect responses */
  readonly __redirect: true;

  /** The path to redirect to */
  readonly path: string;

  /** Whether this is a permanent redirect */
  readonly permanent: boolean;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Create a redirect response
 *
 * Returns a special object that the router can detect and use to navigate
 * to a different path. This is similar to Django's `redirect()` shortcut.
 *
 * @param path - The path to redirect to (e.g., '/auth/signin/')
 * @param options - Redirect options
 * @returns A RedirectResponse object
 *
 * @example Redirect to login
 * ```ts
 * import { redirect } from '@alexi/urls';
 *
 * export async function protectedView(ctx, params) {
 *   if (!isAuthenticated()) {
 *     return redirect('/auth/signin/');
 *   }
 *   // ... render protected content
 * }
 * ```
 *
 * @example Redirect after form submission
 * ```ts
 * export async function createItem(ctx, params) {
 *   const item = await createNewItem(ctx.data);
 *   return redirect(`/items/${item.id}/`);
 * }
 * ```
 *
 * @example Permanent redirect (for SEO purposes)
 * ```ts
 * export async function oldPage(ctx, params) {
 *   return redirect('/new-page/', { permanent: true });
 * }
 * ```
 */
export function redirect(
  path: string,
  options?: RedirectOptions,
): RedirectResponse {
  return {
    __redirect: true,
    path,
    permanent: options?.permanent ?? false,
  };
}

/**
 * Check if a value is a redirect response
 *
 * Use this function in the router to detect redirect responses
 * and handle navigation appropriately.
 *
 * @param value - The value to check
 * @returns True if the value is a RedirectResponse
 *
 * @example Router usage
 * ```ts
 * import { resolve, isRedirectResponse } from '@alexi/urls';
 *
 * async function renderCurrentRoute(root: HTMLElement) {
 *   const result = resolve(path, urlpatterns);
 *
 *   if (!result) {
 *     root.replaceChildren(await render404(path));
 *     return;
 *   }
 *
 *   const view = await result.view(ctx, result.params);
 *
 *   // Check for redirect response
 *   if (isRedirectResponse(view)) {
 *     // Use replace to avoid back-button issues
 *     navigate(view.path, { replace: true });
 *     return;
 *   }
 *
 *   root.replaceChildren(view);
 * }
 * ```
 */
export function isRedirectResponse(value: unknown): value is RedirectResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "__redirect" in value &&
    (value as RedirectResponse).__redirect === true
  );
}
