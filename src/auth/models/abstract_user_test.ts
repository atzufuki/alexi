/**
 * Tests for AbstractUser — password hashing and verification.
 *
 * @module
 */

import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { Manager, registerBackend, reset } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { AbstractUser } from "./abstract_user.ts";

// =============================================================================
// Concrete test model (AbstractUser is abstract — needs Manager + meta)
// =============================================================================

class TestUser extends AbstractUser {
  static objects = new Manager(TestUser);
  static override meta = { dbTable: "test_users" };
}

// =============================================================================
// hashPassword — static method
// =============================================================================

Deno.test("AbstractUser.hashPassword: returns a pbkdf2_sha256 hash string", async () => {
  const hash = await TestUser.hashPassword("mysecret");

  assert(
    hash.startsWith("pbkdf2_sha256$"),
    `expected pbkdf2_sha256 prefix, got: ${hash}`,
  );
  const parts = hash.split("$");
  assertEquals(parts.length, 4, "hash should have 4 '$'-delimited parts");
  assertEquals(parts[0], "pbkdf2_sha256");
  assertEquals(parseInt(parts[1], 10), 260_000, "iterations should be 260000");
  assert(parts[2].length > 0, "salt should not be empty");
  assert(parts[3].length > 0, "hash value should not be empty");
});

Deno.test("AbstractUser.hashPassword: two calls produce different salts", async () => {
  const hash1 = await TestUser.hashPassword("samepassword");
  const hash2 = await TestUser.hashPassword("samepassword");

  // Same password — different salt → different hash strings
  assertNotEquals(hash1, hash2);
});

Deno.test("AbstractUser.hashPassword: empty string can be hashed", async () => {
  const hash = await TestUser.hashPassword("");

  assert(hash.startsWith("pbkdf2_sha256$"));
});

// =============================================================================
// verifyPassword — instance method
// =============================================================================

Deno.test("AbstractUser.verifyPassword: correct password returns true", async () => {
  const user = new TestUser();
  user.password.set(await TestUser.hashPassword("correct-password"));

  const ok = await user.verifyPassword("correct-password");
  assertEquals(ok, true);
});

Deno.test("AbstractUser.verifyPassword: wrong password returns false", async () => {
  const user = new TestUser();
  user.password.set(await TestUser.hashPassword("correct-password"));

  const ok = await user.verifyPassword("wrong-password");
  assertEquals(ok, false);
});

Deno.test("AbstractUser.verifyPassword: empty stored password returns false", async () => {
  const user = new TestUser();
  // Do not set a password — field defaults to null/blank

  const ok = await user.verifyPassword("anything");
  assertEquals(ok, false);
});

Deno.test("AbstractUser.verifyPassword: invalid hash format returns false", async () => {
  const user = new TestUser();
  user.password.set("not-a-valid-hash");

  const ok = await user.verifyPassword("anything");
  assertEquals(ok, false);
});

Deno.test("AbstractUser.verifyPassword: hash from different password returns false", async () => {
  const user = new TestUser();
  user.password.set(await TestUser.hashPassword("other-password"));

  const ok = await user.verifyPassword("my-password");
  assertEquals(ok, false);
});

// =============================================================================
// Round-trip via ORM (hashPassword → create → fetch → verifyPassword)
// =============================================================================

// =============================================================================
// REQUIRED_FIELDS
// =============================================================================

Deno.test("AbstractUser.REQUIRED_FIELDS: defaults to empty array", () => {
  assertEquals(TestUser.REQUIRED_FIELDS, []);
});

Deno.test("AbstractUser.REQUIRED_FIELDS: subclass can override", () => {
  class ExtendedUser extends AbstractUser {
    static objects = new Manager(ExtendedUser);
    static override meta = { dbTable: "extended_users" };
    static override REQUIRED_FIELDS = ["status", "phone"];
  }

  assertEquals(ExtendedUser.REQUIRED_FIELDS, ["status", "phone"]);
  // Base class unchanged
  assertEquals(TestUser.REQUIRED_FIELDS, []);
});

// =============================================================================
// Round-trip via ORM (hashPassword → create → fetch → verifyPassword)
// =============================================================================

Deno.test({
  name: "AbstractUser: round-trip create/fetch/verify via ORM",
  async fn() {
    const backend = new DenoKVBackend({ name: "auth_test", path: ":memory:" });
    await backend.connect();
    registerBackend("default", backend);

    try {
      const plainPassword = "super-secret-42";
      const hashedPassword = await TestUser.hashPassword(plainPassword);

      const created = await TestUser.objects.create({
        email: "alice@example.com",
        password: hashedPassword,
        isAdmin: true,
        isActive: true,
      });

      const fetched = await TestUser.objects.get({ id: created.id.get() });

      assertEquals(fetched.email.get(), "alice@example.com");
      assert(
        await fetched.verifyPassword(plainPassword),
        "correct password should verify",
      );
      assert(
        !await fetched.verifyPassword("wrong"),
        "wrong password should not verify",
      );
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});
