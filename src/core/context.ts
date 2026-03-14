/**
 * Request-scoped context store for Alexi.
 *
 * Provides a Django-style side-channel for attaching arbitrary data to an
 * in-flight `Request` object without mutating it (which is impossible — `Request`
 * is immutable in the Fetch API).
 *
 * ### Why WeakMap?
 *
 * `AsyncLocalStorage` is not available in Service Workers, but Alexi runs
 * isomorphically in both Deno server and browser SW contexts. A `WeakMap` keyed
 * on the `Request` instance is an equally effective side-channel that works in
 * every runtime:
 *
 * - Entries are automatically GC'd when the `Request` is no longer reachable —
 *   no memory leaks.
 * - Each in-flight request has an independent, isolated context.
 * - No async-storage plumbing needed.
 *
 * ### Typical usage
 *
 * Middleware sets values on the context; views read them back:
 *
 * ```ts
 * // In a middleware
 * import { setRequestContext } from "@alexi/core";
 *
 * const authMiddleware: Middleware = async (request, next) => {
 *   const user = await authenticate(request);
 *   setRequestContext(request, { user });
 *   return next(request);
 * };
 *
 * // In a view
 * import { getRequestContext } from "@alexi/core";
 *
 * const profileView = async (request: Request) => {
 *   const { user } = getRequestContext(request);
 *   return Response.json({ email: user?.email });
 * };
 * ```
 *
 * @module
 */

// =============================================================================
// Internal store
// =============================================================================

/**
 * Per-request context data attached via {@link setRequestContext}.
 *
 * The `user` field mirrors Django's `request.user` — populated by an
 * authentication middleware and read by views / permission checks.
 */
export interface RequestContext {
  /**
   * The authenticated user for this request, or `undefined` for anonymous
   * requests.
   *
   * Mirrors Django's `request.user` (set by `AuthenticationMiddleware`).
   */
  user?: {
    /** Numeric user ID. */
    userId: number;
    /** User email address. */
    email: string;
    /** Whether this user has staff/admin privileges. */
    isAdmin: boolean;
  };

  /**
   * Arbitrary key/value pairs added by custom middleware or views.
   *
   * @example
   * ```ts
   * setRequestContext(request, { extra: { organisationId: 42 } });
   * const { extra } = getRequestContext(request);
   * ```
   */
  [key: string]: unknown;
}

/** WeakMap-based side-channel so entries are GC'd with the Request. */
const _store = new WeakMap<Request, RequestContext>();

// =============================================================================
// Public API
// =============================================================================

/**
 * Attach (or merge) context data to a `Request` instance.
 *
 * Subsequent calls for the same request are **merged** (shallow), so middleware
 * can call `setRequestContext` multiple times without overwriting earlier data.
 *
 * @param request - The in-flight request to annotate.
 * @param context - Data to merge into the request's context.
 *
 * @example
 * ```ts
 * setRequestContext(request, { user: { userId: 1, email: "a@b.com", isAdmin: false } });
 * ```
 */
export function setRequestContext(
  request: Request,
  context: Partial<RequestContext>,
): void {
  const existing = _store.get(request) ?? {};
  _store.set(request, { ...existing, ...context });
}

/**
 * Retrieve the context attached to a `Request` instance.
 *
 * Returns an empty object (`{}`) when no context has been set yet, so callers
 * never need to null-check the return value.
 *
 * @param request - The in-flight request whose context to retrieve.
 * @returns The context object (possibly empty).
 *
 * @example
 * ```ts
 * const { user } = getRequestContext(request);
 * if (!user) return new Response("Unauthorized", { status: 401 });
 * ```
 */
export function getRequestContext(request: Request): RequestContext {
  return _store.get(request) ?? {};
}
