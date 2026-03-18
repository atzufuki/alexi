/**
 * Alexi Static Files RunServer Command
 *
 * Django-style shadowing: this `RunServerCommand` subclasses and wraps the
 * core `RunServerCommand` from `@alexi/core`. When `StaticfilesConfig` is
 * listed in `INSTALLED_APPS`, the management system discovers this command
 * via `commands/mod.ts` and registers it under the name `"runserver"`,
 * replacing the base command — exactly as `django.contrib.staticfiles` ships
 * its own `runserver` that subclasses `django.core.management.commands.runserver`.
 *
 * This command adds:
 * - Frontend bundling via `BundleCommand` (with HMR in watch mode)
 * - Static file serving via `staticFilesMiddleware`
 * - A `--no-bundle` flag to skip bundling
 *
 * Usage:
 *   deno run -A manage.ts runserver --settings ./project/settings.ts
 *
 * @module @alexi/staticfiles/commands/runserver
 */

import { RunServerCommand as CoreRunServerCommand } from "@alexi/core/management";
import type { IArgumentParser, RunServerConfig } from "@alexi/core/management";
import { mediaFilesMiddleware, staticFilesMiddleware } from "../middleware.ts";
import type { MiddlewareClass } from "@alexi/middleware";
import { BundleCommand } from "./bundle.ts";

// =============================================================================
// RunServerCommand (staticfiles subclass)
// =============================================================================

/**
 * Static-files–aware `runserver` management command.
 *
 * Subclasses the core `RunServerCommand` and adds static file serving and
 * frontend bundling, mirroring the Django pattern where
 * `django.contrib.staticfiles` ships its own `runserver` that wraps the core
 * handler with `StaticFilesHandler`.
 *
 * When `StaticfilesConfig` is included in `INSTALLED_APPS`, the Alexi
 * management system discovers this command and registers it as `"runserver"`,
 * shadowing the bare core command.
 *
 * Additional CLI arguments over the base command:
 * - `--no-bundle` — skip frontend bundling (useful when assets are pre-built)
 *
 * @example
 * ```bash
 * deno run -A manage.ts runserver --settings ./project/settings.ts
 * deno run -A manage.ts runserver --settings ./project/settings.ts --no-bundle
 * ```
 *
 * @category Management
 */
export class RunServerCommand extends CoreRunServerCommand {
  override readonly help = "Start web server with static files and bundling";
  override readonly description =
    "Starts a Django-style web server that serves the REST API, admin panel, " +
    "and static files. Frontend TypeScript is bundled via esbuild with HMR support.";

  override readonly examples = [
    "manage.ts runserver --settings ./project/settings.ts          - Start web server",
    "manage.ts runserver --settings ./project/settings.ts -p 3000  - Start on port 3000",
    "manage.ts runserver --settings ./project/settings.ts --no-bundle - Skip bundling",
  ];

  // ==========================================================================
  // Arguments
  // ==========================================================================

  override addArguments(parser: IArgumentParser): void {
    super.addArguments(parser);

    parser.addArgument("--no-bundle", {
      type: "boolean",
      default: false,
      help: "Skip frontend bundling (useful when assets are pre-built)",
    });
  }

  // ==========================================================================
  // Extension Hooks
  // ==========================================================================

  /**
   * Start the frontend bundler and, if `--no-reload` is not set, watch for
   * changes with HMR support.
   *
   * Overrides the no-op base implementation. Returns an HMR SSE response
   * factory that the base `startServer` wires into the HMR URL endpoint.
   *
   * @param settings     - The loaded settings module.
   * @param settingsPath - Absolute path to the settings file (passed through
   *                       to `BundleCommand.bundleAndWatch` so only the active
   *                       settings file's apps are bundled).
   * @returns HMR response factory, or `undefined` when `--no-bundle` is set.
   */
  protected override async startBundler(
    settings: Record<string, unknown>,
    settingsPath: string,
  ): Promise<(() => Response) | undefined> {
    // Respect the --no-bundle flag stored on this instance.
    // Access via the parsed options stored during handle() execution.
    const noBundle = this._noBundle;
    if (noBundle) {
      return undefined;
    }

    // Check SKIP_BUNDLE env var (CI-friendly opt-out)
    if (Deno.env.get("SKIP_BUNDLE") === "1") {
      this.info("Skipping bundling (SKIP_BUNDLE=1)");
      return undefined;
    }

    // Check whether this settings context has anything to bundle
    const assetfilesDirs = settings.ASSETFILES_DIRS;
    if (!Array.isArray(assetfilesDirs) || assetfilesDirs.length === 0) {
      return undefined;
    }

    try {
      const bundleCmd = new BundleCommand();
      bundleCmd.setConsole(this.stdout, this.stderr);
      this.bundler = bundleCmd;

      this.info("Bundling frontend...");

      const result = await bundleCmd.bundleAndWatch({
        settingsPath,
      });

      if (!result.success) {
        this.warn(`Bundling failed: ${result.error}`);
        return undefined;
      }

      return () => bundleCmd.createHmrResponse();
    } catch (error) {
      this.warn(`Bundling failed: ${error}`);
      return undefined;
    }
  }

  /**
   * Return static-file middleware to prepend to the application middleware
   * stack, populated with the app names and paths already collected from
   * `INSTALLED_APPS` by the base class during `loadInstalledApps()`.
   *
   * @param settings - The loaded settings module.
   * @returns Array containing one `staticFilesMiddleware` instance.
   */
  protected override async getExtraMiddleware(
    settings: Record<string, unknown>,
    _config: RunServerConfig,
  ): Promise<MiddlewareClass[]> {
    // this.appNames / this.appPaths are populated by the base class inside
    // startServer() → loadInstalledApps() before this hook is called.
    if (this.appNames.length === 0) {
      return [];
    }

    const staticUrl = (settings.STATIC_URL as string | undefined) ?? "/static/";
    const staticRoot = settings.STATIC_ROOT as string | undefined;
    const debug = true; // dev server is always debug

    const middleware: MiddlewareClass[] = [
      staticFilesMiddleware({
        installedApps: this.appNames,
        appPaths: this.appPaths,
        projectRoot: this.projectRoot,
        staticUrl,
        staticRoot,
        debug,
      }),
    ];

    // Automatically serve MEDIA_URL → MEDIA_ROOT in development
    const mediaRoot = settings.MEDIA_ROOT as string | undefined;
    if (mediaRoot) {
      const mediaUrl = (settings.MEDIA_URL as string | undefined) ?? "/media/";
      middleware.push(mediaFilesMiddleware({ mediaRoot, mediaUrl }));
    }

    return middleware;
  }

  // ==========================================================================
  // Internal state for --no-bundle flag
  // ==========================================================================

  /**
   * Cached `--no-bundle` value from the current `handle()` invocation.
   * Set before `super.handle()` is called so it is available in `startBundler`.
   * @internal
   */
  private _noBundle = false;

  override async handle(
    options: Parameters<CoreRunServerCommand["handle"]>[0],
  ): ReturnType<CoreRunServerCommand["handle"]> {
    this._noBundle = (options.args["no-bundle"] as boolean) ?? false;
    return super.handle(options);
  }
}
