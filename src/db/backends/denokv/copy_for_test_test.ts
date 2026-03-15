/**
 * DenoKVBackend.copyForTest / destroyTestCopy Tests
 *
 * Covers the three cases:
 *  1. Remote URL backend — throws immediately.
 *  2. In-memory backend (`:memory:` or no path) — returns a fresh, isolated
 *     backend without copying any file.
 *  3. File-based backend — copies the `.db` file, connects to the copy, and
 *     destroyTestCopy cleans up the temp file.
 *
 * @module
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
  assertRejects,
} from "jsr:@std/assert@1";
import { DenoKVBackend } from "./backend.ts";

// ============================================================================
// Helpers
// ============================================================================

/** Returns true when a file exists on disk. */
async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Tests
// ============================================================================

Deno.test({
  name: "DenoKVBackend.copyForTest",
  // DenoKV uses unstable APIs; we also skip the resource sanitizer because
  // Deno.openKv keeps an internal async handle alive for the duration of the
  // process and would otherwise be reported as a leaked resource.
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    // ------------------------------------------------------------------
    // 1. Remote URL — must throw an actionable error.
    // ------------------------------------------------------------------
    await t.step("throws for remote URL backend", async () => {
      const backend = new DenoKVBackend({
        name: "remote",
        url: "https://api.deno.com/databases/fake-uuid/connect",
      });

      // We do NOT connect — the check happens before any network I/O.
      await assertRejects(
        () => backend.copyForTest(),
        Error,
        "remote Deno Deploy KV URL",
      );
    });

    // ------------------------------------------------------------------
    // 2a. In-memory backend (explicit `:memory:`) — returns a fresh copy.
    // ------------------------------------------------------------------
    await t.step(
      "in-memory backend returns a fresh connected copy",
      async () => {
        const original = new DenoKVBackend({ name: "test", path: ":memory:" });
        await original.connect();

        const copy = await original.copyForTest();

        try {
          assertExists(copy);
          assertEquals(copy.isConnected, true);
          // The copy must be a distinct instance.
          assertNotEquals(copy, original);
        } finally {
          await copy.destroyTestCopy();
          await original.disconnect();
        }

        assertEquals(copy.isConnected, false);
      },
    );

    // ------------------------------------------------------------------
    // 2b. No-path backend (default KV) — same as in-memory for our logic.
    // ------------------------------------------------------------------
    await t.step(
      "no-path backend returns a fresh connected copy without file I/O",
      async () => {
        // path is undefined → treated as in-memory branch
        const original = new DenoKVBackend({ name: "nopath" });
        await original.connect();

        const copy = await original.copyForTest();

        try {
          assertEquals(copy.isConnected, true);
          assertNotEquals(copy, original);
        } finally {
          await copy.destroyTestCopy();
          await original.disconnect();
        }
      },
    );

    // ------------------------------------------------------------------
    // 3. File-based backend — file copy is created and removed.
    // ------------------------------------------------------------------
    await t.step("file-based backend copies the .db file", async () => {
      const tmpDir = await Deno.makeTempDir();
      const dbPath = `${tmpDir}/test.db`;

      // Create a minimal KV file by connecting and writing one entry.
      const original = new DenoKVBackend({ name: "filebased", path: dbPath });
      await original.connect();
      // Write a sentinel value so the file is non-trivially populated.
      await original.kv.set(["_meta", "sentinel"], "hello");

      const copy = await original.copyForTest() as DenoKVBackend & {
        _tempPath?: string;
      };

      const tempPath = copy._tempPath;

      try {
        assertExists(copy);
        assertExists(tempPath, "copy._tempPath should be set");
        assertEquals(copy.isConnected, true);

        // The temp file must exist on disk.
        assertEquals(await fileExists(tempPath!), true);

        // The original must still be connected and functional after copyForTest.
        assertEquals(original.isConnected, true);
      } finally {
        await copy.destroyTestCopy();
        await original.disconnect();
      }

      // After destroyTestCopy the temp file must be gone.
      assertEquals(await fileExists(tempPath!), false);
      assertEquals(copy.isConnected, false);

      // Clean up temp dir.
      await Deno.remove(tmpDir, { recursive: true });
    });

    // ------------------------------------------------------------------
    // 4. destroyTestCopy on an in-memory copy — idempotent, no errors.
    // ------------------------------------------------------------------
    await t.step(
      "destroyTestCopy on in-memory copy disconnects without errors",
      async () => {
        const original = new DenoKVBackend({ name: "mem2", path: ":memory:" });
        await original.connect();

        const copy = await original.copyForTest();
        assertEquals(copy.isConnected, true);

        await copy.destroyTestCopy(); // must not throw
        assertEquals(copy.isConnected, false);

        await original.disconnect();
      },
    );

    // ------------------------------------------------------------------
    // 5. Data written to the copy is not visible in the original.
    // ------------------------------------------------------------------
    await t.step(
      "writes to file copy are isolated from the original",
      async () => {
        const tmpDir = await Deno.makeTempDir();
        const dbPath = `${tmpDir}/isolation.db`;

        const original = new DenoKVBackend({
          name: "isolation",
          path: dbPath,
        });
        await original.connect();

        const copy = await original.copyForTest();

        try {
          // Write a value to the copy only.
          await copy.kv.set(["test", "isolation_key"], "copy_value");

          // The original must NOT see the new key.
          const fromOriginal = await original.kv.get(["test", "isolation_key"]);
          assertEquals(
            fromOriginal.value,
            null,
            "original should not see value written to copy",
          );

          // The copy must see it.
          const fromCopy = await copy.kv.get(["test", "isolation_key"]);
          assertEquals(fromCopy.value, "copy_value");
        } finally {
          await copy.destroyTestCopy();
          await original.disconnect();
          await Deno.remove(tmpDir, { recursive: true });
        }
      },
    );
  },
});
