/**
 * Sync Backend for Alexi ORM
 *
 * Orchestrates local (IndexedDB) and remote (REST) backends for transparent
 * synchronization. Online-first reads, local-first writes, automatic
 * reconciliation.
 *
 * @module
 *
 * @example Basic usage
 * ```ts
 * import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
 * import { RestBackend } from "@alexi/db/backends/rest";
 * import { SyncBackend } from "@alexi/db/backends/sync";
 *
 * const local = new IndexedDBBackend({ name: "myapp" });
 * const remote = new RestBackend({ apiUrl: "https://api.example.com" });
 * const sync = new SyncBackend(local, remote);
 *
 * await sync.connect();
 *
 * // All ORM operations now sync automatically
 * const task = await TaskModel.objects.using(sync).create({ title: "Hello" });
 * ```
 *
 * @example With Alexi setup
 * ```ts
 * import { setup, getBackend, setBackend } from "@alexi/db";
 * import { RestBackend } from "@alexi/db/backends/rest";
 * import { SyncBackend } from "@alexi/db/backends/sync";
 *
 * // 1. Setup local backend
 * await setup({ database: { engine: "indexeddb", name: "myapp" } });
 * const localBackend = getBackend();
 *
 * // 2. Create REST + Sync backends
 * const restBackend = new RestBackend({ apiUrl: "https://api.example.com" });
 * await restBackend.connect();
 * const syncBackend = new SyncBackend(localBackend, restBackend);
 * await syncBackend.connect();
 *
 * // 3. Replace global backend
 * setBackend(syncBackend);
 * ```
 */

export { SyncBackend } from "./backend.ts";

export type { SyncBackendConfig, SyncResult } from "./backend.ts";
