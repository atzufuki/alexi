# @alexi/create E2E Tests

End-to-end tests for the Alexi project scaffolding tool. These tests verify that
scaffolded Todo applications work correctly in a real browser environment.

## What These Tests Do

1. **Create a new project** using `@alexi/create` in a temporary directory
2. **Start the web server** (REST API) and **UI server** (frontend SPA)
3. **Run Playwright tests** against the Todo app in a real Chromium browser
4. **Clean up** the temporary project and servers

## Prerequisites

### 1. Install Playwright

Before running E2E tests, install the Playwright browsers:

```bash
# From the alexi root directory
deno task playwright:install
```

This installs Chromium for browser automation.

### 2. Dependencies

The tests use:

- **Playwright** - Browser automation
- **Deno std/testing/bdd** - Test organization (describe/it)
- **Deno std/assert** - Assertions

## Running Tests

### All Create Package Tests

```bash
# Run all tests (scaffold + E2E)
deno task test:create
```

### Scaffold Tests Only (Fast, No Browser)

```bash
# Test project creation without starting servers or browser
deno task test:scaffold
```

### E2E Tests (Headless Mode - CI/Default)

```bash
# Run E2E tests with Playwright
deno task test:e2e
```

### E2E Tests (Headed Mode - Debugging)

```bash
# Run with visible browser
deno task test:e2e:headed

# Or set environment variable
HEADLESS=false deno task test:e2e
```

### Slow Motion (Debugging)

```bash
# Slow down browser actions by 100ms
SLOW_MO=100 deno task test:e2e:headed
```

### Run Specific Test File

```bash
deno test -A --unstable-kv --no-check src/create/tests/todo_e2e_test.ts
```

## Test Structure

```
src/create/tests/
├── README.md              # This file
├── e2e_utils.ts           # Test utilities (project creation, server management)
├── console_errors.ts      # Console error collector for Playwright
├── scaffold_test.ts       # Scaffold tests (no browser needed)
└── todo_e2e_test.ts       # Todo app E2E test suite (Playwright)
```

## Available Tasks

| Task                           | Description                                   |
| ------------------------------ | --------------------------------------------- |
| `deno task test:create`        | Run all create package tests                  |
| `deno task test:scaffold`      | Run scaffold tests only (fast)                |
| `deno task test:e2e`           | Run Playwright E2E tests (headless)           |
| `deno task test:e2e:headed`    | Run Playwright E2E tests with visible browser |
| `deno task playwright:install` | Install Playwright browsers                   |

## Test Categories

### Scaffold Tests (scaffold_test.ts)

- Project directory structure is created correctly
- All required files are generated
- deno.jsonc contains project name and tasks
- Models define TodoModel
- Components import from correct packages
- Invalid project names are rejected

### Page Load Tests (todo_e2e_test.ts)

- Home page loads correctly
- App title is displayed
- Input field and Add button exist
- Empty state shows when no todos

### Add Todo Tests

- Add button disabled when input empty
- Add button enabled when input has text
- Adding a todo increases count
- Todo appears in list after adding
- Input clears after adding
- Enter key adds todo
- Multiple todos can be added

### Toggle Todo Tests

- Clicking checkbox toggles completion

### Delete Todo Tests

- Clicking delete button removes todo

### Theme Toggle Tests

- Theme toggle button exists
- Clicking toggle changes theme

### Stats Display Tests

- Task count displays when todos exist

### Persistence Tests

- Todos persist after page reload

## Writing New Tests

### Test Structure

```typescript
import {
  afterAll,
  beforeAll,
  describe,
  it,
} from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { type Browser, chromium, type Page } from "playwright";

describe("My Test Suite", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("should do something", async () => {
    // Test code
  });
});
```

### Locator Best Practices

Prefer stable locators:

```typescript
// ✅ Good - element types and classes
page.locator("home-page").locator("ds-button");

// ✅ Good - text content for user-facing elements
page.locator("text=/add task/i");

// ❌ Avoid - brittle selectors
page.locator("div > div > button:nth-child(2)");
```

### Shadow DOM

Components use Shadow DOM, so pierce through with chained locators:

```typescript
// Get input inside ds-input component
const input = page.locator("home-page").locator("ds-input").locator("input");
```

## Troubleshooting

### Tests Timeout

- Increase `SERVER_STARTUP_TIMEOUT` in `e2e_utils.ts` (default: 120s)
- Check server logs for startup errors
- Ensure ports 9200/9201 are available

### Browser Not Found

```bash
# Reinstall Playwright browsers
deno task playwright:install
```

### Server Won't Start

- Check if ports are in use: `lsof -i :9200` / `netstat -an | findstr 9200`
- Kill orphaned processes from previous runs
- Check project path is correct

### Console Errors

The tests collect console errors. Some warnings are ignored:

- HMR messages
- Font loading errors
- Favicon errors
- Source map warnings

To see all errors, modify `console_errors.ts`.

## CI Integration

For CI environments:

```yaml
# GitHub Actions example
- name: Install Playwright
  run: deno task playwright:install

- name: Run E2E Tests
  run: deno task test:e2e
```

## Environment Variables

| Variable   | Default | Description                        |
| ---------- | ------- | ---------------------------------- |
| `HEADLESS` | `true`  | Set to `false` for visible browser |
| `SLOW_MO`  | `0`     | Milliseconds to slow down actions  |
