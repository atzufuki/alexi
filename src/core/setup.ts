/**
 * Alexi Core Setup
 *
 * Django-style setup() function for Alexi.
 * Accepts a DATABASES dict of pre-built backend instances, then registers
 * them in @alexi/db's backend registry without importing any specific backend
 * implementation.  This keeps @alexi/core free of server-only imports so that
 * browser / Service Worker bundles remain clean.
 *
 * @module @alexi/core/setup
 *
 * @example
 * ```ts
 * // project/web.settings.ts
 * import { DenoKVBackend } from "@alexi/db/backends/denokv";
 *
 * export const DATABASES = {
 *   default: new DenoKVBackend({ name: "myapp", path: "./data/myapp.db" }),
 * };
 * ```
 *
 * ```ts
 * // manage.ts
 * import { setup } from "@alexi/core";
 * import { DATABASES } from "./project/web.settings.ts";
 *
 * await setup({ DATABASES });
 * ```
 */

import type { DatabaseBackend } from "@alexi/db";

// =============================================================================
// Types
// =============================================================================

/**
 * Django-style DATABASES configuration dict.
 * Keys are database aliases (e.g. "default", "replica").
 * Values are pre-constructed, ready-to-use backend instances.
 *
 * The user imports their chosen backend in their settings file so that
 * bundlers (esbuild, etc.) can tree-shake server-only code from browser bundles.
 */
export type DatabasesConfig = Record<string, DatabaseBackend>;

// =============================================================================
// Setup
// =============================================================================

/**
 * Initialise Alexi databases from a DATABASES configuration dict.
 *
 * - Connects each backend if not already connected.
 * - Registers each backend by name in @alexi/db's registry.
 * - The "default" entry (if present) becomes the global default backend.
 *
 * This function contains no static imports of specific database backends, so
 * it is safe to import in both server and browser/SW contexts.
 *
 * @param config.DATABASES  Named backend instances (Django-style)
 */
export async function setup(config: {
  DATABASES: DatabasesConfig;
}): Promise<void> {
  const { DATABASES } = config;

  // Lazy-import the registry API from @alexi/db to avoid a static circular
  // dependency while still keeping @alexi/core independent of backend code.
  const db = await import("@alexi/db");

  if (db.isInitialized()) {
    return;
  }

  // Connect and register each backend via the registry API.
  // Registering 'default' first ensures it becomes the global default backend.
  const entries = Object.entries(DATABASES);

  // Sort so that 'default' is registered first (registerBackend sets default
  // on the first call if no 'default' key has been seen yet).
  const sorted = [
    ...entries.filter(([name]) => name === "default"),
    ...entries.filter(([name]) => name !== "default"),
  ];

  for (const [name, backend] of sorted) {
    if (!backend.isConnected) {
      await backend.connect();
    }
    db.registerBackend(name, backend);
  }
}
