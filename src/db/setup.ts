/**
 * Django-style setup system for Alexi ORM
 *
 * Provides a centralized configuration and initialization system similar to
 * Django's settings.py and django.setup().
 *
 * @module
 *
 * @example
 * ```ts
 * // In main.ts or entry point
 * import { setup, getBackend } from '@alexi/db';
 *
 * await setup({
 *   database: {
 *     engine: 'indexeddb',
 *     name: 'myapp',
 *   },
 * });
 *
 * // Then in any component/view
 * import { getBackend } from '@alexi/db';
 * const backend = getBackend();
 * const articles = await Article.objects.using(backend).all().fetch();
 * ```
 *
 * @example Named backends (Django-style DATABASES)
 * ```ts
 * import { setup } from '@alexi/db';
 * import { IndexedDBBackend } from '@alexi/db/backends/indexeddb';
 * import { RestBackend } from '@alexi/db/backends/rest';
 * import { SyncBackend } from '@alexi/db/backends/sync';
 *
 * const indexeddb = new IndexedDBBackend({ name: 'myapp' });
 * const rest = new RestBackend({ apiUrl: 'http://localhost:8000/api' });
 * const sync = new SyncBackend(indexeddb, rest);
 *
 * await setup({
 *   databases: {
 *     default: sync,
 *     indexeddb: indexeddb,
 *     rest: rest,
 *     sync: sync,
 *   },
 * });
 *
 * // Then use by name
 * const cached = await Article.objects.using('indexeddb').all().fetch();
 * const fresh = await Article.objects.using('sync').all().fetch();
 * ```
 */

import type { DatabaseBackend } from "./backends/backend.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Database engine types
 */
export type DatabaseEngine = "indexeddb" | "denokv" | "memory";

/**
 * Database configuration
 */
export interface DatabaseSettings {
  /** Database engine to use */
  engine: DatabaseEngine;
  /** Database name */
  name: string;
  /** Optional path (for DenoKV file-based storage) */
  path?: string;
}

/**
 * Named database backends configuration (Django-style DATABASES)
 */
export type DatabasesConfig = Record<string, DatabaseBackend>;

/**
 * Alexi ORM settings
 */
export interface AlexiSettings {
  /** Database configuration (required if backend not provided) */
  database?: DatabaseSettings;
  /** Pre-configured backend instance (alternative to database config) */
  backend?: DatabaseBackend;
  /**
   * Named database backends (Django-style DATABASES).
   * Allows using string names with .using('name').
   * The 'default' key sets the default backend.
   *
   * @example
   * ```ts
   * databases: {
   *   default: syncBackend,
   *   indexeddb: indexedDBBackend,
   *   rest: restBackend,
   * }
   * ```
   */
  databases?: DatabasesConfig;
  /** Debug mode - enables extra logging */
  debug?: boolean;
}

// ============================================================================
// Global State
// ============================================================================

let _settings: AlexiSettings | null = null;
let _backend: DatabaseBackend | null = null;
let _initialized = false;

/** Named backends registry */
const _backends: Map<string, DatabaseBackend> = new Map();

// ============================================================================
// Setup Functions
// ============================================================================

/**
 * Initialize Alexi ORM with the given settings
 *
 * This function must be called before using any ORM features.
 * It creates and connects the database backend.
 *
 * @param settings - Configuration settings
 *
 * @example
 * ```ts
 * // Using IndexedDB (browser)
 * await setup({
 *   database: {
 *     engine: 'indexeddb',
 *     name: 'myapp',
 *   },
 * });
 *
 * // Using DenoKV (server)
 * await setup({
 *   database: {
 *     engine: 'denokv',
 *     name: 'myapp',
 *     path: './data/myapp.db',
 *   },
 * });
 * ```
 */
