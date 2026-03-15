/**
 * capacitor.ts template generator (mobile entry point)
 *
 * Generates the project/capacitor.ts file — the single source of truth for
 * Capacitor native project configuration. Follows the same pattern as
 * webui_ts.ts: a thin shell that calls getCapacitorApplication() from
 * @alexi/capacitor.
 *
 * @module @alexi/create/templates/root/capacitor_ts
 */

/**
 * Generate project/capacitor.ts content for a new project.
 *
 * @param name - Project name (kebab-case), used as the default bundle ID suffix
 */
export function generateCapacitorTs(name: string): string {
  const title = toPascalCase(name);
  // Derive a plausible reverse-domain bundle ID from the project name.
  // Users should update this to match their actual domain.
  const appId = `com.example.${name.replace(/-/g, "")}`;
  return `/**
 * ${title} — Capacitor Entry Point
 *
 * Single source of truth for the Capacitor native project configuration.
 * Equivalent to capacitor.config.ts in a standard Capacitor project, but
 * written in Deno TypeScript so it integrates with the rest of the framework.
 *
 * Sync web bundle to native projects:
 *   deno task mobile:sync
 *
 * Run on simulator / emulator:
 *   deno task mobile:ios
 *   deno task mobile:android
 *
 * @module capacitor
 */

import { getCapacitorApplication } from "@alexi/capacitor";

const app = await getCapacitorApplication({
  appId: "${appId}",
  appName: "${title}",
  webDir: "dist",
});

const command = Deno.args[0];
if (command === "sync") {
  await app.sync();
} else if (command === "run") {
  const target = (Deno.args[1] ?? "ios") as "ios" | "android";
  await app.run(target);
}
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
