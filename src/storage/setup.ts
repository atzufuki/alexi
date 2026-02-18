/**
 * Storage Setup
 *
 * Global storage configuration and access functions.
 *
 * @module alexi_storage/setup
 */

import { Storage } from "./storage.ts";

// =============================================================================
// Global Storage Instance
// =============================================================================

let _defaultStorage: Storage | null = null;
let _isInitialized = false;

/**
 * Set the default storage backend
 *
 * @param storage - Storage backend instance
 *
 * @example
 * ```ts
 * import { setStorage } from "@alexi/storage";
 * import { FirebaseStorage } from "@alexi/storage/backends/firebase";
 *
 * const storage = new FirebaseStorage({
 *   bucket: "my-project.appspot.com",
 * });
 *
 * setStorage(storage);
 * ```
 */
export function setStorage(storage: Storage): void {
  _defaultStorage = storage;
  _isInitialized = true;
}

/**
 * Get the default storage backend
 *
 * @returns The default storage backend
 * @throws Error if storage has not been configured
 *
 * @example
 * ```ts
 * import { getStorage } from "@alexi/storage";
 *
 * const storage = getStorage();
 * const url = await storage.url("documents/report.pdf");
 * ```
 */
export function getStorage(): Storage {
  if (!_defaultStorage) {
    throw new Error(
      "Storage not configured. Call setStorage() first or configure DEFAULT_FILE_STORAGE in settings.",
    );
  }
  return _defaultStorage;
}

/**
 * Check if storage has been initialized
 *
 * @returns true if storage is configured
 */
export function isStorageInitialized(): boolean {
  return _isInitialized;
}

/**
 * Reset storage configuration (mainly for testing)
 */
export function resetStorage(): void {
  _defaultStorage = null;
  _isInitialized = false;
}
