/**
 * Type definitions for Alexi URL routing
 *
 * @module @alexi/urls/types
 */

// ============================================================================
// View Types
// ============================================================================

/**
 * A view function that handles requests
 *
 * Generic view function that can be used for backend (Request/Response) or SPA (ViewContext/Node).
 *
 * @template TContext - The context type (default: Request for backend)
 * @template TReturn - The return type (default: Response for backend)
 *
 * @example Backend usage
 * ```ts
 * const list_assets: View = async (request, params) => {
 *   const assets = await AssetModel.objects.all().fetch();
 *   return Response.json(assets);
 * };
 *
 * const get_asset: View = async (request, params) => {
 *   const { id } = params;
 *   const asset = await AssetModel.objects.get({ id: Number(id) });
 *   return Response.json(asset);
 * };
 * ```
 *
 * @example SPA usage
 * ```ts
 * const home_view: View<ViewContext, Node> = async (ctx, params) => {
 *   return new Div({ textContent: "Home" });
 * };
 * ```
 */
export type View<TContext = Request, TReturn = Response> = (
  context: TContext,
  params: Record<string, string>,
) => TReturn | Promise<TReturn>;

// ============================================================================
// URL Pattern Types
// ============================================================================

/**
 * Options for a URL pattern
 */
export interface URLPatternOptions {
  /** Named route for reverse URL lookup */
  name?: string;
  /** HTTP methods allowed for this pattern */
  methods?: string[];
}

/**
 * A URL pattern that maps a route to a view or nested patterns
 *
 * @template TContext - The context type (default: Request for backend)
 * @template TReturn - The return type (default: Response for backend)
 *
 * @example Backend usage
 * ```ts
 * // Simple pattern with view
 * const pattern: URLPattern = {
 *   pattern: "assets/",
 *   view: list_assets,
 *   name: "asset-list",
 * };
 *
 * // Pattern with nested routes (include)
 * const pattern: URLPattern = {
 *   pattern: "api/",
 *   children: [
 *     { pattern: "assets/", view: list_assets },
 *     { pattern: "tasks/", view: list_tasks },
 *   ],
 * };
 * ```
 *
 * @example SPA usage
 * ```ts
 * const pattern: URLPattern<ViewContext, Node> = {
 *   pattern: "",
 *   view: home_view,
 *   name: "home",
 * };
 * ```
 */
export interface URLPattern<TContext = Request, TReturn = Response> {
  /** URL pattern string (e.g., "assets/", ":id/", "users/:userId/posts/") */
  pattern: string;

  /** View function to handle requests (mutually exclusive with children) */
  view?: View<TContext, TReturn>;

  /** Nested URL patterns from include() (mutually exclusive with view) */
  children?: URLPattern<TContext, TReturn>[];

  /** Named route for reverse URL lookup */
  name?: string;
}

// ============================================================================
// Resolve Types
// ============================================================================

/**
 * Result of resolving a URL to a view
 *
 * @template TContext - The context type (default: Request for backend)
 * @template TReturn - The return type (default: Response for backend)
 *
 * @example Backend usage
 * ```ts
 * const result = resolve("/assets/123/", urlpatterns);
 * if (result) {
 *   // result.view is the matched view function
 *   // result.params is { id: "123" }
 *   // result.name is "asset-detail" (if named)
 *   const response = await result.view(request, result.params);
 * }
 * ```
 *
 * @example SPA usage
 * ```ts
 * const result = resolve<ViewContext, Node>("/", urlpatterns);
 * if (result) {
 *   const node = await result.view(ctx, result.params);
 * }
 * ```
 */
export interface ResolveResult<TContext = Request, TReturn = Response> {
  /** The matched view function */
  view: View<TContext, TReturn>;

  /** URL parameters extracted from the path (e.g., { id: "123" }) */
  params: Record<string, string>;

  /** The name of the matched route (if defined) */
  name?: string;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * A compiled URL pattern segment for efficient matching
 * @internal
 */
export interface CompiledSegment {
  /** Whether this segment is a parameter (e.g., :id) */
  isParam: boolean;

  /** The segment value (parameter name or literal value) */
  value: string;
}

/**
 * A compiled URL pattern for efficient matching
 * @template TContext - The context type (default: Request for backend)
 * @template TReturn - The return type (default: Response for backend)
 * @internal
 */
export interface CompiledPattern<TContext = Request, TReturn = Response> {
  /** Original pattern string */
  original: string;

  /** Compiled segments */
  segments: CompiledSegment[];

  /** View function (if leaf pattern) */
  view?: View<TContext, TReturn>;

  /** Nested compiled patterns (if branch pattern) */
  children?: CompiledPattern<TContext, TReturn>[];

  /** Named route */
  name?: string;
}
