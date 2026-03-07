/**
 * Alexi's Django-style file storage abstraction.
 *
 * `@alexi/storage` defines the `Storage` base class plus the global setup
 * helpers used by file-oriented features such as upload handling, file fields,
 * and generated download URLs. It gives applications a single storage API even
 * when the concrete backend changes between local testing and production.
 *
 * The root entrypoint is centered on `Storage`, `setStorage()`, and
 * `getStorage()`. Concrete implementations are exposed from backend subpaths,
 * including `@alexi/storage/backends/memory` for tests and
 * `@alexi/storage/backends/firebase` for Firebase Cloud Storage integrations.
 *
 * The abstraction itself is runtime-neutral, but individual backends may depend
 * on browser APIs, remote services, or server-side credentials.
 *
 * @module @alexi/storage
 *
 * @example Configure and use a storage backend
 * ```ts
 * import { getStorage, setStorage } from "@alexi/storage";
 * import { MemoryStorage } from "@alexi/storage/backends/memory";
 *
 * setStorage(new MemoryStorage());
 *
 * const name = await getStorage().save("documents/hello.txt", "Hello");
 * const exists = await getStorage().exists(name);
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
