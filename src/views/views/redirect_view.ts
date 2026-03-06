/**
 * Alexi Views - Class-Based Views: RedirectView
 *
 * Mirrors Django's `django.views.generic.base.RedirectView`.
 *
 * @module @alexi/views/views/redirect_view
 */

import { View } from "./base.ts";

// =============================================================================
// RedirectView
// =============================================================================

/**
 * A view that redirects to a given URL.
 *
 * Mirrors Django's `django.views.generic.RedirectView`.
 *
 * @example Permanent static redirect
 * ```ts
 * import { RedirectView } from "@alexi/views";
 *
 * path("old/", RedirectView.as_view({ url: "/new/", permanent: true }));
 * ```
 *
 * @example Dynamic redirect
 * ```ts
 * class ProfileRedirectView extends RedirectView {
 *   override getRedirectUrl(
 *     request: Request,
 *     params: Record<string, string>,
 *   ): string | null {
 *     return `/users/${params.username}/profile/`;
 *   }
 * }
 * path("profile/:username/", ProfileRedirectView.as_view());
 * ```
 */
export class RedirectView extends View {
  /**
   * The URL to redirect to.
   * URL parameters from `params` are substituted using `:param` syntax.
   * If `null`, `getRedirectUrl()` must be overridden.
   */
  url: string | null = null;

  /**
   * Whether to use a permanent redirect (301) instead of a temporary one (302).
   * @default false
   */
  permanent = false;

  /**
   * Whether to pass GET query parameters to the redirect URL.
   * @default true
   */
  queryStringForward = true;

  /**
   * Return the URL to redirect to, or `null` to return 410 Gone.
   *
   * The default implementation substitutes `:param` placeholders in `this.url`
   * with the matched URL parameters.
   *
   * Override to generate the URL dynamically.
   */
  getRedirectUrl(
    _request: Request,
    params: Record<string, string>,
  ): string | null {
    if (!this.url) {
      return null;
    }

    // Substitute :param placeholders with URL parameters
    let redirectUrl = this.url;
    for (const [key, value] of Object.entries(params)) {
      redirectUrl = redirectUrl.replaceAll(`:${key}`, value);
    }

    return redirectUrl;
  }

  /**
   * Handle any HTTP method by redirecting.
   */
  private redirect(
    request: Request,
    params: Record<string, string>,
  ): Response {
    let redirectUrl = this.getRedirectUrl(request, params);

    if (!redirectUrl) {
      return new Response("Gone", { status: 410 });
    }

    // Forward query string if configured
    if (this.queryStringForward) {
      const requestUrl = new URL(request.url);
      if (requestUrl.search) {
        // Append existing query string (avoid duplicating if already present)
        const separator = redirectUrl.includes("?") ? "&" : "?";
        redirectUrl = `${redirectUrl}${separator}${requestUrl.search.slice(1)}`;
      }
    }

    const status = this.permanent ? 301 : 302;
    return new Response(null, {
      status,
      headers: { Location: redirectUrl },
    });
  }

  get(request: Request, params: Record<string, string>): Response {
    return this.redirect(request, params);
  }

  post(request: Request, params: Record<string, string>): Response {
    return this.redirect(request, params);
  }

  put(request: Request, params: Record<string, string>): Response {
    return this.redirect(request, params);
  }

  patch(request: Request, params: Record<string, string>): Response {
    return this.redirect(request, params);
  }

  delete(request: Request, params: Record<string, string>): Response {
    return this.redirect(request, params);
  }

  head(request: Request, params: Record<string, string>): Response {
    return this.redirect(request, params);
  }
}
