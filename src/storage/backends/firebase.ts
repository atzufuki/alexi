/**
 * Firebase Storage Backend
 *
 * Storage backend for Firebase Cloud Storage.
 * Uses Firebase Storage REST API for file operations.
 *
 * @module alexi_storage/backends/firebase
 */

import {
  type FileMetadata,
  type ListResult,
  type SaveOptions,
  type SignedUrlOptions,
  Storage,
} from "../storage.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Firebase Storage configuration options
 */
export interface FirebaseStorageOptions {
  /**
   * Firebase Storage bucket name
   * e.g., "my-project.appspot.com" or "my-project.firebasestorage.app"
   */
  bucket: string;

  /**
   * Firebase project ID (optional, derived from bucket if not provided)
   */
  projectId?: string;

  /**
   * Base path prefix for all files (optional)
   * e.g., "uploads/" - all files will be stored under this prefix
   */
  basePath?: string;

  /**
   * Custom API endpoint (optional, for emulator support)
   */
  apiEndpoint?: string;

  /**
   * Function to get the current Firebase auth token
   * If not provided, will attempt to use environment credentials
   */
  getAuthToken?: () => Promise<string>;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Firebase Storage file metadata response
 */
interface FirebaseMetadataResponse {
  name: string;
  bucket: string;
  generation: string;
  metageneration: string;
  contentType: string;
  timeCreated: string;
  updated: string;
  size: string;
  md5Hash: string;
  contentEncoding?: string;
  contentDisposition?: string;
  metadata?: Record<string, string>;
  downloadTokens?: string;
}

/**
 * Firebase Storage list response
 */
interface FirebaseListResponse {
  prefixes?: string[];
  items?: Array<{
    name: string;
    bucket: string;
  }>;
  nextPageToken?: string;
}

// =============================================================================
// FirebaseStorage Implementation
// =============================================================================

/**
 * Firebase Cloud Storage backend
 *
 * Implements the Storage interface for Firebase Storage.
 *
 * @example
 * ```ts
 * // Basic usage
 * const storage = new FirebaseStorage({
 *   bucket: "my-project.appspot.com",
 * });
 *
 * // With auth token provider
 * const storage = new FirebaseStorage({
 *   bucket: "my-project.appspot.com",
 *   getAuthToken: async () => {
 *     const user = firebase.auth().currentUser;
 *     return user?.getIdToken() ?? "";
 *   },
 * });
 *
 * // Save a file
 * const file = new File(["Hello"], "hello.txt", { type: "text/plain" });
 * const name = await storage.save("documents/hello.txt", file);
 *
 * // Get URL
 * const url = await storage.url(name);
 * ```
 */
export class FirebaseStorage extends Storage {
  private readonly bucket: string;
  private readonly basePath: string;
  private readonly apiEndpoint: string;
  private readonly getAuthToken?: () => Promise<string>;
  private readonly debug: boolean;

  constructor(options: FirebaseStorageOptions) {
    super();
    this.bucket = options.bucket;
    this.basePath = options.basePath
      ? this.normalizePath(options.basePath)
      : "";
    this.apiEndpoint = options.apiEndpoint ??
      "https://firebasestorage.googleapis.com/v0";
    this.getAuthToken = options.getAuthToken;
    this.debug = options.debug ?? false;
  }

  /**
   * Save a file to Firebase Storage
   */
  async save(
    name: string,
    content: File | Blob | ReadableStream,
    options?: SaveOptions,
  ): Promise<string> {
    const fullPath = this.getFullPath(name);
    const encodedPath = encodeURIComponent(fullPath);

    // Convert ReadableStream to Blob if needed
    let blob: Blob;
    if (content instanceof ReadableStream) {
      const response = new Response(content);
      blob = await response.blob();
    } else {
      blob = content;
    }

    // Determine content type
    const contentType = options?.contentType ??
      (content instanceof File ? content.type : blob.type) ??
      this.guessContentType(name);

    // Build upload URL
    const uploadUrl =
      `${this.apiEndpoint}/b/${this.bucket}/o?name=${encodedPath}`;

    this.log(`Uploading to: ${uploadUrl}`);

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };

    // Add auth token if available
    const token = await this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Add custom metadata
    if (options?.metadata) {
      for (const [key, value] of Object.entries(options.metadata)) {
        headers[`x-goog-meta-${key}`] = value;
      }
    }

