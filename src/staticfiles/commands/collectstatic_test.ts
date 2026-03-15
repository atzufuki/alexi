/**
 * CollectStatic Command Tests
 *
 * Tests for the collectstatic command, including support for
 * file:// URL-based appPath values (e.g. from @alexi/admin using
 * `new URL("./", import.meta.url).href`).
 */

import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { CollectStaticCommand } from "./collectstatic.ts";
import type { StaticFilesManifest } from "./bundle.ts";
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
  name: "collectstatic: copies files from traditional relative appPath",
  async fn() {
    const tmpDir = await Deno.makeTempDir({
      prefix: "alexi_collectstatic_test_",
    });

    try {
      const appStaticDir = join(tmpDir, "src", "myapp", "static");
      const appConfig: AppConfig = {
        name: "myapp",
        verboseName: "My App",
        appPath: "./src/myapp",
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
  name: "collectstatic: copies files from file:// URL-based appPath",
  async fn() {
    const tmpDir = await Deno.makeTempDir({
      prefix: "alexi_collectstatic_test_",
    });

    try {
      // Simulate a package's app dir resolved via import.meta.url
      const appDir = join(tmpDir, "pkg_cache", "alexi_admin");
      const appStaticDir = join(appDir, "static");
      const fileUrl = toFileUrl(appDir);

      const appConfig: AppConfig = {
        name: "alexi_admin",
        verboseName: "Alexi Admin",
        appPath: fileUrl,
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
  name:
    "collectstatic: skips app when file:// appPath static dir does not exist",
  async fn() {
    const tmpDir = await Deno.makeTempDir({
      prefix: "alexi_collectstatic_test_",
    });

    try {
      const nonExistentAppDir = join(tmpDir, "does_not_exist");
      const fileUrl = toFileUrl(nonExistentAppDir);

      const appConfig: AppConfig = {
        name: "ghost_app",
        verboseName: "Ghost",
        appPath: fileUrl,
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

Deno.test({
  name:
    "collectstatic: merges per-app staticfiles.json manifests into STATIC_ROOT",
  async fn() {
    const tmpDir = await Deno.makeTempDir({
      prefix: "alexi_collectstatic_manifest_",
    });

    try {
      // Two apps, each with their own staticfiles.json manifest
      const app1StaticDir = join(tmpDir, "src", "app1", "static");
      const app2StaticDir = join(tmpDir, "src", "app2", "static");

      await Deno.mkdir(app1StaticDir, { recursive: true });
      await Deno.mkdir(app2StaticDir, { recursive: true });

      // Write per-app manifests (as the bundle command would)
      const manifest1: StaticFilesManifest = {
        version: 1,
        files: { "app1/document.js": "app1/document-abc123.js" },
      };
      const manifest2: StaticFilesManifest = {
        version: 1,
        files: { "app2/main.js": "app2/main-def456.js" },
      };
      await Deno.writeTextFile(
        join(app1StaticDir, "staticfiles.json"),
        JSON.stringify(manifest1),
      );
      await Deno.writeTextFile(
        join(app2StaticDir, "staticfiles.json"),
        JSON.stringify(manifest2),
      );

      // Write dummy static files so the apps are discovered
      await Deno.writeTextFile(join(app1StaticDir, "app1.css"), "/* app1 */");
      await Deno.writeTextFile(join(app2StaticDir, "app2.css"), "/* app2 */");

      const staticRoot = join(tmpDir, "static");
      await Deno.mkdir(join(tmpDir, "project"), { recursive: true });

      const config1: AppConfig = {
        name: "app1",
        verboseName: "App 1",
        appPath: `./src/app1`,
      };
      const config2: AppConfig = {
        name: "app2",
        verboseName: "App 2",
        appPath: `./src/app2`,
      };

      await Deno.writeTextFile(
        join(tmpDir, "project", "web.settings.ts"),
        `
export const INSTALLED_APPS = [
  () => Promise.resolve({ default: ${JSON.stringify(config1)} }),
  () => Promise.resolve({ default: ${JSON.stringify(config2)} }),
];
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

      assertEquals(result.exitCode, 0);

      // Verify merged manifest at STATIC_ROOT/staticfiles.json
      const mergedRaw = await Deno.readTextFile(
        join(staticRoot, "staticfiles.json"),
      );
      const merged = JSON.parse(mergedRaw) as StaticFilesManifest;

      assertEquals(merged.version, 1);
      assertEquals(
        merged.files["app1/document.js"],
        "app1/document-abc123.js",
      );
      assertEquals(merged.files["app2/main.js"], "app2/main-def456.js");
    } finally {
      await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
    }
  },
});

Deno.test({
  name:
    "collectstatic: skips manifest write when no per-app staticfiles.json exist",
  async fn() {
    const tmpDir = await Deno.makeTempDir({
      prefix: "alexi_collectstatic_no_manifest_",
    });

    try {
      const appStaticDir = join(tmpDir, "src", "myapp", "static");
      const appConfig: AppConfig = {
        name: "myapp",
        verboseName: "My App",
        appPath: "./src/myapp",
      };

      const { staticRoot } = await createTempProject({
        tmpDir,
        appConfig,
        appStaticDir,
        files: { "style.css": "body {}" },
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

      // No staticfiles.json should be written when there are no per-app manifests
      let manifestExists = false;
      try {
        await Deno.stat(join(staticRoot, "staticfiles.json"));
        manifestExists = true;
      } catch {
        // expected
      }
      assertEquals(manifestExists, false);
    } finally {
      await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
    }
  },
});
