/**
 * Desktop bindings.ts template generator
 *
 * @module @alexi/create/templates/desktop/bindings_ts
 */

/**
 * Generate bindings.ts content for the desktop app
 */
export function generateDesktopBindingsTs(): string {
  return `/**
 * Desktop Native Bindings
 *
 * Native functions exposed to the WebUI frontend.
 *
 * @module bindings
 */

/**
 * System information interface
 */
export interface SystemInfo {
  platform: string;
  arch: string;
  hostname: string;
}

/**
 * Get system information
 */
export function getSystemInfo(): SystemInfo {
  return {
    platform: Deno.build.os,
    arch: Deno.build.arch,
    hostname: Deno.hostname(),
  };
}

/**
 * Open an external URL or file with the default application
 */
export async function openExternal(path: string): Promise<boolean> {
  let command: Deno.Command;

  switch (Deno.build.os) {
    case "windows":
      command = new Deno.Command("cmd", { args: ["/c", "start", "", path] });
      break;
    case "darwin":
      command = new Deno.Command("open", { args: [path] });
      break;
    default:
      command = new Deno.Command("xdg-open", { args: [path] });
      break;
  }

  const { success } = await command.output();
  return success;
}

/**
 * Get the application version
 */
export function getVersion(): string {
  return "1.0.0";
}

/**
 * Default bindings to register with WebUI
 */
export const bindings = {
  getSystemInfo,
  openExternal,
  getVersion,
};
`;
}
