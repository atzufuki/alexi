/**
 * Static File Storage
 *
 * Django-style storage backends for static files.
 * Handles reading files in development and production.
 *
 * @module alexi_staticfiles/storage
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Content types by file extension
 */
const CONTENT_TYPES: Record<string, string> = {
  // Web
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",

  // Images
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  avif: "image/avif",

  // Fonts
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",

  // Documents
  txt: "text/plain; charset=utf-8",
  xml: "application/xml",
  pdf: "application/pdf",

  // Audio/Video
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "audio/ogg",
  wav: "audio/wav",

  // Archives
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",

  // Data
  csv: "text/csv; charset=utf-8",
  wasm: "application/wasm",
};

/**
 * Static file with content and metadata
 */
export interface StaticFile {
  /**
   * File content as Uint8Array
   */
  content: Uint8Array;

  /**
   * Content-Type header value
   */
  contentType: string;

  /**
   * File size in bytes
   */
  size: number;

  /**
   * Last modified date (if available)
   */
  lastModified?: Date;

  /**
   * ETag for caching (if available)
   */
  etag?: string;
}

/**
 * Storage options
 */
export interface StorageOptions {
  /**
   * Base directory for file lookups
   */
  baseDir: string;

  /**
   * URL prefix (e.g., "/static/")
   */
  urlPrefix?: string;
}

/**
 * Static file storage interface
 */
export interface StaticFileStorage {
  /**
   * Read a static file by path
   *
   * @param path - Path relative to storage base
   * @returns StaticFile if found, null otherwise
   */
  read(path: string): Promise<StaticFile | null>;

  /**
   * Check if a file exists
   *
   * @param path - Path relative to storage base
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get the URL for a static file
   *
   * @param path - Path relative to storage base
   */
  url(path: string): string;
}

// =============================================================================
// FileSystemStorage
// =============================================================================

/**
 * File system based static file storage
 *
 * Reads files directly from disk. Used in both development and production.
 *
 * @example
 * ```ts
 * const storage = new FileSystemStorage({
 *   baseDir: "./static",
 *   urlPrefix: "/static/",
 * });
 *
 * const file = await storage.read("comachine-ui/bundle.js");
 * if (file) {
 *   return new Response(file.content, {
 *     headers: { "Content-Type": file.contentType },
 *   });
 * }
 * ```
 */
export class FileSystemStorage implements StaticFileStorage {
  private readonly baseDir: string;
  private readonly urlPrefix: string;

  constructor(options: StorageOptions) {
    this.baseDir = options.baseDir;
    this.urlPrefix = options.urlPrefix ?? "/static/";
  }

  /**
   * Read a static file
   */
  async read(path: string): Promise<StaticFile | null> {
    const filePath = this.resolvePath(path);

    try {
      const [content, stat] = await Promise.all([
        Deno.readFile(filePath),
        Deno.stat(filePath),
      ]);

      if (!stat.isFile) {
        return null;
      }

      const contentType = this.getContentType(path);
      const etag = this.generateETag(content);

      return {
        content,
        contentType,
        size: content.length,
        lastModified: stat.mtime ?? undefined,
        etag,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if a file exists
   */
  async exists(path: string): Promise<boolean> {
    const filePath = this.resolvePath(path);

    try {
      const stat = await Deno.stat(filePath);
      return stat.isFile;
    } catch {
      return false;
    }
  }

  /**
   * Get the URL for a static file
   */
  url(path: string): string {
    const prefix = this.urlPrefix.endsWith("/") ? this.urlPrefix : `${this.urlPrefix}/`;
    return `${prefix}${path}`;
  }

  /**
   * Resolve a path to absolute file path
   */
  private resolvePath(path: string): string {
    // Prevent path traversal attacks
    const normalized = path
      .replace(/\\/g, "/")
      .replace(/\.{2,}/g, "")
      .replace(/^\/+/, "");

    return `${this.baseDir}/${normalized}`;
  }

  /**
   * Get content type from file extension
   */
  private getContentType(path: string): string {
    const ext = this.getExtension(path);
    return CONTENT_TYPES[ext] ?? "application/octet-stream";
  }

  /**
   * Get file extension (lowercase, without dot)
   */
  private getExtension(path: string): string {
    const lastDot = path.lastIndexOf(".");
    if (lastDot === -1 || lastDot === path.length - 1) {
      return "";
    }
    return path.slice(lastDot + 1).toLowerCase();
  }

  /**
   * Generate simple ETag from content
   */
  private generateETag(content: Uint8Array): string {
    // Simple hash based on size and first/last bytes
    const size = content.length;
    const first = content.length > 0 ? content[0] : 0;
    const last = content.length > 0 ? content[content.length - 1] : 0;
    const hash = ((size * 31 + first) * 31 + last) >>> 0;
    return `"${hash.toString(16)}"`;
  }
}

// =============================================================================
// StaticFilesStorage (Main Entry Point)
// =============================================================================

/**
 * Main static files storage
 *
 * In development: reads from app static directories via finders
 * In production: reads from STATIC_ROOT
 *
 * @example
 * ```ts
 * // Development mode
 * const storage = StaticFilesStorage.forDevelopment({
 *   installedApps: settings.INSTALLED_APPS,
 *   appPaths: settings.APP_PATHS,
 *   staticUrl: settings.STATIC_URL,
 * });
 *
 * // Production mode
 * const storage = StaticFilesStorage.forProduction({
 *   staticRoot: settings.STATIC_ROOT,
 *   staticUrl: settings.STATIC_URL,
 * });
 * ```
 */
export class StaticFilesStorage {
  private readonly storage: StaticFileStorage;
  private readonly debug: boolean;

  constructor(storage: StaticFileStorage, debug: boolean = false) {
    this.storage = storage;
    this.debug = debug;
  }

  /**
   * Create storage for production (reads from STATIC_ROOT)
   */
  static forProduction(options: {
    staticRoot: string;
    staticUrl?: string;
  }): StaticFilesStorage {
    const storage = new FileSystemStorage({
      baseDir: options.staticRoot,
      urlPrefix: options.staticUrl ?? "/static/",
    });
    return new StaticFilesStorage(storage, false);
  }

  /**
   * Read a static file
   */
  async read(path: string): Promise<StaticFile | null> {
    return this.storage.read(path);
  }

  /**
   * Check if a file exists
   */
  async exists(path: string): Promise<boolean> {
    return this.storage.exists(path);
  }

  /**
   * Get the URL for a static file
   */
  url(path: string): string {
    return this.storage.url(path);
  }

  /**
   * Check if in debug mode
   */
  get isDebug(): boolean {
    return this.debug;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get content type for a file path
 */
export function getContentType(path: string): string {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1 || lastDot === path.length - 1) {
    return "application/octet-stream";
  }
  const ext = path.slice(lastDot + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Check if a path is a static file request
 */
export function isStaticFileRequest(
  pathname: string,
  staticUrl: string = "/static/",
): boolean {
  return pathname.startsWith(staticUrl);
}

/**
 * Extract the file path from a static URL
 */
export function extractStaticPath(
  pathname: string,
  staticUrl: string = "/static/",
): string | null {
  if (!pathname.startsWith(staticUrl)) {
    return null;
  }
  return pathname.slice(staticUrl.length);
}
