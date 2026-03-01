/**
 * Alexi WebUI Build Command
 *
 * Packages the desktop application for distribution.
 * Creates native executables for Windows, macOS, and Linux.
 *
 * @module alexi_webui/commands/build
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

type BuildTarget = "windows" | "macos" | "linux";

// =============================================================================
// BuildCommand
// =============================================================================

/**
 * Desktop Build Command
 *
 * Packages the desktop application for distribution.
 * Creates native executables using Deno compile and WebUI.
 *
 * @example
 * ```bash
 * deno run -A manage.ts build --settings desktop
 * deno run -A manage.ts build --settings desktop --target windows
 * deno run -A manage.ts build --settings desktop --target macos
 * deno run -A manage.ts build --settings desktop --target linux
 * ```
 */
export class BuildCommand extends BaseCommand {
  readonly name = "build";
  readonly help = "Package desktop application for distribution";
  override readonly description =
    "Builds a standalone desktop application executable. " +
    "Bundles the UI, WebUI runtime, and creates a native binary.";

  override readonly examples = [
    "manage.ts build --settings desktop                  - Build for current OS",
    "manage.ts build --settings desktop --target windows - Build .exe (Windows)",
    "manage.ts build --settings desktop --target macos   - Build .app (macOS)",
    "manage.ts build --settings desktop --target linux   - Build AppImage (Linux)",
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
      help: "Target OS: windows, macos, linux (defaults to current OS)",
    });

    parser.addArgument("--output", {
      type: "string",
      alias: "-o",
      help: "Output directory for the built application",
    });

    parser.addArgument("--name", {
      type: "string",
      help: "Application name (defaults to settings title)",
    });

    parser.addArgument("--icon", {
      type: "string",
      help: "Path to application icon",
    });

    parser.addArgument("--version", {
      type: "string",
      help: "Application version",
    });
  }

  // ==========================================================================
  // Main Handler
  // ==========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const settingsName = options.args.settings as string;
    const targetArg = options.args.target as BuildTarget | undefined;
    const outputDir = (options.args.output as string) ?? "./dist";
    const appName = options.args.name as string | undefined;
    const iconPath = options.args.icon as string | undefined;
    const appVersion = (options.args.version as string) ?? "1.0.0";

    try {
      // Determine target
      const target = targetArg ?? this.getCurrentTarget();

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

      // Get configuration from settings
      const webUIConfig = (settings.WEBUI ?? settings.DESKTOP ?? {}) as Record<
        string,
        unknown
      >;

      const config = {
        name: appName ?? (webUIConfig.title as string) ?? "AlexiApp",
        version: appVersion,
        icon: iconPath ?? (webUIConfig.icon as string),
        target,
        outputDir,
      };

      // Print banner
      this.printBanner(config);

      // TODO: Implement actual build process
      // For now, this is a placeholder that explains what would happen

      this.warn("⚠️  Desktop build is not yet implemented.");
      this.info("");
      this.info("The build process would:");
      this.info("  1. Bundle the UI application (bundle command)");
      this.info("  2. Compile the desktop entry point with Deno compile");
      this.info("  3. Include WebUI runtime and static assets");
      this.info(`  4. Create executable for ${target}`);
      this.info(`  5. Output to ${outputDir}/`);
      this.info("");
      this.info("Expected output:");
      this.info(`  ${this.getOutputFileName(config.name, target)}`);
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

  private getCurrentTarget(): BuildTarget {
    switch (Deno.build.os) {
      case "windows":
        return "windows";
      case "darwin":
        return "macos";
      default:
        return "linux";
    }
  }

  private getOutputFileName(name: string, target: BuildTarget): string {
    const safeName = name.toLowerCase().replace(/\s+/g, "-");

    switch (target) {
      case "windows":
        return `${safeName}.exe`;
      case "macos":
        return `${safeName}.app`;
      case "linux":
        return `${safeName}.AppImage`;
    }
  }

  private printBanner(config: {
    name: string;
    version: string;
    target: BuildTarget;
    outputDir: string;
  }): void {
    const lines = [
      "",
      "┌─────────────────────────────────────────────┐",
      "│           Alexi Desktop Builder             │",
      "└─────────────────────────────────────────────┘",
      "",
      "Configuration:",
      `  Application:   ${config.name}`,
      `  Version:       ${config.version}`,
      `  Target:        ${config.target}`,
      `  Output:        ${config.outputDir}/`,
      "",
    ];

    this.stdout.log(lines.join("\n"));
  }
}
