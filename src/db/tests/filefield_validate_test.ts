/**
 * Tests for FileField validation during Model.save()
 *
 * Verifies that FileField.validate() is automatically called by Model.save()
 * and that FieldValidationError is thrown when the file fails constraints.
 *
 * @module
 */

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { AutoField, CharField, Manager, Model } from "../mod.ts";
import { FieldValidationError, FileField } from "../fields/mod.ts";
import { ImageField } from "../fields/types.ts";
import { DenoKVBackend } from "../backends/denokv/mod.ts";
import { registerBackend, reset } from "../setup.ts";

// ---------------------------------------------------------------------------
// Test models
// ---------------------------------------------------------------------------

class DocumentModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  file = new FileField({
    uploadTo: "documents/",
    allowedExtensions: [".pdf", ".docx"],
    maxSize: 1024, // 1 KB
  });

  static objects = new Manager(DocumentModel);
  static override meta = { dbTable: "documents" };
}

class ProfileModel extends Model {
  id = new AutoField({ primaryKey: true });
  avatar = new ImageField({
    uploadTo: "avatars/",
    maxSize: 2048,
  });

  static objects = new Manager(ProfileModel);
  static override meta = { dbTable: "profiles" };
}

class RequiredFileModel extends Model {
  id = new AutoField({ primaryKey: true });
  // blank: false is the default for FileField,
  // but FileField constructor sets blank:true — test explicit blank: false
  attachment = new FileField({ uploadTo: "attachments/", blank: false });

  static objects = new Manager(RequiredFileModel);
  static override meta = { dbTable: "required_files" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBackend() {
  return new DenoKVBackend({ name: "test_ff", path: ":memory:" });
}

function makePdfFile(sizeBytes = 100): File {
  return new File([new Uint8Array(sizeBytes)], "report.pdf", {
    type: "application/pdf",
  });
}

function makeImageFile(sizeBytes = 100, name = "photo.jpg"): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: "image/jpeg" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test({
  name: "FileField: save with valid File does not throw",
  async fn() {
    const backend = makeBackend();
    await backend.connect();
    registerBackend("default", backend);

    try {
      const doc = new DocumentModel();
      doc.name.set("My Report");
      // Valid: .pdf extension, within 1 KB
      doc.file.set(makePdfFile(512) as unknown as string);
      // Should not throw — but note the File won't be auto-uploaded by save(),
      // only validated. After validation succeeds we set a string path.
      // In real usage the file is uploaded first, then the path is set.
      // Here we test validation of a File object directly.
      // We expect no FieldValidationError
      let threw = false;
      try {
        // The save will throw a backend-level error since there is no migration,
        // but FieldValidationError must NOT be among them.
        await doc.save();
      } catch (err) {
        if (err instanceof FieldValidationError) {
          threw = true;
        }
        // Other errors (backend / schema) are acceptable
      }
      assertEquals(threw, false, "Should not throw FieldValidationError");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "FileField: save with disallowed extension throws FieldValidationError",
  async fn() {
    const backend = makeBackend();
    await backend.connect();
    registerBackend("default", backend);

    try {
      const doc = new DocumentModel();
      doc.name.set("My Report");
      // .txt is not in allowedExtensions
      doc.file.set(
        new File(["data"], "report.txt", {
          type: "text/plain",
        }) as unknown as string,
      );

      await assertRejects(
        () => doc.save(),
        FieldValidationError,
      );
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "FileField: save with oversized file throws FieldValidationError",
  async fn() {
    const backend = makeBackend();
    await backend.connect();
    registerBackend("default", backend);

    try {
      const doc = new DocumentModel();
      doc.name.set("Big File");
      // 2048 bytes > 1 KB (1024 bytes) limit
      doc.file.set(makePdfFile(2048) as unknown as string);

      await assertRejects(
        () => doc.save(),
        FieldValidationError,
      );
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "FileField: save with already-persisted string path does not throw",
  async fn() {
    const backend = makeBackend();
    await backend.connect();
    registerBackend("default", backend);

    try {
      const doc = new DocumentModel();
      doc.name.set("Existing");
      // Set a string path directly (already uploaded) — no File, no validation
      doc.file.set("documents/existing-report.pdf");

      let threw = false;
      try {
        await doc.save();
      } catch (err) {
        if (err instanceof FieldValidationError) {
          threw = true;
        }
      }
      assertEquals(
        threw,
        false,
        "Should not throw FieldValidationError for string path",
      );
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name:
    "ImageField: save with disallowed MIME type throws FieldValidationError",
  async fn() {
    const backend = makeBackend();
    await backend.connect();
    registerBackend("default", backend);

    try {
      const profile = new ProfileModel();
      // .pdf is not an allowed image type
      profile.avatar.set(
        new File([new Uint8Array(100)], "doc.pdf", {
          type: "application/pdf",
        }) as unknown as string,
      );

      await assertRejects(
        () => profile.save(),
        FieldValidationError,
      );
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name:
    "ImageField: save with valid image File does not throw FieldValidationError",
  async fn() {
    const backend = makeBackend();
    await backend.connect();
    registerBackend("default", backend);

    try {
      const profile = new ProfileModel();
      profile.avatar.set(makeImageFile(512) as unknown as string);

      let threw = false;
      try {
        await profile.save();
      } catch (err) {
        if (err instanceof FieldValidationError) {
          threw = true;
        }
      }
      assertEquals(threw, false, "Should not throw FieldValidationError");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "FieldValidationError: has correct fieldName and message",
  fn() {
    const err = new FieldValidationError("avatar", "File too large.");
    assertEquals(err.fieldName, "avatar");
    assertEquals(err.message, "File too large.");
    assertEquals(err.name, "FieldValidationError");
    assertEquals(err instanceof Error, true);
  },
});
