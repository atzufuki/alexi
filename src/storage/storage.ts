/**
 * Storage Base Class
 *
 * Django-style storage API for file uploads and management.
 * Provides a unified interface for different storage backends.
 *
 * @module alexi_storage/storage
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Options for saving a file
 */
export interface SaveOptions {
  /**
   * Content-Type of the file
   */
  contentType?: string;

  /**
   * Custom metadata to store with the file
   */
  metadata?: Record<string, string>;
}

/**
 * Options for generating signed URLs
 */
export interface SignedUrlOptions {
  /**
   * Expiration time in seconds (default: 3600)
   */
  expiresIn?: number;

  /**
   * HTTP method for the signed URL (default: "GET")
   */
  method?: "GET" | "PUT";

  /**
   * Content-Type for PUT requests
   */
  contentType?: string;
}

/**
 * File metadata returned by storage backends
 */
export interface FileMetadata {
  /**
   * File name (path in storage)
   */
  name: string;

  /**
   * File size in bytes
   */
  size: number;

  /**
   * Content-Type / MIME type
   */
  contentType: string;

  /**
   * Last modified date
   */
  updatedAt: Date;

  /**
   * Creation date (if available)
   */
  createdAt?: Date;

  /**
   * Custom metadata
   */
  metadata?: Record<string, string>;

  /**
   * ETag for caching (if available)
   */
  etag?: string;
}

/**
 * Directory listing result
 */
export interface ListResult {
  /**
   * Subdirectory names
   */
  dirs: string[];

  /**
   * File names
   */
  files: string[];
}

// =============================================================================
// Abstract Storage Class
// =============================================================================

/**
 * Abstract base class for storage backends
 *
 * Implements Django-style Storage API for file handling.
 * All storage backends must extend this class.
 *
 * @example
 * ```ts
 * class MyStorage extends Storage {
 *   async save(name: string, content: File | Blob): Promise<string> {
 *     // Implementation
 *   }
 *   // ... other methods
 * }
 * ```
 */
export abstract class Storage {
  /**
   * Save a file to storage
   *
   * @param name - Desired file name/path
   * @param content - File content (File, Blob, or ReadableStream)
   * @param options - Save options
   * @returns Final name of the saved file (may include generated suffix)
   *
   * @example
   * ```ts
   * const file = new File(["Hello"], "hello.txt", { type: "text/plain" });
   * const savedName = await storage.save("documents/hello.txt", file);
   * // savedName might be "documents/hello_a1b2c3.txt" if name collision
   * ```
   */
  abstract save(
    name: string,
    content: File | Blob | ReadableStream,
    options?: SaveOptions,
  ): Promise<string>;

  /**
   * Open a file for reading
   *
   * @param name - File name/path in storage
   * @returns ReadableStream of file content
   *
   * @example
   * ```ts
   * const stream = await storage.open("documents/report.pdf");
   * const response = new Response(stream);
   * ```
   */
  abstract open(name: string): Promise<ReadableStream>;

  /**
   * Delete a file from storage
   *
   * @param name - File name/path to delete
   *
   * @example
   * ```ts
   * await storage.delete("documents/old-report.pdf");
   * ```
   */
  abstract delete(name: string): Promise<void>;

  /**
   * Check if a file exists in storage
   *
   * @param name - File name/path to check
   * @returns true if file exists
   *
   * @example
   * ```ts
   * if (await storage.exists("documents/report.pdf")) {
   *   // File exists
   * }
   * ```
   */
  abstract exists(name: string): Promise<boolean>;

  /**
   * Get the public URL for a file
   *
   * @param name - File name/path
   * @returns Public URL to access the file
   *
   * @example
   * ```ts
   * const url = await storage.url("documents/report.pdf");
   * // "https://storage.example.com/bucket/documents/report.pdf"
   * ```
   */
  abstract url(name: string): Promise<string>;

  /**
   * Get the size of a file in bytes
   *
   * @param name - File name/path
   * @returns File size in bytes
   *
   * @example
   * ```ts
   * const bytes = await storage.size("documents/report.pdf");
   * console.log(`File is ${bytes} bytes`);
   * ```
   */
  abstract size(name: string): Promise<number>;

  /**
   * List contents of a directory
   *
   * @param path - Directory path to list
   * @returns Object with dirs and files arrays
   *
   * @example
   * ```ts
   * const { dirs, files } = await storage.listdir("documents/");
   * console.log("Subdirectories:", dirs);
   * console.log("Files:", files);
   * ```
   */
  abstract listdir(path: string): Promise<ListResult>;

  // =========================================================================
  // Optional methods with default implementations
  // =========================================================================

  /**
   * Get file metadata
   *
   * @param name - File name/path
   * @returns File metadata
   */
  async getMetadata(name: string): Promise<FileMetadata> {
    // Default implementation - backends can override for efficiency
    const fileSize = await this.size(name);
    return {
      name,
      size: fileSize,
      contentType: this.guessContentType(name),
      updatedAt: new Date(),
    };
  }

  /**
   * Generate a signed URL for temporary access
   *
   * @param name - File name/path
   * @param options - Signed URL options
   * @returns Signed URL with expiration
   */
  async signedUrl(
    name: string,
    _options?: SignedUrlOptions,
  ): Promise<string> {
    // Default: return regular URL (backends should override for signed URLs)
    return this.url(name);
  }

  /**
   * Generate a unique filename to avoid collisions
   *
   * @param name - Original file name
   * @returns Unique file name
   */
  generateUniqueName(name: string): string {
    const lastDot = name.lastIndexOf(".");
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const suffix = `_${timestamp}${random}`;

    if (lastDot === -1) {
      return `${name}${suffix}`;
    }

    const baseName = name.substring(0, lastDot);
    const extension = name.substring(lastDot);
    return `${baseName}${suffix}${extension}`;
  }

  /**
   * Normalize a path for storage
   *
   * @param path - Path to normalize
   * @returns Normalized path
   */
  protected normalizePath(path: string): string {
    // Remove leading/trailing slashes, normalize separators
    return path
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
  }

  /**
   * Guess content type from file extension
   *
   * @param name - File name
   * @returns Content type
   */
  protected guessContentType(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    return CONTENT_TYPES[ext] ?? "application/octet-stream";
  }
}

// =============================================================================
// Content Types
// =============================================================================

const CONTENT_TYPES: Record<string, string> = {
  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  avif: "image/avif",

  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // Text
  txt: "text/plain",
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  xml: "application/xml",
  csv: "text/csv",
  md: "text/markdown",

  // Archives
  zip: "application/zip",
  tar: "application/x-tar",
  gz: "application/gzip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",

  // Audio
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",

  // Video
  mp4: "video/mp4",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  mkv: "video/x-matroska",

  // Fonts
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};
