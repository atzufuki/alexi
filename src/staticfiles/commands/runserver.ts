/**
 * Alexi Static Files RunServer Command
 *
 * A static file server for serving SPA bundles with HMR support.
 * This provides a development server for frontend work.
 *
 * The SPA connects to the web server's API for data.
 * Make sure dev:web is running for full functionality.
 *
 * Usage:
 *   deno task dev:ui
 *   deno run -A manage.ts runserver --settings ui
 *
 * @module @alexi/staticfiles/commands/runserver
 */

import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";

// =============================================================================
// RunServerCommand
// =============================================================================

/**
 * UI RunServer Command
 *
 * A static file server that serves the SPA bundle with HMR support.
 * Provides SPA fallback (all routes serve index.html).
 */
export class RunServerCommand extends BaseCommand {
  readonly name = "runserver";
  readonly help = "Start static file development server";
  readonly description =
    "Starts a development server for SPA applications with bundling and HMR support. " +
    "API calls go to the web server - make sure dev:web is running.";

  readonly examples = [
    "manage.ts runserver --settings ui         - Start static server",
    "manage.ts runserver --settings ui -p 3000 - Start on port 3000",
    "manage.ts runserver --settings ui --no-bundle - Skip bundling",
  ];

  private abortController: AbortController | null = null;
  private bundler: unknown = null;
  private projectRoot: string = Deno.cwd();

  // ==========================================================================
  // Arguments
  // ==========================================================================

  addArguments(parser: IArgumentParser): void {
    parser.addArgument("--settings", {
      type: "string",
      alias: "-s",
      help: "Settings module name",
      required: true,
    });

    parser.addArgument("--port", {
      type: "number",
      alias: "-p",
      help: "Port to listen on",
    });

    parser.addArgument("--host", {
      type: "string",
      alias: "-H",
      help: "Host to bind to",
    });

    parser.addArgument("--no-bundle", {
      type: "boolean",
      default: false,
      help: "Skip frontend bundling",
    });

    parser.addArgument("--no-reload", {
      type: "boolean",
      default: false,
      help: "Disable HMR",
    });
  }

  // ==========================================================================
  // Main Handler
  // ==========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const portArg = options.args.port as number | undefined;
    const hostArg = options.args.host as string | undefined;
    const noBundle = options.args["no-bundle"] as boolean;
    const noReload = options.args["no-reload"] as boolean;
    const debug = options.debug;

    // Get settings name from --settings argument
    const settingsName = options.args.settings as string | undefined;
    if (!settingsName) {
      this.error("--settings is required (e.g., --settings ui)");
      return failure("Settings not specified");
    }

