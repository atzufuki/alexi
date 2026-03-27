/**
 * Tests for @alexi/mail
 *
 * Covers: EmailMessage, EmailMultiAlternatives, BadHeaderError, all
 * non-SMTP backends (memory, console, file, dummy), sendMail(),
 * sendMassMail(), mailAdmins(), mailManagers(), and getConnection().
 */

import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import {
  BadHeaderError,
  EmailMessage,
  EmailMultiAlternatives,
  getConnection,
  mailAdmins,
  mailManagers,
  registerBackend,
  sendMail,
  sendMassMail,
} from "./mod.ts";

// Import backends to trigger registration
import "@alexi/mail/backends/memory";
import "@alexi/mail/backends/console";
import "@alexi/mail/backends/file";
import "@alexi/mail/backends/dummy";

import { outbox } from "./backends/memory.ts";

// =============================================================================
// EmailMessage
// =============================================================================

Deno.test("EmailMessage: basic construction with defaults", () => {
  const msg = new EmailMessage({
    subject: "Hello",
    body: "World",
    fromEmail: "from@example.com",
    to: ["to@example.com"],
  });

  assertEquals(msg.subject, "Hello");
  assertEquals(msg.body, "World");
  assertEquals(msg.fromEmail, "from@example.com");
  assertEquals(msg.to, ["to@example.com"]);
  assertEquals(msg.cc, []);
  assertEquals(msg.bcc, []);
  assertEquals(msg.replyTo, []);
  assertEquals(msg.attachments, []);
});

Deno.test("EmailMessage: recipients() returns to + cc + bcc", () => {
  const msg = new EmailMessage({
    to: ["a@example.com"],
    cc: ["b@example.com"],
    bcc: ["c@example.com"],
  });
  assertEquals(msg.recipients(), [
    "a@example.com",
    "b@example.com",
    "c@example.com",
  ]);
});

Deno.test("EmailMessage: attach() adds attachment", () => {
  const msg = new EmailMessage({ to: ["a@example.com"] });
  msg.attach("hello.txt", "Hello World", "text/plain");
  assertEquals(msg.attachments.length, 1);
  assertEquals(msg.attachments[0].filename, "hello.txt");
  assertEquals(msg.attachments[0].mimetype, "text/plain");
});

Deno.test("EmailMessage: attach() guesses mimetype from extension", () => {
  const msg = new EmailMessage({ to: ["a@example.com"] });
  msg.attach("image.png", new Uint8Array([0, 1, 2]));
  assertEquals(msg.attachments[0].mimetype, "image/png");
});

Deno.test("EmailMessage: BadHeaderError on newline in subject", () => {
  let threw = false;
  try {
    new EmailMessage({ subject: "Hello\nWorld" });
  } catch (e) {
    threw = true;
    assertEquals(e instanceof BadHeaderError, true);
  }
  assertEquals(threw, true);
});

Deno.test("EmailMessage: BadHeaderError on carriage return in fromEmail", () => {
  let threw = false;
  try {
    new EmailMessage({ fromEmail: "from\r@example.com" });
  } catch (e) {
    threw = true;
    assertEquals(e instanceof BadHeaderError, true);
  }
  assertEquals(threw, true);
});

Deno.test("EmailMessage: BadHeaderError on newline in custom header", () => {
  let threw = false;
  try {
    new EmailMessage({ headers: { "X-Evil": "value\ninjected" } });
  } catch (e) {
    threw = true;
    assertEquals(e instanceof BadHeaderError, true);
  }
  assertEquals(threw, true);
});

Deno.test("EmailMessage: message() produces valid MIME headers", () => {
  const msg = new EmailMessage({
    subject: "Test Subject",
    body: "Test body.",
    fromEmail: "sender@example.com",
    to: ["recipient@example.com"],
  });
  const raw = msg.message();
  assertStringIncludes(raw, "Subject: Test Subject");
  assertStringIncludes(raw, "From: sender@example.com");
  assertStringIncludes(raw, "To: recipient@example.com");
  assertStringIncludes(raw, "MIME-Version: 1.0");
  assertStringIncludes(raw, "Test body.");
});

