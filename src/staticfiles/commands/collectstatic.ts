/**
 * CollectStatic Command for Alexi Static Files
 *
 * Django-style command that collects static files from all apps
 * into a single STATIC_ROOT directory.
 *
 * @module @alexi/staticfiles/commands/collectstatic
 */

import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";
import type { AppConfig } from "@alexi/types";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a file path to a file:// URL string for dynamic import.
 * Only used for loading settings files.
 */
function toImportUrl(filePath: string): string {
  let normalized = filePath.replace(/\\/g, "/");

  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }

  if (/^[a-zA-Z]:/.test(normalized)) {
    return `file:///${normalized}`;
  }

  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }

  const cwd = Deno.cwd().replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(cwd)) {
    return `file:///${cwd}/${normalized}`;
  }
  return `file://${cwd}/${normalized}`;
}

/**
 * Import function type for apps.
 */
type AppImportFn = () => Promise<{ default?: AppConfig; [key: string]: unknown }>;

// =============================================================================
// Types
// =============================================================================

/**
 * Result of collecting static files from a single app
 */
interface CollectResult {
  appName: string;
  filesCopied: number;
  errors: string[];
}

// =============================================================================
// CollectStaticCommand Class
// =============================================================================

/**
 * Built-in command for collecting static files
 *
 * This command:
 * 1. Reads INSTALLED_APPS from project settings
 * 2. Finds each app's static directory
 * 3. Copies all static files to STATIC_ROOT
 *
 * @example Command line usage
 * ```bash
 * # Collect all static files
 * deno run -A manage.ts collectstatic
 *
 * # Collect without confirmation
 * deno run -A manage.ts collectstatic --no-input
 *
 * # Clear STATIC_ROOT before collecting
 * deno run -A manage.ts collectstatic --clear
 *
 * # Dry run (show what would be copied)
 * deno run -A manage.ts collectstatic --dry-run
 * ```
 */
export class CollectStaticCommand extends BaseCommand {
  readonly name = "collectstatic";
  readonly help = "Collect static files to STATIC_ROOT directory";
  override readonly description =
    "Reads INSTALLED_APPS and copies each app's static directory " +
    "contents to the STATIC_ROOT directory. This is intended for production use.";

  override readonly examples = [
    "manage.ts collectstatic              - Collect all static files",
    "manage.ts collectstatic --no-input   - Do not prompt for confirmation",
    "manage.ts collectstatic --clear      - Clear STATIC_ROOT first",
    "manage.ts collectstatic --dry-run    - Show what would be copied",
  ];

  /**
   * Project root directory
   */
  private projectRoot: string = Deno.cwd();

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("--settings", {
      type: "string",
      alias: "-s",
      help:
        "Settings module to use (e.g., 'web', 'desktop'). Loads project/<name>.settings.ts",
      default: "web",
    });

    parser.addArgument("--no-input", {
      type: "boolean",
      default: false,
      help: "Do not prompt for confirmation",
    });

    parser.addArgument("--clear", {
      type: "boolean",
      default: false,
      alias: "-c",
      help: "Clear STATIC_ROOT before copying",
    });

    parser.addArgument("--dry-run", {
      type: "boolean",
      default: false,
      alias: "-n",
      help: "Show what would be copied, do not copy",
    });

