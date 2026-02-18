/**
 * Storage API Tests
 */

import { assertEquals, assertRejects } from "@std/assert";
import { MemoryStorage } from "./backends/memory.ts";
import { getStorage, resetStorage, setStorage } from "./setup.ts";

// =============================================================================
// MemoryStorage Tests
// =============================================================================

Deno.test({
  name: "MemoryStorage: save and open file",
  async fn() {
    const storage = new MemoryStorage();

    const content = "Hello, World!";
    const file = new File([content], "hello.txt", { type: "text/plain" });

    // Save
    const name = await storage.save("documents/hello.txt", file);
    assertEquals(name, "documents/hello.txt");

    // Open and read
    const stream = await storage.open("documents/hello.txt");
    const text = await new Response(stream).text();
    assertEquals(text, content);
  },
});

Deno.test({
  name: "MemoryStorage: save with Blob",
  async fn() {
    const storage = new MemoryStorage();

    const content = new Uint8Array([1, 2, 3, 4, 5]);
    const blob = new Blob([content], { type: "application/octet-stream" });

    await storage.save("data/binary.bin", blob);

    const stream = await storage.open("data/binary.bin");
    const result = new Uint8Array(await new Response(stream).arrayBuffer());
    assertEquals(result, content);
  },
});

Deno.test({
  name: "MemoryStorage: save with ReadableStream",
  async fn() {
    const storage = new MemoryStorage();

    const content = "Stream content";
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(content));
        controller.close();
      },
    });

    await storage.save("stream.txt", stream);

    const readStream = await storage.open("stream.txt");
    const text = await new Response(readStream).text();
    assertEquals(text, content);
  },
});

Deno.test({
  name: "MemoryStorage: exists",
  async fn() {
    const storage = new MemoryStorage();

    assertEquals(await storage.exists("missing.txt"), false);

    await storage.save("exists.txt", new File(["test"], "exists.txt"));
    assertEquals(await storage.exists("exists.txt"), true);
  },
});

Deno.test({
  name: "MemoryStorage: delete",
  async fn() {
    const storage = new MemoryStorage();

    await storage.save("delete-me.txt", new File(["test"], "delete-me.txt"));
    assertEquals(await storage.exists("delete-me.txt"), true);

    await storage.delete("delete-me.txt");
    assertEquals(await storage.exists("delete-me.txt"), false);
  },
});

Deno.test({
  name: "MemoryStorage: size",
  async fn() {
    const storage = new MemoryStorage();

    const content = "12345"; // 5 bytes
    await storage.save("sized.txt", new File([content], "sized.txt"));

    const size = await storage.size("sized.txt");
    assertEquals(size, 5);
  },
});

Deno.test({
  name: "MemoryStorage: url",
  async fn() {
    const storage = new MemoryStorage({ baseUrl: "http://localhost:8000/" });

    await storage.save("file.txt", new File(["test"], "file.txt"));

    const url = await storage.url("file.txt");
    assertEquals(url, "http://localhost:8000/file.txt");
  },
});

Deno.test({
  name: "MemoryStorage: listdir",
  async fn() {
    const storage = new MemoryStorage();

    // Create some files
    await storage.save("docs/a.txt", new File(["a"], "a.txt"));
    await storage.save("docs/b.txt", new File(["b"], "b.txt"));
    await storage.save("docs/sub/c.txt", new File(["c"], "c.txt"));
    await storage.save("docs/sub/deep/d.txt", new File(["d"], "d.txt"));
    await storage.save("other/e.txt", new File(["e"], "e.txt"));

    // List root
    const root = await storage.listdir("");
    assertEquals(root.dirs.sort(), ["docs", "other"]);
    assertEquals(root.files, []);

    // List docs
    const docs = await storage.listdir("docs");
    assertEquals(docs.dirs, ["sub"]);
    assertEquals(docs.files.sort(), ["a.txt", "b.txt"]);

    // List docs/sub
    const sub = await storage.listdir("docs/sub");
    assertEquals(sub.dirs, ["deep"]);
    assertEquals(sub.files, ["c.txt"]);
  },
});

