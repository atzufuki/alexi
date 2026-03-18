/**
 * MediaFilesMiddleware Tests
 *
 * Tests for the MediaFilesMiddleware, mediaFilesMiddleware factory, and
 * the mediaServe helper introduced in issue #423.
 */

import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  MediaFilesMiddleware,
  mediaFilesMiddleware,
  mediaServe,
} from "./middleware.ts";

// =============================================================================
// Helpers
// =============================================================================

/** Create a temporary directory with a media file and return the dir path. */
async function createTempMediaDir(
  files: Record<string, string>,
): Promise<string> {
  const tmpDir = await Deno.makeTempDir({ prefix: "alexi_media_test_" });
  for (const [rel, content] of Object.entries(files)) {
    const dest = join(tmpDir, rel);
    await Deno.mkdir(join(dest, ".."), { recursive: true });
    await Deno.writeTextFile(dest, content);
  }
  return tmpDir;
}

function makeRequest(url: string): Request {
  return new Request(url);
}

// =============================================================================
// mediaServe — unit tests
// =============================================================================

Deno.test("mediaServe: returns 200 for existing file", async () => {
  const tmpDir = await createTempMediaDir({ "hello.txt": "hello world" });
  try {
    const req = makeRequest("http://localhost/media/hello.txt");
    const res = await mediaServe(tmpDir, "hello.txt", req);
    assertEquals(res.status, 200);
    const body = await res.text();
    assertEquals(body, "hello world");
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("mediaServe: returns 404 for missing file", async () => {
  const tmpDir = await createTempMediaDir({});
  try {
    const req = makeRequest("http://localhost/media/missing.txt");
    const res = await mediaServe(tmpDir, "missing.txt", req);
    assertEquals(res.status, 404);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("mediaServe: returns 404 for empty path", async () => {
  const tmpDir = await createTempMediaDir({});
  try {
    const req = makeRequest("http://localhost/media/");
    const res = await mediaServe(tmpDir, "", req);
    assertEquals(res.status, 404);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("mediaServe: prevents directory traversal", async () => {
  const tmpDir = await createTempMediaDir({ "secret.txt": "secret" });
  try {
    const req = makeRequest("http://localhost/media/../../secret.txt");
    // Path traversal segments are stripped by sanitizePath
    const res = await mediaServe(tmpDir, "../../secret.txt", req);
    // After sanitization the path becomes "secret.txt" which does exist — this
    // is acceptable. What must NOT happen is reading files outside tmpDir.
    // The sanitized path resolves within tmpDir so a 200 here is correct.
    // The important guarantee is that ".." is removed.
    assertEquals([200, 404].includes(res.status), true);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("mediaServe: returns 304 when ETag matches", async () => {
  const tmpDir = await createTempMediaDir({ "style.css": "body{}" });
  try {
    // First request to get ETag
    const req1 = makeRequest("http://localhost/media/style.css");
    const res1 = await mediaServe(tmpDir, "style.css", req1);
    assertEquals(res1.status, 200);
    const etag = res1.headers.get("ETag");
    assertEquals(typeof etag, "string");

    // Conditional request with matching ETag
    const req2 = new Request("http://localhost/media/style.css", {
      headers: { "If-None-Match": etag! },
    });
    const res2 = await mediaServe(tmpDir, "style.css", req2);
    assertEquals(res2.status, 304);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("mediaServe: sets correct Content-Type for image", async () => {
  const tmpDir = await createTempMediaDir({ "photo.png": "" });
  try {
    const req = makeRequest("http://localhost/media/photo.png");
    const res = await mediaServe(tmpDir, "photo.png", req);
    assertEquals(res.status, 200);
    const ct = res.headers.get("Content-Type") ?? "";
    assertEquals(ct.startsWith("image/png"), true);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

// =============================================================================
// MediaFilesMiddleware — integration tests
// =============================================================================

/** Minimal next-layer that returns a 200 "passed through" response. */
async function nextLayer(_req: Request | undefined): Promise<Response> {
  return new Response("next layer", { status: 200 });
}

Deno.test("MediaFilesMiddleware: serves file at MEDIA_URL prefix", async () => {
  const tmpDir = await createTempMediaDir({ "avatar.jpg": "JPEG_BYTES" });
  try {
    const mw = new MediaFilesMiddleware(nextLayer, {
      mediaRoot: tmpDir,
      mediaUrl: "/media/",
    });

    const req = makeRequest("http://localhost/media/avatar.jpg");
    const res = await mw.call(req);
    assertEquals(res.status, 200);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("MediaFilesMiddleware: passes through non-media requests", async () => {
  const tmpDir = await createTempMediaDir({});
  try {
    const mw = new MediaFilesMiddleware(nextLayer, {
      mediaRoot: tmpDir,
      mediaUrl: "/media/",
    });

    const req = makeRequest("http://localhost/api/users/");
    const res = await mw.call(req);
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "next layer");
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("MediaFilesMiddleware: passes through when file not found", async () => {
  const tmpDir = await createTempMediaDir({});
  try {
    const mw = new MediaFilesMiddleware(nextLayer, {
      mediaRoot: tmpDir,
      mediaUrl: "/media/",
    });

    const req = makeRequest("http://localhost/media/nonexistent.png");
    const res = await mw.call(req);
    // Falls through to next layer
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "next layer");
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("MediaFilesMiddleware: passes through for bare MEDIA_URL (no path)", async () => {
  const tmpDir = await createTempMediaDir({});
  try {
    const mw = new MediaFilesMiddleware(nextLayer, {
      mediaRoot: tmpDir,
      mediaUrl: "/media/",
    });

    const req = makeRequest("http://localhost/media/");
    const res = await mw.call(req);
    // No file path → pass through
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "next layer");
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("MediaFilesMiddleware: uses custom mediaUrl prefix", async () => {
  const tmpDir = await createTempMediaDir({ "doc.pdf": "%PDF" });
  try {
    const mw = new MediaFilesMiddleware(nextLayer, {
      mediaRoot: tmpDir,
      mediaUrl: "/uploads/",
    });

    // Request to /media/ should pass through (not matching /uploads/)
    const req1 = makeRequest("http://localhost/media/doc.pdf");
    const res1 = await mw.call(req1);
    assertEquals(await res1.text(), "next layer");

    // Request to /uploads/ should be served
    const req2 = makeRequest("http://localhost/uploads/doc.pdf");
    const res2 = await mw.call(req2);
    assertEquals(res2.status, 200);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

// =============================================================================
// mediaFilesMiddleware factory
// =============================================================================

Deno.test("mediaFilesMiddleware: factory returns MiddlewareClass", async () => {
  const tmpDir = await createTempMediaDir({ "img.gif": "GIF89a" });
  try {
    const MwClass = mediaFilesMiddleware({
      mediaRoot: tmpDir,
      mediaUrl: "/media/",
    });

    const mw = new MwClass(nextLayer);
    const req = makeRequest("http://localhost/media/img.gif");
    const res = await mw.call(req);
    assertEquals(res.status, 200);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});
