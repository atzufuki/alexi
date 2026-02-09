/**
 * Alexi WebUI Launcher
 *
 * Generic WebUI launcher for desktop applications.
 * Provides a reusable way to open WebUI windows.
 *
 * @module alexi_webui/launcher
 */

// =============================================================================
// Types
// =============================================================================

/**
 * WebUI configuration options
 */
export interface WebUIConfig {
  /**
   * Window title
   */
  title: string;

  /**
   * Window width in pixels
   * @default 1400
   */
  width?: number;

  /**
   * Window height in pixels
   * @default 900
   */
  height?: number;

  /**
   * Browser to use
   * @default "any"
   */
  browser?: "any" | "chrome" | "firefox" | "edge" | "safari" | "chromium";

  /**
   * Enable kiosk (fullscreen) mode
   * @default false
   */
  kiosk?: boolean;

  /**
   * Show DevTools on startup
   * @default false
   */
  devTools?: boolean;
}

/**
 * Options for the WebUI launcher
 */
export interface WebUILauncherOptions {
  /**
   * WebUI configuration
   */
  config: WebUIConfig;

  /**
   * URL to load in the window
   */
  url: string;

  /**
   * Bindings to register (native functions callable from JS)
   */
  bindings?: Record<string, (...args: unknown[]) => unknown>;

  /**
   * Callback when window opens
   */
  onOpen?: () => void;

  /**
   * Callback when window closes
   */
  onClose?: () => void;

  /**
   * Logger for status messages
   */
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    success: (msg: string) => void;
  };
}

/**
 * Internal WebUI window interface
 */
interface WebUIWindow {
  setSize(width: number, height: number): void;
  setKiosk(enable: boolean): void;
  show(content: string): Promise<void>;
  bind(name: string, callback: (...args: unknown[]) => unknown): void;
  close(): void;
}

/**
 * Internal WebUI class interface
 */
interface WebUIClass {
  new (): WebUIWindow;
  Browser: {
    AnyBrowser: number;
    Chrome: number;
    Firefox: number;
    Edge: number;
    Safari: number;
    Chromium: number;
  };
  wait(): Promise<void>;
  exit(): void;
}

// =============================================================================
// Default Logger
// =============================================================================

