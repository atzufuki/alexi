/**
 * Content Negotiation and Renderers for Alexi REST Framework
 *
 * Provides DRF-style content negotiation allowing clients to request different
 * response formats via the Accept header or `?format=` query parameter.
 *
 * @module @alexi/restframework/renderers/renderers
 */

/**
 * Optional render context passed to renderers
 *
 * Used by `BrowsableAPIRenderer` and other context-aware renderers.
 * Base renderers ignore this entirely.
 */
export interface RenderContext {
  /** The original HTTP request */
  request?: Request;
  /** HTTP method of the request */
  method?: string;
  /** HTTP methods allowed on this endpoint */
  allowedMethods?: string[];
  /** Response HTTP status code */
  statusCode?: number;
  /** Additional context data */
  [key: string]: unknown;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Renderer class constructor type
 */
export interface RendererClass {
  new (): BaseRenderer;
}

/**
 * Options for the content negotiation
 */
export interface ContentNegotiationOptions {
  /** Query parameter name for format selection (default: "format") */
  formatParam?: string;
}

// ============================================================================
// Base Renderer
// ============================================================================

/**
 * Base renderer class
 *
 * All renderers should extend this class and implement `render()`.
 * The `mediaType` and `format` properties identify this renderer.
 *
 * @example
 * ```ts
 * class PlainTextRenderer extends BaseRenderer {
 *   readonly mediaType = "text/plain";
 *   readonly format = "txt";
 *
 *   render(data: unknown): string {
 *     return String(data);
 *   }
 * }
 * ```
 */
export abstract class BaseRenderer {
  /**
   * The MIME type this renderer produces (e.g., "application/json")
   */
  abstract readonly mediaType: string;

  /**
   * Short format name used in `?format=` query param (e.g., "json", "csv")
   */
  abstract readonly format: string;

  /**
   * Character set for the response (default: utf-8)
   */
  charset = "utf-8";

  /**
   * Render the data to a string
   *
   * @param data - The data to render (typically a JSON-serializable object)
   * @param context - Optional render context (used by context-aware renderers)
   * @returns The rendered string
   */
  abstract render(data: unknown, context?: RenderContext): string;

  /**
   * Build the Content-Type header value (includes charset if applicable)
   */
  getContentType(): string {
    return `${this.mediaType}; charset=${this.charset}`;
  }
}

// ============================================================================
// Built-in Renderers
// ============================================================================

/**
 * JSON renderer — produces `application/json` responses
 *
 * This is the default renderer. Used when the client accepts JSON
 * or does not specify a format preference.
 *
 * @example
 * ```ts
 * class MyViewSet extends ModelViewSet {
 *   renderer_classes = [JSONRenderer, CSVRenderer];
 * }
 * ```
 */
export class JSONRenderer extends BaseRenderer {
  readonly mediaType = "application/json";
  readonly format = "json";

  render(data: unknown, _context?: RenderContext): string {
    return JSON.stringify(data);
  }
}

/**
 * XML renderer — produces `application/xml` responses
 *
 * Converts JSON-serializable objects to XML. Arrays become repeated
 * `<item>` elements. Nested objects become nested elements.
 *
 * Note: XML keys are sanitized (non-alphanumeric chars replaced with `_`).
 *
 * @example
 * ```ts
 * class MyViewSet extends ModelViewSet {
 *   renderer_classes = [JSONRenderer, XMLRenderer];
 * }
 * // Accept: application/xml → XML response
 * // ?format=xml → XML response
 * ```
 */
export class XMLRenderer extends BaseRenderer {
  readonly mediaType = "application/xml";
  readonly format = "xml";

  render(data: unknown, _context?: RenderContext): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${
      this.toXml(data, "root")
    }`;
  }

  /**
   * Recursively convert a value to XML
   */
  protected toXml(value: unknown, tag: string): string {
    const safeTag = tag.replace(/[^a-zA-Z0-9_.-]/g, "_");

    if (value === null || value === undefined) {
      return `<${safeTag}/>`;
    }

    if (
      typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const escaped = String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<${safeTag}>${escaped}</${safeTag}>`;
    }

    if (Array.isArray(value)) {
      const items = value.map((item) => this.toXml(item, "item")).join("\n");
      return `<${safeTag}>\n${items}\n</${safeTag}>`;
    }

    if (typeof value === "object") {
      const children = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => this.toXml(v, k))
        .join("\n");
      return `<${safeTag}>\n${children}\n</${safeTag}>`;
    }

    return `<${safeTag}>${String(value)}</${safeTag}>`;
  }
}

/**
 * CSV renderer — produces `text/csv` responses
 *
 * Converts arrays of objects to CSV format. The first object's keys
 * are used as the header row. Non-array data is wrapped in a single row.
 *
 * Values containing commas, quotes, or newlines are quoted.
 *
 * @example
 * ```ts
 * class MyViewSet extends ModelViewSet {
 *   renderer_classes = [JSONRenderer, CSVRenderer];
 * }
 * // Accept: text/csv → CSV response
 * // ?format=csv → CSV response
 * ```
 */
export class CSVRenderer extends BaseRenderer {
  readonly mediaType = "text/csv";
  readonly format = "csv";

  render(data: unknown, _context?: RenderContext): string {
    // Handle paginated responses (DRF-style: { count, results })
    const rows = this.extractRows(data);

    if (rows.length === 0) {
      return "";
    }

    // Get headers from first row
    const headers = Object.keys(rows[0] as Record<string, unknown>);
    const headerRow = headers.map((h) => this.escapeCSV(h)).join(",");

    const dataRows = rows.map((row) => {
      const record = row as Record<string, unknown>;
      return headers.map((h) => this.escapeCSV(record[h])).join(",");
    });

    return [headerRow, ...dataRows].join("\n");
  }