Deno.test("EmailMessage: message() encodes non-ASCII subject with RFC 2047", () => {
  const msg = new EmailMessage({
    subject: "Hei maailma — tämä on testi",
    body: "body",
    fromEmail: "f@example.com",
    to: ["t@example.com"],
  });
  const raw = msg.message();
  // Should contain encoded-word marker
  assertStringIncludes(raw, "=?utf-8?B?");
});

Deno.test("EmailMessage: message() with attachment produces multipart/mixed", () => {
  const msg = new EmailMessage({
    subject: "With attachment",
    body: "See attached.",
    fromEmail: "f@example.com",
    to: ["t@example.com"],
  });
  msg.attach("doc.txt", "Document content", "text/plain");
  const raw = msg.message();
  assertStringIncludes(raw, "multipart/mixed");
  assertStringIncludes(raw, "doc.txt");
});

// =============================================================================
// EmailMultiAlternatives
// =============================================================================

Deno.test("EmailMultiAlternatives: attachAlternative() stores alternative", () => {
  const msg = new EmailMultiAlternatives({
    subject: "Multi",
    body: "Plain text.",
    fromEmail: "f@example.com",
    to: ["t@example.com"],
  });
  msg.attachAlternative("<p>HTML</p>", "text/html");
  assertEquals(msg.alternatives.length, 1);
  assertEquals(msg.alternatives[0].mimetype, "text/html");
  assertEquals(msg.alternatives[0].content, "<p>HTML</p>");
});

Deno.test("EmailMultiAlternatives: bodyContains() returns true when text found in all parts", () => {
  const msg = new EmailMultiAlternatives({
    body: "Hello world",
    to: [],
  });
  msg.attachAlternative("<p>Hello world</p>", "text/html");
  assertEquals(msg.bodyContains("Hello world"), true);
});

Deno.test("EmailMultiAlternatives: bodyContains() returns false when text missing from alternative", () => {
  const msg = new EmailMultiAlternatives({
    body: "Hello world",
    to: [],
  });
  msg.attachAlternative("<p>Different content</p>", "text/html");
  assertEquals(msg.bodyContains("Hello world"), false);
});

Deno.test("EmailMultiAlternatives: message() produces multipart/alternative", () => {
  const msg = new EmailMultiAlternatives({
    subject: "Multi",
    body: "Plain.",
    fromEmail: "f@example.com",
    to: ["t@example.com"],
  });
  msg.attachAlternative("<p>HTML</p>", "text/html");
  const raw = msg.message();
  assertStringIncludes(raw, "multipart/alternative");
  assertStringIncludes(raw, "Plain.");
  assertStringIncludes(raw, "<p>HTML</p>");
});

// =============================================================================
// MemoryEmailBackend
// =============================================================================

Deno.test("MemoryEmailBackend: sendMessages() stores in outbox", async () => {
  outbox.length = 0;
  const backend = getConnection("memory");
  const msg = new EmailMessage({
    subject: "Memory test",
    body: "body",
    fromEmail: "f@example.com",
    to: ["t@example.com"],
  });
  const sent = await backend.sendMessages([msg]);
  assertEquals(sent, 1);
  assertEquals(outbox.length, 1);
  assertEquals(outbox[0].subject, "Memory test");
});

Deno.test("MemoryEmailBackend: multiple messages accumulate in outbox", async () => {
  outbox.length = 0;
  const backend = getConnection("memory");
  const m1 = new EmailMessage({ subject: "A", to: ["a@x.com"] });
  const m2 = new EmailMessage({ subject: "B", to: ["b@x.com"] });
  await backend.sendMessages([m1, m2]);
  assertEquals(outbox.length, 2);
});

// =============================================================================
// ConsoleEmailBackend
// =============================================================================

