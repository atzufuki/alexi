/**
 * Alexi WebUI RunServer Command
 *
 * Generic desktop runserver command that opens a WebUI window.
 * Uses settings configuration to determine window properties and URL.
 *
 * @module alexi_webui/commands/runserver
 */

import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";
import { WebUILauncher } from "../launcher.ts";
import { createDefaultBindings } from "../bindings.ts";

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
// RunServerCommand
// =============================================================================

/**
 * Desktop RunServer Command
 *
 * Opens a WebUI window for desktop applications.
 * Reads configuration from settings file.
 *
 * @example
 * ```bash
 * deno run -A --unstable-ffi manage.ts runserver --settings desktop
 * deno run -A --unstable-ffi manage.ts runserver --settings desktop --browser chrome
 * ```
 */
export class RunServerCommand extends BaseCommand {
  readonly name = "runserver";
  readonly help = "Open a desktop application window";
  override readonly description =
    "Opens a WebUI window for the desktop application. " +
    "Configure window properties and URL in the settings file.";

  override readonly examples = [
    "manage.ts runserver --settings desktop              - Open desktop window",
    "manage.ts runserver --settings desktop --browser chrome  - Use Chrome",
    "manage.ts runserver --settings desktop --kiosk      - Fullscreen mode",
    "manage.ts runserver --settings desktop --devtools   - Show DevTools",
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

    parser.addArgument("--browser", {
      type: "string",
      alias: "-b",
      help: "Browser to use: chrome, firefox, edge, any",
    });

    parser.addArgument("--kiosk", {
      type: "boolean",
      default: false,
      help: "Start in fullscreen/kiosk mode",
    });

    parser.addArgument("--devtools", {
      type: "boolean",
      default: false,
      help: "Show DevTools on startup",
    });

    parser.addArgument("--title", {
      type: "string",
      help: "Window title",
    });

    parser.addArgument("--width", {
      type: "number",
      help: "Window width in pixels",
    });

    parser.addArgument("--height", {
      type: "number",
      help: "Window height in pixels",
    });

    parser.addArgument("--url", {
      type: "string",
      help: "URL to load (overrides settings)",
    });
  }

  // ==========================================================================
  // Main Handler
  // ==========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const settingsName = options.args.settings as string;
    const browserArg = options.args.browser as string | undefined;
    const kioskMode = options.args.kiosk as boolean;
    const devToolsMode = options.args.devtools as boolean;
    const titleArg = options.args.title as string | undefined;
    const widthArg = options.args.width as number | undefined;
    const heightArg = options.args.height as number | undefined;
    const urlArg = options.args.url as string | undefined;

    try {
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

      // Get WEBUI config from settings
      const webUIConfig = (settings.WEBUI ?? settings.DESKTOP ?? {}) as Record<
        string,
        unknown
      >;

      // Build configuration with command line overrides
      const config = {
        title: titleArg ??
          (webUIConfig.title as string) ??
          "Alexi Desktop App",
        width: widthArg ?? (webUIConfig.width as number) ?? 1400,
        height: heightArg ?? (webUIConfig.height as number) ?? 900,
        browser: (browserArg as
          | "any"
          | "chrome"
          | "firefox"
          | "edge"
          | "safari"
          | "chromium") ??
          (webUIConfig.browser as string) ??
          "any",
        kiosk: kioskMode || (webUIConfig.kiosk as boolean) || false,
        devTools: devToolsMode || (webUIConfig.devTools as boolean) || false,
      };

      // Get URL from settings or command line
      const url = urlArg ??
        (settings.UI_URL as string) ??
        (settings.APP_URL as string) ??
        "http://localhost:8000/";

      // Load custom bindings from settings if available
      let bindings = createDefaultBindings();
      const bindingsModule = settings.BINDINGS_MODULE as string | undefined;

      if (bindingsModule) {
        try {
          const customBindingsPath = `${Deno.cwd()}/${bindingsModule}`;
          const customBindingsUrl = toImportUrl(customBindingsPath);
          const customBindings = await import(customBindingsUrl);
          bindings = {
            ...bindings,
            ...(customBindings.bindings ?? customBindings.default ?? {}),
          };
        } catch {
          this.warn(`Could not load custom bindings: ${bindingsModule}`);
        }
      }

      // Print banner
      this.printBanner(config.title, url);

      // Create and launch WebUI
      const launcher = new WebUILauncher({
        config,
        url,
        bindings: bindings as unknown as Record<
          string,
          (...args: unknown[]) => unknown
        >,
        logger: {
          info: (msg) => this.info(msg),
          warn: (msg) => this.warn(msg),
          error: (msg) => this.error(msg),
          success: (msg) => this.success(msg),
        },
        onOpen: () => {
          this.success(`Window opened: ${config.title}`);
        },
        onClose: () => {
          this.info("Window closed");
        },
      });

      await launcher.launch();

      return success();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Desktop launch failed: ${message}`);
      return failure(message);
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private printBanner(title: string, url: string): void {
    const lines = [
      "",
      "┌─────────────────────────────────────────────┐",
      "│          Alexi Desktop Application          │",
      "└─────────────────────────────────────────────┘",
      "",
      "Configuration:",
      `  Application:   ${title}`,
      `  URL:           ${url}`,
      "",
      "Press Ctrl+C or close the window to exit.",
      "",
    ];

    this.stdout.log(lines.join("\n"));
  }
}
