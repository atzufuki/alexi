/**
 * Tests for the createsuperuser management command — specifically the
 * REQUIRED_FIELDS handling added to fix issue #431.
 *
 * @module
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { CreateSuperuserCommand } from "./createsuperuser.ts";
import type { CommandOptions, IConsole } from "@alexi/core/management";

// =============================================================================
// Helpers
// =============================================================================

class MockConsole implements IConsole {
  logs: string[] = [];
  errors: string[] = [];
  infos: string[] = [];
  warns: string[] = [];

  log(...args: unknown[]): void {
    this.logs.push(args.map(String).join(" "));
  }
  error(...args: unknown[]): void {
    this.errors.push(args.map(String).join(" "));
  }
  info(...args: unknown[]): void {
    this.infos.push(args.map(String).join(" "));
  }
  warn(...args: unknown[]): void {
    this.warns.push(args.map(String).join(" "));
  }
}

// Helper: build a CommandOptions from a partial args map.
function makeOptions(args: Record<string, unknown>): CommandOptions {
  return {
    args: { _: [], ...args },
    rawArgs: [],
    debug: false,
  };
}

Deno.test(
  "createsuperuser: REQUIRED_FIELDS values collected from CLI args",
  async () => {
    // Track what objects.create() is called with.
    const calls: Record<string, unknown>[] = [];

    const fakeModel = {
      REQUIRED_FIELDS: ["status", "phone"],
      hashPassword: async (p: string) => `hashed:${p}`,
      objects: {
        filter: (_: unknown) => ({ first: async () => null }),
        create: async (data: Record<string, unknown>) => {
          calls.push(data);
          return { id: { get: () => 1 } };
        },
      },
    };

    const fakeSettings = {
      AUTH_USER_MODEL: fakeModel,
      DATABASES: {},
    };

    const cmd = new CreateSuperuserCommand();
    const out = new MockConsole();
    cmd.setConsole(out);

    // Patch private loadSettings and setup so we don't need real files/DB.
    // deno-lint-ignore no-explicit-any
    (cmd as any).loadSettings = async () => fakeSettings;
    // deno-lint-ignore no-explicit-any
    (cmd as any).loadUserModel = async () => ({
      UserModel: fakeModel,
      hashPassword: fakeModel.hashPassword,
    });
    // deno-lint-ignore no-explicit-any
    (cmd as any).runSetup = async () => {};

    // Mock DB setup — no-op.
    const originalSetup = (await import("@alexi/core")).setup;
    void originalSetup;

    const result = await cmd.handle(makeOptions({
      settings: "test",
      email: "admin@example.com",
      password: "password123",
      "first-name": "Admin",
      "last-name": "User",
      "no-input": true,
      status: "active", // REQUIRED_FIELDS[0]
      phone: "+358501234567", // REQUIRED_FIELDS[1]
    }));

    // Restore (not strictly needed for isolated test, but good practice)
    void originalSetup;

    assertEquals(result.exitCode, 0, "command should succeed");
    assertEquals(calls.length, 1, "objects.create should be called once");

    const created = calls[0];
    assertEquals(created["email"], "admin@example.com");
    assertEquals(created["isAdmin"], true);
    assertEquals(created["status"], "active");
    assertEquals(created["phone"], "+358501234567");
  },
);

// =============================================================================
// REQUIRED_FIELDS — environment variable path
// =============================================================================

Deno.test(
  "createsuperuser: REQUIRED_FIELDS values collected from env vars",
  async () => {
    const calls: Record<string, unknown>[] = [];

    const fakeModel = {
      REQUIRED_FIELDS: ["status"],
      hashPassword: async (p: string) => `hashed:${p}`,
      objects: {
        filter: (_: unknown) => ({ first: async () => null }),
        create: async (data: Record<string, unknown>) => {
          calls.push(data);
          return { id: { get: () => 2 } };
        },
      },
    };

    const fakeSettings = {
      AUTH_USER_MODEL: fakeModel,
      DATABASES: {},
    };

    const cmd = new CreateSuperuserCommand();
    const out = new MockConsole();
    cmd.setConsole(out);

    // deno-lint-ignore no-explicit-any
    (cmd as any).loadSettings = async () => fakeSettings;
    // deno-lint-ignore no-explicit-any
    (cmd as any).loadUserModel = async () => ({
      UserModel: fakeModel,
      hashPassword: fakeModel.hashPassword,
    });
    // deno-lint-ignore no-explicit-any
    (cmd as any).runSetup = async () => {};

    // Inject env variable
    Deno.env.set("ALEXI_SUPERUSER_STATUS", "pending");

    try {
      const result = await cmd.handle(makeOptions({
        settings: "test",
        email: "user@example.com",
        password: "password123",
        "no-input": true,
        // status NOT provided via CLI — should be picked up from env
      }));

      assertEquals(result.exitCode, 0);
      assertEquals(calls[0]["status"], "pending");
    } finally {
      Deno.env.delete("ALEXI_SUPERUSER_STATUS");
    }
  },
);

// =============================================================================
// REQUIRED_FIELDS — missing in --no-input mode → failure
// =============================================================================

Deno.test(
  "createsuperuser: missing REQUIRED_FIELDS in --no-input mode returns failure",
  async () => {
    const fakeModel = {
      REQUIRED_FIELDS: ["status"],
      hashPassword: async (p: string) => `hashed:${p}`,
      objects: {
        filter: (_: unknown) => ({ first: async () => null }),
        create: async () => ({ id: { get: () => 3 } }),
      },
    };

    const fakeSettings = {
      AUTH_USER_MODEL: fakeModel,
      DATABASES: {},
    };

    const cmd = new CreateSuperuserCommand();
    const out = new MockConsole();
    cmd.setConsole(out);

    // deno-lint-ignore no-explicit-any
    (cmd as any).loadSettings = async () => fakeSettings;
    // deno-lint-ignore no-explicit-any
    (cmd as any).loadUserModel = async () => ({
      UserModel: fakeModel,
      hashPassword: fakeModel.hashPassword,
    });
    // deno-lint-ignore no-explicit-any
    (cmd as any).runSetup = async () => {};

    const result = await cmd.handle(makeOptions({
      settings: "test",
      email: "user@example.com",
      password: "password123",
      "no-input": true,
      // status intentionally omitted
    }));

    assertEquals(
      result.exitCode,
      1,
      "should fail when required field is missing",
    );
    const errorText = out.errors.join(" ");
    assertStringIncludes(errorText, "status");
  },
);

// =============================================================================
// REQUIRED_FIELDS — empty list (plain AbstractUser subclass)
// =============================================================================

Deno.test(
  "createsuperuser: empty REQUIRED_FIELDS works as before",
  async () => {
    const calls: Record<string, unknown>[] = [];

    const fakeModel = {
      REQUIRED_FIELDS: [],
      hashPassword: async (p: string) => `hashed:${p}`,
      objects: {
        filter: (_: unknown) => ({ first: async () => null }),
        create: async (data: Record<string, unknown>) => {
          calls.push(data);
          return { id: { get: () => 4 } };
        },
      },
    };

    const fakeSettings = {
      AUTH_USER_MODEL: fakeModel,
      DATABASES: {},
    };

    const cmd = new CreateSuperuserCommand();
    const out = new MockConsole();
    cmd.setConsole(out);

    // deno-lint-ignore no-explicit-any
    (cmd as any).loadSettings = async () => fakeSettings;
    // deno-lint-ignore no-explicit-any
    (cmd as any).loadUserModel = async () => ({
      UserModel: fakeModel,
      hashPassword: fakeModel.hashPassword,
    });
    // deno-lint-ignore no-explicit-any
    (cmd as any).runSetup = async () => {};

    const result = await cmd.handle(makeOptions({
      settings: "test",
      email: "simple@example.com",
      password: "password123",
      "no-input": true,
    }));

    assertEquals(result.exitCode, 0);
    assertEquals(calls.length, 1);
    assertEquals(calls[0]["email"], "simple@example.com");
    assertEquals(calls[0]["isAdmin"], true);
  },
);
