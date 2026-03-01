/**
 * Tests for ArgumentParser
 *
 * @module @alexi/management/tests/argument_parser
 */

import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ArgumentParser } from "../management/argument_parser.ts";

// =============================================================================
// Basic Parsing Tests
// =============================================================================

Deno.test("ArgumentParser - parses long arguments with equals", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--port", { type: "number" });
  parser.addArgument("--host", { type: "string" });

  const result = parser.parse(["--port=3000", "--host=localhost"]);

  assertEquals(result.port, 3000);
  assertEquals(result.host, "localhost");
});

Deno.test("ArgumentParser - parses long arguments with space", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--port", { type: "number" });
  parser.addArgument("--host", { type: "string" });

  const result = parser.parse(["--port", "3000", "--host", "localhost"]);

  assertEquals(result.port, 3000);
  assertEquals(result.host, "localhost");
});

Deno.test("ArgumentParser - parses short arguments", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--port", { type: "number", alias: "-p" });
  parser.addArgument("--host", { type: "string", alias: "-H" });

  const result = parser.parse(["-p", "3000", "-H", "localhost"]);

  assertEquals(result.port, 3000);
  assertEquals(result.host, "localhost");
});

Deno.test("ArgumentParser - parses short arguments with equals", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--port", { type: "number", alias: "-p" });

  const result = parser.parse(["-p=3000"]);

  assertEquals(result.port, 3000);
});

// =============================================================================
// Boolean Flags Tests
// =============================================================================

Deno.test("ArgumentParser - parses boolean flags", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--debug", { type: "boolean", default: false });
  parser.addArgument("--verbose", { type: "boolean", default: false });

  const result = parser.parse(["--debug"]);

  assertEquals(result.debug, true);
  assertEquals(result.verbose, false);
});

Deno.test("ArgumentParser - parses boolean with explicit values", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--debug", { type: "boolean" });

  assertEquals(parser.parse(["--debug=true"]).debug, true);
  assertEquals(parser.parse(["--debug=false"]).debug, false);
  assertEquals(parser.parse(["--debug=1"]).debug, true);
  assertEquals(parser.parse(["--debug=0"]).debug, false);
  assertEquals(parser.parse(["--debug=yes"]).debug, true);
  assertEquals(parser.parse(["--debug=no"]).debug, false);
});

// =============================================================================
// Default Values Tests
// =============================================================================

Deno.test("ArgumentParser - uses default values", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--port", { type: "number", default: 8000 });
  parser.addArgument("--host", { type: "string", default: "0.0.0.0" });

  const result = parser.parse([]);

  assertEquals(result.port, 8000);
  assertEquals(result.host, "0.0.0.0");
});

Deno.test("ArgumentParser - overrides default values", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--port", { type: "number", default: 8000 });

  const result = parser.parse(["--port", "3000"]);

  assertEquals(result.port, 3000);
});

// =============================================================================
// Positional Arguments Tests
// =============================================================================

Deno.test("ArgumentParser - parses positional arguments", () => {
  const parser = new ArgumentParser();
  parser.addArgument("command", { required: true });
  parser.addArgument("target", { required: false });

  const result = parser.parse(["runserver", "app"]);

  assertEquals(result.command, "runserver");
  assertEquals(result.target, "app");
});

Deno.test("ArgumentParser - collects extra positional arguments in _", () => {
  const parser = new ArgumentParser();
  parser.addArgument("command", { required: true });

  const result = parser.parse(["runserver", "extra1", "extra2"]);

  assertEquals(result.command, "runserver");
  assertEquals(result._, ["extra1", "extra2"]);
});

Deno.test("ArgumentParser - mixes positional and named arguments", () => {
  const parser = new ArgumentParser();
  parser.addArgument("command", { required: true });
  parser.addArgument("--port", { type: "number", default: 8000 });

  const result = parser.parse(["runserver", "--port", "3000"]);

  assertEquals(result.command, "runserver");
  assertEquals(result.port, 3000);
});

// =============================================================================
// Validation Tests
// =============================================================================

Deno.test("ArgumentParser - throws on missing required argument", () => {
  const parser = new ArgumentParser();
  parser.addArgument("command", { required: true });

  assertThrows(
    () => parser.parse([]),
    Error,
    "Missing required argument",
  );
});

Deno.test("ArgumentParser - throws on invalid number", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--port", { type: "number" });

  assertThrows(
    () => parser.parse(["--port", "abc"]),
    Error,
    "Invalid number",
  );
});

Deno.test("ArgumentParser - throws on missing value for non-boolean", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--port", { type: "number" });

  assertThrows(
    () => parser.parse(["--port"]),
    Error,
    "requires a value",
  );
});

Deno.test("ArgumentParser - validates choices", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--level", {
    type: "string",
    choices: ["debug", "info", "error"],
  });

  // Valid choice
  const result = parser.parse(["--level", "debug"]);
  assertEquals(result.level, "debug");

  // Invalid choice
  assertThrows(
    () => parser.parse(["--level", "invalid"]),
    Error,
    "Invalid value",
  );
});

// =============================================================================
// Array Type Tests
// =============================================================================

Deno.test("ArgumentParser - parses array type", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--origins", { type: "array" });

  const result = parser.parse([
    "--origins",
    "http://localhost:3000,http://localhost:5173",
  ]);

  assertEquals(result.origins, [
    "http://localhost:3000",
    "http://localhost:5173",
  ]);
});

// =============================================================================
// Help Generation Tests
// =============================================================================

Deno.test("ArgumentParser - generates help text", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--port", {
    type: "number",
    default: 8000,
    alias: "-p",
    help: "Port to listen on",
  });
  parser.addArgument("--debug", {
    type: "boolean",
    default: false,
    help: "Enable debug mode",
  });

  const help = parser.getHelp();

  // Should contain option names
  assertEquals(help.includes("--port"), true);
  assertEquals(help.includes("-p"), true);
  assertEquals(help.includes("--debug"), true);

  // Should contain help text
  assertEquals(help.includes("Port to listen on"), true);
  assertEquals(help.includes("Enable debug mode"), true);

  // Should contain type info
  assertEquals(help.includes("[number]"), true);
  assertEquals(help.includes("[boolean]"), true);

  // Should contain default values
  assertEquals(help.includes("8000"), true);
});

// =============================================================================
// Edge Cases
// =============================================================================

Deno.test("ArgumentParser - handles empty input", () => {
  const parser = new ArgumentParser();

  const result = parser.parse([]);

  assertEquals(result._, []);
});

Deno.test("ArgumentParser - handles unknown arguments gracefully", () => {
  const parser = new ArgumentParser();
  parser.addArgument("--known", { type: "string" });

  // Unknown arguments are stored by their name
  const result = parser.parse(["--known", "value", "--unknown", "other"]);

  assertEquals(result.known, "value");
  assertEquals(result.unknown, "other");
});

Deno.test("ArgumentParser - chaining addArgument", () => {
  const parser = new ArgumentParser()
    .addArgument("--port", { type: "number", default: 8000 })
    .addArgument("--host", { type: "string", default: "localhost" })
    .addArgument("--debug", { type: "boolean", default: false });

  const result = parser.parse(["--debug"]);

  assertEquals(result.port, 8000);
  assertEquals(result.host, "localhost");
  assertEquals(result.debug, true);
});
