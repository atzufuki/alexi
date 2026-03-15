/**
 * getCapacitorApplication() factory for mobile applications.
 *
 * Provides the Capacitor equivalent of `getHttpApplication()` from `@alexi/core`.
 * Call this in `project/capacitor.ts` to configure and obtain a
 * {@link CapacitorApplication} that wraps the web bundle in native iOS and
 * Android shells via the Capacitor CLI.
 *
 * @module
 */

// =============================================================================
// Settings Interface
// =============================================================================

/**
 * Live-reload server configuration for development.
 *
 * When set, Capacitor passes `url` to the native shell so the app loads
 * from the dev server instead of the bundled assets. Remove in production.
 */
export interface CapacitorServerConfig {
  /**
   * Dev-server URL for live-reload (e.g. `"http://192.168.1.10:8000"`).
   *
   * Must be reachable from the simulator/device on your local network.
   */
  url?: string;
}

/**
 * Settings accepted by {@link getCapacitorApplication}.
 *
 * These map directly to [Capacitor's configuration schema](https://capacitorjs.com/docs/config).
 * `project/capacitor.ts` is the single source of truth — at sync time the
 * factory serialises these settings to `capacitor.config.json` so the native
 * tooling picks them up automatically.
 *
 * @example
 * ```ts
 * const app = await getCapacitorApplication({
 *   appId: "com.example.myapp",
 *   appName: "MyApp",
 *   webDir: "dist",
 * });
 * await app.sync();
 * ```
 */
export interface GetCapacitorApplicationSettings {
  /**
   * Reverse-domain bundle identifier (e.g. `"com.example.myapp"`).
   *
   * Used as the iOS Bundle ID and Android Application ID. Must be unique
   * in the respective app stores.
   */
  appId: string;

  /**
   * Human-readable application name shown on the device home screen.
   */
  appName: string;

  /**
   * Output directory that contains the compiled web bundle.
   *
   * Capacitor copies the contents of this directory into the native projects
   * during sync. Defaults to `"dist"`.
   *
   * @default "dist"
   */
  webDir?: string;

  /**
   * Live-reload server configuration (development only).
   *
   * Omit in production builds.
   */
  server?: CapacitorServerConfig;

  /**
   * Capacitor plugin configuration keyed by plugin package name.
   *
   * @example
   * ```ts
   * plugins: {
   *   SplashScreen: { launchShowDuration: 0 },
   *   PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
   * }
   * ```
   */
  plugins?: Record<string, unknown>;
}

/**
 * The resolved Capacitor configuration written to `capacitor.config.json`.
 *
 * Returned by {@link CapacitorApplication.getConfig} and written to disk
 * before every sync or run operation.
 */
export interface CapacitorConfig {
  /** Reverse-domain bundle identifier. */
  appId: string;
  /** Human-readable application name. */
  appName: string;
  /** Web bundle output directory. */
  webDir: string;
  /** Optional live-reload server config. */
  server?: CapacitorServerConfig;
  /** Optional Capacitor plugin configuration. */
  plugins?: Record<string, unknown>;
}

// =============================================================================
// CapacitorApplication
// =============================================================================

/**
 * A configured mobile application returned by {@link getCapacitorApplication}.
 *
 * Wraps the [Capacitor CLI](https://capacitorjs.com/docs/cli) via
 * `Deno.Command`. The factory writes `capacitor.config.json` before each
 * operation so the native tooling always uses the latest settings.
 *
 * @example
 * ```ts
 * const app = await getCapacitorApplication({
 *   appId: "com.example.myapp",
 *   appName: "MyApp",
 * });
 *
 * // Sync web bundle to native projects
 * await app.sync();
 *
 * // Run on iOS simulator
 * await app.run("ios");
 * ```
 */
export class CapacitorApplication {
  readonly #config: CapacitorConfig;

  /** @internal */
  constructor(config: CapacitorConfig) {
    this.#config = config;
  }

