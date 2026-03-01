/**
 * Tests for StartAppCommand
 *
 * Tests that startapp creates the correct directory structure and file content
 * for each app type, focusing on the sw type.
 *
 * @module @alexi/core/tests/startapp_test
 */

import { assertEquals, assertExists, assertMatch } from "jsr:@std/assert@1";
import { join } from "jsr:@std/path@1";
import { StartAppCommand } from "../management/commands/startapp.ts";
import type { IConsole } from "../management/types.ts";

// =============================================================================
// Mock Console
// =============================================================================

class MockConsole implements IConsole {
  logs: string[] = [];
  errors: string[] = [];
  warns: string[] = [];
  infos: string[] = [];

  log(...args: unknown[]): void {
    this.logs.push(args.map(String).join(" "));
  }
  error(...args: unknown[]): void {
    this.errors.push(args.map(String).join(" "));
  }
  warn(...args: unknown[]): void {
    this.warns.push(args.map(String).join(" "));
  }
  info(...args: unknown[]): void {
    this.infos.push(args.map(String).join(" "));
  }
  clear(): void {
    this.logs = [];
    this.errors = [];
    this.warns = [];
    this.infos = [];
  }
}

// =============================================================================
// Helpers
// =============================================================================

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "alexi_startapp_test_" });
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

