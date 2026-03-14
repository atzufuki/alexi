/**
 * Application class for Alexi Core
 *
 * Combines URL routing with middleware to create an HTTP application.
 * This is the core request handler, similar to Django's WSGIHandler.
 *
 * Isomorphic: works in both server (Deno) and browser (Service Worker)
 * contexts. The serve() method is only available when Deno.serve exists.
 *
 * @module @alexi/core/application
 */

import { resolve } from "@alexi/urls";
import type { URLPattern } from "@alexi/urls";
import { BaseMiddleware } from "@alexi/middleware";
import type {
  Middleware,
  MiddlewareClass,
  NextFunction,
} from "@alexi/middleware";
import { HttpError } from "@alexi/middleware";

export { BaseMiddleware } from "@alexi/middleware";
export type {
  Middleware,
  MiddlewareClass,
  NextFunction,
} from "@alexi/middleware";
export type { URLPattern, View } from "@alexi/urls";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Returns true if `m` is a class-based middleware constructor (i.e. a subclass
 * of {@link BaseMiddleware}), as opposed to a legacy function middleware.
 *
 * @param m - The middleware entry to inspect
 */
function _isMiddlewareClass(
  m: MiddlewareClass | Middleware,
): m is MiddlewareClass {
  return typeof m === "function" && m.prototype instanceof BaseMiddleware;
}

// ============================================================================
// Types (defined locally to avoid circular imports)
// ============================================================================

/**
 * Configuration options for the Application
 */
export interface ApplicationOptions {
  /**
   * URL patterns to use for routing
   */
  urls: URLPattern[];

  /**
   * Middleware stack to apply to all requests.
   *
   * Accepts class-based middleware (preferred) or legacy function middleware
   * for backwards compatibility. Middleware is executed in order (first to
   * last).
   *
   * @example Class-based (preferred)
   * ```ts
   * import { CorsMiddleware, LoggingMiddleware } from "@alexi/middleware";
   * middleware: [LoggingMiddleware, CorsMiddleware]
   * ```
   *
   * @example Legacy function-based
   * ```ts
   * middleware: [loggingMiddleware(), corsMiddleware()]
   * ```
   */
  middleware?: Array<MiddlewareClass | Middleware>;

  /**
   * Enable debug mode
   * When true, error responses include stack traces
   */
  debug?: boolean;
}

/**
 * Options for starting the HTTP server
 */
export interface ServeOptions {
  /**
   * Port to listen on
   * @default 8000
   */
  port?: number;

  /**
   * Hostname to bind to
   * @default "0.0.0.0"
   */
  hostname?: string;

  /**
   * Callback when server starts listening
   */
  onListen?: (addr: { hostname: string; port: number }) => void;

  /**
   * AbortSignal to stop the server
   */
  signal?: AbortSignal;
}

/**
 * HTTP request handler compatible with Deno.serve()
 */
export type Handler = (request: Request) => Promise<Response> | Response;

// ============================================================================
// Application Class
// ============================================================================

/**
 * HTTP Application that combines URL routing with middleware.
 *
 * Isomorphic — works identically in Deno server and Service Worker contexts.
 *
 * @example Service Worker
 * ```ts
 * import { getApplication } from "@alexi/core";
 * import * as settings from "./settings.ts";
 *
 * const app = await getApplication(settings);
 *
 * self.addEventListener("fetch", (event) => {
 *   event.respondWith(app.handler(event.request));
 * });
 * ```
 *
 * @example Deno Deploy (http.ts)
 * ```ts
 * import { getApplication } from "@alexi/core";
 * import * as settings from "./settings.ts";
 *
 * export default await getApplication(settings);
 * ```
 */
export class Application {
  private readonly urls: URLPattern[];
  private readonly middleware: Array<MiddlewareClass | Middleware>;
  private readonly debug: boolean;

  /**
   * Create a new Application instance
   *
   * @param options - Application configuration options
   */
  constructor(options: ApplicationOptions) {
    this.urls = options.urls;
    this.middleware = options.middleware ?? [];
    this.debug = options.debug ?? false;
  }

  // ==========================================================================
  // Deno Deploy / Deno.serve() compatibility
  // ==========================================================================

  /**
   * Deno Deploy default export compatibility.
   *
   * Allows `export default await getApplication(settings)` to work
   * with Deno Deploy, which expects `{ fetch: Handler }`.
   */
  fetch: Handler = async (request: Request): Promise<Response> => {
    return await this.handler(request);
  };

  // ==========================================================================
  // Request Handling
  // ==========================================================================

  /**
   * HTTP request handler compatible with Deno.serve()
   *
   * This is bound to the instance so it can be passed directly to
   * Deno.serve() or Service Worker fetch event handlers.
   *
   * @example
   * ```ts
   * const app = new Application({ urls: urlpatterns });
   * Deno.serve({ port: 8000 }, app.handler);
   * ```
   */
  handler: Handler = async (request: Request): Promise<Response> => {
    try {
      // Build and execute the middleware chain
      const chain = this.buildMiddlewareChain(request);
      return await chain();
    } catch (error) {
      return this.handleError(error, request);
    }
  };

