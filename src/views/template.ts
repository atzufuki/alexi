/**
 * Alexi Views - Template View
 *
 * Django-style template view helper for serving HTML files
 * with optional context variable substitution.
 *
 * @module @alexi/views/template
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Options for TemplateView
 */
export interface TemplateViewOptions {
  /**
   * Path to the template file (relative to project root).
   * @example "./src/comachine-web/templates/ui/index.html"
   */
  templatePath: string;

  /**
   * Content-Type header value.
   * @default "text/html; charset=utf-8"
   */
  contentType?: string;

  /**
   * Cache-Control header value.
   * @default "no-cache" (development), "public, max-age=3600" (production)
   */
  cacheControl?: string;

  /**
   * Context variables to replace in the template.
   * Uses {{variableName}} syntax.
   * @example { API_URL: "https://api.example.com" }
   */
  context?: Record<string, string>;
}

// =============================================================================
// Template Cache
// =============================================================================

/**
 * Simple in-memory template cache for production.
 */
const templateCache = new Map<string, string>();

// =============================================================================
// Template View
// =============================================================================

/**
 * Create a view function that serves an HTML template.
 *
 * Django-style template view for serving HTML files with optional
 * context variable substitution.
 *
 * @param options - Template view options
 * @returns Request handler function
 *
 * @example Basic usage
 * ```ts
 * import { templateView } from "@alexi/http/views";
 * import { path } from "@alexi/urls";
 *
 * const urlpatterns = [
 *   path("", templateView({
 *     templatePath: "./src/myapp/templates/index.html",
 *   }), { name: "home" }),
 * ];
 * ```
 *
 * @example With context variables
 * ```ts
 * path("", templateView({
 *   templatePath: "./src/myapp/templates/index.html",
 *   context: {
 *     API_URL: Deno.env.get("API_URL") ?? "",
 *     APP_VERSION: "1.0.0",
 *   },
 * }), { name: "home" });
 * ```
 */
export function templateView(
  options: TemplateViewOptions,
): () => Promise<Response> {
  const {
    templatePath,
    contentType = "text/html; charset=utf-8",
    cacheControl = "no-cache",
    context = {},
  } = options;

  return async (): Promise<Response> => {
    try {
      // Check cache first
      let html = templateCache.get(templatePath);

      if (!html) {
        // Resolve path relative to project root (Deno.cwd())
        const projectRoot = Deno.cwd();
        const fullPath = templatePath.startsWith("./")
          ? `${projectRoot}/${templatePath.slice(2)}`
          : `${projectRoot}/${templatePath}`;

        // Read template file
        html = await Deno.readTextFile(fullPath);

        // Cache in production
        if (Deno.env.get("DEBUG") !== "true") {
          templateCache.set(templatePath, html);
        }
      }

      // Replace context variables ({{variableName}} syntax)
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

      // Return 500 error with details in development
      const isDev = Deno.env.get("DEBUG") === "true";
      const message = isDev
        ? `Template not found: ${templatePath}\n${error}`
        : "Internal Server Error";

      return new Response(message, {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  };
}

/**
 * Clear the template cache.
 * Useful for development hot-reloading.
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}

/**
 * Remove a specific template from the cache.
 *
 * @param templatePath - Path to the template to remove
 */
export function invalidateTemplate(templatePath: string): void {
  templateCache.delete(templatePath);
}
