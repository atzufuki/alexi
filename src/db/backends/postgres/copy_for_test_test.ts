/**
 * PostgresBackend.copyForTest / destroyTestCopy Tests
 *
 * Covers:
 *  1. copyForTest creates a temporary database with the expected name pattern.
 *  2. The temp database is connected and functional after copyForTest.
 *  3. The original backend is still connected after copyForTest.
 *  4. Seeded rows from the original are visible in the copy.
 *  5. Writes to the copy are NOT visible in the original (isolation).
 *  6. destroyTestCopy drops the temp database and disconnects the copy.
 *  7. destroyTestCopy is idempotent (safe to call twice).
 *
 * These tests require a running PostgreSQL database.
 * Set DATABASE_URL or the individual PG* env vars to enable them.
 *
 * @module
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "jsr:@std/assert@1";
import pg from "npm:pg@8";
import { PostgresBackend } from "./backend.ts";
import type { PostgresConfig } from "./types.ts";

// ============================================================================
// Test Configuration
// ============================================================================

/** Returns true when a PostgreSQL connection is available. */
function hasPostgres(): boolean {
  return !!(
    Deno.env.get("DATABASE_URL") ||
    Deno.env.get("PGHOST") ||
    Deno.env.get("PGDATABASE")
  );
}

/** Build a PostgresConfig from environment variables. */
function getTestConfig(): PostgresConfig {
  const connectionString = Deno.env.get("DATABASE_URL");

  if (connectionString) {
    return {
      engine: "postgres",
      name: "alexi_test",
      connectionString,
      debug: Deno.env.get("DEBUG") === "true",
    };
  }

  return {
    engine: "postgres",
    name: Deno.env.get("PGDATABASE") ?? "alexi_test",
    host: Deno.env.get("PGHOST") ?? "localhost",
    port: parseInt(Deno.env.get("PGPORT") ?? "5432"),
    user: Deno.env.get("PGUSER") ?? "postgres",
    password: Deno.env.get("PGPASSWORD"),
    debug: Deno.env.get("DEBUG") === "true",
  };
}

// ============================================================================
// Helpers
// ============================================================================

