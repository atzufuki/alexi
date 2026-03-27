/**
 * Tests for the flush management command — specifically the fix for issue #433
 * where the command always tried to use DenoKV instead of the configured
 * DATABASES backend.
 *
 * @module
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { FlushCommand } from "./flush.ts";
import type { CommandOptions, IConsole } from "../types.ts";
import { DatabaseBackend } from "@alexi/db";
import type {
  Aggregations,
  CompiledQuery,
  ParsedFilter,
  QueryState,
  SchemaEditor,
  Transaction,
} from "@alexi/db";
import type { Model } from "@alexi/db";
import { registerBackend, reset } from "@alexi/db";

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

function makeOptions(args: Record<string, unknown>): CommandOptions {
  return {
    args: { _: [], ...args },
    rawArgs: [],
    debug: false,
  };
}

/**
 * Minimal stub backend that records flush() calls and returns a configurable
 * count. All other abstract methods throw "not implemented".
 */
class StubBackend extends DatabaseBackend {
  flushCallCount = 0;
  flushResult = 42;
  flushError: Error | null = null;

  constructor() {
    super({ engine: "stub", name: "stub" });
    this._connected = true;
  }

  async flush(): Promise<number> {
    this.flushCallCount++;
    if (this.flushError) throw this.flushError;
    return this.flushResult;
  }

  // -- unused stubs --
  async connect() {}
  async disconnect() {}
  async execute<T extends Model>(_s: QueryState<T>) {
    return [];
  }
  async executeRaw<R>(_q: string, _p?: unknown[]) {
    return [] as R[];
  }
  async insert<T extends Model>(_i: T) {
    return {} as Record<string, unknown>;
  }
  async update<T extends Model>(_i: T) {}
  async partialUpdate<T extends Model>(_i: T, _f: string[]) {}
  async delete<T extends Model>(_i: T) {}
  async deleteById(_t: string, _id: unknown) {}
  async getById<T extends Model>(_m: new () => T, _id: unknown) {
    return null;
  }
  async existsById<T extends Model>(_m: new () => T, _id: unknown) {
    return false;
  }
  async bulkInsert<T extends Model>(_i: T[]) {
    return [];
  }
  async bulkUpdate<T extends Model>(_i: T[], _f: string[]) {
    return 0;
  }
  async updateMany<T extends Model>(
    _s: QueryState<T>,
    _v: Record<string, unknown>,
  ) {
    return 0;
  }
  async deleteMany<T extends Model>(_s: QueryState<T>) {
    return 0;
  }
  async count<T extends Model>(_s: QueryState<T>) {
    return 0;
  }
  async aggregate<T extends Model>(_s: QueryState<T>, _a: Aggregations) {
    return {};
  }
  async beginTransaction() {
    return {
      commit: async () => {},
      rollback: async () => {},
      isActive: true,
    } as Transaction;
  }
  getSchemaEditor(): SchemaEditor {
    return {} as SchemaEditor;
  }
  async tableExists(_t: string) {
    return false;
  }
  compile<T extends Model>(_s: QueryState<T>) {
    return { operation: {}, params: [] } as unknown as CompiledQuery;
  }
  protected async executeSimpleFilter(_t: string, _f: ParsedFilter[]) {
    return [];
  }
}

// =============================================================================
// FlushCommand subclass that skips real configure() and injects stub backend
// =============================================================================

class TestFlushCommand extends FlushCommand {
  stub = new StubBackend();

  protected override async runConfigure(_settingsArg?: string): Promise<void> {
    // Register our stub as the default backend instead of loading real settings
    registerBackend("default", this.stub);
  }
}

// =============================================================================
// Tests
// =============================================================================

Deno.test(
  "flush: calls backend.flush() and reports deleted count",
  async () => {
    const cmd = new TestFlushCommand();
    const out = new MockConsole();
    cmd.setConsole(out);

    const result = await cmd.handle(
      makeOptions({ "no-input": true, "yes": false }),
    );

    assertEquals(result.exitCode, 0);
    assertEquals(cmd.stub.flushCallCount, 1);
    assertStringIncludes(out.logs.join("\n"), "42");
    assertStringIncludes(out.logs.join("\n"), "cleared successfully");

    reset();
  },
);

Deno.test(
  "flush: uses named backend when --database is supplied",
  async () => {
    const secondary = new StubBackend();
    secondary.flushResult = 7;

    class NamedFlushCommand extends FlushCommand {
      protected override async runConfigure(
        _settingsArg?: string,
      ): Promise<void> {
        registerBackend("secondary", secondary);
      }
    }

    const cmd = new NamedFlushCommand();
    const out = new MockConsole();
    cmd.setConsole(out);

    const result = await cmd.handle(
      makeOptions({ "no-input": true, "yes": false, database: "secondary" }),
    );

    assertEquals(result.exitCode, 0);
    assertEquals(secondary.flushCallCount, 1);
    assertStringIncludes(out.logs.join("\n"), "7");

    reset();
  },
);

Deno.test(
  "flush: returns failure when backend.flush() throws",
  async () => {
    class ErrorFlushCommand extends FlushCommand {
      stub = new StubBackend();

      protected override async runConfigure(
        _settingsArg?: string,
      ): Promise<void> {
        this.stub.flushError = new Error("connection refused");
        registerBackend("default", this.stub);
      }
    }

    const cmd = new ErrorFlushCommand();
    const out = new MockConsole();
    cmd.setConsole(out);

    const result = await cmd.handle(
      makeOptions({ "no-input": true, "yes": false }),
    );

    assertEquals(result.exitCode, 1);
    assertStringIncludes(out.errors.join("\n"), "connection refused");

    reset();
  },
);

Deno.test(
  "flush: cancelled when confirmation is declined (--no-input=false, prompt=null)",
  async () => {
    // Override prompt globally to simulate user pressing Ctrl+C (null)
    const originalPrompt = globalThis.prompt;
    globalThis.prompt = () => null;

    const cmd = new TestFlushCommand();
    const out = new MockConsole();
    cmd.setConsole(out);

    const result = await cmd.handle(
      makeOptions({ "no-input": false, "yes": false }),
    );

    assertEquals(result.exitCode, 0);
    assertEquals(cmd.stub.flushCallCount, 0);
    assertStringIncludes(out.logs.join("\n"), "cancelled");

    globalThis.prompt = originalPrompt;
    reset();
  },
);
