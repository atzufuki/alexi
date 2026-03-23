/**
 * Tests for StartAppCommand
 *
 * Tests that startapp creates the correct unified directory structure
 * and file content. No app types — every app gets the full structure.
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
  const originalCwd = Deno.cwd();
  Deno.chdir(tempDir);

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
// Directory structure tests
// =============================================================================

Deno.test({
  name: "startapp: creates correct unified directory structure",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, ["my-app"]);

      assertEquals(result.exitCode, 0, "Command should succeed");

      const appDir = join(dir, "src/my-app");

      const expectedDirs = [
        appDir,
        join(appDir, "migrations"),
        join(appDir, "tests"),
        join(appDir, "assets/my-app"),
        join(appDir, "assets/my-app/components"),
        join(appDir, "workers/my-app"),
        join(appDir, "workers/my-app/templates/my-app"),
        join(appDir, "static/my-app"),
      ];

      for (const d of expectedDirs) {
        assertEquals(
          await fileExists(d),
          true,
          `${d} should exist`,
        );
      }
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// =============================================================================
// File creation tests
// =============================================================================

Deno.test({
  name: "startapp: creates all required root (server-side) files",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, ["my-app"]);

      assertEquals(result.exitCode, 0, "Command should succeed");

      const appDir = join(dir, "src/my-app");

      const expectedFiles = [
        join(appDir, "mod.ts"),
        join(appDir, "models.ts"),
        join(appDir, "views.ts"),
        join(appDir, "urls.ts"),
        join(appDir, "serializers.ts"),
        join(appDir, "viewsets.ts"),
        join(appDir, "migrations/0001_init.ts"),
        join(appDir, "tests/basic_test.ts"),
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
  name: "startapp: creates assets (frontend) files",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, ["my-app"]);
      assertEquals(result.exitCode, 0);

      const appDir = join(dir, "src/my-app");

      assertEquals(
        await fileExists(join(appDir, "assets/my-app/mod.ts")),
        true,
        "assets/my-app/mod.ts should exist",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: creates worker (Service Worker) files",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, ["my-app"]);
      assertEquals(result.exitCode, 0);

      const appDir = join(dir, "src/my-app");

      const workerFiles = [
        join(appDir, "workers/my-app/mod.ts"),
        join(appDir, "workers/my-app/models.ts"),
        join(appDir, "workers/my-app/endpoints.ts"),
        join(appDir, "workers/my-app/settings.ts"),
        join(appDir, "workers/my-app/urls.ts"),
        join(appDir, "workers/my-app/views.ts"),
        join(appDir, "workers/my-app/templates/my-app/base.html"),
        join(appDir, "workers/my-app/templates/my-app/index.html"),
      ];

      for (const file of workerFiles) {
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
  name: "startapp: creates static output files",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, ["my-app"]);
      assertEquals(result.exitCode, 0);

      const appDir = join(dir, "src/my-app");

      assertEquals(
        await fileExists(join(appDir, "static/my-app/index.html")),
        true,
        "static/my-app/index.html should exist",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// =============================================================================
// File content tests — root (server-side)
// =============================================================================

Deno.test({
  name: "startapp: mod.ts exports models, views, urls, serializers, viewsets",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app"]);

      const modTs = await readFile(join(dir, "src/my-app/mod.ts"));

      assertMatch(modTs, /export \* from "\.\/models\.ts"/);
      assertMatch(modTs, /export \* from "\.\/views\.ts"/);
      assertMatch(modTs, /export \* from "\.\/urls\.ts"/);
      assertMatch(modTs, /export \* from "\.\/serializers\.ts"/);
      assertMatch(modTs, /export \* from "\.\/viewsets\.ts"/);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: mod.ts exports named AppConfig",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app"]);

      const modTs = await readFile(join(dir, "src/my-app/mod.ts"));

      assertMatch(modTs, /export const MyAppConfig: AppConfig/);
      assertMatch(modTs, /name: "my-app"/);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: models.ts imports from @alexi/db",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app"]);

      const modelsTs = await readFile(join(dir, "src/my-app/models.ts"));

      assertMatch(modelsTs, /@alexi\/db/);
      assertMatch(modelsTs, /class ExampleModel extends Model/);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// =============================================================================
// File content tests — worker (Service Worker)
// =============================================================================

Deno.test({
  name:
    "startapp: worker mod.ts has staticfiles config with worker and asset entries",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app"]);

      const workerModTs = await readFile(
        join(dir, "src/my-app/workers/my-app/mod.ts"),
      );

      assertMatch(workerModTs, /staticfiles:/);
      assertMatch(
        workerModTs,
        /entrypoint: "\.\/workers\/my-app\/mod\.ts"/,
      );
      assertMatch(
        workerModTs,
        /outputFile: "\.\/static\/my-app\/worker\.js"/,
      );
      assertMatch(
        workerModTs,
        /entrypoint: "\.\/assets\/my-app\/mod\.ts"/,
      );
      assertMatch(
        workerModTs,
        /outputFile: "\.\/static\/my-app\/my-app\.js"/,
      );
      assertMatch(workerModTs, /templatesDir:/);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: worker mod.ts is a Service Worker entry point",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app"]);

      const workerModTs = await readFile(
        join(dir, "src/my-app/workers/my-app/mod.ts"),
      );

      assertMatch(workerModTs, /ServiceWorkerGlobalScope/);
      assertMatch(workerModTs, /Application/);
      assertMatch(workerModTs, /addEventListener\("install"/);
      assertMatch(workerModTs, /addEventListener\("activate"/);
      assertMatch(workerModTs, /addEventListener\("fetch"/);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: worker settings.ts configures IndexedDBBackend",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app"]);

      const settingsTs = await readFile(
        join(dir, "src/my-app/workers/my-app/settings.ts"),
      );

      assertMatch(settingsTs, /IndexedDBBackend/);
      assertMatch(settingsTs, /DATABASES/);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: worker views.ts uses templateView",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app"]);

      const viewsTs = await readFile(
        join(dir, "src/my-app/workers/my-app/views.ts"),
      );

      assertMatch(viewsTs, /templateView/);
      assertMatch(viewsTs, /my-app\/index\.html/);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// =============================================================================
// File content tests — static & templates
// =============================================================================

Deno.test({
  name: "startapp: base.html loads frontend JS as module",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app"]);

      const baseHtml = await readFile(
        join(dir, "src/my-app/workers/my-app/templates/my-app/base.html"),
      );

      assertMatch(baseHtml, /<!DOCTYPE html>/);
      assertMatch(baseHtml, /my-app\.js/);
      assertMatch(baseHtml, /type="module"/);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: static/index.html registers Service Worker",
  async fn() {
    await withTempDir(async (dir) => {
      await runStartapp(dir, ["my-app"]);

      const indexHtml = await readFile(
        join(dir, "src/my-app/static/my-app/index.html"),
      );

      assertMatch(indexHtml, /<!DOCTYPE html>/);
      assertMatch(indexHtml, /worker\.js/);
      assertMatch(indexHtml, /serviceWorker\.register/);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// =============================================================================
// Validation tests
// =============================================================================

Deno.test({
  name: "startapp: rejects duplicate app name",
  async fn() {
    await withTempDir(async (dir) => {
      const first = await runStartapp(dir, ["my-app"]);
      assertEquals(first.exitCode, 0, "First creation should succeed");

      const second = await runStartapp(dir, ["my-app"]);
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
  name: "startapp: rejects invalid app name",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, ["MyBadName"]);
      assertEquals(result.exitCode, 1, "Invalid name should fail");
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startapp: command is instantiable with correct name",
  fn() {
    const command = new StartAppCommand();
    assertExists(command, "Command should be instantiable");
    assertEquals(command.name, "startapp");
  },
});

// =============================================================================
// No --type flag tests (no app types)
// =============================================================================

Deno.test({
  name: "startapp: works without --type flag (no app types)",
  async fn() {
    await withTempDir(async (dir) => {
      const result = await runStartapp(dir, ["posts"]);

      assertEquals(result.exitCode, 0, "Should succeed without --type");

      // Should create the full unified structure
      const appDir = join(dir, "src/posts");
      assertEquals(await fileExists(appDir), true);
      assertEquals(await fileExists(join(appDir, "models.ts")), true);
      assertEquals(await fileExists(join(appDir, "assets/posts/mod.ts")), true);
      assertEquals(
        await fileExists(join(appDir, "workers/posts/mod.ts")),
        true,
      );
      assertEquals(
        await fileExists(join(appDir, "static/posts/index.html")),
        true,
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
