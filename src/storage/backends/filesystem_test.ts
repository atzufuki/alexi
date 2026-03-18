/**
 * Tests for FileSystemStorage backend
 */

import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert@1";
import { join } from "jsr:@std/path@1";
import { FileSystemStorage } from "./filesystem.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an isolated temp dir and a FileSystemStorage pointed at it. */
async function makeTempStorage(
  opts: { allowOverwrite?: boolean; baseUrl?: string } = {},
): Promise<{ storage: FileSystemStorage; dir: string }> {
  const dir = await Deno.makeTempDir({ prefix: "alexi_fs_test_" });
  const storage = new FileSystemStorage({
    location: dir,
    baseUrl: opts.baseUrl ?? "/media/",
    allowOverwrite: opts.allowOverwrite,
  });
  return { storage, dir };
}

/** Remove temp dir after each test. */
async function cleanup(dir: string): Promise<void> {
  await Deno.remove(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// save / exists / open
// ---------------------------------------------------------------------------

Deno.test("FileSystemStorage: save and exists", async () => {
  const { storage, dir } = await makeTempStorage();
  try {
    const file = new File(["hello world"], "hello.txt", {
      type: "text/plain",
    });
    const savedName = await storage.save("hello.txt", file);
    assertEquals(savedName, "hello.txt");
    assertEquals(await storage.exists("hello.txt"), true);
    assertEquals(await storage.exists("missing.txt"), false);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("FileSystemStorage: save creates intermediate directories", async () => {
  const { storage, dir } = await makeTempStorage();
  try {
    const file = new File(["nested"], "file.txt", { type: "text/plain" });
    const savedName = await storage.save("a/b/c/file.txt", file);
    assertEquals(savedName, "a/b/c/file.txt");
    assertEquals(await storage.exists("a/b/c/file.txt"), true);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("FileSystemStorage: open reads saved content", async () => {
  const { storage, dir } = await makeTempStorage();
  try {
    const content = "file content 123";
    await storage.save("read_me.txt", new Blob([content]));
    const stream = await storage.open("read_me.txt");
    const text = await new Response(stream).text();
    assertEquals(text, content);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("FileSystemStorage: open throws for missing file", async () => {
  const { storage, dir } = await makeTempStorage();
  try {
    await assertRejects(() => storage.open("ghost.txt"));
  } finally {
    await cleanup(dir);
  }
});

Deno.test("FileSystemStorage: save ReadableStream content", async () => {
  const { storage, dir } = await makeTempStorage();
  try {
    const text = "streamed content";
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
    const savedName = await storage.save("streamed.txt", stream);
    assertEquals(savedName, "streamed.txt");
    const result = await new Response(await storage.open("streamed.txt"))
      .text();
    assertEquals(result, text);
  } finally {
    await cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

Deno.test("FileSystemStorage: delete removes the file", async () => {
  const { storage, dir } = await makeTempStorage();
  try {
    await storage.save("to_delete.txt", new Blob(["bye"]));
    assertEquals(await storage.exists("to_delete.txt"), true);
    await storage.delete("to_delete.txt");
    assertEquals(await storage.exists("to_delete.txt"), false);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("FileSystemStorage: delete is idempotent for missing files", async () => {
  const { storage, dir } = await makeTempStorage();
  try {
    // Should not throw
    await storage.delete("does_not_exist.txt");
  } finally {
    await cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// url
// ---------------------------------------------------------------------------

Deno.test("FileSystemStorage: url returns baseUrl + name", async () => {
  const { storage, dir } = await makeTempStorage({ baseUrl: "/uploads/" });
  try {
    const u = await storage.url("images/photo.jpg");
    assertEquals(u, "/uploads/images/photo.jpg");
  } finally {
    await cleanup(dir);
  }
});

Deno.test("FileSystemStorage: url handles baseUrl without trailing slash", async () => {
  const { storage, dir } = await makeTempStorage({ baseUrl: "/uploads" });
  try {
    const u = await storage.url("photo.jpg");
    assertEquals(u, "/uploads/photo.jpg");
  } finally {
    await cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// size
// ---------------------------------------------------------------------------

Deno.test("FileSystemStorage: size returns correct byte count", async () => {
  const { storage, dir } = await makeTempStorage();
  try {
    const data = "abcde";
    await storage.save("sized.txt", new Blob([data]));
    const bytes = await storage.size("sized.txt");
    assertEquals(bytes, new TextEncoder().encode(data).byteLength);
  } finally {
    await cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// listdir
// ---------------------------------------------------------------------------

Deno.test("FileSystemStorage: listdir returns dirs and files", async () => {
  const { storage, dir } = await makeTempStorage();
  try {
    await storage.save("root.txt", new Blob(["r"]));
    await storage.save("subdir/child.txt", new Blob(["c"]));

    const result = await storage.listdir("");
    assertEquals(result.files, ["root.txt"]);
    assertEquals(result.dirs, ["subdir"]);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("FileSystemStorage: listdir on non-existent path returns empty", async () => {
  const { storage, dir } = await makeTempStorage();
  try {
    const result = await storage.listdir("does/not/exist");
    assertEquals(result.dirs, []);
    assertEquals(result.files, []);
  } finally {
    await cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// getMetadata
// ---------------------------------------------------------------------------

Deno.test("FileSystemStorage: getMetadata returns size and name", async () => {
  const { storage, dir } = await makeTempStorage();
  try {
    const data = "metadata test";
    await storage.save("meta.txt", new Blob([data]));
    const meta = await storage.getMetadata("meta.txt");
    assertEquals(meta.name, "meta.txt");
    assertEquals(meta.size, new TextEncoder().encode(data).byteLength);
    assertExists(meta.updatedAt);
    assertEquals(meta.contentType, "text/plain");
  } finally {
    await cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// allowOverwrite = false (default)
// ---------------------------------------------------------------------------

Deno.test("FileSystemStorage: generates unique name on collision by default", async () => {
  const { storage, dir } = await makeTempStorage({ allowOverwrite: false });
  try {
    await storage.save("dupe.txt", new Blob(["first"]));
    const second = await storage.save("dupe.txt", new Blob(["second"]));

    // The second save should use a different name
    assertEquals(second !== "dupe.txt", true);

    // Both files should exist
    assertEquals(await storage.exists("dupe.txt"), true);
    assertEquals(await storage.exists(second), true);

    // Original content unchanged
    const original = await new Response(
      await storage.open("dupe.txt"),
    ).text();
    assertEquals(original, "first");
  } finally {
    await cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// allowOverwrite = true
// ---------------------------------------------------------------------------

Deno.test("FileSystemStorage: overwrites file when allowOverwrite is true", async () => {
  const { storage, dir } = await makeTempStorage({ allowOverwrite: true });
  try {
    await storage.save("over.txt", new Blob(["original"]));
    await storage.save("over.txt", new Blob(["overwritten"]));

    const result = await new Response(await storage.open("over.txt")).text();
    assertEquals(result, "overwritten");
  } finally {
    await cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// signedUrl
// ---------------------------------------------------------------------------

Deno.test("FileSystemStorage: signedUrl falls back to public url", async () => {
  const { storage, dir } = await makeTempStorage({ baseUrl: "/files/" });
  try {
    const signed = await storage.signedUrl("report.pdf");
    assertEquals(signed, "/files/report.pdf");
  } finally {
    await cleanup(dir);
  }
});