const defaultLogger = {
  info: (msg: string) => console.log(`ℹ ${msg}`),
  warn: (msg: string) => console.warn(`⚠ ${msg}`),
  error: (msg: string) => console.error(`✗ ${msg}`),
  success: (msg: string) => console.log(`✓ ${msg}`),
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Wait for a URL to become available
 *
 * @param url - URL to check
 * @param options - Retry options
 * @returns true if URL is available, false if timeout
 */
async function waitForUrl(
  url: string,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    logger?: typeof defaultLogger;
  } = {},
): Promise<boolean> {
  const maxRetries = options.maxRetries ?? 30;
  const retryDelay = options.retryDelay ?? 1000;
  const logger = options.logger ?? defaultLogger;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok || response.status === 304) {
        return true;
      }
    } catch {
      // Server not ready yet
    }

    if (attempt < maxRetries) {
      if (attempt === 1) {
        logger.info(`Waiting for ${url} to be ready...`);
      } else if (attempt % 5 === 0) {
        logger.info(`Still waiting... (attempt ${attempt}/${maxRetries})`);
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return false;
}

// =============================================================================
// WebUI Launcher
// =============================================================================

/**
 * WebUI Launcher
 *
 * Provides a reusable way to open WebUI windows for desktop applications.
 *
 * @example
 * ```ts
 * const launcher = new WebUILauncher({
 *   config: {
 *     title: "My App",
 *     width: 1200,
 *     height: 800,
 *   },
 *   url: "http://localhost:8000/",
 *   bindings: {
 *     getSystemInfo: () => ({ platform: Deno.build.os }),
 *   },
 * });
 *
 * await launcher.launch();
 * ```
 */
export class WebUILauncher {
  private readonly config: WebUIConfig;
  private readonly url: string;
  private readonly bindings: Record<string, (...args: unknown[]) => unknown>;
  private readonly onOpen?: () => void;
  private readonly onClose?: () => void;
  private readonly logger: typeof defaultLogger;

  private window: WebUIWindow | null = null;
  private WebUI: WebUIClass | null = null;

  constructor(options: WebUILauncherOptions) {
    this.config = {
      width: 1400,
      height: 900,
      browser: "any",
      kiosk: false,
      devTools: false,
      ...options.config,
    };
    this.url = options.url;
    this.bindings = options.bindings ?? {};
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.logger = options.logger ?? defaultLogger;
  }

  /**
   * Launch the WebUI window
   *
   * This method:
   * 1. Waits for the target URL to be available
   * 2. Loads the WebUI library
   * 3. Creates a new window
   * 4. Registers bindings
   * 5. Opens the URL
   * 6. Waits for the window to close
   */
  async launch(): Promise<void> {
    // Set global flag for desktop mode detection
    // @ts-ignore - Setting global flag
    globalThis.__ALEXI_DESKTOP__ = true;
    // @ts-ignore - Setting global flag for backwards compatibility
    globalThis.__COMACHINE_DESKTOP__ = true;

    this.logger.info(`Checking if ${this.url} is available...`);

    // Wait for the target URL to be available (server might still be starting)
    const urlReady = await waitForUrl(this.url, {
      maxRetries: 30,
      retryDelay: 1000,
      logger: this.logger,
    });

    if (!urlReady) {
      this.logger.error(`Could not connect to ${this.url} after 30 seconds`);
      this.logger.error(
        "Make sure the UI server is running (deno task dev:ui or dev:web)",
      );
      throw new Error(`Server at ${this.url} is not available`);
    }

    this.logger.success(`Server at ${this.url} is ready`);

    // Load WebUI
    await this.loadWebUI();

    // Create and configure window
    this.createWindow();

    // Register bindings
    this.registerBindings();

    // Setup signal handlers
    this.setupSignalHandlers();

    // Open window
    await this.openWindow();

    // Wait for close
    await this.waitForClose();
  }

  /**
   * Close the window programmatically
   */
  close(): void {
    if (this.window) {
      try {
        this.window.close();
      } catch {
        // Ignore errors on close
      }
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async loadWebUI(): Promise<void> {
    try {
      const module = await import("@webui/deno-webui");
      this.WebUI = module.WebUI;
    } catch (error) {
      this.logger.error(
        "WebUI could not be loaded. Make sure --unstable-ffi is enabled.",
      );
      throw error;
    }
  }

  private createWindow(): void {
    if (!this.WebUI) {
      throw new Error("WebUI not loaded");
    }

    this.window = new this.WebUI();

    // Set size
    this.window.setSize(this.config.width!, this.config.height!);

    // Set kiosk mode
    if (this.config.kiosk) {
      this.window.setKiosk(true);
    }
  }

  private registerBindings(): void {
    if (!this.window) return;

    // Register closeWindow binding
    this.window.bind("closeWindow", () => {
      this.logger.info("Window closed by application");
      this.onClose?.();
      this.close();
      Deno.exit(0);
    });

    // Register custom bindings
    const bindingNames: string[] = [];
    for (const [name, fn] of Object.entries(this.bindings)) {
      if (typeof fn === "function") {
        this.window.bind(name, fn);
        bindingNames.push(name);
      }
    }

    if (bindingNames.length > 0) {
      this.logger.info(
        `Registered ${bindingNames.length} native bindings: ${
          bindingNames.join(", ")
        }`,
      );
    }
  }

  private setupSignalHandlers(): void {
    const cleanup = () => {
      this.logger.info("\nShutting down...");
      this.close();
      Deno.exit(0);
    };

    try {
      Deno.addSignalListener("SIGINT", cleanup);
      Deno.addSignalListener("SIGTERM", cleanup);
    } catch {
      // Signal listeners not available on Windows
    }
  }

  private async openWindow(): Promise<void> {
    if (!this.window) {
      throw new Error("Window not created");
    }

    this.logger.info(`Opening ${this.config.title}...`);

    try {
      await this.window.show(this.url);
    } catch (error) {
      // Ignore "unable to start the browser" - window may still have opened
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes("unable to start the browser")) {
        throw error;
      }
    }

    this.onOpen?.();

    this.logger.info("");
    this.logger.success(`Desktop app running at ${this.url}`);
    this.logger.info("Press Ctrl+C to close the application.");
    this.logger.info("");
  }

  private async waitForClose(): Promise<void> {
    if (!this.WebUI) return;

    // On Windows, WebUI.wait() may return immediately even when the window is still open.
    // Use a polling approach instead to check if the process should continue.
    if (Deno.build.os === "windows") {
      // Keep the process alive until Ctrl+C or window close binding is called
      await new Promise<void>(() => {
        // This promise never resolves - we exit via signal handlers or closeWindow binding
      });
    } else {
      // On other platforms, use the standard WebUI wait
      try {
        await this.WebUI.wait();
      } catch (error) {
        // Log the error for debugging
        this.logger.warn(`WebUI.wait() error: ${error}`);
      }

      this.onClose?.();
    }
  }
}
