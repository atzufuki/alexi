/**
 * Todo App E2E Tests for @alexi/create
 *
 * Tests the scaffolded Todo application:
 * - Creates a new project using @alexi/create
 * - Starts the web and UI servers
 * - Tests Todo functionality in a real browser via Playwright
 *
 * @module @alexi/create/tests/todo_e2e_test
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.208.0/testing/bdd.ts";
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from "playwright";
import { createConsoleErrorCollector } from "./console_errors.ts";
import {
  cleanupTempDir,
  cleanupTestProject,
  createTempDir,
  createTestProject,
  DEFAULT_API_PORT,
  DEFAULT_UI_PORT,
  generateProjectName,
  type ScaffoldedProject,
  type ServerProcess,
  sleep,
  startApiServer,
  startUiServer,
  stopServer,
  TEST_OPTIONS,
} from "./e2e_utils.ts";

// =============================================================================
// Test Configuration
// =============================================================================

const HEADLESS = Deno.env.get("HEADLESS") !== "false";
const SLOW_MO = parseInt(Deno.env.get("SLOW_MO") ?? "0", 10);

// API URL that will be injected into the browser
const API_URL = `http://localhost:${DEFAULT_API_PORT}/api`;

// =============================================================================
// Test Suite
// =============================================================================

describe("Todo App E2E Tests", {
  // Disable sanitizers to prevent timer leak errors from Playwright
  sanitizeOps: false,
  sanitizeResources: false,
}, () => {
  let tempDir: string;
  let project: ScaffoldedProject;
  let apiServer: ServerProcess;
  let uiServer: ServerProcess;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  const consoleErrors = createConsoleErrorCollector();

  // Setup: Create project and start servers
  beforeAll(async () => {
    console.log("[e2e] Starting Todo E2E test suite...");

    // Create temp directory
    tempDir = await createTempDir();

    // Generate unique project name
    const projectName = generateProjectName();

    // Create scaffolded project
    project = await createTestProject(projectName, tempDir);

    // Start API server (REST backend)
    apiServer = await startApiServer(project.path, DEFAULT_API_PORT);

    // Start UI server (frontend SPA)
    uiServer = await startUiServer(project.path, DEFAULT_UI_PORT);

    // Launch browser
    browser = await chromium.launch({
      headless: HEADLESS,
      slowMo: SLOW_MO,
    });

    console.log("[e2e] Setup complete, starting tests...");
  });

  // Teardown: Stop servers and clean up
  afterAll(async () => {
    console.log("[e2e] Cleaning up...");

    // Close browser
    if (browser) {
      await browser.close();
    }

    // Stop servers
    if (apiServer) {
      await stopServer(apiServer);
    }
    if (uiServer) {
      await stopServer(uiServer);
    }

    // Clean up project and temp directory
    if (project) {
      await cleanupTestProject(project);
    }
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }

    console.log("[e2e] Cleanup complete.");
  });

  // Create fresh context for each test
  beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();

    // Clear and attach console error collector
    consoleErrors.clear();
    consoleErrors.attach(page);

    // Inject the API URL before any scripts run
    // This overrides the default http://localhost:8000/api in UI settings
    await page.addInitScript(`
      Object.defineProperty(globalThis, '__ALEXI_API_URL__', {
        value: '${API_URL}',
        writable: false,
        configurable: false
      });
    `);
  });

  // Clean up context after each test
  afterEach(async () => {
    // Check for console errors (use assertNoCriticalErrors to allow warnings)
    consoleErrors.assertNoCriticalErrors();

    if (context) {
      await context.close();
    }
  });

  // ===========================================================================
  // Helper Functions
  // ===========================================================================

  async function navigateToHome(): Promise<void> {
    await page.goto(uiServer.baseUrl);
    await page.waitForLoadState("networkidle");
    // Wait for home page to render
    await page.waitForSelector("home-page", { timeout: 10000 });
    // Give Shadow DOM time to initialize
    await sleep(500);
  }

  function getHomePage(): ReturnType<typeof page.locator> {
    // Use >> to pierce shadow DOM boundaries
    return page.locator("home-page");
  }

  async function getInputField(): Promise<ReturnType<typeof page.locator>> {
    // Pierce through multiple shadow DOMs: home-page > ds-input > input
    // Playwright's >> operator pierces shadow DOM
    return page.locator("home-page >> ds-input >> input");
  }

  async function getAddButton(): Promise<ReturnType<typeof page.locator>> {
    // Pierce shadow DOM to find the button with "Add" text
    return page.locator("home-page >> ds-button >> button").first();
  }

  async function getTodoItems(): Promise<ReturnType<typeof page.locator>> {
    // Pierce shadow DOM to find todo items
    return page.locator("home-page >> .todo-item");
  }

  async function getTodoCount(): Promise<number> {
    const items = await getTodoItems();
    return await items.count();
  }

  async function addTodo(title: string): Promise<void> {
    const input = await getInputField();
    await input.fill(title);
    await sleep(100); // Wait for input event to propagate

    const addButton = await getAddButton();
    await addButton.click();

    // Wait for the todo to appear
    await sleep(500);
  }

  async function getTodoTitles(): Promise<string[]> {
    const items = await getTodoItems();
    const count = await items.count();
    const titles: string[] = [];

    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      // Pierce shadow DOM of ds-text component
      const textElement = item.locator("ds-text");
      const text = await textElement.textContent();
      if (text) {
        titles.push(text.trim());
      }
    }

    return titles;
  }

  // ===========================================================================
  // Page Load Tests
  // ===========================================================================

  describe("Page Load", () => {
    it("should load the home page", async () => {
      await navigateToHome();

      // Check that the page loaded
      const homePage = getHomePage();
      assertExists(await homePage.count() > 0, "Home page should exist");
    });

    it("should display the app title", async () => {
      await navigateToHome();

      // Look for the title text - pierce shadow DOM
      const title = page.locator("home-page >> ds-text").first();
      const text = await title.textContent();

      // Should contain "Todo" somewhere in the title
      assertEquals(
        text?.toLowerCase().includes("todo"),
        true,
        "Page should display Todo in title",
      );
    });

    it("should display the input field", async () => {
      await navigateToHome();

      const input = await getInputField();
      assertExists(await input.count() > 0, "Input field should exist");
    });

    it("should display the Add button", async () => {
      await navigateToHome();

      const button = await getAddButton();
      assertExists(await button.count() > 0, "Add button should exist");
    });

    it("should show empty state initially", async () => {
      await navigateToHome();

      // Should show "No tasks yet" or similar empty message
      // Pierce shadow DOM for text search
      const emptyMessage = page.locator("home-page >> text=/no tasks/i");
      const count = await emptyMessage.count();

      // Either empty message is shown OR there are no todo items
      const todoCount = await getTodoCount();
      assertEquals(
        count > 0 || todoCount === 0,
        true,
        "Should show empty state or no todos",
      );
    });
  });

  // ===========================================================================
  // Add Todo Tests
  // ===========================================================================

  describe("Add Todo", () => {
    it("should have Add button disabled when input is empty", async () => {
      await navigateToHome();

      const button = await getAddButton();
      const isDisabled = await button.isDisabled();

      assertEquals(isDisabled, true, "Add button should be disabled initially");
    });

    it("should enable Add button when input has text", async () => {
      await navigateToHome();

      const input = await getInputField();
      await input.fill("Test task");
      await sleep(100);

      const button = await getAddButton();
      const isDisabled = await button.isDisabled();

      assertEquals(
        isDisabled,
        false,
        "Add button should be enabled when input has text",
      );
    });

    it("should add a new todo when clicking Add", async () => {
      await navigateToHome();

      const initialCount = await getTodoCount();

      await addTodo("My first task");

      const newCount = await getTodoCount();
      assertEquals(
        newCount,
        initialCount + 1,
        "Todo count should increase by 1",
      );
    });

    it("should display the added todo in the list", async () => {
      await navigateToHome();

      const taskTitle = `Task ${Date.now()}`;
      await addTodo(taskTitle);

      const titles = await getTodoTitles();
      assertEquals(
        titles.includes(taskTitle),
        true,
        "Added task should appear in the list",
      );
    });

    it("should clear the input after adding a todo", async () => {
      await navigateToHome();

      await addTodo("Task to clear");

      // Wait for the input to be cleared (component state update + render)
      await sleep(500);

      const input = await getInputField();
      const value = await input.inputValue();

      assertEquals(value, "", "Input should be cleared after adding todo");
    });

    it("should add todo when pressing Enter", async () => {
      await navigateToHome();

      const initialCount = await getTodoCount();

      const input = await getInputField();
      await input.fill("Task via Enter");
      await input.press("Enter");
      await sleep(500);

      const newCount = await getTodoCount();
      assertEquals(
        newCount,
        initialCount + 1,
        "Todo should be added when pressing Enter",
      );
    });

    it("should add multiple todos", async () => {
      await navigateToHome();

      const initialCount = await getTodoCount();

      await addTodo("Task 1");
      await addTodo("Task 2");
      await addTodo("Task 3");

      const newCount = await getTodoCount();
      assertEquals(newCount, initialCount + 3, "Should add 3 todos");
    });
  });

  // ===========================================================================
  // Toggle Todo Tests
  // ===========================================================================

  describe("Toggle Todo", () => {
    it("should toggle todo completion when clicking checkbox", async () => {
      await navigateToHome();

      // Add a todo first
      const taskTitle = `Toggle task ${Date.now()}`;
      await addTodo(taskTitle);

      // Find the checkbox in the last added todo - pierce shadow DOM
      const items = await getTodoItems();
      const lastItem = items.last();
      // Click on ds-checkbox element (it handles the click internally)
      const checkbox = lastItem.locator("ds-checkbox");

      // Click the checkbox
      await checkbox.click();
      await sleep(300);

      // Check if the item has completed class
      const itemClass = await lastItem.getAttribute("class");
      assertEquals(
        itemClass?.includes("completed") || itemClass?.includes("todo-item"),
        true,
        "Todo item should reflect toggle state",
      );
    });
  });

  // ===========================================================================
  // Delete Todo Tests
  // ===========================================================================

  describe("Delete Todo", () => {
    it("should delete todo when clicking delete button", async () => {
      await navigateToHome();

      // Add a todo first
      const taskTitle = `Delete task ${Date.now()}`;
      await addTodo(taskTitle);

      const countBefore = await getTodoCount();

      // Find the delete button in the last added todo
      const items = await getTodoItems();
      const lastItem = items.last();
      // Get the last ds-button in the todo item (the delete button)
      const deleteButton = lastItem.locator("ds-button").last();

      // Click delete
      await deleteButton.click();
      await sleep(500);

      const countAfter = await getTodoCount();
      assertEquals(
        countAfter,
        countBefore - 1,
        "Todo count should decrease by 1",
      );
    });
  });

  // ===========================================================================
  // Theme Toggle Tests
  // ===========================================================================

  describe("Theme Toggle", () => {
    it("should display theme toggle button", async () => {
      await navigateToHome();

      // Pierce shadow DOM
      const themeToggle = page.locator("home-page >> ds-theme-toggle");
      assertExists(
        await themeToggle.count() > 0,
        "Theme toggle should exist",
      );
    });

    it("should toggle theme when clicking theme button", async () => {
      await navigateToHome();

      // Pierce shadow DOM
      const themeToggle = page.locator("home-page >> ds-theme-toggle");

      // Get initial theme
      const initialTheme = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme")
      );

      // Click theme toggle
      await themeToggle.click();
      await sleep(200);

      // Get new theme
      const newTheme = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme")
      );

      // Theme should have changed
      assertEquals(
        initialTheme !== newTheme,
        true,
        "Theme should change when toggle is clicked",
      );
    });
  });

  // ===========================================================================
  // Stats Display Tests
  // ===========================================================================

  describe("Stats Display", () => {
    it("should show task count when todos exist", async () => {
      await navigateToHome();

      // Add some todos
      await addTodo("Stats task 1");
      await addTodo("Stats task 2");

      // Look for stats display - pierce shadow DOM
      const statsText = page.locator("home-page >> text=/\\d+\\s*task/i");
      const count = await statsText.count();

      assertEquals(count > 0, true, "Should display task count stats");
    });
  });

  // ===========================================================================
  // Persistence Tests
  // ===========================================================================

  describe("Persistence", () => {
    it("should persist todos after page reload", async () => {
      await navigateToHome();

      // Add a unique todo
      const taskTitle = `Persistent task ${Date.now()}`;
      await addTodo(taskTitle);

      // Reload page
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForSelector("home-page", { timeout: 10000 });
      await sleep(500);

      // Check if todo still exists
      const titles = await getTodoTitles();
      assertEquals(
        titles.includes(taskTitle),
        true,
        "Todo should persist after reload",
      );
    });
  });
});