export async function setup(settings: AlexiSettings): Promise<void> {
  if (_initialized) {
    if (settings.debug) {
      console.warn("[Alexi] Already initialized, skipping setup");
    }
    return;
  }

  _settings = settings;

  if (settings.debug) {
    console.log("[Alexi] Initializing with settings:", settings);
  }

  // Handle named databases configuration (Django-style DATABASES)
  if (settings.databases) {
    // Clear existing registry
    _backends.clear();

    // Register and connect all named backends
    for (const [name, backend] of Object.entries(settings.databases)) {
      if (!backend.isConnected) {
        await backend.connect();
      }
      _backends.set(name, backend);

      if (settings.debug) {
        console.log(`[Alexi] Registered backend '${name}'`);
      }
    }

    // Set default backend if specified
    if (_backends.has("default")) {
      _backend = _backends.get("default")!;
    } else {
      // Use first backend as default if no 'default' key
      const firstBackend = _backends.values().next().value;
      if (firstBackend) {
        _backend = firstBackend;
      }
    }
  } else if (settings.backend) {
    // Use pre-configured backend
    _backend = settings.backend;
    if (!_backend.isConnected) {
      await _backend.connect();
    }
  } else if (settings.database) {
    // Create and connect backend based on engine
    _backend = await createBackend(settings.database);
    await _backend.connect();
  } else {
    throw new Error(
      "Alexi ORM setup requires 'databases', 'backend', or 'database' configuration.",
    );
  }

  _initialized = true;

  if (settings.debug) {
    console.log("[Alexi] Setup complete, backend connected");
  }
}

/**
 * Create a database backend based on settings
 */
async function createBackend(
  dbSettings: DatabaseSettings,
): Promise<DatabaseBackend> {
  switch (dbSettings.engine) {
    case "indexeddb": {
      // Dynamic import to avoid loading browser code in server context
      const { IndexedDBBackend } = await import("./backends/indexeddb/mod.ts");
      return new IndexedDBBackend({
        name: dbSettings.name,
      });
    }

    case "denokv": {
      // Dynamic import to avoid loading Deno code in browser context
      const { DenoKVBackend } = await import("./backends/denokv/mod.ts");
      return new DenoKVBackend({
        name: dbSettings.name,
        path: dbSettings.path,
      });
    }

    case "memory": {
      // For testing - use IndexedDB with a random name
      const { IndexedDBBackend } = await import("./backends/indexeddb/mod.ts");
      return new IndexedDBBackend({
        name: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
    }

    default:
      throw new Error(`Unknown database engine: ${dbSettings.engine}`);
  }
}

/**
 * Get the current settings
 *
 * @throws Error if setup() has not been called
 */
export function getSettings(): AlexiSettings {
  if (!_settings) {
    throw new Error(
      "Alexi ORM is not configured. Call setup() first.",
    );
  }
  return _settings;
}

/**
 * Get the database backend
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
      "Alexi ORM is not configured. Call setup() first.",
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
// Named Backend Registry
// ============================================================================

/**
 * Register a named backend
 *
 * @param name - The name to register the backend under
 * @param backend - The backend instance
 *
 * @example
 * ```ts
 * registerBackend('replica', replicaBackend);
 * ```
 */
export function registerBackend(name: string, backend: DatabaseBackend): void {
  _backends.set(name, backend);
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
 * Replace the current database backend
 *
 * This is useful for wrapping the backend with additional functionality,
 * such as the SyncBackend which intercepts operations for synchronization.
 *
 * @param backend - The new backend to use
 *
 * @example
 * ```ts
 * // Wrap the current backend with SyncBackend
 * const localBackend = getBackend();
 * const syncBackend = new SyncBackend(localBackend, syncConfig);
 * await syncBackend.connect();
 * setBackend(syncBackend);
 * ```
 */
export function setBackend(backend: DatabaseBackend): void {
  if (!_initialized) {
    throw new Error(
      "Alexi ORM is not configured. Call setup() first before setting a new backend.",
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
  _settings = null;
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
