/**
 * getWebuiApplication() factory for desktop applications.
 *
 * Provides the WebUI equivalent of `getHttpApplication()` from `@alexi/core`.
 * Call this in `project/webui.ts` to configure and obtain a
 * {@link WebuiApplication} that opens the web server UI in a native desktop
 * window.
 *
 * @module
 */

import { WebUILauncher } from "./launcher.ts";
import { createDefaultBindings } from "./bindings.ts";
import type { WebUIConfig } from "./launcher.ts";
export type { WebUIConfig } from "./launcher.ts";

// =============================================================================
// Settings Interface
// =============================================================================

/**
 * Settings accepted by {@link getWebuiApplication}.
 *
 * All fields are optional. The factory uses sensible defaults so that a minimal
 * `project/webui.ts` requires almost no configuration.
 *
 * @example
 * ```ts
 * const app = await getWebuiApplication({
 *   url: "http://localhost:8000/",
 *   webui: { title: "MyApp", width: 1400, height: 900 },
 * });
 * await app.launch();
 * ```
 */
export interface GetWebuiApplicationSettings {
  /**
   * URL to open in the native window.
   *
   * The factory polls this URL until the server responds before opening the
   * window, so it is safe to start the WebUI process before the server is
   * fully ready.
   *
   * @default "http://localhost:8000/"
   */
  url?: string;

  /**
   * WebUI window configuration (title, size, browser engine, kiosk mode, …).
   *
   * All sub-fields are optional; see {@link WebUIConfig} for defaults.
   */
  webui?: WebUIConfig;

  /**
   * Additional native bindings callable from JavaScript running inside the
   * window. These are merged on top of the default bindings provided by
   * {@link createDefaultBindings}.
   */
  bindings?: Record<string, (...args: unknown[]) => unknown>;
}

// =============================================================================
// WebuiApplication
// =============================================================================

/**
 * A configured desktop application returned by {@link getWebuiApplication}.
 *
 * Call {@link launch} to open the native window and block until it is closed.
 *
 * @example
 * ```ts
 * const app = await getWebuiApplication({ url: "http://localhost:8000/" });
 * await app.launch();
 * ```
 */
export class WebuiApplication {
  readonly #launcher: WebUILauncher;

  /** @internal */
  constructor(launcher: WebUILauncher) {
    this.#launcher = launcher;
  }

  /**
   * Open the native desktop window and wait for it to close.
   *
   * The method first waits for the configured URL to become available (polling
   * up to 30 times with 1 s intervals), then opens the WebUI window and blocks
   * until the user closes it or the process receives SIGINT/SIGTERM.
   *
   * @throws {Error} If the server at the configured URL does not respond within
   *   30 seconds.
   */
  async launch(): Promise<void> {
    await this.#launcher.launch();
  }

  /**
   * Close the native window programmatically.
   *
   * Safe to call even when no window is open.
   */
  close(): void {
    this.#launcher.close();
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Configure and return a {@link WebuiApplication} for a desktop entry point.
 *
 * This is the WebUI counterpart to `getHttpApplication()` from `@alexi/core`.
 * Use it in `project/webui.ts` to open the web server UI in a native desktop
 * window:
 *
 * ```ts
 * // project/webui.ts
 * import { getWebuiApplication } from "@alexi/webui";
 *
 * const app = await getWebuiApplication({
 *   url: "http://localhost:8000/",
 *   webui: { title: "MyApp", width: 1400, height: 900 },
 * });
 *
 * await app.launch();
 * ```
 *
 * The factory:
 * 1. Merges the provided settings with defaults.
 * 2. Combines {@link createDefaultBindings} with any extra `bindings` provided.
 * 3. Constructs a {@link WebUILauncher} and wraps it in a {@link WebuiApplication}.
 *
 * @param settings - Optional configuration for the window and URL.
 * @returns A configured {@link WebuiApplication} ready to {@link WebuiApplication.launch}.
 *
 * @example Minimal usage
 * ```ts
 * const app = await getWebuiApplication();
 * await app.launch(); // opens http://localhost:8000/ in a native window
 * ```
 *
 * @example With custom bindings
 * ```ts
 * const app = await getWebuiApplication({
 *   url: "http://localhost:8000/",
 *   webui: { title: "MyApp" },
 *   bindings: {
 *     greet: (name: unknown) => `Hello, ${name}!`,
 *   },
 * });
 * await app.launch();
 * ```
 */
export async function getWebuiApplication(
  settings: GetWebuiApplicationSettings = {},
): Promise<WebuiApplication> {
  const url = settings.url ?? "http://localhost:8000/";
  const config: WebUIConfig = {
    title: "Alexi App",
    width: 1400,
    height: 900,
    ...settings.webui,
  };

  const bindings: Record<string, (...args: unknown[]) => unknown> = {
    ...(createDefaultBindings() as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >),
    ...settings.bindings,
  };

  const launcher = new WebUILauncher({ config, url, bindings });

  return new WebuiApplication(launcher);
}
