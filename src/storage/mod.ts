/**
 * @alexi/storage
 *
 * Django-style storage API for file handling in Alexi.
 * Provides a unified interface for file uploads, storage, and retrieval
 * across different storage backends.
 *
 * @module alexi_storage
 *
 * @example
 * ```ts
 * import { getStorage, setStorage, Storage } from "@alexi/storage";
 * import { FirebaseStorage } from "@alexi/storage/backends/firebase";
 * import { MemoryStorage } from "@alexi/storage/backends/memory";
 *
 * // Configure storage
 * const storage = new FirebaseStorage({
 *   bucket: "my-project.appspot.com",
 * });
 * setStorage(storage);
 *
 * // Use storage
 * const file = new File(["Hello"], "hello.txt", { type: "text/plain" });
 * const name = await getStorage().save("documents/hello.txt", file);
 * const url = await getStorage().url(name);
 * ```
 */

// Core storage class and types
export {
  type FileMetadata,
  type ListResult,
  type SaveOptions,
  type SignedUrlOptions,
  Storage,
} from "./storage.ts";

// Setup functions
export {
  getStorage,
  isStorageInitialized,
  resetStorage,
  setStorage,
} from "./setup.ts";

// Backends are exported from subpaths:
// - @alexi/storage/backends/firebase
// - @alexi/storage/backends/memory