Deno.test({
  name: "MemoryStorage: getMetadata",
  async fn() {
    const storage = new MemoryStorage();

    const file = new File(["Hello"], "hello.txt", { type: "text/plain" });
    await storage.save("meta.txt", file, {
      metadata: { author: "test" },
    });

    const meta = await storage.getMetadata("meta.txt");
    assertEquals(meta.name, "meta.txt");
    assertEquals(meta.size, 5);
    assertEquals(meta.contentType, "text/plain");
    assertEquals(meta.metadata?.author, "test");
  },
});

Deno.test({
  name: "MemoryStorage: open throws for missing file",
  async fn() {
    const storage = new MemoryStorage();

    await assertRejects(
      () => storage.open("missing.txt"),
      Error,
      "File not found",
    );
  },
});

Deno.test({
  name: "MemoryStorage: clear",
  async fn() {
    const storage = new MemoryStorage();

    await storage.save("a.txt", new File(["a"], "a.txt"));
    await storage.save("b.txt", new File(["b"], "b.txt"));
    assertEquals(storage.count, 2);

    storage.clear();
    assertEquals(storage.count, 0);
    assertEquals(await storage.exists("a.txt"), false);
  },
});

Deno.test({
  name: "MemoryStorage: names property",
  async fn() {
    const storage = new MemoryStorage();

    await storage.save("first.txt", new File(["1"], "first.txt"));
    await storage.save("second.txt", new File(["2"], "second.txt"));

    assertEquals(storage.names.sort(), ["first.txt", "second.txt"]);
  },
});

Deno.test({
  name: "MemoryStorage: path normalization",
  async fn() {
    const storage = new MemoryStorage();

    // Various path formats should normalize
    await storage.save("//docs//file.txt", new File(["test"], "file.txt"));
    assertEquals(await storage.exists("docs/file.txt"), true);

    await storage.save("other\\path\\file.txt", new File(["test"], "file.txt"));
    assertEquals(await storage.exists("other/path/file.txt"), true);
  },
});

// =============================================================================
// Setup Tests
// =============================================================================

Deno.test({
  name: "setStorage and getStorage",
  fn() {
    resetStorage();

    const storage = new MemoryStorage();
    setStorage(storage);

    const retrieved = getStorage();
    assertEquals(retrieved, storage);

    resetStorage();
  },
});

Deno.test({
  name: "getStorage throws when not configured",
  fn() {
    resetStorage();

    try {
      getStorage();
      throw new Error("Should have thrown");
    } catch (e) {
      assertEquals((e as Error).message.includes("not configured"), true);
    }

    resetStorage();
  },
});

// =============================================================================
// Storage Base Class Tests
// =============================================================================

Deno.test({
  name: "Storage: generateUniqueName",
  fn() {
    const storage = new MemoryStorage();

    const name1 = storage.generateUniqueName("file.txt");
    const name2 = storage.generateUniqueName("file.txt");

    // Should have different suffixes
    assertEquals(name1.startsWith("file_"), true);
    assertEquals(name1.endsWith(".txt"), true);
    assertEquals(name1 !== name2, true);

    // Without extension
    const name3 = storage.generateUniqueName("noext");
    assertEquals(name3.startsWith("noext_"), true);
    assertEquals(name3.includes("."), false);
  },
});

Deno.test({
  name: "Storage: guessContentType",
  async fn() {
    const storage = new MemoryStorage();

    // Save without explicit content type
    await storage.save("image.png", new Blob(["fake png"]));
    const meta = await storage.getMetadata("image.png");
    assertEquals(meta.contentType, "image/png");

    await storage.save("doc.pdf", new Blob(["fake pdf"]));
    const meta2 = await storage.getMetadata("doc.pdf");
    assertEquals(meta2.contentType, "application/pdf");

    await storage.save("unknown.xyz", new Blob(["unknown"]));
    const meta3 = await storage.getMetadata("unknown.xyz");
    assertEquals(meta3.contentType, "application/octet-stream");
  },
});
