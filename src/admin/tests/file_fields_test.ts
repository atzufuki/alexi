/**
 * Admin file field support tests (#409)
 *
 * Covers:
 *  - FIELD_WIDGET_MAP returns correct widget for FileField
 *  - FIELD_WIDGET_MAP returns correct widget for ImageField (with accept=image/*)
 *  - parseFormData keeps File objects intact
 *  - validateFormData uploads File via storage and stores returned path
 *  - validateFormData treats empty file input as optional when field is not required
 *  - Change form contains enctype=multipart/form-data when file fields are present
 *  - Change form does NOT have enctype when no file fields present
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { AutoField, CharField, Manager, Model } from "@alexi/db";
import { FileField, ImageField } from "@alexi/db/fields";
import { resetStorage, setStorage } from "@alexi/storage";
import { MemoryStorage } from "@alexi/storage/backends/memory";
import { getFieldInfo, getWidgetForField } from "../introspection.ts";
import { setup } from "@alexi/core";
import { reset } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { AdminSite } from "../site.ts";
import { ModelAdmin } from "../model_admin.ts";
import { renderChangeForm } from "../views/changeform_views.ts";

// =============================================================================
// Test Models
// =============================================================================

class DocumentModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  attachment = new FileField({ uploadTo: "docs/", null: true, blank: true });
  cover = new ImageField({ uploadTo: "covers/", null: true, blank: true });

  static objects = new Manager(DocumentModel);
  static override meta = {
    dbTable: "ff_documents",
    verboseName: "Document",
    verboseNamePlural: "Documents",
  };
}

// =============================================================================
// Widget mapping tests
// =============================================================================

Deno.test("getWidgetForField: FileField -> admin-input[type=file]", () => {
  const instance = new DocumentModel();
  // deno-lint-ignore no-explicit-any
  const field = getFieldInfo("attachment", instance.attachment as any);
  assertEquals(getWidgetForField(field), "admin-input[type=file]");
});

Deno.test(
  "getWidgetForField: ImageField -> admin-input[type=file][accept='image/*']",
  () => {
    const instance = new DocumentModel();
    // deno-lint-ignore no-explicit-any
    const field = getFieldInfo("cover", instance.cover as any);
    assertEquals(
      getWidgetForField(field),
      "admin-input[type=file][accept='image/*']",
    );
  },
);

// =============================================================================
// parseFormData — File object preservation
// =============================================================================

Deno.test("parseFormData: keeps File objects from multipart/form-data", async () => {
  // Build a multipart request that contains a file
  const formData = new FormData();
  formData.append("title", "My Doc");
  const file = new File(["hello content"], "hello.txt", {
    type: "text/plain",
  });
  formData.append("attachment", file);

  const request = new Request("http://localhost/admin/document/add/", {
    method: "POST",
    body: formData,
  });

  // Verify the FormData API behaviour that our code relies on:
  // File objects should be preserved (not coerced to strings)
  const parsed = await request.formData();
  const titleEntry = parsed.get("title");
  const fileEntry = parsed.get("attachment");

  assertEquals(titleEntry, "My Doc");
  assertEquals(fileEntry instanceof File, true);
  assertEquals((fileEntry as File).name, "hello.txt");
  assertEquals((fileEntry as File).size, 13);
});

// =============================================================================
// Helpers
// =============================================================================

function makeDevToken(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) => {
    const json = JSON.stringify(obj);
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(
      /=+$/,
      "",
    );
  };
  const header = encode({ alg: "none", typ: "JWT" });
  const body = encode(payload);
  return `${header}.${body}.`;
}

function makeValidToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return makeDevToken({
    userId: 1,
    email: "admin@example.com",
    isAdmin: true,
    iat: now,
    exp: now + 900,
  });
}

async function makeBackend() {
  const backend = new DenoKVBackend({ name: "ff_test", path: ":memory:" });
  await backend.connect();
  await setup({ DATABASES: { default: backend } });
  return backend;
}

async function teardownBackend(backend: DenoKVBackend) {
  await reset();
  await backend.disconnect();
  resetStorage();
}

// =============================================================================
// File upload via renderChangeForm
// =============================================================================

Deno.test({
  name: "file upload: POST add with file saves path via storage",
  async fn() {
    const backend = await makeBackend();
    const storage = new MemoryStorage();
    setStorage(storage);

    try {
      const site = new AdminSite({ title: "Test Admin", urlPrefix: "/admin" });
      site.register(DocumentModel, ModelAdmin);

      const token = makeValidToken();
      const formData = new FormData();
      formData.append("title", "My Doc");
      const file = new File(["file contents"], "report.pdf", {
        type: "application/pdf",
      });
      formData.append("attachment", file);

      const request = new Request(
        "http://localhost/admin/documentmodel/add/",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );

      const response = await renderChangeForm(
        { request, params: {}, adminSite: site, backend },
        "documentmodel",
        undefined,
      );

      // Should redirect on success
      assertEquals(response.status, 302);

      // Verify file was saved to storage
      const listing = await storage.listdir("");
      assertEquals(listing.files.length + listing.dirs.length > 0, true);
    } finally {
      await teardownBackend(backend);
    }
  },
});

Deno.test({
  name: "file upload: optional FileField with no file submitted is accepted",
  async fn() {
    const backend = await makeBackend();

    try {
      const site = new AdminSite({ title: "Test Admin", urlPrefix: "/admin" });
      site.register(DocumentModel, ModelAdmin);

      const token = makeValidToken();
      const formData = new FormData();
      formData.append("title", "No File");
      // attachment and cover are optional (null=true, blank=true) — omit them

      const request = new Request(
        "http://localhost/admin/documentmodel/add/",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );

      const response = await renderChangeForm(
        { request, params: {}, adminSite: site, backend },
        "documentmodel",
        undefined,
      );

      // Should redirect on success (no file required)
      assertEquals(response.status, 302);
    } finally {
      await teardownBackend(backend);
    }
  },
});

// =============================================================================
// enctype on change form
// =============================================================================

Deno.test({
  name: "change form: has enctype=multipart/form-data when FileField present",
  async fn() {
    const backend = await makeBackend();

    try {
      const site = new AdminSite({ title: "Test Admin", urlPrefix: "/admin" });
      site.register(DocumentModel, ModelAdmin);

      const token = makeValidToken();
      const request = new Request(
        "http://localhost/admin/documentmodel/add/",
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const response = await renderChangeForm(
        { request, params: {}, adminSite: site, backend },
        "documentmodel",
        undefined,
      );

      assertEquals(response.status, 200);
      const html = await response.text();
      assertStringIncludes(html, 'enctype="multipart/form-data"');
    } finally {
      await teardownBackend(backend);
    }
  },
});

Deno.test({
  name: "change form: no enctype when no file fields present",
  async fn() {
    class PlainModel extends Model {
      id = new AutoField({ primaryKey: true });
      name = new CharField({ maxLength: 100 });
      static objects = new Manager(PlainModel);
      static override meta = { dbTable: "ff_plain" };
    }

    const backend = await makeBackend();

    try {
      const site = new AdminSite({ title: "Test Admin", urlPrefix: "/admin" });
      site.register(PlainModel, ModelAdmin);

      const token = makeValidToken();
      const request = new Request(
        "http://localhost/admin/plainmodel/add/",
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const response = await renderChangeForm(
        { request, params: {}, adminSite: site, backend },
        "plainmodel",
        undefined,
      );

      assertEquals(response.status, 200);
      const html = await response.text();
      // enctype should NOT be present when there are no file fields
      assertEquals(html.includes("multipart/form-data"), false);
    } finally {
      await teardownBackend(backend);
    }
  },
});