Deno.test("ConsoleEmailBackend: sendMessages() returns count without throwing", async () => {
  const backend = getConnection("console");
  const msg = new EmailMessage({
    subject: "Console test",
    body: "body",
    fromEmail: "f@example.com",
    to: ["t@example.com"],
  });
  const sent = await backend.sendMessages([msg]);
  assertEquals(sent, 1);
});

Deno.test("ConsoleEmailBackend: handles multipart message", async () => {
  const backend = getConnection("console");
  const msg = new EmailMultiAlternatives({
    subject: "Console multipart",
    body: "Plain",
    fromEmail: "f@example.com",
    to: ["t@example.com"],
  });
  msg.attachAlternative("<p>HTML</p>", "text/html");
  const sent = await backend.sendMessages([msg]);
  assertEquals(sent, 1);
});

// =============================================================================
// DummyEmailBackend
// =============================================================================

Deno.test("DummyEmailBackend: sendMessages() always returns 0", async () => {
  const backend = getConnection("dummy");
  const msg = new EmailMessage({
    subject: "Dummy test",
    body: "body",
    to: ["t@example.com"],
  });
  const sent = await backend.sendMessages([msg]);
  assertEquals(sent, 0);
});

// =============================================================================
// FileEmailBackend
// =============================================================================

Deno.test("FileEmailBackend: sendMessages() writes .eml file", async () => {
  const tmpDir = await Deno.makeTempDir();
  const { FileEmailBackend } = await import("./backends/file.ts");
  const backend = new FileEmailBackend({ filePath: tmpDir });

  const msg = new EmailMessage({
    subject: "File test",
    body: "body",
    fromEmail: "f@example.com",
    to: ["t@example.com"],
  });

  const sent = await backend.sendMessages([msg]);
  assertEquals(sent, 1);

  // Check file was created
  const entries: string[] = [];
  for await (const entry of Deno.readDir(tmpDir)) {
    entries.push(entry.name);
  }
  assertEquals(entries.length, 1);
  assertStringIncludes(entries[0], ".eml");

  // Verify file content contains subject
  const content = await Deno.readTextFile(`${tmpDir}/${entries[0]}`);
  assertStringIncludes(content, "File test");

  // Cleanup
  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("FileEmailBackend: sendMessages() returns 0 for empty list", async () => {
  const { FileEmailBackend } = await import("./backends/file.ts");
  const backend = new FileEmailBackend({ filePath: "/tmp/alexi-test" });
  const sent = await backend.sendMessages([]);
  assertEquals(sent, 0);
});

// =============================================================================
// sendMail()
// =============================================================================

Deno.test("sendMail(): sends via memory backend", async () => {
  outbox.length = 0;
  const { MemoryEmailBackend } = await import("./backends/memory.ts");
  const conn = new MemoryEmailBackend();
  const sent = await sendMail(
    "sendMail test",
    "body",
    "from@example.com",
    ["to@example.com"],
    { connection: conn },
  );
  assertEquals(sent, 1);
  assertEquals(outbox.length, 1);
  assertEquals(outbox[0].subject, "sendMail test");
});

Deno.test("sendMail(): sends multipart when htmlMessage provided", async () => {
  outbox.length = 0;
  const { MemoryEmailBackend } = await import("./backends/memory.ts");
  const conn = new MemoryEmailBackend();
  await sendMail(
    "HTML test",
    "Plain text",
    "from@example.com",
    ["to@example.com"],
    { connection: conn, htmlMessage: "<p>HTML</p>" },
  );
  assertEquals(outbox.length, 1);
  const msg = outbox[0];
  assertEquals(msg instanceof EmailMultiAlternatives, true);
  assertEquals((msg as EmailMultiAlternatives).alternatives.length, 1);
});

Deno.test("sendMail(): null fromEmail uses default", async () => {
  outbox.length = 0;
  const { MemoryEmailBackend } = await import("./backends/memory.ts");
  const conn = new MemoryEmailBackend();
  await sendMail("Subject", "body", null, ["to@example.com"], {
    connection: conn,
  });
  // Should use default "webmaster@localhost" when no settings loaded
  assertEquals(outbox[0].fromEmail, "webmaster@localhost");
});

Deno.test("sendMail(): failSilently suppresses errors", async () => {
  const { DummyEmailBackend } = await import("./backends/dummy.ts");
  // DummyBackend always returns 0, no error to suppress, just verifies the path
  const conn = new DummyEmailBackend({ failSilently: true });
  const sent = await sendMail("S", "b", null, ["t@example.com"], {
    connection: conn,
    failSilently: true,
  });
  assertEquals(sent, 0);
});

// =============================================================================
// sendMassMail()
// =============================================================================

Deno.test("sendMassMail(): sends all tuples via single connection", async () => {
  outbox.length = 0;
  const { MemoryEmailBackend } = await import("./backends/memory.ts");
  const conn = new MemoryEmailBackend();
  const sent = await sendMassMail(
    [
      ["Subject 1", "Body 1", "from@example.com", ["a@example.com"]],
      ["Subject 2", "Body 2", "from@example.com", ["b@example.com"]],
    ],
    { connection: conn },
  );
  assertEquals(sent, 2);
  assertEquals(outbox.length, 2);
  assertEquals(outbox[0].subject, "Subject 1");
  assertEquals(outbox[1].subject, "Subject 2");
});

// =============================================================================
// mailAdmins() / mailManagers()
// =============================================================================

Deno.test("mailAdmins(): sends nothing when ADMINS is empty", async () => {
  outbox.length = 0;
  const { MemoryEmailBackend } = await import("./backends/memory.ts");
  const conn = new MemoryEmailBackend();
  // No ADMINS set → should do nothing
  await mailAdmins("Error", "Something broke", { connection: conn });
  assertEquals(outbox.length, 0);
});

Deno.test("mailManagers(): sends nothing when MANAGERS is empty", async () => {
  outbox.length = 0;
  const { MemoryEmailBackend } = await import("./backends/memory.ts");
  const conn = new MemoryEmailBackend();
  await mailManagers("Alert", "Check this", { connection: conn });
  assertEquals(outbox.length, 0);
});

// =============================================================================
// getConnection() / registerBackend()
// =============================================================================

Deno.test("getConnection(): throws for unknown backend", () => {
  let threw = false;
  try {
    getConnection("nonexistent_backend_xyz");
  } catch (e) {
    threw = true;
    assertStringIncludes((e as Error).message, "nonexistent_backend_xyz");
  }
  assertEquals(threw, true);
});

Deno.test("registerBackend(): custom backend is usable via getConnection()", async () => {
  const { BaseEmailBackend } = await import("./backends/base.ts");
  const collected: EmailMessage[] = [];

  class CustomBackend extends BaseEmailBackend {
    override async sendMessages(msgs: EmailMessage[]): Promise<number> {
      collected.push(...msgs);
      return msgs.length;
    }
  }

  registerBackend("custom_test", CustomBackend);
  const conn = getConnection("custom_test");
  const msg = new EmailMessage({ subject: "Custom", to: ["x@y.com"] });
  await conn.sendMessages([msg]);
  assertEquals(collected.length, 1);
  assertEquals(collected[0].subject, "Custom");
});

// =============================================================================
// Symbol.asyncDispose
// =============================================================================

Deno.test("BaseEmailBackend: Symbol.asyncDispose calls close()", async () => {
  let closeCalled = false;
  const { BaseEmailBackend } = await import("./backends/base.ts");

  class TestBackend extends BaseEmailBackend {
    override async close(): Promise<void> {
      closeCalled = true;
    }
    override async sendMessages(_msgs: EmailMessage[]): Promise<number> {
      return 0;
    }
  }

  const backend = new TestBackend();
  await backend[Symbol.asyncDispose]();
  assertEquals(closeCalled, true);
});
