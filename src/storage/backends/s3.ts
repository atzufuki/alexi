/**
 * S3-Compatible Storage Backend
 *
 * Storage backend using the S3-compatible XML API. Works with AWS S3,
 * Google Cloud Storage (via S3 interoperability), Cloudflare R2, MinIO,
 * and any other S3-compatible object store.
 *
 * @example
 * ```ts
 * // AWS S3
 * import { S3Storage } from "@alexi/storage/backends/s3";
 *
 * const storage = new S3Storage({
 *   bucket: "my-bucket",
 *   endpoint: "https://s3.eu-west-1.amazonaws.com",
 *   region: "eu-west-1",
 *   accessKeyId: "AKIAIOSFODNN7EXAMPLE",
 *   secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
 * });
 * ```
 *
 * @example
 * ```ts
 * // Google Cloud Storage (via S3 interoperability)
 * import { S3Storage } from "@alexi/storage/backends/s3";
 *
 * const storage = new S3Storage({
 *   bucket: "my-gcs-bucket",
 *   endpoint: "https://storage.googleapis.com",
 *   region: "auto",
 *   accessKeyId: "GOOGXXXXXXXXXXXXXXXXX",
 *   secretAccessKey: "...",
 *   basePath: "uploads/",
 * });
 * ```
 *
 * @example
 * ```ts
 * // Cloudflare R2
 * import { S3Storage } from "@alexi/storage/backends/s3";
 *
 * const storage = new S3Storage({
 *   bucket: "my-r2-bucket",
 *   endpoint: "https://<accountid>.r2.cloudflarestorage.com",
 *   region: "auto",
 *   accessKeyId: "...",
 *   secretAccessKey: "...",
 * });
 * ```
 *
 * @module
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
 * Configuration options for {@link S3Storage}
 */
export interface S3StorageOptions {
  /**
   * S3 bucket name
   */
  bucket: string;

  /**
   * Base endpoint URL, e.g. `"https://storage.googleapis.com"` or
   * `"https://<accountid>.r2.cloudflarestorage.com"`
   */
  endpoint: string;

  /**
   * AWS region, or `"auto"` for GCS/R2
   */
  region: string;

  /**
   * HMAC / AWS access key ID
   */
  accessKeyId: string;

  /**
   * HMAC / AWS secret access key
   */
  secretAccessKey: string;

  /**
   * Optional key prefix for all stored files (e.g. `"uploads/"`)
   */
  basePath?: string;

