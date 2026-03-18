/**
 * FileSystem Storage Backend
 *
 * Local filesystem storage backend for development and self-hosted deployments.
 * Files are stored in a configurable directory on the local filesystem and
 * served via a configurable base URL.
 *
 * @module alexi_storage/backends/filesystem
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
 * Configuration options for {@link FileSystemStorage}.
 */
export interface FileSystemStorageOptions {
  /**
   * Absolute or relative path to the root directory where files are stored.
   * Created automatically if it does not exist.
   *
   * @example "./media"
   */
  location: string;

  /**
   * URL prefix used to construct public file URLs.
   * Should end with `/`.
   *
   * @example "/media/"
   * @default "/media/"
   */
  baseUrl?: string;

  /**
   * When `false` (default), if a file with the given name already exists a
   * unique suffix is appended via {@link Storage.generateUniqueName}.
   * When `true`, the existing file is silently overwritten.
   *
   * @default false
   */
  allowOverwrite?: boolean;
}

// =============================================================================
// FileSystemStorage Implementation
// =============================================================================

/**
 * Local filesystem storage backend.
 *
 * Useful for local development and self-hosted deployments where files should
 * be stored on the server's filesystem. Requires `--allow-read` and
 * `--allow-write` Deno permissions for the configured {@link FileSystemStorageOptions.location}.
 *
 * @example
 * ```ts
 * import { setStorage } from "@alexi/storage";
 * import { FileSystemStorage } from "@alexi/storage/backends/filesystem";
 *
 * setStorage(new FileSystemStorage({ location: "./media", baseUrl: "/media/" }));
 *
 * const storage = getStorage();
 * const file = new File(["Hello"], "hello.txt", { type: "text/plain" });
 * const savedName = await storage.save("documents/hello.txt", file);
 * const url = await storage.url(savedName);
 * // url === "/media/documents/hello.txt"
 * ```
 */
export class FileSystemStorage extends Storage {
  private readonly location: string;
  private readonly baseUrl: string;
  private readonly allowOverwrite: boolean;

  constructor(options: FileSystemStorageOptions) {
    super();
    // Normalise location: strip trailing slash
    this.location = options.location.replace(/[\\/]+$/, "");
    this.baseUrl = options.baseUrl ?? "/media/";
    this.allowOverwrite = options.allowOverwrite ?? false;
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Resolve a storage-relative name to an absolute filesystem path.
   *
   * @param name - Storage-relative file name/path.
   * @returns Absolute filesystem path.
   */
  private resolvePath(name: string): string {
    const normalized = this.normalizePath(name);
    return `${this.location}/${normalized}`;
  }

  // ===========================================================================
  // Abstract method implementations
  // ===========================================================================

  /**
   * Save a file to the local filesystem.
   *
   * Intermediate directories are created automatically. When
   * {@link FileSystemStorageOptions.allowOverwrite} is `false` (default) and a
   * file with the given name already exists, a unique suffix is appended to
   * avoid collision.
   *
   * @param name - Desired storage-relative file name/path.
   * @param content - File content as a `File`, `Blob`, or `ReadableStream`.
   * @param _options - Optional save options (metadata is not persisted by this backend).
   * @returns Final storage-relative name of the saved file.
   */
  override async save(
    name: string,
    content: File | Blob | ReadableStream,
    _options?: SaveOptions,
  ): Promise<string> {
    let finalName = this.normalizePath(name);

    if (!this.allowOverwrite) {
      while (await this.exists(finalName)) {
        finalName = this.normalizePath(this.generateUniqueName(finalName));
      }
    }

    const filePath = this.resolvePath(finalName);

    // Ensure parent directory exists
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash > 0) {
      await Deno.mkdir(filePath.slice(0, lastSlash), { recursive: true });
    }

    // Convert content to bytes
    let bytes: Uint8Array;
    if (content instanceof ReadableStream) {
      const response = new Response(content);
      bytes = new Uint8Array(await response.arrayBuffer());
    } else {
      bytes = new Uint8Array(await content.arrayBuffer());
    }

    await Deno.writeFile(filePath, bytes);

    return finalName;
  }

  /**
   * Open a file for reading.
   *
   * @param name - Storage-relative file name/path.
   * @returns A `ReadableStream` of the file's content.
   * @throws {Error} If the file does not exist.
   */
  override async open(name: string): Promise<ReadableStream> {
    const filePath = this.resolvePath(name);
    const file = await Deno.open(filePath, { read: true });
    return file.readable;
  }

  /**
   * Delete a file from the filesystem.
   *
   * Silently ignores the error when the file does not exist.
   *
   * @param name - Storage-relative file name/path.
   */
  override async delete(name: string): Promise<void> {
    const filePath = this.resolvePath(name);
    try {
      await Deno.remove(filePath);
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) {
        throw err;
      }
    }
  }

  /**
   * Check whether a file exists on the filesystem.
   *
   * @param name - Storage-relative file name/path.
   * @returns `true` if the file exists, `false` otherwise.
   */
  override async exists(name: string): Promise<boolean> {
    const filePath = this.resolvePath(name);
    try {
      const stat = await Deno.stat(filePath);
      return stat.isFile;
    } catch {
      return false;
    }
  }

  /**
   * Return the public URL for a stored file.
   *
   * The URL is constructed by joining {@link FileSystemStorageOptions.baseUrl}
   * with the normalised file name. No network call is made.
   *
   * @param name - Storage-relative file name/path.
   * @returns Public URL string.
   */
  override async url(name: string): Promise<string> {
    const normalized = this.normalizePath(name);
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    return `${base}${normalized}`;
  }

  /**
   * Return the size of a stored file in bytes.
   *
   * @param name - Storage-relative file name/path.
   * @returns File size in bytes.
   * @throws {Error} If the file does not exist.
   */
  override async size(name: string): Promise<number> {
    const filePath = this.resolvePath(name);
    const stat = await Deno.stat(filePath);
    return stat.size;
  }

  /**
   * List the contents of a directory within the storage root.
   *
   * @param path - Storage-relative directory path.
   * @returns Object containing `dirs` (subdirectory names) and `files` (file names).
   */
  override async listdir(path: string): Promise<ListResult> {
    const dirPath = this.resolvePath(path);

    const dirs: string[] = [];
    const files: string[] = [];

    try {
      for await (const entry of Deno.readDir(dirPath)) {
        if (entry.isDirectory) {
          dirs.push(entry.name);
        } else if (entry.isFile) {
          files.push(entry.name);
        }
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return { dirs: [], files: [] };
      }
      throw err;
    }

    return {
      dirs: dirs.sort(),
      files: files.sort(),
    };
  }

  // ===========================================================================
  // Overridden optional methods
  // ===========================================================================

  /**
   * Return rich metadata for a stored file.
   *
   * Uses `Deno.stat()` to obtain size and modification timestamps.
   *
   * @param name - Storage-relative file name/path.
   * @returns {@link FileMetadata} for the file.
   * @throws {Error} If the file does not exist.
   */
  override async getMetadata(name: string): Promise<FileMetadata> {
    const filePath = this.resolvePath(name);
    const stat = await Deno.stat(filePath);

    return {
      name,
      size: stat.size,
      contentType: this.guessContentType(name),
      updatedAt: stat.mtime ?? new Date(),
      createdAt: stat.birthtime ?? undefined,
    };
  }

  /**
   * Generate a signed URL — falls back to the regular public URL since local
   * filesystem storage does not support token-based access control.
   *
   * @param name - Storage-relative file name/path.
   * @returns Public URL (same as {@link url}).
   */
  override async signedUrl(name: string): Promise<string> {
    return this.url(name);
  }
}
