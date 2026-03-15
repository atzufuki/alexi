/**
 * webui.ts template generator (desktop entry point)
 *
 * Generates the project/webui.ts file — the standalone desktop entry point.
 * Follows the same pattern as http_ts.ts: a thin shell that calls
 * getWebuiApplication() from @alexi/webui.
 *
 * @module @alexi/create/templates/root/webui_ts
 */

/**
 * Generate project/webui.ts content for a new project.
 *
 * @param name - Project name (kebab-case)
 */
export function generateWebuiTs(name: string): string {
  const title = toPascalCase(name);
  return `/**
 * ${title} — WebUI Entry Point
 *
 * Opens the web server UI (http://localhost:8000/) in a native desktop
 * window using WebUI. Run this alongside \`deno task dev\` to get a
 * desktop-app experience without Electron.
 *
 * Usage (development):
 *   deno run -A --unstable-kv --unstable-ffi project/webui.ts
 *
 * Usage (production binary):
 *   deno compile -A --unstable-kv --unstable-ffi -o ${name} project/webui.ts
 *   ./${name}
 *
 * @module webui
 */

import { getWebuiApplication } from "@alexi/webui";

const app = await getWebuiApplication({
  url: "http://localhost:8000/",
  webui: {
    title: "${title}",
    width: 1400,
    height: 900,
  },
});

await app.launch();
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