    try {
      // Load settings from the specified settings file
      const settingsPath =
        `${this.projectRoot}/project/${settingsName}.settings.ts`;
      const settings = await import(`file://${settingsPath}`);

      const port = portArg ?? settings.DEFAULT_PORT ?? 5173;
      const host = hostArg ?? settings.DEFAULT_HOST ?? "127.0.0.1";
      const spaRoot = settings.SPA_ROOT ??
        "./src/comachine-ui/static/comachine-ui";
      const apiUrl = settings.API_URL ?? "http://localhost:8000/api";

      // Bundle if needed
      let createHmrResponse: (() => Response) | undefined;
      if (!noBundle) {
        try {
          const { BundleCommand } = await import("./bundle.ts");
          this.bundler = new BundleCommand();
          (this.bundler as BaseCommand).setConsole(this.stdout, this.stderr);

          this.info("Bundling frontend...");

          if (noReload) {
            await (this.bundler as {
              run: (args: string[], debug: boolean) => Promise<unknown>;
            }).run([], debug);
          } else {
            await (this.bundler as {
              bundleAndWatch: (
                opts: { debug: boolean },
              ) => Promise<{ success: boolean }>;
            }).bundleAndWatch({ debug });
          }

          createHmrResponse = () =>
            (this.bundler as { createHmrResponse: () => Response })
              .createHmrResponse();
        } catch (error) {
          this.warn(`Bundling failed: ${error}`);
        }
      }

      this.printBanner(host, port, spaRoot, apiUrl, !noReload);

      // Setup signal handlers
      this.setupSignalHandlers();

      // Start the static file server
      await this.startServer(host, port, spaRoot, apiUrl, createHmrResponse);

      // Keep the process alive
      await new Promise(() => {});

      return success();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`UI server startup failed: ${message}`);
      return failure(message);
    }
  }

  // ==========================================================================
  // Server
  // ==========================================================================

  private async startServer(
    host: string,
    port: number,
    spaRoot: string,
    apiUrl: string,
    createHmrResponse?: () => Response,
  ): Promise<void> {
    this.abortController = new AbortController();

    const handler = async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // HMR endpoint
      if (pathname === "/hmr" && createHmrResponse) {
        return createHmrResponse();
      }

      // Root goes to index.html
      if (pathname === "/") {
        return this.serveIndexHtml(spaRoot, apiUrl);
      }

      // Try to serve static file
      const staticResponse = await this.serveStaticFile(pathname, spaRoot);
      if (staticResponse) {
        return staticResponse;
      }

      // SPA fallback: serve index.html for all routes
      return this.serveIndexHtml(spaRoot, apiUrl);
    };

    Deno.serve(
      {
        port,
        hostname: host,
        signal: this.abortController.signal,
        onListen: ({ hostname, port }) => {
          this.success(`Server running at http://${hostname}:${port}/`);
        },
      },
      handler,
    );
  }

  private async serveStaticFile(
    pathname: string,
    spaRoot: string,
  ): Promise<Response | null> {
    // Remove leading slash
    const filePath = pathname.slice(1);

    // Security: prevent path traversal
    if (filePath.includes("..")) {
      return null;
    }

    const fullPath = `${spaRoot}/${filePath}`;

    try {
      const file = await Deno.open(fullPath, { read: true });
      const stat = await file.stat();

      if (stat.isDirectory) {
        file.close();
        // Try index.html in directory
        const indexPath = `${fullPath}/index.html`;
        try {
          const indexFile = await Deno.open(indexPath, { read: true });
          return new Response(indexFile.readable, {
            headers: this.getHeaders("index.html"),
          });
        } catch {
          return null;
        }
      }

      return new Response(file.readable, {
        headers: this.getHeaders(pathname),
      });
    } catch {
      return null;
    }
  }

  private async serveIndexHtml(
    spaRoot: string,
    apiUrl: string,
  ): Promise<Response> {
    const indexPath = `${spaRoot}/index.html`;

    try {
      let html = await Deno.readTextFile(indexPath);

      // Inject API URL if placeholder exists
      if (html.includes("{{COMACHINE_API_URL}}")) {
        html = html.replace(/\{\{COMACHINE_API_URL\}\}/g, apiUrl);
      }

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch {
      return new Response("index.html not found", { status: 404 });
    }
  }

  private getHeaders(pathname: string): Record<string, string> {
    const ext = pathname.split(".").pop()?.toLowerCase() ?? "";
    const contentTypes: Record<string, string> = {
      html: "text/html; charset=utf-8",
      js: "application/javascript; charset=utf-8",
      mjs: "application/javascript; charset=utf-8",
      css: "text/css; charset=utf-8",
      json: "application/json; charset=utf-8",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      woff: "font/woff",
      woff2: "font/woff2",
      ttf: "font/ttf",
      eot: "application/vnd.ms-fontobject",
    };

    return {
      "Content-Type": contentTypes[ext] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    };
  }

  // ==========================================================================
  // Signal Handlers
  // ==========================================================================

  private setupSignalHandlers(): void {
    let cleanupCalled = false;

    const cleanup = () => {
      if (cleanupCalled) return;
      cleanupCalled = true;

      this.info("\nShutting down static server...");

      // Stop bundler watcher
      if (this.bundler) {
        try {
          (this.bundler as { stopWatching: () => void }).stopWatching();
        } catch {
          // Ignore
        }
        this.bundler = null;
      }

      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }

      this.success("Static server stopped.");
      Deno.exit(0);
    };

    try {
      Deno.addSignalListener("SIGINT", cleanup);
      Deno.addSignalListener("SIGTERM", cleanup);
    } catch {
      // Signal listeners not available (e.g., Windows)
    }
  }

  // ==========================================================================
  // UI
  // ==========================================================================

  private printBanner(
    host: string,
    port: number,
    spaRoot: string,
    apiUrl: string,
    hmrEnabled: boolean,
  ): void {
    const lines = [
      "",
      "┌─────────────────────────────────────────────┐",
      "│       Alexi Static File Server              │",
      "└─────────────────────────────────────────────┘",
      "",
      "Configuration:",
      `  URL:        http://${host}:${port}/`,
      `  SPA Root:   ${spaRoot}`,
      `  API URL:    ${apiUrl}`,
      `  HMR:        ${hmrEnabled ? "Enabled" : "Disabled"}`,
      "",
      "Press Ctrl+C to stop the server.",
      "",
    ];

    this.stdout.log(lines.join("\n"));
  }
}
