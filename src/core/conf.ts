/**
 * Alexi Global Settings Registry
 *
 * Django-style `django.conf.settings` equivalent for Alexi.
 *
 * `conf` is a global, lazily-loaded settings proxy that always reflects the
 * *active* settings module regardless of how the application was started.
 * It is populated by `getApplication()` / `setup()` and can be imported from
 * any module without hardcoding the settings file path.
 *
 * @module @alexi/core/conf
 *
 * @example
 * ```ts
 * // Instead of:
 * import * as settings from "../../project/settings.ts"; // ❌ hardcoded path
 * const backend = settings.DATABASES.default;
 *
 * // Do this:
 * import { conf } from "@alexi/core";
 * const backend = conf.DATABASES?.default;              // ✅ always active settings
 * ```
 */

import type { GetApplicationSettings } from "./get_application.ts";

// =============================================================================
// Module-level global state
// =============================================================================

let _settings: GetApplicationSettings | null = null;

// =============================================================================
// Public API
// =============================================================================

/**
 * Configure the global settings registry.
 *
 * This is called automatically by `getApplication()`. You do not normally need
 * to call this directly.
 *
 * @param settings - The settings object passed to `getApplication()`
 */
export function configureSettings(settings: GetApplicationSettings): void {
  _settings = settings;
}

/**
 * Reset the global settings registry.
 *
 * Clears the stored settings. Useful in tests.
 */
export function resetSettings(): void {
  _settings = null;
}

/**
 * Whether the global settings registry has been configured.
 */
export function isSettingsConfigured(): boolean {
  return _settings !== null;
}

/**
 * Global settings proxy — always reflects the active settings module.
 *
 * This is the Alexi equivalent of Django's `django.conf.settings`.
 * Access it after `getApplication()` has been called.
 *
 * @example
 * ```ts
 * import { conf } from "@alexi/core";
 *
 * // In a view, middleware, or any module:
 * const debug = conf.DEBUG ?? false;
 * const db = conf.DATABASES?.default;
 * ```
 *
 * @throws {Error} If accessed before `getApplication()` has been called.
 */
export const conf: GetApplicationSettings = new Proxy(
  {} as GetApplicationSettings,
  {
    get(_target, prop: string | symbol) {
      if (_settings === null) {
        throw new Error(
          "Alexi settings are not configured. " +
            "Call configureSettings() before accessing conf, or use " +
            "getHttpApplication() which requires settings to be configured " +
            "via the --settings CLI flag.",
        );
      }
      return _settings[prop as keyof GetApplicationSettings];
    },

    has(_target, prop: string | symbol) {
      if (_settings === null) return false;
      return prop in _settings;
    },

    ownKeys(_target) {
      if (_settings === null) return [];
      return Reflect.ownKeys(_settings);
    },

    getOwnPropertyDescriptor(_target, prop: string | symbol) {
      if (_settings === null) return undefined;
      return Object.getOwnPropertyDescriptor(_settings, prop);
    },
  },
);