  /**
   * Build the middleware chain for a request.
   *
   * Supports both class-based middleware ({@link MiddlewareClass}) and legacy
   * function-based middleware ({@link Middleware}). Class-based middleware is
   * detected via `instanceof BaseMiddleware` prototype check.
   *
   * Each class-based middleware is instantiated with the next layer as
   * `getResponse` — matching Django's `__init__(get_response)` contract.
   *
   * @param request - The incoming HTTP request
   * @returns A function that executes the full middleware chain
   */
  private buildMiddlewareChain(request: Request): NextFunction {
    // The final handler is the view dispatch
    let current: NextFunction = () => this.dispatch(request);

    // Wrap each middleware around the current chain
    // Process in reverse order so first middleware executes first
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const entry = this.middleware[i];
      const next = current;

      if (_isMiddlewareClass(entry)) {
        // Class-based: instantiate with the next layer
        const instance = new entry(next);
        current = (req?: Request) => instance.call(req ?? request);
      } else {
        // Legacy function-based
        current = () => (entry as Middleware)(request, next);
      }
    }

    return current;
  }

  /**
   * Dispatch a request to the matched view
   *
   * @param request - The incoming HTTP request
   * @returns Response from the matched view or 404/405 error
   */
  private async dispatch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Try to resolve the URL to a view
    const result = resolve(pathname, this.urls);

    if (!result) {
      return this.notFound(request);
    }

    // Call the view with request and params
    try {
      return await result.view(request, result.params);
    } catch (error) {
      // Re-throw to be caught by handler
      throw error;
    }
  }

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  /**
   * Handle unhandled errors during request processing
   *
   * @param error - The error that occurred
   * @param request - The original request
   * @returns Error response with appropriate status code
   */
  private handleError(error: unknown, request: Request): Response {
    console.error(
      `[ERROR] ${request.method} ${request.url}:`,
      error,
    );

    // Handle HttpError instances with correct status codes
    if (error instanceof HttpError) {
      const body: Record<string, unknown> = {
        error: error.message,
      };

      if (error.details) {
        body.details = error.details;
      }

      if (this.debug && error.stack) {
        body.stack = error.stack;
      }

      return Response.json(body, { status: error.status });
    }

    if (this.debug) {
      // Debug mode: include error details
      return Response.json(
        {
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 },
      );
    }

    // Production mode: generic error message
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }

  /**
   * Handle 404 Not Found
   *
   * @param request - The original request
   * @returns 404 response
   */
  private notFound(request: Request): Response {
    const url = new URL(request.url);

    if (this.debug) {
      return Response.json(
        {
          error: "Not Found",
          path: url.pathname,
          method: request.method,
        },
        { status: 404 },
      );
    }

    return Response.json(
      { error: "Not Found" },
      { status: 404 },
    );
  }

  // ==========================================================================
  // Server Management
  // ==========================================================================

  /**
   * Start the HTTP server
   *
   * This is a convenience method that wraps Deno.serve().
   * Only available in Deno server context (not in Service Workers).
   *
   * @param options - Server options
   * @throws Error if Deno.serve is not available (e.g., in a browser/SW context)
   */
  async serve(options: ServeOptions = {}): Promise<void> {
    if (typeof Deno === "undefined" || typeof Deno.serve !== "function") {
      throw new Error(
        "Application.serve() is only available in Deno server context. " +
          "In a Service Worker, use app.handler directly.",
      );
    }

    const port = options.port ?? 8000;
    const hostname = options.hostname ?? "0.0.0.0";

    const onListenCallback = options.onListen ??
      ((addr: { hostname: string; port: number }) => {
        console.log(`Server running at http://${addr.hostname}:${addr.port}/`);
      });

    // Call onListen callback
    onListenCallback({ hostname, port });

    // Use Deno.serve with the handler
    const server = Deno.serve({
      port,
      hostname,
      signal: options.signal,
    }, this.handler);

    await server.finished;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Add middleware to the application.
   *
   * Accepts both class-based ({@link MiddlewareClass}) and legacy function
   * ({@link Middleware}) middleware. Middleware is added to the end of the
   * stack.
   *
   * @param middleware - Middleware class or function to add
   * @returns this for chaining
   */
  use(middleware: MiddlewareClass | Middleware): this {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Get the URL patterns
   */
  get urlpatterns(): URLPattern[] {
    return this.urls;
  }

  /**
   * Get the middleware stack
   */
  get middlewareStack(): Array<MiddlewareClass | Middleware> {
    return [...this.middleware];
  }

  /**
   * Check if debug mode is enabled
   */
  get isDebug(): boolean {
    return this.debug;
  }
}
