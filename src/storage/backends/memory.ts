/**
 * Memory Storage Backend
 *
 * In-memory storage backend for testing and development.
 * All files are stored in memory and lost when the process exits.
 *
 * @module alexi_storage/backends/memory
 */

import {
  type FileMetadata,
  type ListResult,
  type SaveOptions,
  Storage,
} from "../storage.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Memory storage options
 */
export interface MemoryStorageOptions {
  /**
   * Base URL for generating file URLs
   */
  baseUrl?: string;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Stored file entry
 */
interface StoredFile {
  content: Uint8Array;
  contentType: string;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// MemoryStorage Implementation
// =============================================================================

/**
 * In-memory storage backend
 *
 * Useful for testing and development. All files are stored in memory.
 *
 * @example
 * ```ts
 * const storage = new MemoryStorage();
 *
 * // Save a file
 * const file = new File(["Hello"], "hello.txt", { type: "text/plain" });
 * await storage.save("documents/hello.txt", file);
 *
 * // Read it back
 * const stream = await storage.open("documents/hello.txt");
 * const text = await new Response(stream).text();
 * console.log(text); // "Hello"
 *
 * // Clear all files
 * storage.clear();
 * ```
 */
export class MemoryStorage extends Storage {
  private readonly files: Map<string, StoredFile> = new Map();
  private readonly baseUrl: string;
  private readonly debug: boolean;

  constructor(options: MemoryStorageOptions = {}) {
    super();
    this.baseUrl = options.baseUrl ?? "memory://";
    this.debug = options.debug ?? false;
  }

  /**
   * Save a file to memory
   */
  async save(
    name: string,
    content: File | Blob | ReadableStream,
    options?: SaveOptions,
  ): Promise<string> {
    const normalizedName = this.normalizePath(name);

    // Convert content to Uint8Array
    let bytes: Uint8Array;
    if (content instanceof ReadableStream) {
      const response = new Response(content);
      bytes = new Uint8Array(await response.arrayBuffer());
    } else {
      bytes = new Uint8Array(await content.arrayBuffer());
    }

    // Determine content type
    const contentType = options?.contentType ??
      (content instanceof File ? content.type : undefined) ??
      this.guessContentType(name);

    const now = new Date();
    const entry: StoredFile = {
      content: bytes,
      contentType,
      metadata: options?.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    this.files.set(normalizedName, entry);
    this.log(`Saved: ${normalizedName} (${bytes.length} bytes)`);

    return name;
  }

  /**
   * Open a file for reading
   */
  async open(name: string): Promise<ReadableStream> {
    const normalizedName = this.normalizePath(name);
    const entry = this.files.get(normalizedName);

    if (!entry) {
      throw new Error(`File not found: ${name}`);
    }

    this.log(`Opened: ${normalizedName}`);

    // Create a ReadableStream from the Uint8Array
    return new ReadableStream({
      start(controller) {
        controller.enqueue(entry.content);
        controller.close();
      },
    });
  }

  /**
   * Delete a file from memory
   */
  async delete(name: string): Promise<void> {
    const normalizedName = this.normalizePath(name);
    const deleted = this.files.delete(normalizedName);

    if (deleted) {
      this.log(`Deleted: ${normalizedName}`);
    }
  }

  /**
   * Check if a file exists
   */
  async exists(name: string): Promise<boolean> {
    const normalizedName = this.normalizePath(name);
    return this.files.has(normalizedName);
  }

  /**
   * Get the URL for a file
   */
  async url(name: string): Promise<string> {
    const normalizedName = this.normalizePath(name);
    return `${this.baseUrl}${normalizedName}`;
  }

  /**
   * Get the size of a file
   */
  async size(name: string): Promise<number> {
    const normalizedName = this.normalizePath(name);
    const entry = this.files.get(normalizedName);

    if (!entry) {
      throw new Error(`File not found: ${name}`);
    }

    return entry.content.length;
  }

  /**
   * List contents of a directory
   */
  async listdir(path: string): Promise<ListResult> {
    const normalizedPath = this.normalizePath(path);
    const prefix = normalizedPath ? `${normalizedPath}/` : "";

    const dirs = new Set<string>();
    const files: string[] = [];

    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      const relative = key.slice(prefix.length);
      const slashIndex = relative.indexOf("/");

      if (slashIndex === -1) {
        // Direct file
        files.push(relative);
      } else {
        // Subdirectory
        dirs.add(relative.slice(0, slashIndex));
      }
    }

    return {
      dirs: Array.from(dirs).sort(),
      files: files.sort(),
    };
  }

  /**
   * Get file metadata
   */
  override async getMetadata(name: string): Promise<FileMetadata> {
    const normalizedName = this.normalizePath(name);
    const entry = this.files.get(normalizedName);

    if (!entry) {
      throw new Error(`File not found: ${name}`);
    }

    return {
      name,
      size: entry.content.length,
      contentType: entry.contentType,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      metadata: entry.metadata,
    };
  }

  // ===========================================================================
  // Memory-specific methods
  // ===========================================================================

  /**
   * Clear all stored files
   */
  clear(): void {
    this.files.clear();
    this.log("Cleared all files");
  }

  /**
   * Get the number of stored files
   */
  get count(): number {
    return this.files.size;
  }

  /**
   * Get all stored file names
   */
  get names(): string[] {
    return Array.from(this.files.keys());
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[MemoryStorage] ${message}`);
    }
  }
}
