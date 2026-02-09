/**
 * Alexi WebUI Bindings
 *
 * Default native bindings for desktop applications.
 * These functions are callable from JavaScript in the WebUI window.
 *
 * @module alexi_webui/bindings
 */

// =============================================================================
// Types
// =============================================================================

/**
 * System information returned by getSystemInfo binding
 */
export interface SystemInfo {
  platform: "windows" | "darwin" | "linux" | string;
  arch: string;
  hostname: string;
  homeDir: string | null;
  denoVersion: string;
}

/**
 * File dialog options
 */
export interface FileDialogOptions {
  /**
   * Dialog title
   */
  title?: string;

  /**
   * Default path to open
   */
  defaultPath?: string;

  /**
   * File type filters
   */
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;

  /**
   * Allow selecting multiple files
   */
  multiple?: boolean;

  /**
   * Select directories instead of files
   */
  directory?: boolean;
}

/**
 * Notification options
 */
export interface NotificationOptions {
  /**
   * Notification title
   */
  title: string;

  /**
   * Notification body text
   */
  body: string;

  /**
   * Icon path (optional)
   */
  icon?: string;
}

/**
 * WebUI bindings interface
 */
export interface WebUIBindings {
  getSystemInfo: () => SystemInfo;
  openFileDialog: (
    options?: FileDialogOptions,
  ) => Promise<string | string[] | null>;
  saveFileDialog: (options?: FileDialogOptions) => Promise<string | null>;
  showNotification: (options: NotificationOptions) => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  readClipboard: () => Promise<string>;
  writeClipboard: (text: string) => Promise<boolean>;
  getEnv: (key: string) => string | undefined;
}

// =============================================================================
// Default Bindings Implementation
// =============================================================================

/**
 * Get system information
 */
function getSystemInfo(): SystemInfo {
  return {
    platform: Deno.build.os,
    arch: Deno.build.arch,
    hostname: Deno.hostname?.() ?? "unknown",
    homeDir: Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? null,
    denoVersion: Deno.version.deno,
  };
}

/**
 * Open a file dialog
 *
 * Note: This is a placeholder implementation.
 * Full implementation would use native dialogs via FFI or external tools.
 */
async function openFileDialog(
  _options?: FileDialogOptions,
): Promise<string | string[] | null> {
  // Placeholder - in real implementation would use native file dialog
  // For now, return null to indicate no selection
  console.warn("openFileDialog: Native file dialogs not yet implemented");
  return null;
}

/**
 * Open a save file dialog
 *
 * Note: This is a placeholder implementation.
 */
async function saveFileDialog(
  _options?: FileDialogOptions,
): Promise<string | null> {
  console.warn("saveFileDialog: Native file dialogs not yet implemented");
  return null;
}

/**
 * Show a system notification
 *
 * Note: This is a placeholder implementation.
 */
async function showNotification(
  options: NotificationOptions,
): Promise<boolean> {
  console.log(`[Notification] ${options.title}: ${options.body}`);
  // In real implementation, would use native notifications
  return true;
}

/**
 * Open a URL or file with the default system application
 */
async function openExternal(url: string): Promise<boolean> {
  try {
    let command: Deno.Command;

    switch (Deno.build.os) {
      case "windows":
        command = new Deno.Command("cmd", {
          args: ["/c", "start", "", url],
        });
        break;
      case "darwin":
        command = new Deno.Command("open", {
          args: [url],
        });
        break;
      default:
        // Linux and others
        command = new Deno.Command("xdg-open", {
          args: [url],
        });
        break;
    }

    const { success } = await command.output();
    return success;
  } catch (error) {
    console.error("Failed to open external URL:", error);
    return false;
  }
}

/**
 * Read text from clipboard
 */
async function readClipboard(): Promise<string> {
  try {
    let command: Deno.Command;

    switch (Deno.build.os) {
      case "windows":
        command = new Deno.Command("powershell", {
          args: ["-command", "Get-Clipboard"],
        });
        break;
      case "darwin":
        command = new Deno.Command("pbpaste", {
          args: [],
        });
        break;
      default:
        // Linux - try xclip
        command = new Deno.Command("xclip", {
          args: ["-selection", "clipboard", "-o"],
        });
        break;
    }

    const { stdout } = await command.output();
    return new TextDecoder().decode(stdout).trim();
  } catch (error) {
    console.error("Failed to read clipboard:", error);
    return "";
  }
}

/**
 * Write text to clipboard
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    let command: Deno.Command;

    switch (Deno.build.os) {
      case "windows":
        command = new Deno.Command("powershell", {
          args: [
            "-command",
            `Set-Clipboard -Value '${text.replace(/'/g, "''")}'`,
          ],
        });
        break;
      case "darwin":
        command = new Deno.Command("pbcopy", {
          args: [],
          stdin: "piped",
        });
        break;
      default:
        // Linux - try xclip
        command = new Deno.Command("xclip", {
          args: ["-selection", "clipboard"],
          stdin: "piped",
        });
        break;
    }

    if (Deno.build.os !== "windows") {
      const process = command.spawn();
      const writer = process.stdin.getWriter();
      await writer.write(new TextEncoder().encode(text));
      await writer.close();
      const { success } = await process.status;
      return success;
    } else {
      const { success } = await command.output();
      return success;
    }
  } catch (error) {
    console.error("Failed to write clipboard:", error);
    return false;
  }
}

/**
 * Get environment variable
 */
function getEnv(key: string): string | undefined {
  return Deno.env.get(key);
}

// =============================================================================
// Exports
// =============================================================================

/**
 * Create default bindings object
 *
 * These bindings can be passed to WebUILauncher or merged with custom bindings.
 *
 * @example
 * ```ts
 * import { createDefaultBindings } from "@alexi/webui";
 *
 * const bindings = {
 *   ...createDefaultBindings(),
 *   // Add custom bindings
 *   myCustomBinding: () => { ... },
 * };
 * ```
 */
export function createDefaultBindings(): WebUIBindings {
  return {
    getSystemInfo,
    openFileDialog,
    saveFileDialog,
    showNotification,
    openExternal,
    readClipboard,
    writeClipboard,
    getEnv,
  };
}

/**
 * Default bindings object
 *
 * Pre-created bindings for convenience.
 */
export const defaultBindings = createDefaultBindings();