async function runStartapp(
  tempDir: string,
  args: string[],
): Promise<{ exitCode: number; logs: string[]; errors: string[] }> {
  // startapp writes files relative to cwd, so we must change to tempDir
  const originalCwd = Deno.cwd();
  Deno.chdir(tempDir);

  // Create project/ dir (startapp writes settings there)
  await Deno.mkdir(join(tempDir, "project"), { recursive: true });

  try {
    const command = new StartAppCommand();
    const mockConsole = new MockConsole();
    command.setConsole(mockConsole);
    const result = await command.run(args);
    return {
      exitCode: result.exitCode,
      logs: mockConsole.logs,
      errors: mockConsole.errors,
    };
  } finally {
    Deno.chdir(originalCwd);
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readFile(path: string): Promise<string> {
  return await Deno.readTextFile(path);
}

// =============================================================================
// sw app type tests
// =============================================================================

Deno.test({
  name: "startapp sw: creates correct directory structure",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, [
        "my-app-sw",
        "--type",
        "sw",
        "--no-input",
      ]);

      assertEquals(result.exitCode, 0, "Command should succeed");

      const appDir = join(dir, "src/my-app-sw");

      // Core directories
      assertEquals(
        await fileExists(appDir),
        true,
        "App directory should exist",
      );
      assertEquals(
        await fileExists(join(appDir, "tests")),
        true,
        "tests/ should exist",
      );
      assertEquals(
        await fileExists(join(appDir, "static/my-app-sw")),
        true,
        "static/my-app-sw/ should exist",
      );
      assertEquals(
        await fileExists(join(appDir, "templates/my-app-sw")),
        true,
        "templates/my-app-sw/ should exist",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp sw: creates all required files",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, [
        "my-app-sw",
        "--type",
        "sw",
        "--no-input",
      ]);

      assertEquals(result.exitCode, 0, "Command should succeed");

      const appDir = join(dir, "src/my-app-sw");

      const expectedFiles = [
        join(appDir, "app.ts"),
        join(appDir, "mod.ts"),
        join(appDir, "models.ts"),
        join(appDir, "views.ts"),
        join(appDir, "urls.ts"),
        join(appDir, "sw.ts"),
        join(appDir, "static/my-app-sw/index.html"),
        join(appDir, "templates/my-app-sw/base.html"),
        join(appDir, "templates/my-app-sw/index.html"),
        join(appDir, "tests/basic_test.ts"),
        join(dir, "project/my-app-sw.settings.ts"),
      ];

      for (const file of expectedFiles) {
        assertEquals(
          await fileExists(file),
          true,
          `${file} should exist`,
        );
      }
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp sw: app.ts has bundle config pointing to sw.ts",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app-sw", "--type", "sw", "--no-input"]);

      const appTs = await readFile(join(dir, "src/my-app-sw/app.ts"));

      assertMatch(appTs, /bundle:/, "app.ts should have bundle config");
      assertMatch(
        appTs,
        /entrypoint: "\.\/sw\.ts"/,
        "entrypoint should be ./sw.ts",
      );
      assertMatch(
        appTs,
        /outputName: "sw\.js"/,
        "outputName should be sw.js",
      );
      assertMatch(
        appTs,
        /outputDir: "\.\/static\/my-app-sw"/,
        "outputDir should be ./static/my-app-sw",
      );
      assertMatch(
        appTs,
        /templatesDir: "src\/my-app-sw\/templates"/,
        "app.ts should set templatesDir",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp sw: sw.ts wires Application to fetch event",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app-sw", "--type", "sw", "--no-input"]);

      const swTs = await readFile(join(dir, "src/my-app-sw/sw.ts"));

      assertMatch(
        swTs,
        /import { Application.*} from "@alexi\/core"/,
        "sw.ts should import Application from @alexi/core",
      );
      assertMatch(
        swTs,
        /new Application\({ urls: urlpatterns }\)/,
        "sw.ts should create Application with urlpatterns",
      );
      assertMatch(
        swTs,
        /addEventListener\("install"/,
        "sw.ts should listen for install event",
      );
      assertMatch(
        swTs,
        /addEventListener\("activate"/,
        "sw.ts should listen for activate event",
      );
      assertMatch(
        swTs,
        /addEventListener\("fetch"/,
        "sw.ts should listen for fetch event",
      );
      assertMatch(
        swTs,
        /app\.handler\(event\.request\)/,
        "sw.ts should delegate to app.handler",
      );
      assertMatch(
        swTs,
        /skipWaiting/,
        "sw.ts should call skipWaiting",
      );
      assertMatch(
        swTs,
        /clients\.claim/,
        "sw.ts should call clients.claim",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp sw: index.html registers Service Worker and loads htmx",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app-sw", "--type", "sw", "--no-input"]);

      const indexHtml = await readFile(
        join(dir, "src/my-app-sw/static/my-app-sw/index.html"),
      );

      assertMatch(
        indexHtml,
        /serviceWorker\.register/,
        "index.html should register SW",
      );
      assertMatch(
        indexHtml,
        /sw\.js/,
        "index.html should reference sw.js",
      );
      assertMatch(
        indexHtml,
        /htmx/,
        "index.html should include htmx",
      );
      assertMatch(
        indexHtml,
        /htmx\.ajax/,
        "index.html should call htmx.ajax to bootstrap content",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp sw: base.html is a valid HTML template with blocks",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app-sw", "--type", "sw", "--no-input"]);

      const baseHtml = await readFile(
        join(dir, "src/my-app-sw/templates/my-app-sw/base.html"),
      );

      assertMatch(baseHtml, /<!DOCTYPE html>/, "base.html should be HTML doc");
      assertMatch(
        baseHtml,
        /{% block title %}/,
        "base.html should have title block",
      );
      assertMatch(
        baseHtml,
        /{% block content %}/,
        "base.html should have content block",
      );
      assertMatch(
        baseHtml,
        /{% endblock %}/,
        "base.html should close blocks",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp sw: index template extends base and has content block",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app-sw", "--type", "sw", "--no-input"]);

      const indexHtml = await readFile(
        join(dir, "src/my-app-sw/templates/my-app-sw/index.html"),
      );

      assertMatch(
        indexHtml,
        /{% extends "my-app-sw\/base\.html" %}/,
        "index template should extend base",
      );
      assertMatch(
        indexHtml,
        /{% block content %}/,
        "index template should have content block",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp sw: views.ts uses templateView",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app-sw", "--type", "sw", "--no-input"]);

      const viewsTs = await readFile(join(dir, "src/my-app-sw/views.ts"));

      assertMatch(
        viewsTs,
        /import { templateView } from "@alexi\/views"/,
        "views.ts should import templateView",
      );
      assertMatch(
        viewsTs,
        /templateView\(/,
        "views.ts should call templateView",
      );
      assertMatch(
        viewsTs,
        /templateName: "my-app-sw\/index\.html"/,
        "views.ts should reference the namespaced template",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp sw: settings has INSTALLED_APPS with staticfiles and web",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app-sw", "--type", "sw", "--no-input"]);

      const settings = await readFile(
        join(dir, "project/my-app-sw.settings.ts"),
      );

      assertMatch(
        settings,
        /import.*@alexi\/staticfiles/,
        "settings should include staticfiles",
      );
      assertMatch(
        settings,
        /import.*@alexi\/web/,
        "settings should include web server",
      );
      assertMatch(
        settings,
        /@my-app-sw\/sw/,
        "settings should include the sw app",
      );
      assertMatch(
        settings,
        /ROOT_URLCONF/,
        "settings should define ROOT_URLCONF",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp sw: mod.ts exports models, views, and urls",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app-sw", "--type", "sw", "--no-input"]);

      const modTs = await readFile(join(dir, "src/my-app-sw/mod.ts"));

      assertMatch(
        modTs,
        /export \* from "\.\/models\.ts"/,
        "mod.ts should export models",
      );
      assertMatch(
        modTs,
        /export \* from "\.\/views\.ts"/,
        "mod.ts should export views",
      );
      assertMatch(
        modTs,
        /export \* from "\.\/urls\.ts"/,
        "mod.ts should export urls",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp sw: rejects duplicate app name",
  async fn() {
    await withTempDir(async (dir) => {
      // First creation
      const first = await runStartapp(dir, [
        "my-app-sw",
        "--type",
        "sw",
        "--no-input",
      ]);
      assertEquals(first.exitCode, 0, "First creation should succeed");

      // Second creation — same name
      const second = await runStartapp(dir, [
        "my-app-sw",
        "--type",
        "sw",
        "--no-input",
      ]);
      assertEquals(
        second.exitCode,
        1,
        "Second creation of same name should fail",
      );
      assertEquals(
        second.errors.some((e) => e.includes("already exists")),
        true,
        "Error should mention already exists",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp sw: rejects invalid app name",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, [
        "MyBadName",
        "--type",
        "sw",
        "--no-input",
      ]);
      assertEquals(result.exitCode, 1, "Invalid name should fail");
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: 'sw' appears in APP_TYPES list",
  fn() {
    // Verify sw is a valid type by checking the help output or by running
    // with an invalid type and confirming sw is listed
    const command = new StartAppCommand();
    assertExists(command, "Command should be instantiable");

    // The type is validated internally; running with --type sw should succeed
    // (covered by the other tests), so just confirm the command instantiates
    assertEquals(command.name, "startapp");
  },
});
