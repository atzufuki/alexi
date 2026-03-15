/**
 * SQLiteBackend.copyForTest / destroyTestCopy Tests
 *
 * Covers:
 *  1. In-memory backend (`:memory:`) — returns a fresh isolated backend,
 *     no file copy performed.
 *  2. File-based backend — `.db` file is copied to a temp path;
 *     destroyTestCopy removes the file (and any -wal/-shm siblings).
 *  3. The original backend is still functional after copyForTest.
 *  4. Writes to the copy are not visible in the original (isolation).
 *  5. destroyTestCopy is idempotent for in-memory copies.
 *
 * All tests run under a single outer Deno.test with sanitizeResources:false
 * because `@db/sqlite` loads an FFI dynamic library at module evaluation time.
 * Deno's resource sanitizer would otherwise flag the first sub-test that
 * triggers the import as a "dynamic library leak".
 *
 * @module
 */

import {
  assertEquals,
  assertExists,
  assertNotStrictEquals,
} from "jsr:@std/assert@1";
import { SQLiteBackend } from "./backend.ts";

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

/** Create and connect a file-based SQLiteBackend with a minimal schema. */
async function createFileBackend(
  dbPath: string,
  tableName = "copy_test_items",
): Promise<SQLiteBackend> {
  const backend = new SQLiteBackend({ path: dbPath });
  await backend.connect();
  await backend.executeRaw(`
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      "id"   INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL
    )
  `);
  return backend;
}

// ============================================================================
// Test Suite
// ============================================================================

