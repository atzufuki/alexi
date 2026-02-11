/**
 * SyncBackend tests
 *
 * Tests for the SyncBackend class, particularly verifying that
 * local filtering is applied after remote fetch.
 *
 * @module
 */

import { assertEquals } from "jsr:@std/assert";

import {
  AutoField,
  BooleanField,
  CharField,
  IntegerField,
  Manager,
  Model,
} from "../mod.ts";

import { DenoKVBackend } from "../backends/denokv/mod.ts";
import { DatabaseBackend } from "../backends/backend.ts";
import { SyncBackend } from "../backends/sync/mod.ts";
import { reset, setup } from "../setup.ts";
import type { QueryState } from "../query/types.ts";

// ============================================================================
// Test Models
// ============================================================================

class Project extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 200 });
  organisationId = new IntegerField();
  isPublished = new BooleanField({ default: false });

  static objects = new Manager(Project);
  static override meta = {
    dbTable: "projects",
    ordering: ["name"],
  };
}

// ============================================================================
// Mock RestBackend
// ============================================================================

/**
 * A mock RestBackend that returns unfiltered data to simulate
 * a misbehaving API that doesn't respect filters.
 */
class MockRestBackend extends DatabaseBackend {
  private _mockData: Record<string, unknown>[] = [];
  private _authenticated = true;

  constructor() {
    super({ engine: "mock-rest", name: "mock" });
  }

  setMockData(data: Record<string, unknown>[]): void {
    this._mockData = data;
  }

  setAuthenticated(value: boolean): void {
    this._authenticated = value;
  }

  isAuthenticated(): boolean {
    return this._authenticated;
  }

  async connect(): Promise<void> {
    // No-op
  }

  async disconnect(): Promise<void> {
    // No-op
  }

  /**
   * Returns ALL mock data without applying any filters.
   * This simulates a buggy API that ignores filter parameters.
   */
  async execute<T extends Model>(
    _state: QueryState<T>,
  ): Promise<Record<string, unknown>[]> {
    // Deliberately return all data without filtering
    return this._mockData;
  }

  async executeRaw<R = unknown>(
    _query: string,
    _params?: unknown[],
  ): Promise<R[]> {
    return [];
  }

  async insert<T extends Model>(
    _instance: T,
  ): Promise<Record<string, unknown>> {
    return {};
  }

  async update<T extends Model>(_instance: T): Promise<void> {
    // No-op
  }

  async delete<T extends Model>(_instance: T): Promise<void> {
    // No-op
  }

  async deleteById(_tableName: string, _id: unknown): Promise<void> {
    // No-op
  }

  async getById<T extends Model>(
    _model: new () => T,
    _id: unknown,
  ): Promise<Record<string, unknown> | null> {
    return null;
  }

  async existsById<T extends Model>(
    _model: new () => T,
    _id: unknown,
  ): Promise<boolean> {
    return false;
  }

  async bulkInsert<T extends Model>(
    _instances: T[],
  ): Promise<Record<string, unknown>[]> {
    return [];
  }

  async bulkUpdate<T extends Model>(
    _instances: T[],
    _fields: string[],
  ): Promise<number> {
    return 0;
  }

  async updateMany<T extends Model>(
    _state: QueryState<T>,
    _values: Partial<Record<string, unknown>>,
  ): Promise<number> {
    return 0;
  }

  async deleteMany<T extends Model>(_state: QueryState<T>): Promise<number> {
    return 0;
  }

  async count<T extends Model>(_state: QueryState<T>): Promise<number> {
    return this._mockData.length;
  }

  async aggregate<T extends Model>(
    _state: QueryState<T>,
    _aggregations: import("../query/types.ts").Aggregations,
  ): Promise<Record<string, number>> {
    return {};
  }

  async beginTransaction(): Promise<
    import("../backends/backend.ts").Transaction
  > {
    return {
      commit: async () => {},
      rollback: async () => {},
      isActive: false,
    };
  }

  getSchemaEditor(): import("../backends/backend.ts").SchemaEditor {
    return {
      createTable: async () => {},
      dropTable: async () => {},
      addField: async () => {},
      removeField: async () => {},
      createIndex: async () => {},
      dropIndex: async () => {},
    };
  }

  async tableExists(_tableName: string): Promise<boolean> {
    return true;
  }

  compile<T extends Model>(
    _state: QueryState<T>,
  ): import("../query/types.ts").CompiledQuery {
    return { sql: "", params: [] };
  }
}

// ============================================================================
// Tests
// ============================================================================

