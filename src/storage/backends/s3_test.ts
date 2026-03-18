/**
 * Tests for S3Storage backend
 *
 * Uses mocked fetch to avoid requiring a real S3-compatible service.
 */

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { S3Storage } from "./s3.ts";

// =============================================================================
// Mock fetch helper
// =============================================================================

type MockHandler = (input: RequestInfo | URL, init?: RequestInit) => Response;

function withMockFetch(
  handler: MockHandler,
  fn: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(input, init));
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

// =============================================================================
// Test fixtures
// =============================================================================

const storageOptions = {
  bucket: "test-bucket",
  endpoint: "https://s3.example.com",
  region: "us-east-1",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

// =============================================================================
// Tests: save()
// =============================================================================

Deno.test("S3Storage: save() uploads file and returns name", async () => {
  const storage = new S3Storage(storageOptions);
  const file = new File(["hello world"], "test.txt", { type: "text/plain" });

  await withMockFetch((input, init) => {
    assertEquals((init?.method ?? "GET").toUpperCase(), "PUT");
    assertEquals(
      input.toString(),
      "https://s3.example.com/test-bucket/test.txt",
    );
    return new Response("", { status: 200 });
  }, async () => {
    const name = await storage.save("test.txt", file);
    assertEquals(name, "test.txt");
  });
});

Deno.test("S3Storage: save() with basePath prefixes the key", async () => {
  const storage = new S3Storage({ ...storageOptions, basePath: "uploads/" });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });

  await withMockFetch((input) => {
    assertEquals(
      input.toString(),
      "https://s3.example.com/test-bucket/uploads/photo.jpg",
    );
    return new Response("", { status: 200 });
  }, async () => {
    const name = await storage.save("photo.jpg", file);
    assertEquals(name, "photo.jpg");
  });
});

Deno.test("S3Storage: save() throws on non-2xx response", async () => {
  const storage = new S3Storage(storageOptions);
  const file = new File(["data"], "fail.txt");

  await withMockFetch(
    () => new Response("<Error>AccessDenied</Error>", { status: 403 }),
    async () => {
      await assertRejects(
        () => storage.save("fail.txt", file),
        Error,
        "S3 save failed (403)",
      );
    },
  );
});

Deno.test("S3Storage: save() with ReadableStream content", async () => {
  const storage = new S3Storage(storageOptions);
  const stream = new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(new TextEncoder().encode("stream data"));
      ctrl.close();
    },
  });

  await withMockFetch((_input, init) => {
    assertEquals((init?.method ?? "GET").toUpperCase(), "PUT");
    return new Response("", { status: 200 });
  }, async () => {
    const name = await storage.save("streamed.txt", stream);
    assertEquals(name, "streamed.txt");
  });
});

// =============================================================================
// Tests: open()
// =============================================================================

Deno.test("S3Storage: open() returns response body stream", async () => {
  const storage = new S3Storage(storageOptions);

  await withMockFetch((_input, init) => {
    assertEquals((init?.method ?? "GET").toUpperCase(), "GET");
    return new Response("file content", { status: 200 });
  }, async () => {
    const stream = await storage.open("test.txt");
    const text = await new Response(stream).text();
    assertEquals(text, "file content");
  });
});

Deno.test("S3Storage: open() throws on non-2xx", async () => {
  const storage = new S3Storage(storageOptions);

  await withMockFetch(
    () => new Response("Not Found", { status: 404 }),
    async () => {
      await assertRejects(
        () => storage.open("missing.txt"),
        Error,
        "S3 open failed (404)",
      );
    },
  );
});

// =============================================================================
// Tests: delete()
// =============================================================================

Deno.test("S3Storage: delete() sends DELETE request", async () => {
  const storage = new S3Storage(storageOptions);
  let calledMethod = "";

  await withMockFetch((_input, init) => {
    calledMethod = (init?.method ?? "GET").toUpperCase();
    return new Response(null, { status: 204 });
  }, async () => {
    await storage.delete("test.txt");
    assertEquals(calledMethod, "DELETE");
  });
});

