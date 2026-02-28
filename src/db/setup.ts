/**
 * Alexi ORM backend registry
 *
 * Low-level registry API for managing database backend instances.
 * Use `setup()` from `@alexi/core` to initialize the ORM.
 *
 * @module
 */

import type { DatabaseBackend } from "./backends/backend.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Named database backends configuration (Django-style DATABASES)
 */
export type DatabasesConfig = Record<string, DatabaseBackend>;

// ============================================================================
// Global State
// ============================================================================

let _backend: DatabaseBackend | null = null;
let _initialized = false;

/** Named backends registry */
const _backends: Map<string, DatabaseBackend> = new Map();

// ============================================================================
// Registry API
// ============================================================================

/**
 * Get the default database backend
 *
 * @throws Error if setup() has not been called
 *
 * @example
 * ```ts
 * const backend = getBackend();
 * const users = await User.objects.using(backend).all().fetch();
 * ```
 */
export function getBackend(): DatabaseBackend {
  if (!_backend) {
    throw new Error(
      "Alexi ORM is not configured. Call setup() from @alexi/core first.",
    );
  }
  return _backend;
}

/**
 * Check if Alexi ORM has been initialized
 */
export function isInitialized(): boolean {
  return _initialized;
}

// ============================================================================
// Setup API (db-level, for tests and internal use)
// ============================================================================

/**
 * Low-level ORM setup.
 *
 * Registers one or more backends directly. For application use, prefer
 * `setup({ DATABASES })` from `@alexi/core`.
 *
 * Accepts:
 * - `setup({ backend })` — registers a single backend as "default"
 * - `setup({ databases: { default: ..., secondary: ... } })` — named backends
 *
 * @example
 * ```ts
 * import { setup, reset } from "@alexi/db";
 * import { DenoKVBackend } from "@alexi/db/backends/denokv";
 *
 * const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
 * await backend.connect();
 * await setup({ backend });
 *
 * // ... tests ...
 *
 * await reset();
 * ```
 */
export async function setup(
  config:
    | { backend: DatabaseBackend; databases?: never }
    | { databases: DatabasesConfig; backend?: never },
): Promise<void> {
  if ("backend" in config && config.backend) {
    // Single-backend shorthand
    const backend = config.backend;
    if (!backend.isConnected) {
      await backend.connect();
    }
    registerBackend("default", backend);
  } else if ("databases" in config && config.databases) {
    // Named backends — register "default" first
    const entries = Object.entries(config.databases);
    const sorted = entries.sort(([a], [b]) => {
      if (a === "default") return -1;
      if (b === "default") return 1;
      return 0;
    });
    for (const [name, backend] of sorted) {
      if (!backend.isConnected) {
        await backend.connect();
      }
      registerBackend(name, backend);
    }
  }
}

// ============================================================================
// Registry API
// ============================================================================

/**
 * Register a named backend and mark ORM as initialized.
 *
 * Called internally by `setup()` in `@alexi/core`.
 *
 * @param name - The name to register the backend under
 * @param backend - The backend instance
 */
export function registerBackend(name: string, backend: DatabaseBackend): void {
  _backends.set(name, backend);
  _initialized = true;
  // The 'default' key sets the default backend
  if (name === "default") {
    _backend = backend;
  } else if (!_backend) {
    // Use first registered backend as default if no 'default' key yet
    _backend = backend;
  }
}

/**
 * Get a backend by name
 *
 * @param name - The name of the backend to retrieve
 * @returns The backend instance, or undefined if not found
 *
 * @example
 * ```ts
 * const backend = getBackendByName('indexeddb');
 * if (backend) {
 *   const articles = await Article.objects.using(backend).all().fetch();
 * }
 * ```
 */
export function getBackendByName(name: string): DatabaseBackend | undefined {
  return _backends.get(name);
}

/**
 * Check if a named backend exists
 *
 * @param name - The name to check
 * @returns true if the backend exists
 */
export function hasBackend(name: string): boolean {
  return _backends.has(name);
}

/**
 * Get all registered backend names
 *
 * @returns Array of registered backend names
 */
export function getBackendNames(): string[] {
  return Array.from(_backends.keys());
}

/**
 * Replace the default database backend
 *
 * @param backend - The new backend to use
 */
export function setBackend(backend: DatabaseBackend): void {
  if (!_initialized) {
    throw new Error(
      "Alexi ORM is not configured. Call setup() from @alexi/core first before setting a new backend.",
    );
  }
  _backend = backend;
}

/**
 * Shutdown Alexi ORM and disconnect from the database
 *
 * Call this when your application is shutting down.
 */
export async function shutdown(): Promise<void> {
  // Disconnect all named backends
  for (const backend of _backends.values()) {
    if (backend.isConnected) {
      await backend.disconnect();
    }
  }
  _backends.clear();

  // Disconnect default backend if not in registry
  if (_backend && !Array.from(_backends.values()).includes(_backend)) {
    await _backend.disconnect();
  }
  _backend = null;
  _initialized = false;
}

/**
 * Reset the ORM state (useful for testing)
 *
 * This disconnects and clears the backend without requiring a new setup.
 */
export async function reset(): Promise<void> {
  await shutdown();
}
