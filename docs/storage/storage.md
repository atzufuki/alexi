# File Storage

Alexi provides a Django-style file storage abstraction through the
`@alexi/storage` package. It defines a unified `Storage` API that works across
different backends — local filesystem, in-memory, Firebase Cloud Storage, and
more.

## Overview

The storage system has two parts:

1. **`@alexi/storage`** — the `Storage` abstract base class, setup helpers
   (`setStorage`, `getStorage`), and shared types.
2. **Backend subpaths** — concrete implementations imported from
   `@alexi/storage/backends/<name>`.

```typescript
import { getStorage, setStorage } from "@alexi/storage";
import { FileSystemStorage } from "@alexi/storage/backends/filesystem";

setStorage(
  new FileSystemStorage({ location: "./uploads", baseUrl: "/uploads/" }),
);

const storage = getStorage();
const file = new File(["Hello"], "hello.txt", { type: "text/plain" });
const savedName = await storage.save("documents/hello.txt", file);
const url = await storage.url(savedName);
// url === "/uploads/documents/hello.txt"
```

## Configuration

### DEFAULT_FILE_STORAGE setting

Configure the default storage backend in `settings.ts`:

```typescript
// project/settings.ts
import { FileSystemStorage } from "@alexi/storage/backends/filesystem";

export const DEFAULT_FILE_STORAGE = new FileSystemStorage({
  location: "./uploads",
  baseUrl: "/uploads/",
});
```

`@alexi/core` will call `setStorage(DEFAULT_FILE_STORAGE)` automatically during
application startup.

### Manual setup

Call `setStorage()` directly for custom initialization:

```typescript
import { setStorage } from "@alexi/storage";
import { MemoryStorage } from "@alexi/storage/backends/memory";

setStorage(new MemoryStorage());
```

## Storage API

All backends implement the `Storage` abstract class.

### save()

Save a file to storage. Returns the final storage-relative name (may differ from
the requested name if a collision is resolved).

```typescript
const file = new File(["content"], "report.pdf", { type: "application/pdf" });
const savedName = await storage.save("reports/report.pdf", file);
```

### open()

Open a file for reading, returning a `ReadableStream`:

```typescript
const stream = await storage.open("reports/report.pdf");
const response = new Response(stream, {
  headers: { "Content-Type": "application/pdf" },
});
```

### delete()

Delete a file from storage:

```typescript
await storage.delete("reports/old-report.pdf");
```

### exists()

Check if a file exists:

```typescript
if (await storage.exists("reports/report.pdf")) {
  // File exists
}
```

### url()

Get the public URL for a file:

```typescript
const url = await storage.url("reports/report.pdf");
// "/uploads/reports/report.pdf"
```

### size()

Get the file size in bytes:

```typescript
const bytes = await storage.size("reports/report.pdf");
console.log(`${bytes} bytes`);
```

### listdir()

List directory contents:

```typescript
const { dirs, files } = await storage.listdir("reports/");
console.log("Subdirectories:", dirs);
console.log("Files:", files);
```

### getMetadata()

Get file metadata (size, content type, timestamps):

```typescript
const meta = await storage.getMetadata("reports/report.pdf");
// { name, size, contentType, updatedAt, createdAt? }
```

### signedUrl()

Generate a temporary signed URL (backends that support it; falls back to the
regular URL otherwise):

```typescript
const url = await storage.signedUrl("private/file.pdf", { expiresIn: 3600 });
```

## Backends

### FileSystemStorage

Local filesystem storage — suitable for development and self-hosted deployments.

```typescript
import { FileSystemStorage } from "@alexi/storage/backends/filesystem";

const storage = new FileSystemStorage({
  location: "./uploads", // directory on disk (created automatically)
  baseUrl: "/uploads/", // URL prefix for generated public URLs
  allowOverwrite: false, // append unique suffix on collision (default)
});
```

| Option           | Type      | Default     | Description                                    |
| ---------------- | --------- | ----------- | ---------------------------------------------- |
| `location`       | `string`  | —           | Path to root upload directory (required)       |
| `baseUrl`        | `string`  | `"/media/"` | URL prefix for `storage.url()`                 |
| `allowOverwrite` | `boolean` | `false`     | When `true`, overwrite existing files silently |

**Serving uploaded files** — add a route that reads from the upload directory:

```typescript
// views.ts
import { getStorage } from "@alexi/storage";

export async function uploadsView(
  _request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const storage = getStorage();
  const name = params["path"];

  if (!(await storage.exists(name))) {
    return new Response("Not Found", { status: 404 });
  }

  const stream = await storage.open(name);
  const meta = await storage.getMetadata(name);
  return new Response(stream, {
    headers: { "Content-Type": meta.contentType },
  });
}

// urls.ts
import { path } from "@alexi/urls";

export const urlpatterns = [
  path("uploads/:path", uploadsView),
];
```

### MemoryStorage

In-memory storage — intended for testing. Data is lost when the process ends.

```typescript
import { MemoryStorage } from "@alexi/storage/backends/memory";

const storage = new MemoryStorage();
```

### FirebaseStorage

Firebase Cloud Storage backend for production browser and server applications.

```typescript
import { FirebaseStorage } from "@alexi/storage/backends/firebase";

setStorage(
  new FirebaseStorage({
    bucket: "my-project.appspot.com",
    basePath: "uploads/",
    getAuthToken: async () =>
      await firebase.auth().currentUser?.getIdToken() ?? "",
  }),
);
```

## File Upload Pattern

A typical server-side file upload handler reads the file from `FormData`, saves
it via the storage backend, and stores the resulting path on the model:

```typescript
import { getStorage } from "@alexi/storage";
import { PostModel } from "./models.ts";

export async function postCreateView(request: Request): Promise<Response> {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const coverFile = formData.get("cover") as File | null;

  const post = new PostModel();
  post.title.set(title);

  if (coverFile && coverFile.size > 0) {
    const storage = getStorage();
    const uploadPath = post.cover.getUploadPath(coverFile.name);
    const savedName = await storage.save(uploadPath, coverFile);
    post.cover.set(savedName);
  }

  await post.save();
  return Response.redirect("/posts/");
}
```

The HTML form must use `enctype="multipart/form-data"`:

```html
<form method="POST" enctype="multipart/form-data">
  <input type="text" name="title" />
  <input type="file" name="cover" accept="image/*" />
  <button type="submit">Create</button>
</form>
```

## Testing with MemoryStorage

Use `MemoryStorage` in tests to avoid touching the filesystem:

```typescript
import { resetStorage, setStorage } from "@alexi/storage";
import { MemoryStorage } from "@alexi/storage/backends/memory";

Deno.test("upload cover image", async () => {
  setStorage(new MemoryStorage());

  try {
    const storage = getStorage();
    const file = new File(["img"], "photo.png", { type: "image/png" });
    const name = await storage.save("covers/photo.png", file);

    assertEquals(await storage.exists(name), true);
    assertEquals(await storage.url(name), `/media/${name}`);
  } finally {
    resetStorage();
  }
});
```