  /**
   * Use path-style URLs (default `true`). Required for GCS and most non-AWS providers.
   *
   * - Path-style (default): `https://storage.googleapis.com/{bucket}/{key}`
   * - Virtual-hosted (AWS default): `https://{bucket}.s3.amazonaws.com/{key}`
   */
  forcePathStyle?: boolean;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

// =============================================================================
// AWS Signature V4 helpers (pure Web Crypto)
// =============================================================================

/**
 * Compute HMAC-SHA256 and return as ArrayBuffer
 */
async function hmacSha256(
  key: ArrayBuffer | Uint8Array,
  data: string,
): Promise<ArrayBuffer> {
  const keyBuf = key instanceof Uint8Array
    ? key.buffer.slice(
      key.byteOffset,
      key.byteOffset + key.byteLength,
    ) as ArrayBuffer
    : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

/**
 * Compute SHA-256 hash and return as lowercase hex string
 */
async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert ArrayBuffer to lowercase hex string
 */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Format a Date as `YYYYMMDDTHHmmssZ` (ISO 8601 basic, UTC)
 */
function toIsoBasic(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Format a Date as `YYYYMMDD` (date only, UTC)
 */
function toDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Derive the AWS Signature V4 signing key
 */
async function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(
    new TextEncoder().encode(`AWS4${secretAccessKey}`),
    dateStamp,
  );
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

interface SignedHeaders extends Record<string, string> {
  authorization: string;
  "x-amz-date": string;
  "x-amz-content-sha256": string;
}

/**
 * Sign an HTTP request using AWS Signature Version 4 (header signing)
 *
 * @param method - HTTP method
 * @param url - Full request URL
 * @param headers - Request headers (will be augmented)
 * @param payload - Request body (string or ArrayBuffer); use empty string for GET/DELETE/HEAD
 * @param credentials - AWS credentials
 * @returns Object with `authorization`, `x-amz-date`, and `x-amz-content-sha256` headers
 */
async function signRequest(
  method: string,
  url: URL,
  headers: Record<string, string>,
  payload: string | ArrayBuffer,
  credentials: { accessKeyId: string; secretAccessKey: string; region: string },
): Promise<SignedHeaders> {
  const now = new Date();
  const amzDate = toIsoBasic(now);
  const dateStamp = toDateStamp(now);
  const service = "s3";

  const payloadHash = await sha256Hex(payload);

  // Canonical headers (must include host + x-amz-date + x-amz-content-sha256)
  const allHeaders: Record<string, string> = {
    ...headers,
    host: url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };

  const sortedHeaderKeys = Object.keys(allHeaders).map((k) => k.toLowerCase())
    .sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${allHeaders[k].trim()}`)
    .join("\n") + "\n";
  const signedHeadersStr = sortedHeaderKeys.join(";");

  // Canonical query string
  const sortedParams = [...url.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b));
  const canonicalQueryString = sortedParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  // Canonical request
  const canonicalRequest = [
    method.toUpperCase(),
    url.pathname,
    canonicalQueryString,
    canonicalHeaders,
    signedHeadersStr,
    payloadHash,
  ].join("\n");

  const credentialScope =
    `${dateStamp}/${credentials.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey(
    credentials.secretAccessKey,
    dateStamp,
    credentials.region,
    service,
  );
  const signature = bufToHex(await hmacSha256(signingKey, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  return {
    authorization,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };
}

/**
 * Generate a presigned GET URL using AWS Signature V4 query-string signing
 *
 * @param url - Base URL for the object
 * @param credentials - AWS credentials
 * @param expiresIn - Expiration in seconds (default 3600)
 * @returns Presigned URL string
 */
async function presignUrl(
  url: URL,
  credentials: { accessKeyId: string; secretAccessKey: string; region: string },
  expiresIn = 3600,
): Promise<string> {
  const now = new Date();
  const amzDate = toIsoBasic(now);
  const dateStamp = toDateStamp(now);
  const service = "s3";
  const credentialScope =
    `${dateStamp}/${credentials.region}/${service}/aws4_request`;

  // Build query string
  const params = new URLSearchParams(url.searchParams);
  params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  params.set(
    "X-Amz-Credential",
    `${credentials.accessKeyId}/${credentialScope}`,
  );
  params.set("X-Amz-Date", amzDate);
  params.set("X-Amz-Expires", String(expiresIn));
  params.set("X-Amz-SignedHeaders", "host");

  const sortedParams = [...params.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const canonicalQueryString = sortedParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalHeaders = `host:${url.host}\n`;
  const signedHeadersStr = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    "GET",
    url.pathname,
    canonicalQueryString,
    canonicalHeaders,
    signedHeadersStr,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey(
    credentials.secretAccessKey,
    dateStamp,
    credentials.region,
    service,
  );
  const signature = bufToHex(await hmacSha256(signingKey, stringToSign));

  params.set("X-Amz-Signature", signature);
  return `${url.origin}${url.pathname}?${params.toString()}`;
}

// =============================================================================
// S3Storage Implementation
// =============================================================================

/**
 * S3-compatible object storage backend
 *
 * Implements the {@link Storage} API using the S3 XML REST API.
 * Compatible with AWS S3, Google Cloud Storage (S3 interoperability),
 * Cloudflare R2, MinIO, Tigris, and any other S3-compatible store.
 *
 * All requests are signed with AWS Signature Version 4 using only the
 * Web Crypto API — no external dependencies.
 *
 * @example
 * ```ts
 * import { S3Storage } from "@alexi/storage/backends/s3";
 * import { setStorage } from "@alexi/storage";
 *
 * setStorage(new S3Storage({
 *   bucket: "my-bucket",
 *   endpoint: "https://s3.eu-west-1.amazonaws.com",
 *   region: "eu-west-1",
 *   accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
 *   secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
 * }));
 * ```
 *
 * @category Backends
 */
export class S3Storage extends Storage {
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly basePath: string;
  private readonly forcePathStyle: boolean;
  private readonly debug: boolean;

  constructor(options: S3StorageOptions) {
    super();
    this.bucket = options.bucket;
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.region = options.region;
    this.accessKeyId = options.accessKeyId;
    this.secretAccessKey = options.secretAccessKey;
    this.basePath = options.basePath
      ? this.normalizePath(options.basePath) + "/"
      : "";
    this.forcePathStyle = options.forcePathStyle ?? true;
    this.debug = options.debug ?? false;
  }

  // ===========================================================================
  // Abstract method implementations
  // ===========================================================================

  /**
   * Save a file to S3-compatible storage
   *
   * Uploads the file using `PUT /{bucket}/{key}` with AWS Signature V4.
   * Content-Type and optional metadata headers are included.
   *
   * @param name - Desired file path/name
   * @param content - File content
   * @param options - Save options including `contentType` and `metadata`
   * @returns The stored file name (same as `name`)
   */
  async save(
    name: string,
    content: File | Blob | ReadableStream,
    options?: SaveOptions,
  ): Promise<string> {
    const key = this.getFullKey(name);
    const url = this.buildUrl(key);

    const contentType = options?.contentType ??
      (content instanceof File ? content.type : null) ??
      this.guessContentType(name);

    let body: ArrayBuffer;
    if (content instanceof ReadableStream) {
      body = await new Response(content).arrayBuffer();
    } else {
      body = await content.arrayBuffer();
    }

    const extraHeaders: Record<string, string> = {
      "content-type": contentType,
    };
    if (options?.metadata) {
      for (const [k, v] of Object.entries(options.metadata)) {
        extraHeaders[`x-amz-meta-${k}`] = v;
      }
    }

    const signed = await signRequest(
      "PUT",
      url,
      extraHeaders,
      body as ArrayBuffer,
      {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        region: this.region,
      },
    );

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        ...extraHeaders,
        ...signed,
      },
      body,
    });

    this.log(`PUT ${key} → ${response.status}`);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `S3 save failed (${response.status}): ${text}`,
      );
    }

    return name;
  }

  /**
   * Open a file for reading
   *
   * Sends a `GET /{bucket}/{key}` request and returns the response body stream.
   *
   * @param name - File path/name in storage
   * @returns ReadableStream of file content
   */
  async open(name: string): Promise<ReadableStream> {
    const key = this.getFullKey(name);
    const url = this.buildUrl(key);

    const signed = await signRequest(
      "GET",
      url,
      {},
      "",
      {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        region: this.region,
      },
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: signed,
    });

    this.log(`GET ${key} → ${response.status}`);

    if (!response.ok) {
      throw new Error(`S3 open failed (${response.status}): ${name}`);
    }

    return response.body!;
  }

  /**
   * Delete a file from storage
   *
   * Sends `DELETE /{bucket}/{key}`. 404 responses are silently ignored.
   *
   * @param name - File path/name to delete
   */
  async delete(name: string): Promise<void> {
    const key = this.getFullKey(name);
    const url = this.buildUrl(key);

    const signed = await signRequest(
      "DELETE",
      url,
      {},
      "",
      {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        region: this.region,
      },
    );

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: signed,
    });

