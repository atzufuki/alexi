/**
 * Tests for FileField and ImageField serializer fields
 */

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { resetStorage, setStorage } from "@alexi/storage";
import { MemoryStorage } from "@alexi/storage/backends/memory";
import { FileField, ImageField } from "./fields.ts";

// =============================================================================
// Test helpers
// =============================================================================

function makeFile(
  name: string,
  content: string,
  type: string,
): File {
  return new File([content], name, { type });
}

// =============================================================================
// FileField: validateType()
// =============================================================================

Deno.test("FileField: validates a File object", () => {
  const field = new FileField();
  const file = makeFile("test.txt", "hello", "text/plain");
  const result = field.validate(file);
  assertEquals(result.valid, true);
});

Deno.test("FileField: passes through existing path string", () => {
  const field = new FileField();
  const result = field.validate("uploads/existing.txt");
  assertEquals(result.valid, true);
  assertEquals(result.value, "uploads/existing.txt");
});

Deno.test("FileField: rejects non-File, non-string value", () => {
  const field = new FileField();
  const result = field.validate(42);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

Deno.test("FileField: validates maxSize constraint", () => {
  const field = new FileField({ maxSize: 5 });
  const bigFile = makeFile("big.txt", "hello world!", "text/plain");
  const result = field.validate(bigFile);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0].includes("exceeds the maximum"), true);
});

Deno.test("FileField: passes maxSize when file is within limit", () => {
  const field = new FileField({ maxSize: 100 });
  const smallFile = makeFile("small.txt", "hi", "text/plain");
  const result = field.validate(smallFile);
  assertEquals(result.valid, true);
});

Deno.test("FileField: validates allowedExtensions constraint", () => {
  const field = new FileField({ allowedExtensions: [".jpg", ".png"] });
  const file = makeFile("photo.txt", "data", "text/plain");
  const result = field.validate(file);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0].includes("extension"), true);
});

Deno.test("FileField: passes allowedExtensions when extension matches", () => {
  const field = new FileField({ allowedExtensions: [".jpg", ".png"] });
  const file = makeFile("photo.jpg", "data", "image/jpeg");
  const result = field.validate(file);
  assertEquals(result.valid, true);
});

Deno.test("FileField: validates allowedMimeTypes constraint", () => {
  const field = new FileField({ allowedMimeTypes: ["image/jpeg"] });
  const file = makeFile("doc.pdf", "data", "application/pdf");
  const result = field.validate(file);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0].includes("type"), true);
});

Deno.test("FileField: passes allowedMimeTypes when MIME type matches", () => {
  const field = new FileField({ allowedMimeTypes: ["image/jpeg"] });
  const file = makeFile("photo.jpg", "data", "image/jpeg");
  const result = field.validate(file);
  assertEquals(result.valid, true);
});

// =============================================================================
// FileField: runAsync() — file upload
// =============================================================================

Deno.test("FileField: runAsync() uploads File to storage and returns path", async () => {
  const storage = new MemoryStorage({ baseUrl: "memory://" });
  setStorage(storage);

  try {
    const field = new FileField({ uploadTo: "uploads/" });
    const file = makeFile("test.txt", "hello", "text/plain");
    const path = await field.runAsync(file);
    assertEquals(path, "uploads/test.txt");
    assertEquals(await storage.exists("uploads/test.txt"), true);
  } finally {
    resetStorage();
  }
});

Deno.test("FileField: runAsync() uses uploadTo function", async () => {
  const storage = new MemoryStorage({ baseUrl: "memory://" });
  setStorage(storage);

  try {
    const field = new FileField({
      uploadTo: (filename) => `custom/${filename}`,
    });
    const file = makeFile("data.csv", "a,b,c", "text/csv");
    const path = await field.runAsync(file);
    assertEquals(path, "custom/data.csv");
  } finally {
    resetStorage();
  }
});

Deno.test("FileField: runAsync() returns string path unchanged", async () => {
  const field = new FileField();
  const result = await field.runAsync("already/saved.txt");
  assertEquals(result, "already/saved.txt");
});

// =============================================================================
// FileField: getUrl()
// =============================================================================

Deno.test("FileField: getUrl() returns storage URL", async () => {
  const storage = new MemoryStorage({ baseUrl: "http://localhost/media/" });
  setStorage(storage);

  try {
    const field = new FileField();
    const url = await field.getUrl("photo.jpg");
    assertEquals(url, "http://localhost/media/photo.jpg");
  } finally {
    resetStorage();
  }
});

Deno.test("FileField: getUrl() returns path if storage throws", async () => {
  resetStorage(); // ensure no storage configured
  const field = new FileField();
  const result = await field.getUrl("photo.jpg");
  // Without storage, falls back to the raw path
  assertEquals(result, "photo.jpg");
});

// =============================================================================
// ImageField
// =============================================================================

Deno.test("ImageField: accepts image MIME types by default", () => {
  const field = new ImageField();
  const file = makeFile("photo.png", "data", "image/png");
  const result = field.validate(file);
  assertEquals(result.valid, true);
});

Deno.test("ImageField: rejects non-image MIME types", () => {
  const field = new ImageField();
  const file = makeFile("doc.pdf", "data", "application/pdf");
  const result = field.validate(file);
  assertEquals(result.valid, false);
});

Deno.test("ImageField: custom allowedMimeTypes override defaults", () => {
  const field = new ImageField({
    allowedMimeTypes: ["image/jpeg"],
  });
  const png = makeFile("photo.png", "data", "image/png");
  const result = field.validate(png);
  assertEquals(result.valid, false);
});
