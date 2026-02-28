/**
 * Alexi Views - Template View
 *
 * Django-style template view helper for serving HTML files.
 *
 * Supports two modes:
 *
 * 1. **New API** — `templateName` + `context` function.
 *    Uses the full Django-style template engine with inheritance,
 *    loops, conditionals, and variable output.
 *
 *    ```ts
 *    export const noteListView = templateView({
 *      templateName: "my-app/note_list.html",
 *      context: async (request, params) => ({
 *        notes: await fetchNotes(),
 *      }),
 *    });
 *    ```
 *
 * 2. **Legacy API** — `templatePath` + static `context: Record<string, string>`.
 *    Reads a file from disk and performs simple `{{KEY}}` substitution.
 *    Kept for backwards compatibility.
 *
 *    ```ts
 *    templateView({
 *      templatePath: "./src/myapp/templates/index.html",
 *      context: { API_URL: "https://api.example.com" },
 *    })
 *    ```
 *
 * @module @alexi/views/template
 */

import { render, templateRegistry } from "./engine/mod.ts";
import type { TemplateContext, TemplateLoader } from "./engine/mod.ts";

// Re-export engine symbols so callers can use them without a separate import
export {
  ChainTemplateLoader,
  FilesystemTemplateLoader,
  MemoryTemplateLoader,
  render,
  TemplateNotFoundError,
  TemplateParseError,
  templateRegistry,
} from "./engine/mod.ts";
export type { TemplateContext, TemplateLoader } from "./engine/mod.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Context factory function signature for the new templateView API.
 */
export type ContextFunction = (
  request: Request,
  params: Record<string, string>,
) => TemplateContext | Promise<TemplateContext>;

/**
 * Options for `templateView` — supports both the new and legacy APIs.
 */
export type TemplateViewOptions =
  | NewTemplateViewOptions
  | LegacyTemplateViewOptions;

/**
 * New API: Django-style template engine with template name and context
 * function.
 */
export interface NewTemplateViewOptions {
  /**
   * Django-style template name, e.g. `"my-app/note_list.html"`.
   * Resolved via the global `templateRegistry` or an explicit `loader`.
   */
  templateName: string;

  /**
   * Function that receives the request and URL params, and returns a context
   * object for the template.
   *
   * @example
   * ```ts
   * context: async (request, params) => ({
   *   notes: await NoteModel.objects.all().fetch(),
   * })
   * ```
   */
  context?: ContextFunction;

  /**
   * Custom template loader.
   * Defaults to the global `templateRegistry`.
   */
  loader?: TemplateLoader;

  /**
   * Content-Type header value.
   * @default "text/html; charset=utf-8"
   */
  contentType?: string;

  /**
   * Cache-Control header value.
   * @default "no-cache"
   */
  cacheControl?: string;

  /** Discriminant — must NOT be set alongside `templateName`. */
  templatePath?: never;
}

/**
 * Legacy API: read a file from disk and substitute `{{KEY}}` placeholders.
 *
 * @deprecated Use `templateName` with the new template engine instead.
 */
export interface LegacyTemplateViewOptions {
  /**
   * Path to the template file (relative to project root).
   * @example "./src/myapp/templates/index.html"
   */
  templatePath: string;

  /**
   * Static context variables to substitute in the template.
   * Uses `{{KEY}}` syntax (no spaces).
   */
  context?: Record<string, string>;

  /**
   * Content-Type header value.
   * @default "text/html; charset=utf-8"
   */
  contentType?: string;

  /**
   * Cache-Control header value.
   * @default "no-cache"
   */
  cacheControl?: string;

  /** Discriminant — must NOT be set alongside `templatePath`. */
  templateName?: never;
}

// =============================================================================
// Template Cache (legacy)
// =============================================================================

const legacyTemplateCache = new Map<string, string>();

// =============================================================================
// templateView
// =============================================================================

/**
 * Create a view function that serves an HTML template.
 *
 * @param options - Template view options (new or legacy API)
 * @returns Request handler `(request, params) => Promise<Response>`
 */
export function templateView(
  options: TemplateViewOptions,
): (request: Request, params: Record<string, string>) => Promise<Response> {
  if ("templateName" in options && options.templateName) {
    return newTemplateView(options as NewTemplateViewOptions);
  }
  return legacyTemplateView(options as LegacyTemplateViewOptions);
}

// =============================================================================
// New API implementation
// =============================================================================

function newTemplateView(
  options: NewTemplateViewOptions,
): (request: Request, params: Record<string, string>) => Promise<Response> {
  const {
    templateName,
    context: contextFn,
    loader,
    contentType = "text/html; charset=utf-8",
    cacheControl = "no-cache",
  } = options;

  return async (
    request: Request,
    params: Record<string, string>,
  ): Promise<Response> => {
    try {
      const ctx: TemplateContext = contextFn
        ? await contextFn(request, params)
        : {};

      const resolvedLoader = loader ?? templateRegistry;
      const html = await render(templateName, ctx, resolvedLoader);

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": cacheControl,
        },
      });
    } catch (error) {
      console.error(
        `[templateView] Failed to render template: ${templateName}`,
        error,
      );
      const message = `Template error: ${templateName}\n${error}`;
      return new Response(message, {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  };
}

// =============================================================================
// Legacy API implementation
// =============================================================================

function legacyTemplateView(
  options: LegacyTemplateViewOptions,
): (request: Request, params: Record<string, string>) => Promise<Response> {
  const {
    templatePath,
    contentType = "text/html; charset=utf-8",
    cacheControl = "no-cache",
    context = {},
  } = options;

  return async (): Promise<Response> => {
    try {
      let html = legacyTemplateCache.get(templatePath);

      if (!html) {
        const projectRoot = Deno.cwd();
        const fullPath = templatePath.startsWith("./")
          ? `${projectRoot}/${templatePath.slice(2)}`
          : `${projectRoot}/${templatePath}`;

        html = await Deno.readTextFile(fullPath);

        if (Deno.env.get("DEBUG") !== "true") {
          legacyTemplateCache.set(templatePath, html);
        }
      }

      for (const [key, value] of Object.entries(context)) {
        html = html.replaceAll(`{{${key}}}`, value);
      }

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": cacheControl,
        },
      });
    } catch (error) {
      console.error(
        `[templateView] Failed to load template: ${templatePath}`,
        error,
      );

      const isDev = Deno.env.get("DEBUG") === "true";
      const message = isDev
        ? `Template not found: ${templatePath}\n${error}`
        : "Internal Server Error";

      return new Response(message, {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  };
}

// =============================================================================
// Cache management (legacy)
// =============================================================================

/**
 * Clear the legacy template file cache.
 * Useful for development hot-reloading.
 */
export function clearTemplateCache(): void {
  legacyTemplateCache.clear();
}

/**
 * Remove a specific template from the legacy cache.
 *
 * @param templatePath - Path to the template to remove
 */
export function invalidateTemplate(templatePath: string): void {
  legacyTemplateCache.delete(templatePath);
}