    this.log(`DELETE ${key} → ${response.status}`);

    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      throw new Error(`S3 delete failed (${response.status}): ${text}`);
    }
  }

  /**
   * Check if a file exists in storage
   *
   * Sends `HEAD /{bucket}/{key}` and returns `true` on 200, `false` on 404.
   *
   * @param name - File path/name to check
   * @returns `true` if the file exists
   */
  async exists(name: string): Promise<boolean> {
    const key = this.getFullKey(name);
    const url = this.buildUrl(key);

    const signed = await signRequest(
      "HEAD",
      url,
      {},
      "",
      {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        region: this.region,
      },
    );

    const response = await fetch(url.toString(), {
      method: "HEAD",
      headers: signed,
    });

    this.log(`HEAD ${key} → ${response.status}`);

    if (response.status === 404) return false;
    if (response.ok) return true;
    throw new Error(`S3 exists check failed (${response.status}): ${name}`);
  }

  /**
   * Get the public URL for a file
   *
   * Returns a path-style URL: `{endpoint}/{bucket}/{key}`.
   * No signing — suitable for publicly accessible objects.
   *
   * @param name - File path/name
   * @returns Public URL string
   */
  async url(name: string): Promise<string> {
    const key = this.getFullKey(name);
    return this.buildUrl(key).toString();
  }

  /**
   * Get the size of a file in bytes
   *
   * Uses a `HEAD` request and reads the `Content-Length` header.
   *
   * @param name - File path/name
   * @returns File size in bytes
   */
  async size(name: string): Promise<number> {
    const metadata = await this.getMetadata(name);
    return metadata.size;
  }

  /**
   * List contents of a directory
   *
   * Uses `GET /{bucket}?prefix={path}&delimiter=/` and parses the
   * `ListBucketResult` XML response.
   *
   * @param path - Directory path to list
   * @returns `{ dirs, files }` with the subdirectory and file names
   */
  async listdir(path: string): Promise<ListResult> {
    const normalizedPath = this.normalizePath(path);
    const fullPrefix = this.basePath +
      (normalizedPath ? `${normalizedPath}/` : "");

    const listUrl = this.buildBucketUrl();
    listUrl.searchParams.set("prefix", fullPrefix);
    listUrl.searchParams.set("delimiter", "/");
    listUrl.searchParams.set("list-type", "2");

    const signed = await signRequest(
      "GET",
      listUrl,
      {},
      "",
      {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        region: this.region,
      },
    );

    const response = await fetch(listUrl.toString(), {
      method: "GET",
      headers: signed,
    });

    this.log(`LIST ${fullPrefix} → ${response.status}`);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`S3 listdir failed (${response.status}): ${text}`);
    }

    const xml = await response.text();

    const stripBase = (key: string): string => {
      if (key.startsWith(this.basePath)) {
        key = key.slice(this.basePath.length);
      }
      return key.replace(/\/$/, "");
    };

    const dirs = [...xml.matchAll(/<Prefix>([^<]+)<\/Prefix>/g)]
      .map((m) => stripBase(m[1]))
      .filter(Boolean);

    const files = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)]
      .map((m) => stripBase(m[1]))
      .filter((f) => f !== normalizedPath && !f.endsWith("/"));

    return { dirs, files };
  }

  /**
   * Get file metadata
   *
   * Uses a `HEAD` request and maps response headers to {@link FileMetadata}.
   *
   * @param name - File path/name
   * @returns File metadata
   */
  override async getMetadata(name: string): Promise<FileMetadata> {
    const key = this.getFullKey(name);
    const url = this.buildUrl(key);

    const signed = await signRequest(
      "HEAD",
      url,
      {},
      "",
      {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        region: this.region,
      },
    );

    const response = await fetch(url.toString(), {
      method: "HEAD",
      headers: signed,
    });

    this.log(`HEAD metadata ${key} → ${response.status}`);

    if (!response.ok) {
      throw new Error(
        `S3 getMetadata failed (${response.status}): ${name}`,
      );
    }

    const contentLength = response.headers.get("content-length");
    const contentType = response.headers.get("content-type") ??
      this.guessContentType(name);
    const lastModified = response.headers.get("last-modified");
    const etag = response.headers.get("etag")?.replace(/"/g, "");

    // Extract custom metadata from x-amz-meta-* headers
    const metadata: Record<string, string> = {};
    for (const [key, value] of response.headers.entries()) {
      if (key.startsWith("x-amz-meta-")) {
        metadata[key.slice("x-amz-meta-".length)] = value;
      }
    }

    return {
      name,
      size: contentLength ? parseInt(contentLength, 10) : 0,
      contentType,
      updatedAt: lastModified ? new Date(lastModified) : new Date(),
      etag,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  /**
   * Generate a presigned URL for temporary access
   *
   * Uses AWS Signature V4 query-string signing. The URL is valid for
   * `options.expiresIn` seconds (default 3600).
   *
   * @param name - File path/name
   * @param options - Signed URL options
   * @returns Presigned URL string
   */
  override async signedUrl(
    name: string,
    options?: SignedUrlOptions,
  ): Promise<string> {
    const key = this.getFullKey(name);
    const url = this.buildUrl(key);
    return presignUrl(
      url,
      {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        region: this.region,
      },
      options?.expiresIn ?? 3600,
    );
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Build the full S3 object key including basePath
   */
  private getFullKey(name: string): string {
    const normalized = this.normalizePath(name);
    return this.basePath + normalized;
  }

  /**
   * Build the URL for an S3 object
   *
   * With `forcePathStyle: true` (default):
   *   `{endpoint}/{bucket}/{key}`
   *
   * With `forcePathStyle: false` (virtual-hosted, AWS default):
   *   `https://{bucket}.{host}/{key}`
   */
  private buildUrl(key: string): URL {
    if (this.forcePathStyle) {
      return new URL(`${this.endpoint}/${this.bucket}/${key}`);
    }
    const endpointUrl = new URL(this.endpoint);
    return new URL(
      `https://${this.bucket}.${endpointUrl.host}/${key}`,
    );
  }

  /**
   * Build the bucket-level URL for list operations
   */
  private buildBucketUrl(): URL {
    if (this.forcePathStyle) {
      return new URL(`${this.endpoint}/${this.bucket}`);
    }
    const endpointUrl = new URL(this.endpoint);
    return new URL(`https://${this.bucket}.${endpointUrl.host}/`);
  }

  /**
   * Log a debug message
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[S3Storage] ${message}`);
    }
  }
}
