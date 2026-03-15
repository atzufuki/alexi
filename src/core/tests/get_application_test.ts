/**
 * Tests for _buildApplication() INSTALLED_APPS processing
 *
 * @module @alexi/core/tests/get_application
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getWorkerApplication } from "../get_application.ts";
import { appRegistrationHooks } from "@alexi/types";
import {
  globalChainLoader,
  globalFilesystemLoader,
  templateRegistry,
} from "@alexi/views";
import type { AppConfig } from "@alexi/types";

// =============================================================================
// Helpers
// =============================================================================

/** Drain the globalFilesystemLoader dirs after each test by replacing with empty. */
function clearFilesystemLoaderDirs(): void {
  // Access internal dirs via type cast for test isolation
  (globalFilesystemLoader as unknown as { dirs: string[] }).dirs.length = 0;
}

// =============================================================================
// Tests
// =============================================================================

Deno.test("getWorkerApplication: returns Application with no INSTALLED_APPS", async () => {
  const app = await getWorkerApplication({});
  assertExists(app);
  assertExists(app.handler);
});

Deno.test(
  "getWorkerApplication: calls ready() on each installed app",
  async () => {
    const called: string[] = [];

    const appA: AppConfig = {
      name: "test-app-a",
      ready() {
        called.push("a");
      },
    };
    const appB: AppConfig = {
      name: "test-app-b",
      async ready() {
        called.push("b");
      },
    };

    await getWorkerApplication({ INSTALLED_APPS: [appA, appB] });

    assertEquals(called, ["a", "b"]);
  },
);

Deno.test(
  "getWorkerApplication: registers template dirs when APP_DIRS is true",
  async () => {
    clearFilesystemLoaderDirs();

    const app: AppConfig = {
      name: "test-app-template",
      appPath: "/fake/path/to/my-app",
    };

    await getWorkerApplication({
      INSTALLED_APPS: [app],
      TEMPLATES: [{ APP_DIRS: true }],
    });

    const dirs = (globalFilesystemLoader as unknown as { dirs: string[] }).dirs;
    assertEquals(
      dirs.some((d) => d.endsWith("my-app/templates")),
      true,
    );

    clearFilesystemLoaderDirs();
  },
);

Deno.test(
  "getWorkerApplication: registers TEMPLATES[0].DIRS entries",
  async () => {
    clearFilesystemLoaderDirs();

    await getWorkerApplication({
      INSTALLED_APPS: [],
      TEMPLATES: [{ DIRS: ["/custom/templates"] }],
    });

    const dirs = (globalFilesystemLoader as unknown as { dirs: string[] }).dirs;
    assertEquals(dirs.includes("/custom/templates"), true);

    clearFilesystemLoaderDirs();
  },
);

Deno.test(
  "getWorkerApplication: skips template dir registration when APP_DIRS is false",
  async () => {
    clearFilesystemLoaderDirs();

    const app: AppConfig = {
      name: "test-app-no-dirs",
      appPath: "/some/path",
    };

    await getWorkerApplication({
      INSTALLED_APPS: [app],
      TEMPLATES: [{ APP_DIRS: false }],
    });

    const dirs = (globalFilesystemLoader as unknown as { dirs: string[] }).dirs;
    assertEquals(dirs.length, 0);

    clearFilesystemLoaderDirs();
  },
);

Deno.test(
  "getWorkerApplication: invokes appRegistrationHooks for each installed app",
  async () => {
    const registered: Array<{ name: string; path: string | undefined }> = [];

    const hook = (name: string, path: string | undefined) => {
      registered.push({ name, path });
    };
    appRegistrationHooks.push(hook);

    try {
      const app: AppConfig = {
        name: "hook-test-app",
        appPath: "/hook/path",
      };

      await getWorkerApplication({ INSTALLED_APPS: [app] });

      assertEquals(registered.length >= 1, true);
      assertEquals(
        registered.some((r) => r.name === "hook-test-app"),
        true,
      );
      assertEquals(
        registered.find((r) => r.name === "hook-test-app")?.path,
        "/hook/path",
      );
    } finally {
      // Remove the hook we added
      const idx = appRegistrationHooks.indexOf(hook);
      if (idx !== -1) appRegistrationHooks.splice(idx, 1);
    }
  },
);

Deno.test(
  "getWorkerApplication: resolves file:// appPath for template dir registration",
  async () => {
    clearFilesystemLoaderDirs();

    const appPath = new URL("./", import.meta.url).href; // file:// URL

    const app: AppConfig = {
      name: "fileurl-app",
      appPath,
    };

    await getWorkerApplication({
      INSTALLED_APPS: [app],
      TEMPLATES: [{ APP_DIRS: true }],
    });

    const dirs = (globalFilesystemLoader as unknown as { dirs: string[] }).dirs;
    assertEquals(
      dirs.some((d) => d.endsWith("/templates")),
      true,
    );
    // Should NOT contain "file://" in the path
    assertEquals(dirs.every((d) => !d.startsWith("file://")), true);

    clearFilesystemLoaderDirs();
  },
);