    // Upload file
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body: blob,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Firebase Storage upload failed: ${response.status} ${error}`,
      );
    }

    const result = await response.json() as FirebaseMetadataResponse;
    this.log(`Uploaded: ${result.name}`);

    return name; // Return the original name (without basePath)
  }

  /**
   * Open a file for reading
   */
  async open(name: string): Promise<ReadableStream> {
    const url = await this.getDownloadUrl(name);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Firebase Storage open failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Firebase Storage returned empty body");
    }

    return response.body;
  }

  /**
   * Delete a file from Firebase Storage
   */
  async delete(name: string): Promise<void> {
    const fullPath = this.getFullPath(name);
    const encodedPath = encodeURIComponent(fullPath);
    const deleteUrl = `${this.apiEndpoint}/b/${this.bucket}/o/${encodedPath}`;

    this.log(`Deleting: ${deleteUrl}`);

    const headers: Record<string, string> = {};
    const token = await this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers,
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(
        `Firebase Storage delete failed: ${response.status} ${error}`,
      );
    }

    this.log(`Deleted: ${name}`);
  }

  /**
   * Check if a file exists in Firebase Storage
   */
  async exists(name: string): Promise<boolean> {
    try {
      await this.getMetadata(name);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the public URL for a file
   *
   * Returns a URL that includes the download token for public access.
   */
  async url(name: string): Promise<string> {
    return this.getDownloadUrl(name);
  }

  /**
   * Get the size of a file in bytes
   */
  async size(name: string): Promise<number> {
    const metadata = await this.getMetadata(name);
    return metadata.size;
  }

  /**
   * List contents of a directory
   */
  async listdir(path: string): Promise<ListResult> {
    const fullPath = this.getFullPath(path);
    const prefix = fullPath ? `${fullPath}/` : "";

    const params = new URLSearchParams({
      prefix,
      delimiter: "/",
    });

    const listUrl = `${this.apiEndpoint}/b/${this.bucket}/o?${params}`;

    this.log(`Listing: ${listUrl}`);

    const headers: Record<string, string> = {};
    const token = await this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(listUrl, { headers });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Firebase Storage list failed: ${response.status} ${error}`,
      );
    }

    const result = await response.json() as FirebaseListResponse;

    // Extract directory names (remove prefix and trailing slash)
    const dirs = (result.prefixes ?? []).map((p) => {
      const relative = p.startsWith(prefix) ? p.slice(prefix.length) : p;
      return relative.replace(/\/$/, "");
    });

    // Extract file names (remove prefix)
    const files = (result.items ?? []).map((item) => {
      const relative = item.name.startsWith(prefix)
        ? item.name.slice(prefix.length)
        : item.name;
      return relative;
    });

    return { dirs, files };
  }

  /**
   * Get file metadata from Firebase Storage
   */
  override async getMetadata(name: string): Promise<FileMetadata> {
    const fullPath = this.getFullPath(name);
    const encodedPath = encodeURIComponent(fullPath);
    const metadataUrl = `${this.apiEndpoint}/b/${this.bucket}/o/${encodedPath}`;

    this.log(`Getting metadata: ${metadataUrl}`);

    const headers: Record<string, string> = {};
    const token = await this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(metadataUrl, { headers });
    if (!response.ok) {
      throw new Error(`Firebase Storage metadata failed: ${response.status}`);
    }

    const result = await response.json() as FirebaseMetadataResponse;

    return {
      name,
      size: parseInt(result.size, 10),
      contentType: result.contentType,
      updatedAt: new Date(result.updated),
      createdAt: new Date(result.timeCreated),
      metadata: result.metadata,
      etag: result.md5Hash,
    };
  }

  /**
   * Generate a signed URL for temporary access
   *
   * Note: Firebase Storage doesn't support signed URLs directly via REST API.
   * This returns a download URL with the download token.
   * For true signed URLs, use Firebase Admin SDK on the server.
   */
  override async signedUrl(
    name: string,
    _options?: SignedUrlOptions,
  ): Promise<string> {
    // Firebase Storage REST API doesn't support signed URLs directly
    // Return the download URL with token instead
    return this.getDownloadUrl(name);
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Get the full path including basePath
   */
  private getFullPath(name: string): string {
    const normalized = this.normalizePath(name);
    if (this.basePath) {
      return `${this.basePath}/${normalized}`;
    }
    return normalized;
  }

  /**
   * Get download URL with token
   */
  private async getDownloadUrl(name: string): Promise<string> {
    const fullPath = this.getFullPath(name);
    const encodedPath = encodeURIComponent(fullPath);

    // Get metadata to retrieve download token
    const metadataUrl = `${this.apiEndpoint}/b/${this.bucket}/o/${encodedPath}`;

    const headers: Record<string, string> = {};
    const token = await this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(metadataUrl, { headers });
    if (!response.ok) {
      throw new Error(`Firebase Storage URL failed: ${response.status}`);
    }

    const result = await response.json() as FirebaseMetadataResponse;

    // Build download URL with token
    if (result.downloadTokens) {
      return `${this.apiEndpoint}/b/${this.bucket}/o/${encodedPath}?alt=media&token=${result.downloadTokens}`;
    }

    // Fallback without token (requires auth)
    return `${this.apiEndpoint}/b/${this.bucket}/o/${encodedPath}?alt=media`;
  }

  /**
   * Get auth token
   */
  private async getToken(): Promise<string | null> {
    if (this.getAuthToken) {
      return this.getAuthToken();
    }
    return null;
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[FirebaseStorage] ${message}`);
    }
  }
}