/** Create a minimal test table in the given backend. */
async function createTestTable(backend: PostgresBackend): Promise<void> {
  await backend.executeRaw(`
    CREATE TABLE IF NOT EXISTS "public"."copy_for_test_items" (
      id   SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);
}

/** Drop the test table. Safe to call even if the table doesn't exist. */
async function dropTestTable(backend: PostgresBackend): Promise<void> {
  try {
    await backend.executeRaw(
      'DROP TABLE IF EXISTS "public"."copy_for_test_items" CASCADE',
    );
  } catch {
    // Ignore — table may not exist if the test failed early.
  }
}

// ============================================================================
// Tests
// ============================================================================

Deno.test({
  name:
    "PostgresBackend.copyForTest - creates temp database with correct name pattern",
  ignore: !hasPostgres(),
  async fn() {
    const backend = new PostgresBackend(getTestConfig());
    await backend.connect();

    let copy: PostgresBackend | null = null;
    try {
      copy = await backend.copyForTest();

      const tempDbName =
        (copy as PostgresBackend & { _tempDbName?: string })._tempDbName;

      assertExists(tempDbName, "_tempDbName should be set on the copy");
      assertStringIncludes(
        tempDbName,
        "_test_",
        "temp database name should contain '_test_'",
      );
      // Pattern: <originalName>_test_<timestamp>
      assertStringIncludes(
        tempDbName,
        getTestConfig().name,
        "temp name should start with the original database name",
      );
    } finally {
      if (copy) await copy.destroyTestCopy();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name:
    "PostgresBackend.copyForTest - temp database is connected and functional",
  ignore: !hasPostgres(),
  async fn() {
    const backend = new PostgresBackend(getTestConfig());
    await backend.connect();
    await createTestTable(backend);

    let copy: PostgresBackend | null = null;
    try {
      copy = await backend.copyForTest();

      assertEquals(copy.isConnected, true, "copy should be connected");

      // Functional check: create a table and insert a row.
      await copy.executeRaw(`
        CREATE TABLE IF NOT EXISTS "public"."copy_func_check" (
          id SERIAL PRIMARY KEY
        )
      `);
      await copy.executeRaw(
        'INSERT INTO "public"."copy_func_check" DEFAULT VALUES',
      );
      const rows = await copy.executeRaw<{ id: number }>(
        'SELECT id FROM "public"."copy_func_check"',
      );
      assertEquals(rows.length, 1, "copy should support INSERT/SELECT");
    } finally {
      if (copy) await copy.destroyTestCopy();
      await dropTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name:
    "PostgresBackend.copyForTest - original backend is still connected after copy",
  ignore: !hasPostgres(),
  async fn() {
    const backend = new PostgresBackend(getTestConfig());
    await backend.connect();
    await createTestTable(backend);

    let copy: PostgresBackend | null = null;
    try {
      copy = await backend.copyForTest();

      assertEquals(
        backend.isConnected,
        true,
        "original should be reconnected after copyForTest",
      );

      // Functional check on original: can still query.
      const rows = await backend.executeRaw<{ name: string }>(
        'SELECT name FROM "public"."copy_for_test_items"',
      );
      assertEquals(Array.isArray(rows), true);
    } finally {
      if (copy) await copy.destroyTestCopy();
      await dropTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend.copyForTest - seeded rows are visible in the copy",
  ignore: !hasPostgres(),
  async fn() {
    const backend = new PostgresBackend(getTestConfig());
    await backend.connect();
    await createTestTable(backend);

    // Seed two rows before copying.
    await backend.executeRaw(
      'INSERT INTO "public"."copy_for_test_items" (name) VALUES ($1)',
      ["alpha"],
    );
    await backend.executeRaw(
      'INSERT INTO "public"."copy_for_test_items" (name) VALUES ($1)',
      ["beta"],
    );

    let copy: PostgresBackend | null = null;
    try {
      copy = await backend.copyForTest();

      const rows = await copy.executeRaw<{ name: string }>(
        'SELECT name FROM "public"."copy_for_test_items" ORDER BY name',
      );

      assertEquals(rows.length, 2, "copy should contain the 2 seeded rows");
      assertEquals(rows[0].name, "alpha");
      assertEquals(rows[1].name, "beta");
    } finally {
      if (copy) await copy.destroyTestCopy();
      await dropTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name:
    "PostgresBackend.copyForTest - writes to copy are not visible in original",
  ignore: !hasPostgres(),
  async fn() {
    const backend = new PostgresBackend(getTestConfig());
    await backend.connect();
    await createTestTable(backend);

    let copy: PostgresBackend | null = null;
    try {
      copy = await backend.copyForTest();

      // Write a row to the copy only.
      await copy.executeRaw(
        'INSERT INTO "public"."copy_for_test_items" (name) VALUES ($1)',
        ["copy_only"],
      );

      // Original must NOT see the new row.
      const originalRows = await backend.executeRaw<{ name: string }>(
        'SELECT name FROM "public"."copy_for_test_items"',
      );
      assertEquals(
        originalRows.length,
        0,
        "original should not see row written to copy",
      );

      // Copy must see it.
      const copyRows = await copy.executeRaw<{ name: string }>(
        'SELECT name FROM "public"."copy_for_test_items"',
      );
      assertEquals(copyRows.length, 1);
      assertEquals(copyRows[0].name, "copy_only");
    } finally {
      if (copy) await copy.destroyTestCopy();
      await dropTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name:
    "PostgresBackend.destroyTestCopy - drops temp database and disconnects copy",
  ignore: !hasPostgres(),
  async fn() {
    const backend = new PostgresBackend(getTestConfig());
    await backend.connect();
    await createTestTable(backend);

    const copy = await backend.copyForTest();
    const tempDbName = (copy as PostgresBackend & { _tempDbName?: string })
      ._tempDbName!;
    const maintenancePoolConfig = (
      copy as PostgresBackend & {
        _maintenancePoolConfig?: Record<string, unknown>;
      }
    )._maintenancePoolConfig!;

    await copy.destroyTestCopy();

    assertEquals(copy.isConnected, false, "copy should be disconnected");

    // Verify the database was actually dropped by trying to connect to it.
    // We use the maintenance pool to query pg_database.
    const { Pool } = pg;
    const maintenancePool = new Pool(maintenancePoolConfig);
    try {
      const client = await maintenancePool.connect();
      try {
        const result = await client.query(
          "SELECT 1 FROM pg_database WHERE datname = $1",
          [tempDbName],
        );
        assertEquals(
          result.rows.length,
          0,
          `temp database "${tempDbName}" should have been dropped`,
        );
      } finally {
        client.release();
      }
    } finally {
      await maintenancePool.end();
      await dropTestTable(backend);
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostgresBackend.destroyTestCopy - idempotent, safe to call twice",
  ignore: !hasPostgres(),
  async fn() {
    const backend = new PostgresBackend(getTestConfig());
    await backend.connect();
    await createTestTable(backend);

    const copy = await backend.copyForTest();

    await copy.destroyTestCopy(); // first call — drops DB, disconnects
    await copy.destroyTestCopy(); // second call — must not throw

    assertEquals(copy.isConnected, false);

    await dropTestTable(backend);
    await backend.disconnect();
  },
});
