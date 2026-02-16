/**
 * Scaffold Tests for @alexi/create
 *
 * Tests that project scaffolding creates the correct directory structure
 * and files. These tests run without starting servers or browser.
 *
 * @module @alexi/create/tests/scaffold_test
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
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
        `src/${project.name}-web`,
        `src/${project.name}-web/tests`,
        `src/${project.name}-ui`,
        `src/${project.name}-ui/templates`,
        `src/${project.name}-ui/components`,
        `src/${project.name}-ui/styles`,
        `src/${project.name}-ui/static/${project.name}-ui`,
        `src/${project.name}-desktop`,
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
      const requiredTasks = ["dev", "dev:web", "dev:ui", "dev:desktop", "test"];

      for (const task of requiredTasks) {
        assertEquals(
          content.includes(`"${task}"`),
          true,
          `deno.jsonc should have ${task} task`,
        );
      }
    });

    // ==========================================================================
    // Project Settings Tests
    // ==========================================================================

    await t.step("creates project settings files", async () => {
      const settingsFiles = [
        "project/settings.ts",
        "project/web.settings.ts",
        "project/ui.settings.ts",
        "project/desktop.settings.ts",
      ];

      for (const file of settingsFiles) {
        const fullPath = `${project.path}/${file}`;
        try {
          const stat = await Deno.stat(fullPath);
          assertEquals(stat.isFile, true, `${file} should be a file`);
        } catch {
          throw new Error(`Settings file ${file} does not exist`);
        }
      }
    });

    // ==========================================================================
    // Web App Tests
    // ==========================================================================

    await t.step("creates web app files", async () => {
      const webFiles = [
        `src/${project.name}-web/app.ts`,
        `src/${project.name}-web/mod.ts`,
        `src/${project.name}-web/models.ts`,
        `src/${project.name}-web/serializers.ts`,
        `src/${project.name}-web/viewsets.ts`,
        `src/${project.name}-web/urls.ts`,
        `src/${project.name}-web/tests/todo_test.ts`,
      ];

      for (const file of webFiles) {
        const fullPath = `${project.path}/${file}`;
        try {
          const stat = await Deno.stat(fullPath);
          assertEquals(stat.isFile, true, `${file} should be a file`);
        } catch {
          throw new Error(`Web app file ${file} does not exist`);
        }
      }
    });

    await t.step("web models.ts defines TodoModel", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}-web/models.ts`,
      );
      assertEquals(
        content.includes("TodoModel"),
        true,
        "models.ts should define TodoModel",
      );
      assertEquals(
        content.includes("class TodoModel extends Model"),
        true,
        "TodoModel should extend Model",
      );
    });

    // ==========================================================================
    // UI App Tests
    // ==========================================================================

    await t.step("creates UI app files", async () => {
      const uiFiles = [
        `src/${project.name}-ui/app.ts`,
        `src/${project.name}-ui/mod.ts`,
        `src/${project.name}-ui/models.ts`,
        `src/${project.name}-ui/endpoints.ts`,
        `src/${project.name}-ui/settings.ts`,
        `src/${project.name}-ui/utils.ts`,
        `src/${project.name}-ui/views.ts`,
        `src/${project.name}-ui/urls.ts`,
        `src/${project.name}-ui/main.ts`,
        `src/${project.name}-ui/templates/home.ts`,
        `src/${project.name}-ui/styles/global.css`,
        `src/${project.name}-ui/static/${project.name}-ui/index.html`,
      ];

      for (const file of uiFiles) {
        const fullPath = `${project.path}/${file}`;
        try {
          const stat = await Deno.stat(fullPath);
          assertEquals(stat.isFile, true, `${file} should be a file`);
        } catch {
          throw new Error(`UI app file ${file} does not exist`);
        }
      }
    });

    await t.step("creates UI component files", async () => {
      const componentFiles = [
        `src/${project.name}-ui/components/mod.ts`,
        `src/${project.name}-ui/components/ds_button.ts`,
        `src/${project.name}-ui/components/ds_input.ts`,
        `src/${project.name}-ui/components/ds_checkbox.ts`,
        `src/${project.name}-ui/components/ds_icon.ts`,
        `src/${project.name}-ui/components/ds_text.ts`,
        `src/${project.name}-ui/components/ds_card.ts`,
        `src/${project.name}-ui/components/ds_theme_toggle.ts`,
      ];

      for (const file of componentFiles) {
        const fullPath = `${project.path}/${file}`;
        try {
          const stat = await Deno.stat(fullPath);
          assertEquals(stat.isFile, true, `${file} should be a file`);
        } catch {
          throw new Error(`UI component file ${file} does not exist`);
        }
      }
    });

    await t.step("home.ts defines HomePage component", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}-ui/templates/home.ts`,
      );
      assertEquals(
        content.includes("HomePage"),
        true,
        "home.ts should define HomePage",
      );
      assertEquals(
        content.includes('HomePage.define("home-page")'),
        true,
        "HomePage should be registered as home-page custom element",
      );
    });

    await t.step("index.html contains project name", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}-ui/static/${project.name}-ui/index.html`,
      );
      assertEquals(
        content.includes("<!DOCTYPE html>"),
        true,
        "index.html should be valid HTML",
      );
      assertEquals(
        content.includes("<title>"),
        true,
        "index.html should have a title",
      );
    });

    await t.step("global.css contains Alexi design tokens", async () => {
      const content = await Deno.readTextFile(
        `${project.path}/src/${project.name}-ui/styles/global.css`,
      );
      assertEquals(
        content.includes("--alexi-"),
        true,
        "global.css should contain Alexi CSS variables",
      );
    });

    // ==========================================================================
    // Desktop App Tests
    // ==========================================================================

    await t.step("creates desktop app files", async () => {
      const desktopFiles = [
        `src/${project.name}-desktop/app.ts`,
        `src/${project.name}-desktop/mod.ts`,
        `src/${project.name}-desktop/bindings.ts`,
      ];

      for (const file of desktopFiles) {
        const fullPath = `${project.path}/${file}`;
        try {
          const stat = await Deno.stat(fullPath);
          assertEquals(stat.isFile, true, `${file} should be a file`);
        } catch {
          throw new Error(`Desktop app file ${file} does not exist`);
        }
      }
    });

    // ==========================================================================
    // Import Validation Tests
    // ==========================================================================

    await t.step("UI components import from @html-props/core", async () => {
      const buttonContent = await Deno.readTextFile(
        `${project.path}/src/${project.name}-ui/components/ds_button.ts`,
      );
      assertEquals(
        buttonContent.includes("@html-props/core"),
        true,
        "DSButton should import from @html-props/core",
      );
    });

    await t.step("web models import from @alexi/db", async () => {
      const modelsContent = await Deno.readTextFile(
        `${project.path}/src/${project.name}-web/models.ts`,
      );
      assertEquals(
        modelsContent.includes("@alexi/db"),
        true,
        "models.ts should import from @alexi/db",
      );
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