Deno.test({
  name: "SQLiteBackend.copyForTest / destroyTestCopy",
  sanitizeResources: false,
  async fn(t) {
    // ------------------------------------------------------------------
    // 1. In-memory — returns a fresh, connected copy; no file involved.
    // ------------------------------------------------------------------
    await t.step(
      "in-memory backend returns a fresh connected copy",
      async () => {
        const original = new SQLiteBackend({ path: ":memory:" });
        await original.connect();

        const copy = await original.copyForTest();

        try {
          assertExists(copy);
          assertEquals(copy.isConnected, true);
          assertNotStrictEquals(copy, original);
        } finally {
          await copy.destroyTestCopy();
          await original.disconnect();
        }

        assertEquals(copy.isConnected, false);
      },
    );

    // ------------------------------------------------------------------
    // 2. File-based — temp file created, then removed by destroyTestCopy.
    // ------------------------------------------------------------------
    await t.step(
      "file-based backend copies the .db file and cleans up on destroy",
      async () => {
        const tmpDir = await Deno.makeTempDir();
        const dbPath = `${tmpDir}/source.db`;

        const original = await createFileBackend(dbPath);

        // Seed one row so the file is non-trivially populated.
        await original.executeRaw(
          'INSERT INTO "copy_test_items" ("name") VALUES (?)',
          ["seed"],
        );

        const copy = await original.copyForTest() as SQLiteBackend & {
          _tempPath?: string;
        };
        const tempPath = copy._tempPath;

        try {
          assertExists(tempPath, "copy._tempPath should be set");
          assertEquals(copy.isConnected, true);

          // Temp file must exist on disk.
          assertEquals(await fileExists(tempPath!), true);

          // Original must still be connected and functional.
          assertEquals(original.isConnected, true);
          const rows = await original.executeRaw<{ name: string }>(
            'SELECT name FROM "copy_test_items"',
          );
          assertEquals(rows.length, 1);
        } finally {
          await copy.destroyTestCopy();
          await original.disconnect();
        }

        // After destroy the temp file must be gone.
        assertEquals(await fileExists(tempPath!), false);
        assertEquals(copy.isConnected, false);

        await Deno.remove(tmpDir, { recursive: true });
      },
    );

    // ------------------------------------------------------------------
    // 3. WAL and SHM siblings are removed by destroyTestCopy.
    // ------------------------------------------------------------------
    await t.step(
      "destroyTestCopy removes -wal and -shm siblings if present",
      async () => {
        const tmpDir = await Deno.makeTempDir();
        const dbPath = `${tmpDir}/wal_test.db`;

        const original = await createFileBackend(dbPath, "wal_items");

        const copy = await original.copyForTest() as SQLiteBackend & {
          _tempPath?: string;
        };
        const tempPath = copy._tempPath!;

        // Disconnect the copy first so SQLite releases its lock on any
        // memory-mapped WAL/SHM files (Windows keeps these locked while open).
        await copy.disconnect();

        // Now safely create fake sibling files to simulate WAL mode artefacts.
        await Deno.writeTextFile(`${tempPath}-wal`, "fake wal");
        await Deno.writeTextFile(`${tempPath}-shm`, "fake shm");

        assertEquals(await fileExists(`${tempPath}-wal`), true);
        assertEquals(await fileExists(`${tempPath}-shm`), true);

        // destroyTestCopy calls disconnect() again (no-op) then removes files.
        await copy.destroyTestCopy();
        await original.disconnect();

        // All three paths must be cleaned up.
        assertEquals(await fileExists(tempPath), false);
        assertEquals(await fileExists(`${tempPath}-wal`), false);
        assertEquals(await fileExists(`${tempPath}-shm`), false);

        await Deno.remove(tmpDir, { recursive: true });
      },
    );

    // ------------------------------------------------------------------
    // 4. Data isolation — writes to the copy don't appear in the original.
    // ------------------------------------------------------------------
    await t.step(
      "writes to file copy are isolated from the original",
      async () => {
        const tmpDir = await Deno.makeTempDir();
        const dbPath = `${tmpDir}/isolation.db`;

        const original = await createFileBackend(dbPath);

        const copy = await original.copyForTest();

        try {
          // Write a row to the copy only.
          await copy.executeRaw(
            'INSERT INTO "copy_test_items" ("name") VALUES (?)',
            ["copy_only"],
          );

          // Original must NOT see the new row.
          const originalRows = await original.executeRaw<{ name: string }>(
            'SELECT name FROM "copy_test_items"',
          );
          assertEquals(
            originalRows.length,
            0,
            "original should not see row written to copy",
          );

          // Copy must see it.
          const copyRows = await copy.executeRaw<{ name: string }>(
            'SELECT name FROM "copy_test_items"',
          );
          assertEquals(copyRows.length, 1);
          assertEquals(copyRows[0].name, "copy_only");
        } finally {
          await copy.destroyTestCopy();
          await original.disconnect();
          await Deno.remove(tmpDir, { recursive: true });
        }
      },
    );

    // ------------------------------------------------------------------
    // 5. destroyTestCopy on in-memory copy — idempotent, no errors.
    // ------------------------------------------------------------------
    await t.step(
      "destroyTestCopy on in-memory copy is safe to call",
      async () => {
        const original = new SQLiteBackend({ path: ":memory:" });
        await original.connect();

        const copy = await original.copyForTest();
        assertEquals(copy.isConnected, true);

        await copy.destroyTestCopy(); // must not throw
        assertEquals(copy.isConnected, false);

        await original.disconnect();
      },
    );

    // ------------------------------------------------------------------
    // 6. Seeded data from the original is present in the file copy.
    // ------------------------------------------------------------------
    await t.step(
      "seeded rows from original are visible in the file copy",
      async () => {
        const tmpDir = await Deno.makeTempDir();
        const dbPath = `${tmpDir}/seeded.db`;

        const original = await createFileBackend(dbPath);

        // Insert two rows before copying.
        await original.executeRaw(
          'INSERT INTO "copy_test_items" ("name") VALUES (?)',
          ["alpha"],
        );
        await original.executeRaw(
          'INSERT INTO "copy_test_items" ("name") VALUES (?)',
          ["beta"],
        );

        const copy = await original.copyForTest();

        try {
          const rows = await copy.executeRaw<{ name: string }>(
            'SELECT name FROM "copy_test_items" ORDER BY name',
          );
          assertEquals(rows.length, 2);
          assertEquals(rows[0].name, "alpha");
          assertEquals(rows[1].name, "beta");
        } finally {
          await copy.destroyTestCopy();
          await original.disconnect();
          await Deno.remove(tmpDir, { recursive: true });
        }
      },
    );
  },
});