  /**
   * Returns the resolved {@link CapacitorConfig} for this application.
   *
   * This is the configuration that will be written to `capacitor.config.json`
   * before each sync or run operation.
   */
  getConfig(): CapacitorConfig {
    return { ...this.#config };
  }

  /**
   * Write `capacitor.config.json` and sync the web bundle to native projects.
   *
   * Equivalent to running `npx cap sync` after a web build. Copies the
   * contents of `webDir` into `ios/App/App/public/` and
   * `android/app/src/main/assets/public/` and updates native dependencies.
   *
   * @throws {Error} If the Capacitor CLI (`npx cap sync`) exits with a
   *   non-zero status code.
   */
  async sync(): Promise<void> {
    await this.#writeConfig();
    await this.#run(["cap", "sync"]);
  }

  /**
   * Write `capacitor.config.json` and launch the app on a simulator or device.
   *
   * Equivalent to running `npx cap run <target>`. Opens Xcode / Android Studio
   * automatically when required.
   *
   * @param target - Platform to target: `"ios"` (default) or `"android"`.
   * @throws {Error} If the Capacitor CLI (`npx cap run`) exits with a
   *   non-zero status code.
   */
  async run(target: "ios" | "android" = "ios"): Promise<void> {
    await this.#writeConfig();
    await this.#run(["cap", "run", target]);
  }

  /**
   * Serialise settings to `capacitor.config.json` in the current working
   * directory so the Capacitor CLI and native tooling pick them up.
   */
  async #writeConfig(): Promise<void> {
    await Deno.writeTextFile(
      "capacitor.config.json",
      JSON.stringify(this.#config, null, 2) + "\n",
    );
  }

  /**
   * Execute an npx command and stream its output to stdout/stderr.
   *
   * @param args - Arguments passed after `npx` (e.g. `["cap", "sync"]`).
   */
  async #run(args: string[]): Promise<void> {
    const cmd = new Deno.Command("npx", {
      args,
      stdout: "inherit",
      stderr: "inherit",
    });
    const { code } = await cmd.output();
    if (code !== 0) {
      throw new Error(`npx ${args.join(" ")} exited with code ${code}`);
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Configure and return a {@link CapacitorApplication} for a mobile entry point.
 *
 * This is the Capacitor counterpart to `getHttpApplication()` from
 * `@alexi/core`. Use it in `project/capacitor.ts` to manage the Capacitor
 * native projects:
 *
 * ```ts
 * // project/capacitor.ts
 * import { getCapacitorApplication } from "@alexi/capacitor";
 *
 * const app = await getCapacitorApplication({
 *   appId: "com.example.myapp",
 *   appName: "MyApp",
 *   webDir: "dist",
 * });
 *
 * const command = Deno.args[0];
 * if (command === "sync") {
 *   await app.sync();
 * } else if (command === "run") {
 *   const target = Deno.args[1] ?? "ios";
 *   await app.run(target as "ios" | "android");
 * }
 * ```
 *
 * The factory resolves defaults (e.g. `webDir → "dist"`) and constructs a
 * {@link CapacitorApplication} wrapping the Capacitor CLI.
 *
 * @param settings - Required app identity (`appId`, `appName`) plus optional
 *   `webDir`, `server`, and `plugins` configuration.
 * @returns A configured {@link CapacitorApplication}.
 *
 * @example Minimal usage
 * ```ts
 * const app = await getCapacitorApplication({
 *   appId: "com.example.myapp",
 *   appName: "MyApp",
 * });
 * await app.sync(); // writes capacitor.config.json and runs `npx cap sync`
 * ```
 *
 * @example With live-reload server (development)
 * ```ts
 * const app = await getCapacitorApplication({
 *   appId: "com.example.myapp",
 *   appName: "MyApp",
 *   webDir: "dist",
 *   server: { url: "http://192.168.1.10:8000" },
 * });
 * await app.run("ios");
 * ```
 */
export async function getCapacitorApplication(
  settings: GetCapacitorApplicationSettings,
): Promise<CapacitorApplication> {
  const config: CapacitorConfig = {
    appId: settings.appId,
    appName: settings.appName,
    webDir: settings.webDir ?? "dist",
    ...(settings.server ? { server: settings.server } : {}),
    ...(settings.plugins ? { plugins: settings.plugins } : {}),
  };

  return new CapacitorApplication(config);
}
