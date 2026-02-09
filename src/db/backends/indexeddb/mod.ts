/**
 * IndexedDB Backend for Alexi ORM
 *
 * This module exports the IndexedDB database backend for use in browsers.
 *
 * @module
 *
 * @example
 * ```ts
 * import { IndexedDBBackend } from '@alexi/db/backends/indexeddb';
 *
 * const backend = new IndexedDBBackend({ name: 'myapp', version: 1 });
 * await backend.connect();
 *
 * // Use with models
 * const articles = await Article.objects.using(backend).all().fetch();
 * ```
 */

export { IndexedDBBackend, type IndexedDBConfig } from "./backend.ts";
