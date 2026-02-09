/**
 * Alexi Capacitor Sync Command
 *
 * Syncs the web bundle to native iOS and Android projects.
 * This is a wrapper around `npx cap sync`.
 *
 * @module alexi_capacitor/commands/sync
 */

import { BaseCommand, failure, pathToFileUrl, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";

// =============================================================================
// SyncCommand
// =============================================================================

/**
 * Capacitor Sync Command
 *
 * Copies the web bundle to native projects and updates native dependencies.
 *
 * @example
 * ```bash
 * deno run -A manage.ts sync --settings mobile
 * ```
 */
export class SyncCommand extends BaseCommand {
  readonly name = "sync";
  readonly help = "Sync web bundle to native projects";
  override readonly description =
    "Copies the bundled web application to iOS and Android native projects. " +
    "Also updates native plugins and dependencies.";

  override readonly examples = [
    "manage.ts sync --settings mobile    - Sync to all platforms",
  ];

  // ==========================================================================
  // Arguments
  // ==========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("--settings", {
      type: "string",
      alias: "-s",
      help: "Settings module name",
      required: true,
    });
  }

  // ==========================================================================
  // Main Handler
  // ==========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const settingsName = options.args.settings as string;

    try {
      // Load settings
      const settingsPath = `${Deno.cwd()}/project/${settingsName}.settings.ts`;
      let settings: Record<string, unknown>;

      try {
        const settingsUrl = pathToFileUrl(settingsPath);
        settings = await import(settingsUrl);
      } catch (error) {
        this.error(`Could not load settings: ${settingsPath}`);
        throw error;
      }

      // Get Capacitor config from settings
      const capacitorConfig = (settings.CAPACITOR ?? {}) as Record<
        string,
        unknown
      >;

      this.printBanner(capacitorConfig);

      // TODO: Implement actual sync process
      // This would run: npx cap sync

      this.warn("⚠️  Capacitor sync is not yet implemented.");
      this.info("");
      this.info("The sync process would:");
      this.info("  1. Ensure the web bundle is built (bundle command)");
      this.info("  2. Copy web assets to ios/App/App/public/");
      this.info("  3. Copy web assets to android/app/src/main/assets/public/");
      this.info("  4. Update native dependencies (CocoaPods, Gradle)");
      this.info("");
      this.info("Manual workaround:");
      this.info("  npx cap sync");
      this.info("");

      return success();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Sync failed: ${message}`);
      return failure(message);
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private printBanner(config: Record<string, unknown>): void {
    const appId = (config.appId as string) ?? "com.example.app";
    const appName = (config.appName as string) ?? "My App";

    const lines = [
      "",
      "┌─────────────────────────────────────────────┐",
      "│           Alexi Capacitor Sync              │",
      "└─────────────────────────────────────────────┘",
      "",
      "Configuration:",
      `  App ID:        ${appId}`,
      `  App Name:      ${appName}`,
      "",
    ];

    this.stdout.log(lines.join("\n"));
  }
}