Deno.test({
  name: "SyncBackend - applies local filtering after remote fetch",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const dbPath = ":memory:";
    const localBackend = new DenoKVBackend({ name: "sync-test", path: dbPath });
    await localBackend.connect();
    await setup({ backend: localBackend });

    // Create mock REST backend that returns unfiltered data
    const mockRestBackend = new MockRestBackend();

    // Simulate API returning both published and unpublished projects
    // (as if the API ignores the isPublished filter)
    mockRestBackend.setMockData([
      { id: 1, name: "Project A", organisationId: 1, isPublished: true },
      { id: 2, name: "Project B", organisationId: 1, isPublished: false },
      { id: 3, name: "Project C", organisationId: 1, isPublished: true },
      { id: 4, name: "Project D", organisationId: 1, isPublished: false },
    ]);

    // Create SyncBackend
    const syncBackend = new SyncBackend(
      localBackend,
      mockRestBackend as unknown as import("../backends/rest/mod.ts").RestBackend,
      { debug: false },
    );
    await syncBackend.connect();

    try {
      // Query for only published projects
      const results = (await Project.objects
        .using(syncBackend)
        .filter({ isPublished: true })
        .fetch()).array();

      // Even though the mock API returned all 4 projects,
      // SyncBackend should apply the local filter and return only published ones
      assertEquals(
        results.length,
        2,
        "Should return only 2 published projects",
      );

      // Verify the returned projects are the correct ones
      const names = results.map((r) => r.name.get()).sort();
      assertEquals(names, ["Project A", "Project C"]);

      // Verify all returned projects are published
      for (const project of results) {
        assertEquals(
          project.isPublished.get(),
          true,
          `Project ${project.name.get()} should be published`,
        );
      }
    } finally {
      await reset();
      await localBackend.disconnect();
    }
  },
});

Deno.test({
  name: "SyncBackend - applies multiple filters locally after remote fetch",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const dbPath = ":memory:";
    const localBackend = new DenoKVBackend({
      name: "sync-test-2",
      path: dbPath,
    });
    await localBackend.connect();
    await setup({ backend: localBackend });

    const mockRestBackend = new MockRestBackend();

    // Simulate API returning projects from multiple organisations
    mockRestBackend.setMockData([
      { id: 1, name: "Project A", organisationId: 1, isPublished: true },
      { id: 2, name: "Project B", organisationId: 2, isPublished: true },
      { id: 3, name: "Project C", organisationId: 1, isPublished: false },
      { id: 4, name: "Project D", organisationId: 1, isPublished: true },
      { id: 5, name: "Project E", organisationId: 2, isPublished: false },
    ]);

    const syncBackend = new SyncBackend(
      localBackend,
      mockRestBackend as unknown as import("../backends/rest/mod.ts").RestBackend,
      { debug: false },
    );
    await syncBackend.connect();

    try {
      // Query for published projects in organisation 1 only
      const results = (await Project.objects
        .using(syncBackend)
        .filter({ organisationId: 1, isPublished: true })
        .fetch()).array();

      // Should return only projects that match BOTH filters
      assertEquals(
        results.length,
        2,
        "Should return only 2 published projects from org 1",
      );

      const names = results.map((r) => r.name.get()).sort();
      assertEquals(names, ["Project A", "Project D"]);

      // Verify all returned projects match the criteria
      for (const project of results) {
        assertEquals(project.organisationId.get(), 1);
        assertEquals(project.isPublished.get(), true);
      }
    } finally {
      await reset();
      await localBackend.disconnect();
    }
  },
});

Deno.test({
  name: "SyncBackend - falls back to local when not authenticated",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const dbPath = ":memory:";
    const localBackend = new DenoKVBackend({
      name: "sync-test-3",
      path: dbPath,
    });
    await localBackend.connect();
    await setup({ backend: localBackend });

    const mockRestBackend = new MockRestBackend();
    mockRestBackend.setAuthenticated(false);

    // This data should NOT be used since user is not authenticated
    mockRestBackend.setMockData([
      { id: 1, name: "Remote Project", organisationId: 1, isPublished: true },
    ]);

    const syncBackend = new SyncBackend(
      localBackend,
      mockRestBackend as unknown as import("../backends/rest/mod.ts").RestBackend,
      { debug: false },
    );
    await syncBackend.connect();

    try {
      // Create local data directly
      await Project.objects.using(localBackend).create({
        name: "Local Project",
        organisationId: 1,
        isPublished: true,
      });

      // Query through SyncBackend - should use local since not authenticated
      const results = (await Project.objects
        .using(syncBackend)
        .filter({ isPublished: true })
        .fetch()).array();

      // Should return local data, not remote mock data
      assertEquals(results.length, 1);
      assertEquals(results[0].name.get(), "Local Project");
    } finally {
      await reset();
      await localBackend.disconnect();
    }
  },
});