  /**
   * Extract an array of rows from the data.
   * Handles arrays directly, paginated `{ results }` objects,
   * and wraps single objects in an array.
   */
  protected extractRows(data: unknown): unknown[] {
    if (Array.isArray(data)) {
      return data;
    }
    // Paginated response
    if (
      data !== null && typeof data === "object" &&
      "results" in (data as Record<string, unknown>)
    ) {
      const results = (data as Record<string, unknown>).results;
      if (Array.isArray(results)) {
        return results;
      }
    }
    if (data !== null && typeof data === "object") {
      return [data];
    }
    return [{ value: data }];
  }

  /**
   * Escape a value for CSV
   */
  protected escapeCSV(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}

// ============================================================================
// Content Negotiation
// ============================================================================

/**
 * Result of content negotiation
 */
export interface NegotiationResult {
  /** The renderer to use */
  renderer: BaseRenderer;
  /** The media type that was matched */
  mediaType: string;
}

/**
 * Perform content negotiation: select the best renderer for the request.
 *
 * Selection order:
 * 1. `?format=` query parameter (takes precedence)
 * 2. `Accept` header (standard HTTP content negotiation)
 * 3. First renderer in the list (fallback)
 *
 * Returns null if no renderer matches and there are no renderers.
 * Returns the first renderer as default if Accept is `*\/*` or not set.
 *
 * @param request - The HTTP request
 * @param renderers - Available renderer instances
 * @param formatParam - Query parameter name (default: "format")
 * @returns The selected renderer and media type, or null if none match
 */
export function selectRenderer(
  request: Request,
  renderers: BaseRenderer[],
  formatParam = "format",
): NegotiationResult | null {
  if (renderers.length === 0) {
    return null;
  }

  const url = new URL(request.url);

  // 1. Check ?format= query parameter (overrides Accept header)
  const formatQuery = url.searchParams.get(formatParam);
  if (formatQuery) {
    const renderer = renderers.find((r) => r.format === formatQuery);
    if (renderer) {
      return { renderer, mediaType: renderer.mediaType };
    }
    return null; // Explicit format requested but not available → 406
  }

  // 2. Parse Accept header
  const acceptHeader = request.headers.get("Accept");
  if (!acceptHeader || acceptHeader === "*/*") {
    // No preference — use first renderer
    return { renderer: renderers[0], mediaType: renderers[0].mediaType };
  }

  // Parse Accept header into ordered list of media types with quality values
  const accepted = parseAcceptHeader(acceptHeader);

  // Find the best matching renderer
  for (const { mediaType } of accepted) {
    if (mediaType === "*/*") {
      return { renderer: renderers[0], mediaType: renderers[0].mediaType };
    }

    // Exact match
    const exact = renderers.find((r) => r.mediaType === mediaType);
    if (exact) {
      return { renderer: exact, mediaType: exact.mediaType };
    }

    // Wildcard subtype match (e.g., "text/*" matches "text/csv")
    if (mediaType.endsWith("/*")) {
      const prefix = mediaType.slice(0, -2);
      const match = renderers.find((r) => r.mediaType.startsWith(prefix + "/"));
      if (match) {
        return { renderer: match, mediaType: match.mediaType };
      }
    }
  }

  return null; // No match
}

/**
 * Parsed Accept header entry
 */
interface AcceptEntry {
  mediaType: string;
  quality: number;
}

/**
 * Parse an Accept header into a sorted list of media types
 *
 * @example
 * parseAcceptHeader("text/html, application/json;q=0.9, *\/*;q=0.8")
 * // [
 * //   { mediaType: "text/html", quality: 1.0 },
 * //   { mediaType: "application/json", quality: 0.9 },
 * //   { mediaType: "*\/*", quality: 0.8 },
 * // ]
 */
export function parseAcceptHeader(header: string): AcceptEntry[] {
  return header
    .split(",")
    .map((part) => {
      const segments = part.trim().split(";");
      const mediaType = segments[0].trim();
      let quality = 1.0;
      for (const seg of segments.slice(1)) {
        const kv = seg.trim().split("=");
        if (kv[0].trim() === "q" && kv.length === 2) {
          quality = parseFloat(kv[1].trim());
          if (isNaN(quality)) quality = 1.0;
        }
      }
      return { mediaType, quality };
    })
    .sort((a, b) => b.quality - a.quality);
}

// ============================================================================
// ViewSet integration helper
// ============================================================================

/**
 * Wrap action response data with the appropriate renderer
 *
 * Called after the action runs. Takes the JSON data from the response
 * body and re-renders it using the selected renderer.
 *
 * Returns a new Response with the appropriate Content-Type.
 *
 * @param response - The original JSON response from the action
 * @param renderer - The selected renderer
 * @param context - Optional render context (passed to context-aware renderers)
 */
export async function renderResponse(
  response: Response,
  renderer: BaseRenderer,
  context?: RenderContext,
): Promise<Response> {
  // If already non-JSON (e.g., a redirect or file download), pass through
  const contentType = response.headers.get("Content-Type") ?? "";
  if (
    !contentType.includes("application/json") &&
    renderer instanceof JSONRenderer
  ) {
    return response;
  }

  // Parse the JSON body
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    // Body not parseable as JSON - pass through as-is
    return response;
  }

  const rendered = renderer.render(data, context);

  const headers = new Headers(response.headers);
  headers.set("Content-Type", renderer.getContentType());

  return new Response(rendered, {
    status: response.status,
    headers,
  });
}