Deno.test("S3Storage: delete() silently ignores 404", async () => {
  const storage = new S3Storage(storageOptions);

  await withMockFetch(() => new Response("", { status: 404 }), async () => {
    // Should not throw
    await storage.delete("nonexistent.txt");
  });
});

// =============================================================================
// Tests: exists()
// =============================================================================

Deno.test("S3Storage: exists() returns true on 200", async () => {
  const storage = new S3Storage(storageOptions);

  await withMockFetch(() => new Response("", { status: 200 }), async () => {
    assertEquals(await storage.exists("test.txt"), true);
  });
});

Deno.test("S3Storage: exists() returns false on 404", async () => {
  const storage = new S3Storage(storageOptions);

  await withMockFetch(() => new Response("", { status: 404 }), async () => {
    assertEquals(await storage.exists("missing.txt"), false);
  });
});

// =============================================================================
// Tests: url()
// =============================================================================

Deno.test("S3Storage: url() returns path-style URL by default", async () => {
  const storage = new S3Storage(storageOptions);
  const url = await storage.url("documents/report.pdf");
  assertEquals(url, "https://s3.example.com/test-bucket/documents/report.pdf");
});

Deno.test("S3Storage: url() with basePath includes prefix in URL", async () => {
  const storage = new S3Storage({ ...storageOptions, basePath: "media/" });
  const url = await storage.url("photo.jpg");
  assertEquals(url, "https://s3.example.com/test-bucket/media/photo.jpg");
});

// =============================================================================
// Tests: size()
// =============================================================================

Deno.test("S3Storage: size() reads Content-Length from HEAD", async () => {
  const storage = new S3Storage(storageOptions);

  await withMockFetch(() =>
    new Response("", {
      status: 200,
      headers: {
        "content-length": "1234",
        "content-type": "text/plain",
        "last-modified": "Wed, 01 Jan 2025 00:00:00 GMT",
      },
    }), async () => {
    assertEquals(await storage.size("file.txt"), 1234);
  });
});

// =============================================================================
// Tests: listdir()
// =============================================================================

Deno.test("S3Storage: listdir() parses XML response", async () => {
  const storage = new S3Storage(storageOptions);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <CommonPrefixes><Prefix>images/</Prefix></CommonPrefixes>
  <CommonPrefixes><Prefix>docs/</Prefix></CommonPrefixes>
  <Contents><Key>readme.txt</Key></Contents>
  <Contents><Key>logo.png</Key></Contents>
</ListBucketResult>`;

  await withMockFetch(() => new Response(xml, { status: 200 }), async () => {
    const result = await storage.listdir("");
    assertEquals(result.dirs, ["images", "docs"]);
    assertEquals(result.files, ["readme.txt", "logo.png"]);
  });
});

// =============================================================================
// Tests: getMetadata()
// =============================================================================

Deno.test("S3Storage: getMetadata() maps HEAD headers to FileMetadata", async () => {
  const storage = new S3Storage(storageOptions);

  await withMockFetch(() =>
    new Response("", {
      status: 200,
      headers: {
        "content-length": "512",
        "content-type": "image/jpeg",
        "last-modified": "Fri, 10 Jan 2025 12:00:00 GMT",
        "etag": '"abc123"',
        "x-amz-meta-author": "test-user",
      },
    }), async () => {
    const meta = await storage.getMetadata("photo.jpg");
    assertEquals(meta.name, "photo.jpg");
    assertEquals(meta.size, 512);
    assertEquals(meta.contentType, "image/jpeg");
    assertEquals(meta.etag, "abc123");
    assertEquals(meta.metadata?.author, "test-user");
  });
});

// =============================================================================
// Tests: signedUrl()
// =============================================================================

Deno.test("S3Storage: signedUrl() returns URL with query parameters", async () => {
  const storage = new S3Storage(storageOptions);
  const url = await storage.signedUrl("secret.pdf", { expiresIn: 300 });

  // Must contain the base path and signing parameters
  assertEquals(url.includes("test-bucket/secret.pdf"), true);
  assertEquals(url.includes("X-Amz-Algorithm=AWS4-HMAC-SHA256"), true);
  assertEquals(url.includes("X-Amz-Expires=300"), true);
  assertEquals(url.includes("X-Amz-Signature="), true);
});
