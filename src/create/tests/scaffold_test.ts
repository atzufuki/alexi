/**
 * Scaffold Tests for @alexi/create
 *
 * Tests that project scaffolding creates the correct directory structure
 * and files for the unified app layout. These tests run without starting
 * servers or browser.
 *
 * @module @alexi/create/tests/scaffold_test
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { generateDenoJsonc } from "../templates/root/deno_jsonc.ts";
import {
  cleanupTempDir,
  cleanupTestProject,
  createTempDir,
  createTestProject,
  generateProjectName,
  type ScaffoldedProject,
  TEST_OPTIONS,
} from "./e2e_utils.ts";

// =============================================================================
// Scaffold Test Suite
// =============================================================================

Deno.test({
  name: "Scaffold Tests",
  ...TEST_OPTIONS,
  async fn(t) {
    let tempDir: string;
    let project: ScaffoldedProject;

    // Setup: Create temp directory and project
    await t.step("setup: create temp directory", async () => {
      tempDir = await createTempDir();
      assertExists(tempDir, "Temp directory should be created");
    });

    await t.step("create project with @alexi/create", async () => {
      const projectName = generateProjectName();
      project = await createTestProject(projectName, tempDir);

      assertExists(project.path, "Project path should exist");
      assertEquals(project.name, projectName, "Project name should match");
    });

    // ==========================================================================
    // Directory Structure Tests
    // ==========================================================================

    await t.step("creates root directory structure", async () => {
      const expectedDirs = [
        "project",
        "src",
        `src/${project.name}`,
        `src/${project.name}/tests`,
        `src/${project.name}/migrations`,
        `src/${project.name}/static/${project.name}`,
        `src/${project.name}/assets/${project.name}`,
        `src/${project.name}/workers/${project.name}`,
        `src/${project.name}/templates/${project.name}`,
      ];

      for (const dir of expectedDirs) {
        const fullPath = `${project.path}/${dir}`;
        try {
          const stat = await Deno.stat(fullPath);
          assertEquals(stat.isDirectory, true, `${dir} should be a directory`);
        } catch {
          throw new Error(`Directory ${dir} does not exist`);
        }
      }
    });

    // ==========================================================================
    // Root Files Tests
    // ==========================================================================

    await t.step("creates root files", async () => {
      const expectedFiles = [
        "deno.jsonc",
        "manage.ts",
        ".gitignore",
        "README.md",
        "project/http.ts",
      ];

      for (const file of expectedFiles) {
        const fullPath = `${project.path}/${file}`;
        try {
          const stat = await Deno.stat(fullPath);
          assertEquals(stat.isFile, true, `${file} should be a file`);
        } catch {
          throw new Error(`File ${file} does not exist`);
        }
      }
    });

    await t.step("deno.jsonc contains project name", async () => {
      const content = await Deno.readTextFile(`${project.path}/deno.jsonc`);
      assertEquals(
        content.includes(project.name),
        true,
        "deno.jsonc should contain project name",
      );
    });

    await t.step("deno.jsonc has required tasks", async () => {
      const content = await Deno.readTextFile(`${project.path}/deno.jsonc`);
      const requiredTasks = ["dev", "test"];

      for (const task of requiredTasks) {
        assertEquals(
          content.includes(`"${task}"`),
          true,
          `deno.jsonc should have ${task} task`,
        );
      }
    });

    await t.step("deno.jsonc has unified import map entries", async () => {
      const content = await Deno.readTextFile(`${project.path}/deno.jsonc`);
      const config = JSON.parse(content);

      // Check app import entries
      assertEquals(
        `@${project.name}/` in config.imports,
        true,
        `should have @${project.name}/ import`,
      );
      assertEquals(
        `@${project.name}/workers` in config.imports,
        true,
        `should have @${project.name}/workers import`,
      );
      assertEquals(
        `@${project.name}/workers/urls` in config.imports,
        true,
        `should have @${project.name}/workers/urls import`,
      );
    });

    // ==========================================================================
    // Project Settings Tests
    // ==========================================================================

    await t.step("creates single project settings file", async () => {
      const fullPath = `${project.path}/project/settings.ts`;
      try {
        const stat = await Deno.stat(fullPath);
        assertEquals(stat.isFile, true, "project/settings.ts should be a file");
      } catch {
        throw new Error("Settings file project/settings.ts does not exist");
      }
    });

    await t.step("settings.ts contains all required exports", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/project/settings.ts`,
      );
      const requiredExports = [
        "DATABASES",
        "INSTALLED_APPS",
        "ROOT_URLCONF",
        "DEFAULT_HOST",
        "DEFAULT_PORT",
        "STATIC_URL",
        "CORS_ORIGINS",
        "MIDDLEWARE",
        "ASSETFILES_DIRS",
        "STATICFILES_DIRS",
      ];

      for (const exp of requiredExports) {
        assertEquals(
          content.includes(exp),
          true,
          `settings.ts should contain ${exp}`,
        );
      }
    });

    await t.step("creates production.ts settings file", async () => {
      const fullPath = `${project.path}/project/production.ts`;
      try {
        const stat = await Deno.stat(fullPath);
        assertEquals(
          stat.isFile,
          true,
          "project/production.ts should be a file",
        );
      } catch {
        throw new Error("Settings file project/production.ts does not exist");
      }
    });

    await t.step("production.ts contains required exports", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/project/production.ts`,
      );
      const requiredExports = [
        "DEBUG",
        "SECRET_KEY",
        "DATABASES",
        "DENO_KV_URL",
      ];

      for (const exp of requiredExports) {
        assertEquals(
          content.includes(exp),
          true,
          `production.ts should contain ${exp}`,
        );
      }
    });

    await t.step("does NOT create old settings files", async () => {
      const oldFiles = [
        "project/web.settings.ts",
        "project/ui.settings.ts",
        "project/desktop.settings.ts",
      ];

      for (const file of oldFiles) {
        const fullPath = `${project.path}/${file}`;
        try {
          await Deno.stat(fullPath);
          throw new Error(`Old settings file ${file} should NOT exist`);
        } catch (error) {
          if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
          }
          // NotFound is expected — file correctly does not exist
        }
      }
    });

    await t.step("generateDenoJsonc produces correct Alexi versions", () => {
      // Test the template generator directly (before e2e patching replaces
      // JSR specifiers with file:// URLs)
      const raw = generateDenoJsonc("test-app", "1.2.3");
      const config = JSON.parse(raw);

      // Should not contain old hardcoded 0.18
      assertEquals(
        raw.includes("@^0.18"),
        false,
        "should not contain old hardcoded @^0.18 versions",
      );

      // All @alexi/* imports should use ^1.2.3
      const alexiImports = Object.entries(config.imports).filter(
        ([key]) => key.startsWith("@alexi/"),
      );
      assertEquals(
        alexiImports.length > 0,
        true,
        "should have @alexi/* imports",
      );

      for (const [key, value] of alexiImports) {
        assertEquals(
          (value as string).includes("@^1.2.3"),
          true,
          `${key} should use version @^1.2.3, got ${value}`,
        );
      }
    });

    await t.step("deno.jsonc has @alexi/core/management import", async () => {
      const content = await Deno.readTextFile(`${project.path}/deno.jsonc`);
      const config = JSON.parse(content);

      assertEquals(
        "@alexi/core/management" in config.imports,
        true,
        "should have @alexi/core/management import",
      );
    });

    await t.step(
      "deno.jsonc tasks use --settings ./project/settings.ts",
      async () => {
        const content = await Deno.readTextFile(`${project.path}/deno.jsonc`);

        assertEquals(
          content.includes("--settings ./project/settings.ts"),
          true,
          "tasks should use --settings ./project/settings.ts",
        );
        assertEquals(
          content.includes("--settings web"),
          false,
          "tasks should not use old --settings web convention",
        );
      },
    );

    await t.step(
      "deno.jsonc serve task references project/http.ts",
      async () => {
        const content = await Deno.readTextFile(`${project.path}/deno.jsonc`);
        assertEquals(
          content.includes("project/http.ts"),
          true,
          "serve task should reference project/http.ts",
        );
      },
    );

    await t.step("http.ts is NOT generated at project root", async () => {
      const fullPath = `${project.path}/http.ts`;
      try {
        await Deno.stat(fullPath);
        throw new Error("http.ts should NOT exist at project root");
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
          throw error;
        }
        // NotFound is expected — file correctly does not exist at root
      }
    });

    // ==========================================================================
    // Unified App — Server-side Files
    // ==========================================================================

    await t.step("creates unified app server-side files", async () => {
      const appFiles = [
        `src/${project.name}/app.ts`,
        `src/${project.name}/mod.ts`,
        `src/${project.name}/models.ts`,
        `src/${project.name}/serializers.ts`,
        `src/${project.name}/viewsets.ts`,
        `src/${project.name}/urls.ts`,
        `src/${project.name}/views.ts`,
        `src/${project.name}/tests/post_test.ts`,
        `src/${project.name}/migrations/0001_init.ts`,
      ];

      for (const file of appFiles) {
        const fullPath = `${project.path}/${file}`;
        try {
          const stat = await Deno.stat(fullPath);
          assertEquals(stat.isFile, true, `${file} should be a file`);
        } catch {
          throw new Error(`App file ${file} does not exist`);
        }
      }
    });

    await t.step("models.ts defines PostModel", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}/models.ts`,
      );
      assertEquals(
        content.includes("PostModel"),
        true,
        "models.ts should define PostModel",
      );
      assertEquals(
        content.includes("class PostModel extends Model"),
        true,
        "PostModel should extend Model",
      );
    });

    await t.step("models.ts imports from @alexi/db", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}/models.ts`,
      );
      assertEquals(
        content.includes("@alexi/db"),
        true,
        "models.ts should import from @alexi/db",
      );
    });

    await t.step(
      "urls.ts includes root route with HomeView.as_view()",
      async () => {
        const content = await Deno.readTextFile(
          `${project.path}/src/${project.name}/urls.ts`,
        );
        assertEquals(
          content.includes("HomeView"),
          true,
          "urls.ts should import and use HomeView",
        );
        assertEquals(
          content.includes('path("", HomeView.as_view())'),
          true,
          'urls.ts should have path("", HomeView.as_view()) for the root route',
        );
      },
    );

    // ==========================================================================
    // Unified App — Static Files
    // ==========================================================================

    // ==========================================================================
    // Unified App — Assets (Frontend)
    // ==========================================================================

    await t.step("creates assets entry point", async () => {
      const filePath =
        `${project.path}/src/${project.name}/assets/${project.name}/${project.name}.ts`;
      const stat = await Deno.stat(filePath);
      assertEquals(
        stat.isFile,
        true,
        `assets/${project.name}.ts should be a file`,
      );
    });

    // ==========================================================================
    // Unified App — Workers (Service Worker)
    // ==========================================================================

    await t.step("creates worker files", async () => {
      const workerFiles = [
        `src/${project.name}/workers/${project.name}/worker.ts`,
        `src/${project.name}/workers/${project.name}/models.ts`,
        `src/${project.name}/workers/${project.name}/endpoints.ts`,
        `src/${project.name}/workers/${project.name}/settings.ts`,
        `src/${project.name}/workers/${project.name}/urls.ts`,
        `src/${project.name}/workers/${project.name}/views.ts`,
        `src/${project.name}/templates/${project.name}/base.html`,
        `src/${project.name}/templates/${project.name}/index.html`,
        `src/${project.name}/templates/${project.name}/post_list.html`,
        `src/${project.name}/templates/${project.name}/post_form.html`,
      ];

      for (const file of workerFiles) {
        const fullPath = `${project.path}/${file}`;
        try {
          const stat = await Deno.stat(fullPath);
          assertEquals(stat.isFile, true, `${file} should be a file`);
        } catch {
          throw new Error(`Worker file ${file} does not exist`);
        }
      }
    });

    await t.step(
      "settings.ts defines ASSETFILES_DIRS with worker and asset entry points",
      async () => {
        const content = await Deno.readTextFile(
          `${project.path}/project/settings.ts`,
        );
        assertEquals(
          content.includes("ASSETFILES_DIRS"),
          true,
          "settings.ts should define ASSETFILES_DIRS",
        );
        assertEquals(
          content.includes("worker.ts"),
          true,
          "settings.ts ASSETFILES_DIRS should include worker.ts entry point",
        );
        assertEquals(
          content.includes(`${project.name}.ts`),
          true,
          `settings.ts ASSETFILES_DIRS should include ${project.name}.ts entry point`,
        );
      },
    );

    await t.step("worker.ts sets up Service Worker", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}/workers/${project.name}/worker.ts`,
      );
      assertEquals(
        content.includes("ServiceWorkerGlobalScope"),
        true,
        "worker.ts should declare ServiceWorkerGlobalScope",
      );
      assertEquals(
        content.includes("install"),
        true,
        "worker.ts should handle install event",
      );
      assertEquals(
        content.includes("fetch"),
        true,
        "worker.ts should handle fetch event",
      );
    });

    await t.step("worker endpoints.ts defines PostEndpoint", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}/workers/${project.name}/endpoints.ts`,
      );
      assertEquals(
        content.includes("PostEndpoint"),
        true,
        "endpoints.ts should define PostEndpoint",
      );
      assertEquals(
        content.includes("class PostEndpoint extends ModelEndpoint"),
        true,
        "PostEndpoint should extend ModelEndpoint",
      );
    });

    await t.step("worker models.ts re-exports PostModel", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}/workers/${project.name}/models.ts`,
      );
      assertEquals(
        content.includes("PostModel"),
        true,
        "worker models.ts should re-export PostModel",
      );
    });

    await t.step(
      "worker views.ts defines HomeView, PostListView, PostCreateView",
      async () => {
        const content = await Deno.readTextFile(
          `${project.path}/src/${project.name}/workers/${project.name}/views.ts`,
        );
        assertEquals(
          content.includes("HomeView"),
          true,
          "views.ts should define HomeView",
        );
        assertEquals(
          content.includes("PostListView"),
          true,
          "views.ts should define PostListView",
        );
        assertEquals(
          content.includes("PostCreateView"),
          true,
          "views.ts should define PostCreateView",
        );
      },
    );

    await t.step("worker urls.ts includes posts routes", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}/workers/${project.name}/urls.ts`,
      );
      assertEquals(
        content.includes("posts/"),
        true,
        "urls.ts should include posts/ route",
      );
      assertEquals(
        content.includes("posts/new/"),
        true,
        "urls.ts should include posts/new/ route",
      );
    });

    await t.step("post_list.html extends base and lists posts", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}/templates/${project.name}/post_list.html`,
      );
      assertEquals(
        content.includes(`extends "${project.name}/base.html"`),
        true,
        "post_list.html should extend base.html",
      );
      assertEquals(
        content.includes("{% for post in posts %}"),
        true,
        "post_list.html should iterate posts",
      );
    });

    await t.step("post_form.html extends base and has form", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}/templates/${project.name}/post_form.html`,
      );
      assertEquals(
        content.includes(`extends "${project.name}/base.html"`),
        true,
        "post_form.html should extend base.html",
      );
      assertEquals(
        content.includes("<form"),
        true,
        "post_form.html should contain a form element",
      );
    });

    // ==========================================================================
    // No Old App Directories
    // ==========================================================================

    await t.step("does NOT create old app directories", async () => {
      const oldDirs = [
        `src/${project.name}-web`,
        `src/${project.name}-ui`,
        `src/${project.name}-desktop`,
      ];

      for (const dir of oldDirs) {
        const fullPath = `${project.path}/${dir}`;
        try {
          await Deno.stat(fullPath);
          throw new Error(`Old directory ${dir} should NOT exist`);
        } catch (error) {
          if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
          }
          // NotFound is expected
        }
      }
    });

    // ==========================================================================
    // Cleanup
    // ==========================================================================

    await t.step("cleanup: remove test project", async () => {
      await cleanupTestProject(project);
    });

    await t.step("cleanup: remove temp directory", async () => {
      await cleanupTempDir(tempDir);
    });
  },
});

// =============================================================================
// Invalid Project Name Tests
// =============================================================================

Deno.test({
  name: "Scaffold: rejects invalid project names",
  ...TEST_OPTIONS,
  async fn(t) {
    let tempDir: string;

    await t.step("setup", async () => {
      tempDir = await createTempDir();
    });

    await t.step("rejects project name starting with number", async () => {
      try {
        await createTestProject("123project", tempDir);
        throw new Error("Should have rejected invalid name");
      } catch (error) {
        if (error instanceof Error) {
          assertEquals(
            error.message.includes("Invalid project name") ||
              error.message.includes("Failed to create project"),
            true,
            "Should reject project name starting with number",
          );
        }
      }
    });

    await t.step("rejects project name with uppercase", async () => {
      try {
        await createTestProject("MyProject", tempDir);
        throw new Error("Should have rejected invalid name");
      } catch (error) {
        if (error instanceof Error) {
          assertEquals(
            error.message.includes("Invalid project name") ||
              error.message.includes("Failed to create project"),
            true,
            "Should reject project name with uppercase",
          );
        }
      }
    });

    await t.step("rejects project name with spaces", async () => {
      try {
        await createTestProject("my project", tempDir);
        throw new Error("Should have rejected invalid name");
      } catch (error) {
        if (error instanceof Error) {
          assertEquals(
            error.message.includes("Invalid project name") ||
              error.message.includes("Failed to create project"),
            true,
            "Should reject project name with spaces",
          );
        }
      }
    });

    await t.step("cleanup", async () => {
      await cleanupTempDir(tempDir);
    });
  },
});
