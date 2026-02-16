/**
 * Console Error Collector for Playwright Tests
 *
 * Collects and tracks console errors during page tests.
 * Allows asserting that no unexpected errors occurred.
 *
 * @module @alexi/create/tests/console_errors
 */

import type { Page } from "playwright";

/**
 * Console error entry
 */
export interface ConsoleError {
  type: string;
  text: string;
  location: string;
}

/**
 * Console error collector
 */
export interface ConsoleErrorCollector {
  /**
   * Attach collector to a Playwright page
   */
  attach(page: Page): void;

  /**
   * Get all collected errors
   */
  getErrors(): ConsoleError[];

  /**
   * Clear collected errors
   */
  clear(): void;

  /**
   * Assert that no errors were collected
   * @throws Error if any errors were collected
   */
  assertNoErrors(): void;

  /**
   * Assert that no critical errors were collected
   * Ignores warnings and info messages
   * @throws Error if any critical errors were collected
   */
  assertNoCriticalErrors(): void;
}

/**
 * Create a new console error collector
 */
export function createConsoleErrorCollector(): ConsoleErrorCollector {
  const errors: ConsoleError[] = [];

  // Patterns to ignore (common non-critical messages)
  const ignorePatterns = [
    // Development server messages
    /\[HMR\]/i,
    /hot module replacement/i,
    // Font loading (often fails in test environments)
    /failed to load font/i,
    /font.*not found/i,
    // Service worker messages
    /service worker/i,
    // Favicon (often not present in test projects)
    /favicon\.ico/i,
    // Source map warnings
    /source map/i,
    // Deprecation warnings (non-critical)
    /deprecated/i,
  ];

  function shouldIgnore(text: string): boolean {
    return ignorePatterns.some((pattern) => pattern.test(text));
  }

  return {
    attach(page: Page): void {
      page.on("console", (msg) => {
        const type = msg.type();
        // Only collect errors and warnings
        if (type === "error" || type === "warning") {
          const text = msg.text();
          if (!shouldIgnore(text)) {
            errors.push({
              type,
              text,
              location: msg.location().url || "unknown",
            });
          }
        }
      });

      // Also track page errors (uncaught exceptions)
      page.on("pageerror", (error) => {
        const text = error.message || String(error);
        if (!shouldIgnore(text)) {
          errors.push({
            type: "pageerror",
            text,
            location: "page",
          });
        }
      });
    },

    getErrors(): ConsoleError[] {
      return [...errors];
    },

    clear(): void {
      errors.length = 0;
    },

    assertNoErrors(): void {
      if (errors.length > 0) {
        const errorMessages = errors
          .map((e) => `[${e.type}] ${e.text} (${e.location})`)
          .join("\n");
        throw new Error(
          `Console errors occurred during test:\n${errorMessages}`,
        );
      }
    },

    assertNoCriticalErrors(): void {
      const criticalErrors = errors.filter(
        (e) => e.type === "error" || e.type === "pageerror",
      );
      if (criticalErrors.length > 0) {
        const errorMessages = criticalErrors
          .map((e) => `[${e.type}] ${e.text} (${e.location})`)
          .join("\n");
        throw new Error(
          `Critical console errors occurred during test:\n${errorMessages}`,
        );
      }
    },
  };
}
