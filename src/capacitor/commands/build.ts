/**
 * Alexi Capacitor Build Command
 *
 * Builds the mobile application for distribution.
 * Creates production builds for iOS App Store and Google Play Store.
 *
 * @module alexi_capacitor/commands/build
 */

import { BaseCommand, failure, success } from "@alexi/core/management";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core/management";

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
// BuildCommand
// =============================================================================

/**
 * Capacitor Build Command
 *
 * Creates production builds for app store distribution.
 *
 * @example
 * ```bash
 * deno run -A manage.ts build --settings mobile --target ios
 * deno run -A manage.ts build --settings mobile --target android
 * ```
 */
export class BuildCommand extends BaseCommand {
  readonly name = "build";
  readonly help = "Build mobile app for distribution";
  override readonly description =
    "Creates production builds for iOS App Store (.ipa) or " +
    "Google Play Store (.apk/.aab). Requires Xcode (iOS) or " +
    "Android Studio (Android) to be installed.";

  override readonly examples = [
    "manage.ts build --settings mobile --target ios      - Build .ipa for App Store",
    "manage.ts build --settings mobile --target android  - Build .aab for Play Store",
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

    parser.addArgument("--release", {
      type: "boolean",
      default: true,
      help: "Build in release mode (default: true)",
    });

    parser.addArgument("--output", {
      type: "string",
      alias: "-o",
      help: "Output directory for the built application",
    });

    parser.addArgument("--signing", {
      type: "string",
      help:
        "Path to signing configuration (keystore for Android, provisioning profile for iOS)",
    });
  }

  // ==========================================================================
  // Main Handler
  // ==========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const settingsName = options.args.settings as string;
    const target = options.args.target as MobileTarget;
    const releaseMode = options.args.release as boolean;
    const outputDir = (options.args.output as string) ?? "./dist";
    const signingConfig = options.args.signing as string | undefined;

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

      this.printBanner(
        capacitorConfig,
        target,
        releaseMode,
        outputDir,
        signingConfig,
      );

      // TODO: Implement actual build process
      // This would run: npx cap build ios/android

      this.warn("⚠️  Capacitor build is not yet implemented.");
      this.info("");
      this.info("The build process would:");
      this.info("  1. Ensure the web bundle is synced (sync command)");
      this.info(
        `  2. Build ${target === "ios" ? "iOS" : "Android"} native project`,
      );
      if (target === "ios") {
        this.info("  3. Archive and export .ipa for App Store");
        this.info("  4. Sign with provisioning profile");
      } else {
        this.info("  3. Build signed .aab for Play Store");
        this.info("  4. Sign with keystore");
      }
      this.info(`  5. Output to ${outputDir}/`);
      this.info("");
      this.info("Expected output:");
      this.info(`  ${this.getOutputFileName(capacitorConfig, target)}`);
      this.info("");
      this.info("Manual workaround:");
      if (target === "ios") {
        this.info("  Open ios/App/App.xcworkspace in Xcode and archive");
      } else {
        this.info(
          "  Open android/ in Android Studio and Build > Generate Signed Bundle",
        );
      }
      this.info("");

      return success();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Build failed: ${message}`);
      return failure(message);
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getOutputFileName(
    config: Record<string, unknown>,
    target: MobileTarget,
  ): string {
    const appName = (config.appName as string) ?? "app";
    const safeName = appName.toLowerCase().replace(/\s+/g, "-");

    switch (target) {
      case "ios":
        return `${safeName}.ipa`;
      case "android":
        return `${safeName}.aab`;
    }
  }

  private printBanner(
    config: Record<string, unknown>,
    target: MobileTarget,
    releaseMode: boolean,
    outputDir: string,
    signingConfig: string | undefined,
  ): void {
    const appId = (config.appId as string) ?? "com.example.app";
    const appName = (config.appName as string) ?? "My App";
    const version = (config.version as string) ?? "1.0.0";

    const lines = [
      "",
      "┌─────────────────────────────────────────────┐",
      "│           Alexi Capacitor Builder           │",
      "└─────────────────────────────────────────────┘",
      "",
      "Configuration:",
      `  App ID:        ${appId}`,
      `  App Name:      ${appName}`,
      `  Version:       ${version}`,
      `  Target:        ${target}`,
      `  Mode:          ${releaseMode ? "release" : "debug"}`,
      `  Output:        ${outputDir}/`,
      `  Signing:       ${signingConfig ?? "not configured"}`,
      "",
    ];

    this.stdout.log(lines.join("\n"));
  }
}
