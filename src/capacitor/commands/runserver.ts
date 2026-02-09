/**
 * Alexi Capacitor RunServer Command
 *
 * Runs the mobile application on a simulator/emulator.
 * This is a wrapper around `npx cap run`.
 *
 * @module alexi_capacitor/commands/runserver
 */

import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";

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

// =============================================================================
// Types
// =============================================================================

type MobileTarget = "ios" | "android";

// =============================================================================
// RunServerCommand
// =============================================================================

/**
 * Capacitor RunServer Command
 *
 * Launches the mobile application on iOS simulator or Android emulator.
 *
 * @example
 * ```bash
 * deno run -A manage.ts runserver --settings mobile --target ios
 * deno run -A manage.ts runserver --settings mobile --target android
 * ```
 */
export class RunServerCommand extends BaseCommand {
  readonly name = "runserver";
  readonly help = "Run mobile app on simulator/emulator";
  override readonly description =
    "Launches the mobile application on an iOS simulator or Android emulator. " +
    "Requires Xcode (iOS) or Android Studio (Android) to be installed.";

  override readonly examples = [
    "manage.ts runserver --settings mobile --target ios      - Run on iOS simulator",
    "manage.ts runserver --settings mobile --target android  - Run on Android emulator",
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

    parser.addArgument("--target", {
      type: "string",
      alias: "-t",
      help: "Target platform: ios, android",
      required: true,
    });

    parser.addArgument("--device", {
      type: "string",
      alias: "-d",
      help: "Specific device/simulator ID to run on",
    });

    parser.addArgument("--live-reload", {
      type: "boolean",
      default: false,
      help: "Enable live reload during development",
    });
  }

  // ==========================================================================
  // Main Handler
  // ==========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const settingsName = options.args.settings as string;
    const target = options.args.target as MobileTarget;
    const device = options.args.device as string | undefined;
    const liveReload = options.args["live-reload"] as boolean;

    try {
      // Validate target
      if (target !== "ios" && target !== "android") {
        this.error(`Invalid target: ${target}. Must be 'ios' or 'android'.`);
        return failure("Invalid target");
      }

      // Load settings
      const settingsPath = `${Deno.cwd()}/project/${settingsName}.settings.ts`;
      let settings: Record<string, unknown>;

      try {
        const settingsUrl = toImportUrl(settingsPath);
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

      this.printBanner(capacitorConfig, target, device, liveReload);

      // TODO: Implement actual run process
      // This would run: npx cap run ios/android

      this.warn("⚠️  Capacitor run is not yet implemented.");
      this.info("");
      this.info("The run process would:");
      this.info("  1. Ensure the web bundle is synced (sync command)");
      this.info(
        `  2. Launch ${
          target === "ios" ? "iOS Simulator" : "Android Emulator"
        }`,
      );
      this.info("  3. Install and run the app on the device");
      if (liveReload) {
        this.info("  4. Enable live reload for development");
      }
      this.info("");
      this.info("Manual workaround:");
      this.info(
        `  npx cap run ${target}${device ? ` --target ${device}` : ""}`,
      );
      this.info("");

      return success();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Run failed: ${message}`);
      return failure(message);
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private printBanner(
    config: Record<string, unknown>,
    target: MobileTarget,
    device: string | undefined,
    liveReload: boolean,
  ): void {
    const appId = (config.appId as string) ?? "com.example.app";
    const appName = (config.appName as string) ?? "My App";

    const lines = [
      "",
      "┌─────────────────────────────────────────────┐",
      "│          Alexi Capacitor RunServer          │",
      "└─────────────────────────────────────────────┘",
      "",
      "Configuration:",
      `  App ID:        ${appId}`,
      `  App Name:      ${appName}`,
      `  Target:        ${target}`,
      `  Device:        ${device ?? "default"}`,
      `  Live Reload:   ${liveReload ? "enabled" : "disabled"}`,
      "",
    ];

    this.stdout.log(lines.join("\n"));
  }
}
