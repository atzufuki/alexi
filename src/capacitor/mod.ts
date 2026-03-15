/**
 * Alexi's Capacitor integration for mobile applications.
 *
 * `@alexi/capacitor` provides the framework integration for running
 * Alexi-powered web apps inside native iOS and Android shells via
 * [Capacitor](https://capacitorjs.com/).
 *
 * Use {@link getCapacitorApplication} in `project/capacitor.ts` to configure
 * and manage the Capacitor native projects. The factory wraps the Capacitor CLI
 * (`npx cap sync`, `npx cap run`) so your project stays configured from a
 * single TypeScript file.
 *
 * @example
 * ```ts
 * import { getCapacitorApplication } from "@alexi/capacitor";
 *
 * const app = await getCapacitorApplication({
 *   appId: "com.example.myapp",
 *   appName: "MyApp",
 *   webDir: "dist",
 * });
 *
 * const command = Deno.args[0];
 * if (command === "sync") {
 *   await app.sync();
 * } else if (command === "run") {
 *   await app.run((Deno.args[1] ?? "ios") as "ios" | "android");
 * }
 * ```
 *
 * @module @alexi/capacitor
 */

// =============================================================================
// App Config
// =============================================================================

export { default as appConfig } from "./app.ts";

// =============================================================================
// Factory + Application
// =============================================================================

export {
  CapacitorApplication,
  getCapacitorApplication,
} from "./get_application.ts";

export type {
  CapacitorConfig,
  CapacitorServerConfig,
  GetCapacitorApplicationSettings,
} from "./get_application.ts";
