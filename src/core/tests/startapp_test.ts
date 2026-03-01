/**
 * Tests for StartAppCommand
 *
 * Tests that startapp creates the correct directory structure and file content
 * for each app type.
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
// server app type tests
// =============================================================================

Deno.test({
  name: "startapp server: creates correct directory structure",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, [
        "my-api",
        "--type",
        "server",
        "--no-input",
      ]);

      assertEquals(result.exitCode, 0, "Command should succeed");

      const appDir = join(dir, "src/my-api");

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
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp server: creates all required files",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, [
        "my-api",
        "--type",
        "server",
        "--no-input",
      ]);

      assertEquals(result.exitCode, 0, "Command should succeed");

      const appDir = join(dir, "src/my-api");

      const expectedFiles = [
        join(appDir, "app.ts"),
        join(appDir, "mod.ts"),
        join(appDir, "models.ts"),
        join(appDir, "views.ts"),
        join(appDir, "urls.ts"),
        join(appDir, "serializers.ts"),
        join(appDir, "viewsets.ts"),
        join(appDir, "tests/basic_test.ts"),
        join(dir, "project/my-api.settings.ts"),
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
  name: "startapp server: settings has INSTALLED_APPS with web and db",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-api", "--type", "server", "--no-input"]);

      const settings = await readFile(
        join(dir, "project/my-api.settings.ts"),
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
        /@my-api\/server/,
        "settings should include the server app",
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
  name:
    "startapp server: mod.ts exports models, views, urls, serializers, viewsets",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-api", "--type", "server", "--no-input"]);

      const modTs = await readFile(join(dir, "src/my-api/mod.ts"));

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
      assertMatch(
        modTs,
        /export \* from "\.\/serializers\.ts"/,
        "mod.ts should export serializers",
      );
      assertMatch(
        modTs,
        /export \* from "\.\/viewsets\.ts"/,
        "mod.ts should export viewsets",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp server: rejects duplicate app name",
  async fn() {
    await withTempDir(async (dir) => {
      // First creation
      const first = await runStartapp(dir, [
        "my-api",
        "--type",
        "server",
        "--no-input",
      ]);
      assertEquals(first.exitCode, 0, "First creation should succeed");

      // Second creation — same name
      const second = await runStartapp(dir, [
        "my-api",
        "--type",
        "server",
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
  name: "startapp server: rejects invalid app name",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, [
        "MyBadName",
        "--type",
        "server",
        "--no-input",
      ]);
      assertEquals(result.exitCode, 1, "Invalid name should fail");
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: rejects invalid app type",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, [
        "my-app",
        "--type",
        "sw",
        "--no-input",
      ]);
      assertEquals(result.exitCode, 1, "Invalid type should fail");
      assertEquals(
        result.errors.some((e) => e.includes("Invalid app type")),
        true,
        "Error should mention invalid app type",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: 'server' appears in APP_TYPES list",
  fn() {
    const command = new StartAppCommand();
    assertExists(command, "Command should be instantiable");
    assertEquals(command.name, "startapp");
  },
});

// =============================================================================
// browser app type tests
// =============================================================================

Deno.test({
  name: "startapp browser: creates correct directory structure",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, [
        "my-app-browser",
        "--type",
        "browser",
        "--no-input",
      ]);

      assertEquals(result.exitCode, 0, "Command should succeed");

      const appDir = join(dir, "src/my-app-browser");

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
        await fileExists(join(appDir, "static/my-app-browser")),
        true,
        "static/my-app-browser/ should exist",
      );
      assertEquals(
        await fileExists(join(appDir, "templates/my-app-browser")),
        true,
        "templates/my-app-browser/ should exist",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp browser: creates all required files",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, [
        "my-app-browser",
        "--type",
        "browser",
        "--no-input",
      ]);

      assertEquals(result.exitCode, 0, "Command should succeed");

      const appDir = join(dir, "src/my-app-browser");

      const expectedFiles = [
        join(appDir, "app.ts"),
        join(appDir, "mod.ts"),
        join(appDir, "models.ts"),
        join(appDir, "endpoints.ts"),
        join(appDir, "views.ts"),
        join(appDir, "urls.ts"),
        join(appDir, "worker.ts"),
        join(appDir, "document.ts"),
        join(appDir, "static/my-app-browser/index.html"),
        join(appDir, "templates/my-app-browser/base.html"),
        join(appDir, "templates/my-app-browser/index.html"),
        join(appDir, "tests/basic_test.ts"),
        join(dir, "project/my-app-browser.settings.ts"),
      ];

      for (const file of expectedFiles) {
        assertEquals(await fileExists(file), true, file + " should exist");
      }
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name:
    "startapp browser: app.ts has staticfiles config with worker and document entries",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, [
        "my-app-browser",
        "--type",
        "browser",
        "--no-input",
      ]);

      const appTs = await readFile(join(dir, "src/my-app-browser/app.ts"));

      assertMatch(
        appTs,
        /staticfiles:/,
        "app.ts should have staticfiles config",
      );
      assertMatch(
        appTs,
        /entrypoint: "\.\/worker\.ts"/,
        "should have worker.ts entrypoint",
      );
      assertMatch(
        appTs,
        /entrypoint: "\.\/document\.ts"/,
        "should have document.ts entrypoint",
      );
      assertMatch(
        appTs,
        /outputFile: "\.\/static\/my-app-browser\/worker\.js"/,
        "worker outputFile should be worker.js",
      );
      assertMatch(
        appTs,
        /outputFile: "\.\/static\/my-app-browser\/document\.js"/,
        "document outputFile should be document.js",
      );
      assertMatch(appTs, /staticDir:/, "app.ts should set staticDir");
      assertMatch(appTs, /templatesDir:/, "app.ts should set templatesDir");
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp browser: worker.ts is a Service Worker entry point",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, [
        "my-app-browser",
        "--type",
        "browser",
        "--no-input",
      ]);

      const workerTs = await readFile(
        join(dir, "src/my-app-browser/worker.ts"),
      );

      assertMatch(
        workerTs,
        /ServiceWorkerGlobalScope/,
        "worker.ts should declare ServiceWorkerGlobalScope",
      );
      assertMatch(
        workerTs,
        /IndexedDBBackend/,
        "worker.ts should use IndexedDBBackend",
      );
      assertMatch(
        workerTs,
        /Application/,
        "worker.ts should use Application",
      );
      assertMatch(
        workerTs,
        /addEventListener\("install"/,
        "worker.ts should handle install event",
      );
      assertMatch(
        workerTs,
        /addEventListener\("activate"/,
        "worker.ts should handle activate event",
      );
      assertMatch(
        workerTs,
        /addEventListener\("fetch"/,
        "worker.ts should handle fetch event",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp browser: document.ts is a DOM context entry point",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, [
        "my-app-browser",
        "--type",
        "browser",
        "--no-input",
      ]);

      const documentTs = await readFile(
        join(dir, "src/my-app-browser/document.ts"),
      );

      assertMatch(
        documentTs,
        /RestBackend/,
        "document.ts should use RestBackend",
      );
      assertMatch(documentTs, /setup\(/, "document.ts should call setup");
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp browser: views.ts uses templateView",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, [
        "my-app-browser",
        "--type",
        "browser",
        "--no-input",
      ]);

      const viewsTs = await readFile(
        join(dir, "src/my-app-browser/views.ts"),
      );

      assertMatch(
        viewsTs,
        /templateView/,
        "views.ts should use templateView",
      );
      assertMatch(
        viewsTs,
        /my-app-browser\/index\.html/,
        "views.ts should reference index.html template",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp browser: base.html loads worker.js SW and document.js module",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, [
        "my-app-browser",
        "--type",
        "browser",
        "--no-input",
      ]);

      const baseHtml = await readFile(
        join(dir, "src/my-app-browser/templates/my-app-browser/base.html"),
      );

      assertMatch(baseHtml, /<!DOCTYPE html>/, "should be HTML doc");
      assertMatch(
        baseHtml,
        /document\.js/,
        "base.html should reference document.js",
      );
      assertMatch(
        baseHtml,
        /type="module"/,
        "document.js script should be type=module",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name:
    "startapp browser: static/index.html registers worker.js as Service Worker",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, [
        "my-app-browser",
        "--type",
        "browser",
        "--no-input",
      ]);

      const indexHtml = await readFile(
        join(dir, "src/my-app-browser/static/my-app-browser/index.html"),
      );

      assertMatch(indexHtml, /<!DOCTYPE html>/, "should be HTML doc");
      assertMatch(
        indexHtml,
        /worker\.js/,
        "index.html should register worker.js",
      );
      assertMatch(
        indexHtml,
        /serviceWorker\.register/,
        "index.html should call serviceWorker.register",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name:
    "startapp browser: settings has INSTALLED_APPS with staticfiles and web",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, [
        "my-app-browser",
        "--type",
        "browser",
        "--no-input",
      ]);

      const settings = await readFile(
        join(dir, "project/my-app-browser.settings.ts"),
      );

      assertMatch(
        settings,
        /@alexi\/staticfiles/,
        "settings should include staticfiles",
      );
      assertMatch(
        settings,
        /@alexi\/web/,
        "settings should include web server",
      );
      assertMatch(
        settings,
        /@my-app-browser\/browser/,
        "settings should include the browser app",
      );
      assertMatch(
        settings,
        /ROOT_URLCONF/,
        "settings should define ROOT_URLCONF",
      );
      assertMatch(settings, /API_URL/, "settings should define API_URL");
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp browser: mod.ts exports models, views, urls, and endpoints",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, [
        "my-app-browser",
        "--type",
        "browser",
        "--no-input",
      ]);

      const modTs = await readFile(join(dir, "src/my-app-browser/mod.ts"));

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
      assertMatch(
        modTs,
        /export \* from "\.\/endpoints\.ts"/,
        "mod.ts should export endpoints",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: 'browser' appears in APP_TYPES list",
  fn() {
    const command = new StartAppCommand();
    assertExists(command, "Command should be instantiable");
    assertEquals(command.name, "startapp");
  },
});
