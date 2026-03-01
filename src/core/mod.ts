/**
 * Alexi Core - Universal (browser + server safe) exports
 *
 * This module only exports things that are safe to import in any environment
 * (browser, Service Worker, server).
 *
 * For management commands, CLI utilities, Application server, and
 * configuration loader, import from "@alexi/core/management" (server-only).
 *
 * @module @alexi/core
 *
 * @example Setup databases
 * ```ts
 * import { setup } from "@alexi/core";
 * import { DenoKVBackend } from "@alexi/db/backends/denokv";
 *
 * await setup({
 *   DATABASES: {
 *     default: new DenoKVBackend({ name: "myapp", path: "./data/myapp.db" }),
 *   },
 * });
 * ```
 */

// =============================================================================
// Setup
// =============================================================================

export { setup } from "./setup.ts";
export type { DatabasesConfig } from "./setup.ts";