    parser.addArgument("--link", {
      type: "boolean",
      default: false,
      alias: "-l",
      help: "Create symbolic links instead of copying",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const settingsArg = options.args.settings as string;
    const noInput = options.args["no-input"] as boolean;
    const clear = options.args.clear as boolean;
    const dryRun = options.args["dry-run"] as boolean;
    const useLinks = options.args.link as boolean;
    const debug = options.debug;

    try {
      // Load settings from specified module
      this.info(`Loading settings: ${settingsArg}.settings.ts`);
      const settings = await this.loadSettings(settingsArg);
      if (!settings) {
        return failure("Failed to load settings");
      }

      const staticRoot = settings.staticRoot;

      // Find apps with static directories
      const appsWithStatic = await this.findAppsWithStatic(settings);

      if (appsWithStatic.length === 0) {
        this.warn("No apps found with static directory");
        return success();
      }

      // Count total files
      let totalFiles = 0;
      for (const app of appsWithStatic) {
        totalFiles += await this.countFiles(app.staticDir);
      }

      // Print banner
      this.printBanner(appsWithStatic, staticRoot, {
        clear,
        dryRun,
        useLinks,
        totalFiles,
      });

      // Ask for confirmation if needed
      if (!noInput && !dryRun) {
        const confirmed = await this.confirm(
          `Copy ${totalFiles} files to '${staticRoot}'?`,
        );
        if (!confirmed) {
          this.info("Cancelled.");
          return success();
        }
      }

      // Clear STATIC_ROOT if requested
      if (clear && !dryRun) {
        await this.clearStaticRoot(staticRoot);
      }

      // Ensure STATIC_ROOT exists
      if (!dryRun) {
        await Deno.mkdir(staticRoot, { recursive: true });
      }

      // Collect static files from all apps
      const results: CollectResult[] = [];

      for (const app of appsWithStatic) {
        const result = await this.collectFromApp(app, staticRoot, {
          dryRun,
          useLinks,
          debug,
        });
        results.push(result);
      }

      // Print results
      this.printResults(results, dryRun);

      // Check for errors
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
      if (totalErrors > 0) {
        return failure(`${totalErrors} error(s) during copying`);
      }

      const totalCopied = results.reduce((sum, r) => sum + r.filesCopied, 0);
      if (dryRun) {
        return success(`${totalCopied} files would be copied`);
      }

      return success(
        `${totalCopied} files copied to '${staticRoot}'`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Collection failed: ${message}`);
      return failure(message);
    }
  }

  // ===========================================================================
  // Settings Loading
  // ===========================================================================

  /**
   * Load project settings from specified settings module.
   * Collects import functions from INSTALLED_APPS.
   */
  private async loadSettings(settingsName: string): Promise<
    {
      importFunctions: AppImportFn[];
      staticRoot: string;
    } | null
  > {
    try {
      // Load deployment-specific settings (e.g., web.settings.ts, desktop.settings.ts)
      const settingsPath =
        `${this.projectRoot}/project/${settingsName}.settings.ts`;
      const settingsUrl = toImportUrl(settingsPath);
      const settings = await import(settingsUrl);

      // Collect import functions from INSTALLED_APPS
      const importFunctions: AppImportFn[] = [];
      const installedApps = settings.INSTALLED_APPS ?? [];

      for (const app of installedApps) {
        if (typeof app === "function") {
          importFunctions.push(app as AppImportFn);
        }
      }

      return {
        importFunctions,
        staticRoot: settings.STATIC_ROOT ?? "./static",
      };
    } catch (error) {
      this.error(`Failed to load settings: ${error}`);
      this.info(
        `Make sure the file project/${settingsName}.settings.ts exists`,
      );
      return null;
    }
  }

  // ===========================================================================
  // App Discovery
  // ===========================================================================

  /**
   * Find apps that have static directories.
   * Calls each import function to get the app module.
   */
  private async findAppsWithStatic(settings: {
    importFunctions: AppImportFn[];
    staticRoot: string;
  }): Promise<
    Array<{ name: string; path: string; staticDir: string; config?: AppConfig }>
  > {
    const apps: Array<
      { name: string; path: string; staticDir: string; config?: AppConfig }
    > = [];

    for (const importFn of settings.importFunctions) {
      try {
        // Call the user's import function
        const module = await importFn();
        const config = module.default as AppConfig | undefined;

        if (!config) {
          continue;
        }

        // Get app path from config or derive from name
        const appPath = config.staticDir
          ? `./src/${config.name}`
          : `./src/${config.name}`;
        const appPathNormalized = appPath.replace(/^\.\//, "");
        const appDir = `${this.projectRoot}/${appPathNormalized}`;

        // Get static directory from config
        const staticDirRel = config.staticDir
          ? config.staticDir.replace(/^\.\//, "")
          : "static";

        const staticDir = `${appDir}/${staticDirRel}`;

        // Check if static directory exists
        try {
          const stat = await Deno.stat(staticDir);
          if (stat.isDirectory) {
            apps.push({ name: config.name, path: appPath, staticDir, config });
        }
      } catch {
        // Directory doesn't exist, skip
      }
    }

    return apps;
  }

  // ===========================================================================
  // File Operations
  // ===========================================================================

  /**
   * Count files in a directory recursively
   */
  private async countFiles(dir: string): Promise<number> {
    let count = 0;

    try {
      for await (const entry of Deno.readDir(dir)) {
        if (entry.isFile) {
          // Skip hidden files
          if (!entry.name.startsWith(".")) {
            count++;
          }
        } else if (entry.isDirectory) {
          count += await this.countFiles(`${dir}/${entry.name}`);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return count;
  }

  /**
   * Clear STATIC_ROOT directory
   */
  private async clearStaticRoot(staticRoot: string): Promise<void> {
    try {
      await Deno.remove(staticRoot, { recursive: true });
      this.info(`Cleared: ${staticRoot}`);
    } catch {
      // Directory doesn't exist, that's fine
    }
  }

  /**
   * Collect static files from a single app
   */
  private async collectFromApp(
    app: { name: string; path: string; staticDir: string },
    staticRoot: string,
    options: { dryRun: boolean; useLinks: boolean; debug: boolean },
  ): Promise<CollectResult> {
    const result: CollectResult = {
      appName: app.name,
      filesCopied: 0,
      errors: [],
    };

    try {
      await this.copyDirectory(
        app.staticDir,
        staticRoot,
        result,
        options,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(message);
    }

    return result;
  }

  /**
   * Copy a directory recursively
   */
  private async copyDirectory(
    srcDir: string,
    destRoot: string,
    result: CollectResult,
    options: { dryRun: boolean; useLinks: boolean; debug: boolean },
  ): Promise<void> {
    for await (const entry of Deno.readDir(srcDir)) {
      const srcPath = `${srcDir}/${entry.name}`;
      const destPath = `${destRoot}/${entry.name}`;

      // Skip hidden files
      if (entry.name.startsWith(".")) {
        continue;
      }

      if (entry.isFile) {
        if (options.dryRun) {
          if (options.debug) {
            this.stdout.log(`  [dry-run] ${srcPath} -> ${destPath}`);
          }
          result.filesCopied++;
        } else {
          try {
            // Ensure destination directory exists
            const destDir = destPath.substring(0, destPath.lastIndexOf("/"));
            await Deno.mkdir(destDir, { recursive: true });

            if (options.useLinks) {
              // Create symbolic link
              try {
                await Deno.remove(destPath);
              } catch {
                // File doesn't exist, that's fine
              }
              await Deno.symlink(srcPath, destPath);
            } else {
              // Copy file
              await Deno.copyFile(srcPath, destPath);
            }
            result.filesCopied++;
          } catch (error) {
            const message = error instanceof Error
              ? error.message
              : String(error);
            result.errors.push(`${entry.name}: ${message}`);
          }
        }
      } else if (entry.isDirectory) {
        // Recurse into subdirectory
        await this.copyDirectory(srcPath, destPath, result, options);
      }
    }
  }

  // ===========================================================================
  // User Interaction
  // ===========================================================================

  /**
   * Ask for user confirmation
   */
  private async confirm(message: string): Promise<boolean> {
    this.stdout.log(`${message} [y/N] `);

    const buf = new Uint8Array(1024);
    const n = await Deno.stdin.read(buf);

    if (n === null) {
      return false;
    }

    const answer = new TextDecoder().decode(buf.subarray(0, n)).trim()
      .toLowerCase();
    return answer === "y" || answer === "yes";
  }

  // ===========================================================================
  // Output
  // ===========================================================================

  /**
   * Print startup banner
   */
  private printBanner(
    apps: Array<{ name: string; path: string; staticDir: string }>,
    staticRoot: string,
    options: {
      clear: boolean;
      dryRun: boolean;
      useLinks: boolean;
      totalFiles: number;
    },
  ): void {
    const lines: string[] = [];

    lines.push("┌─────────────────────────────────────────────┐");
    lines.push("│           Alexi CollectStatic               │");
    lines.push("└─────────────────────────────────────────────┘");
    lines.push("");
    lines.push("Configuration:");
    lines.push(`  STATIC_ROOT:       ${staticRoot}`);
    lines.push(`  Clear first:       ${options.clear ? "Yes" : "No"}`);
    lines.push(`  Dry-run:           ${options.dryRun ? "Yes" : "No"}`);
    lines.push(`  Symbolic links:    ${options.useLinks ? "Yes" : "No"}`);
    lines.push("");
    lines.push(`Found ${apps.length} apps with static directory:`);
    for (const app of apps) {
      lines.push(`  - ${app.name} (${app.staticDir})`);
    }
    lines.push("");
    lines.push(`Total ${options.totalFiles} files.`);
    lines.push("");

    this.stdout.log(lines.join("\n"));
  }

  /**
   * Print collection results
   */
  private printResults(results: CollectResult[], dryRun: boolean): void {
    console.log("");

    for (const result of results) {
      if (result.errors.length > 0) {
        this.error(`${result.appName}: ${result.errors.length} errors`);
        for (const err of result.errors) {
          this.stdout.log(`    ${err}`);
        }
      } else {
        const verb = dryRun ? "would be copied" : "copied";
        this.success(
          `${result.appName}: ${result.filesCopied} files ${verb}`,
        );
      }
    }
  }
}
