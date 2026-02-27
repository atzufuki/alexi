/**
 * CollectStatic Command Tests
 *
 * Tests for the collectstatic command, including support for
 * file:// URL-based staticDir values (e.g. from @alexi/admin using
 * `new URL("./static/", import.meta.url).href`).
 */

import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { CollectStaticCommand } from "./collectstatic.ts";
import type { AppConfig } from "@alexi/types";

// =============================================================================
// Helper: create a temporary project with a settings file
// =============================================================================

/**
 * Creates a minimal temp project structure:
 *
 *   <tmpDir>/
 *     project/web.settings.ts   ← loaded by collectstatic
 *     <appStaticDir>/           ← the app's static files
 *       ...
 *     static/                   ← STATIC_ROOT (created by collectstatic)
 */
async function createTempProject(opts: {
  appConfig: AppConfig;
  files?: Record<string, string>; // relative paths inside appStaticDir → content
  appStaticDir: string; // absolute path of the app's static dir
  tmpDir: string;
}): Promise<{ staticRoot: string }> {
  const staticRoot = join(opts.tmpDir, "static");

  // Create the app's static directory and files
  await Deno.mkdir(opts.appStaticDir, { recursive: true });
  for (const [rel, content] of Object.entries(opts.files ?? {})) {
    const dest = join(opts.appStaticDir, rel);
    await Deno.mkdir(join(dest, ".."), { recursive: true });
    await Deno.writeTextFile(dest, content);
  }

  // Create project/ directory and settings module
  await Deno.mkdir(join(opts.tmpDir, "project"), { recursive: true });

  const configJson = JSON.stringify(opts.appConfig);
  const settingsContent = `
// Auto-generated test settings
export const INSTALLED_APPS = [
  () => Promise.resolve({ default: ${configJson} }),
];
export const STATIC_ROOT = ${JSON.stringify(staticRoot)};
export const DEBUG = false;
`;

  await Deno.writeTextFile(
    join(opts.tmpDir, "project", "web.settings.ts"),
    settingsContent,
  );

  return { staticRoot };
}

/**
 * Build a file:// URL for a directory path (cross-platform).
 */
function toFileUrl(absPath: string): string {
  const normalised = absPath.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalised)) {
    return `file:///${normalised}/`;
  }
  return `file://${normalised}/`;
}

// =============================================================================
// Tests
// =============================================================================

Deno.test({
  name: "collectstatic: copies files from traditional relative staticDir",
  async fn() {
    const tmpDir = await Deno.makeTempDir({
      prefix: "alexi_collectstatic_test_",
    });

    try {
      const appStaticDir = join(tmpDir, "src", "myapp", "static");
      const appConfig: AppConfig = {
        name: "myapp",
        verboseName: "My App",
        staticDir: "./static",
      };

      const { staticRoot } = await createTempProject({
        tmpDir,
        appConfig,
        appStaticDir,
        files: { "css/app.css": "body { color: red; }" },
      });

      const cmd = new CollectStaticCommand();
      // @ts-ignore — accessing private field for testing
      cmd["projectRoot"] = tmpDir;

      const result = await cmd.handle({
        args: {
          _: [],
          settings: "web",
          "no-input": true,
          clear: false,
          "dry-run": false,
          link: false,
        },
        rawArgs: [],
        debug: false,
      });

      assertEquals(result.exitCode, 0);

      const copied = await Deno.readTextFile(
        join(staticRoot, "css", "app.css"),
      );
      assertEquals(copied, "body { color: red; }");
    } finally {
      await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
    }
  },
});

Deno.test({
  name: "collectstatic: copies files from file:// URL-based staticDir",
  async fn() {
    const tmpDir = await Deno.makeTempDir({
      prefix: "alexi_collectstatic_test_",
    });

    try {
      // Simulate a package's static dir resolved via import.meta.url
      const appStaticDir = join(tmpDir, "pkg_cache", "alexi_admin", "static");
      const fileUrl = toFileUrl(appStaticDir);

      const appConfig: AppConfig = {
        name: "alexi_admin",
        verboseName: "Alexi Admin",
        staticDir: fileUrl,
      };

      const { staticRoot } = await createTempProject({
        tmpDir,
        appConfig,
        appStaticDir,
        files: {
          "css/admin.css": ".admin { display: block; }",
          "js/admin.js": "console.log('admin');",
        },
      });

      const cmd = new CollectStaticCommand();
      // @ts-ignore — accessing private field for testing
      cmd["projectRoot"] = tmpDir;

      const result = await cmd.handle({
        args: {
          _: [],
          settings: "web",
          "no-input": true,
          clear: false,
          "dry-run": false,
          link: false,
        },
        rawArgs: [],
        debug: false,
      });

      assertEquals(result.exitCode, 0);

      const css = await Deno.readTextFile(join(staticRoot, "css", "admin.css"));
      assertEquals(css, ".admin { display: block; }");

      const js = await Deno.readTextFile(join(staticRoot, "js", "admin.js"));
      assertEquals(js, "console.log('admin');");
    } finally {
      await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
    }
  },
});

Deno.test({
  name: "collectstatic: skips app when file:// staticDir does not exist",
  async fn() {
    const tmpDir = await Deno.makeTempDir({
      prefix: "alexi_collectstatic_test_",
    });

    try {
      const nonExistentDir = join(tmpDir, "does_not_exist", "static");
      const fileUrl = toFileUrl(nonExistentDir);

      const appConfig: AppConfig = {
        name: "ghost_app",
        verboseName: "Ghost",
        staticDir: fileUrl,
      };

      const staticRoot = join(tmpDir, "static");
      await Deno.mkdir(join(tmpDir, "project"), { recursive: true });

      const configJson = JSON.stringify(appConfig);
      await Deno.writeTextFile(
        join(tmpDir, "project", "web.settings.ts"),
        `
export const INSTALLED_APPS = [() => Promise.resolve({ default: ${configJson} })];
export const STATIC_ROOT = ${JSON.stringify(staticRoot)};
export const DEBUG = false;
`,
      );

      const cmd = new CollectStaticCommand();
      // @ts-ignore — accessing private field for testing
      cmd["projectRoot"] = tmpDir;

      const result = await cmd.handle({
        args: {
          _: [],
          settings: "web",
          "no-input": true,
          clear: false,
          "dry-run": false,
          link: false,
        },
        rawArgs: [],
        debug: false,
      });

      // Command should still succeed — it just warns and skips apps without static dirs
      assertEquals(result.exitCode, 0);

      // Static root should not have been created (no files to copy)
      let staticRootExists = false;
      try {
        await Deno.stat(staticRoot);
        staticRootExists = true;
      } catch {
        // expected
      }
      assertEquals(staticRootExists, false);
    } finally {
      await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
    }
  },
});
