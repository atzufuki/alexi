/**
 * Application class for Alexi Core
 *
 * Combines URL routing with middleware to create an HTTP application.
 * This is the core request handler, similar to Django's WSGIHandler.
 *
 * @module @alexi/core/application
 */

import { resolve } from "@alexi/urls";
import type { URLPattern } from "@alexi/urls";
import type { Middleware, NextFunction } from "@alexi/middleware";
import { HttpError } from "@alexi/middleware";

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
   * Middleware stack to apply to all requests
   * Middleware is executed in order (first to last)
   */
  middleware?: Middleware[];

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
 * HTTP Application that combines URL routing with middleware
 *
 * @example Basic usage
 * ```ts
 * import { Application } from "@alexi/core";
 * import { urlpatterns } from "./urls.ts";
 *
 * const app = new Application({
 *   urls: urlpatterns,
 * });
 *
 * // Use with Deno.serve
 * Deno.serve({ port: 8000 }, app.handler);
 * ```
 *
 * @example With middleware
 * ```ts
 * import { Application } from "@alexi/core";
 * import { corsMiddleware, loggingMiddleware } from "@alexi/middleware";
 *
 * const app = new Application({
 *   urls: urlpatterns,
 *   middleware: [
 *     loggingMiddleware,
 *     corsMiddleware({ origins: ["http://localhost:5173"] }),
 *   ],
 *   debug: true,
 * });
 *
 * await app.serve({ port: 8000 });
 * ```
 */
export class Application {
  private readonly urls: URLPattern[];
  private readonly middleware: Middleware[];
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
  // Request Handling
  // ==========================================================================

  /**
   * HTTP request handler compatible with Deno.serve()
   *
   * This is bound to the instance so it can be passed directly to Deno.serve().
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
   * Build the middleware chain for a request
   *
   * Creates a chain of functions where each middleware calls the next.
   * The final function in the chain dispatches to the matched view.
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
      const middleware = this.middleware[i];
      const next = current;
      current = () => middleware(request, next);
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
   *
   * @param options - Server options
   *
   * @example
   * ```ts
   * const app = new Application({ urls: urlpatterns });
   *
   * await app.serve({
   *   port: 8000,
   *   onListen: ({ hostname, port }) => {
   *     console.log(`Server running at http://${hostname}:${port}/`);
   *   },
   * });
   * ```
   */
  async serve(options: ServeOptions = {}): Promise<void> {
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
   * Add middleware to the application
   *
   * Middleware is added to the end of the stack.
   *
   * @param middleware - Middleware function to add
   * @returns this for chaining
   *
   * @example
   * ```ts
   * const app = new Application({ urls: urlpatterns })
   *   .use(loggingMiddleware)
   *   .use(corsMiddleware({ origins: ["*"] }));
   * ```
   */
  use(middleware: Middleware): this {
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
  get middlewareStack(): Middleware[] {
    return [...this.middleware];
  }

  /**
   * Check if debug mode is enabled
   */
  get isDebug(): boolean {
    return this.debug;
  }
}
