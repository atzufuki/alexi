/**
 * AbstractUser — Django-style base user model for Alexi.
 *
 * Provides the standard user fields and built-in password hashing /
 * verification via the Web Crypto API (PBKDF2-SHA256).  Works in both the
 * Deno server runtime and browser / Service Worker contexts — no native
 * dependencies required.
 *
 * Projects should subclass this and add a concrete `Manager`:
 *
 * ```typescript
 * import { AbstractUser } from "@alexi/auth";
 * import { Manager } from "@alexi/db";
 *
 * export class UserModel extends AbstractUser {
 *   static objects = new Manager(UserModel);
 *   static override meta = { dbTable: "users" };
 * }
 * ```
 *
 * Then point `AUTH_USER_MODEL` directly at the class:
 *
 * ```typescript
 * // project/settings.ts
 * import { UserModel } from "@my-app/models";
 * export const AUTH_USER_MODEL = UserModel;
 * ```
 *
 * @module
 */

import { BooleanField, CharField, DateTimeField, Model } from "@alexi/db";
import { AutoField } from "@alexi/db";

// =============================================================================
// Password hashing helpers (PBKDF2-SHA256, Web Crypto API)
// =============================================================================

const ALGORITHM = "pbkdf2_sha256";
const ITERATIONS = 260_000;
const HASH_LENGTH = 32; // bytes → 256-bit

/**
 * Encode a Uint8Array to a base64 string (browser + Deno compatible).
 */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode a base64 string to Uint8Array.
 */
function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Hash a plaintext password using PBKDF2-SHA256.
 *
 * Returns a string in the format:
 *   `pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>`
 */
async function pbkdf2Hash(plain: string): Promise<string> {
  const enc = new TextEncoder();
  const saltBytes = new Uint8Array(crypto.getRandomValues(new Uint8Array(16)));
  const salt = uint8ToBase64(saltBytes);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(plain),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_LENGTH * 8,
  );

  const hash = uint8ToBase64(new Uint8Array(hashBuffer));
  return `${ALGORITHM}$${ITERATIONS}$${salt}$${hash}`;
}

/**
 * Verify a plaintext password against a stored hash string.
 */
async function pbkdf2Verify(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== ALGORITHM) {
    return false;
  }

  const iterations = parseInt(parts[1], 10);
  const saltBytes = base64ToUint8(parts[2]);
  const expectedHash = parts[3];

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(plain),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes.buffer as ArrayBuffer,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_LENGTH * 8,
  );

  const hash = uint8ToBase64(new Uint8Array(hashBuffer));
  return hash === expectedHash;
}

// =============================================================================
// AbstractUser
// =============================================================================

/**
 * Abstract base user model.
 *
 * Mirrors Django's `AbstractUser` — subclass it and add a concrete `Manager`
 * and `meta.dbTable` to get a fully functional user model with built-in
 * password hashing.
 *
 * ### Extra fields and `createsuperuser`
 *
 * If your concrete user model adds fields that are required at creation time
 * (especially `NOT NULL` fields without a database default), list them in
 * `REQUIRED_FIELDS`.  The `createsuperuser` management command will then
 * prompt for — or accept via `--<field-name>` CLI argument — each of those
 * fields before calling `objects.create()`.
 *
 * ```typescript
 * export class UserModel extends AbstractUser {
 *   phone  = new CharField({ maxLength: 32, blank: true, default: "" });
 *   status = new CharField({ maxLength: 20 });   // NOT NULL
 *
 *   // createsuperuser will prompt for "status"
 *   static override REQUIRED_FIELDS = ["status"];
 *
 *   static objects = new Manager(UserModel);
 *   static override meta = { dbTable: "users" };
 * }
 * ```
 *
 * Fields that already have a `default` value (or `blank: true`) do **not**
 * need to appear in `REQUIRED_FIELDS` — the ORM / database will supply the
 * default automatically.
 */
export abstract class AbstractUser extends Model {
  /**
   * Extra fields that the `createsuperuser` management command must prompt
   * for (or accept as `--<field-name>` CLI arguments) in addition to the
   * built-in `email` / `password` / `firstName` / `lastName` fields.
   *
   * Mirrors Django's `AbstractBaseUser.REQUIRED_FIELDS`.  Subclasses should
   * override this with the names of any `NOT NULL` fields (or other fields
   * that must be supplied at account-creation time) that are not already
   * handled by the base command.
   *
   * @default []
   *
   * @example
   * ```typescript
   * export class UserModel extends AbstractUser {
   *   status = new CharField({ maxLength: 20 });
   *
   *   static override REQUIRED_FIELDS = ["status"];
   *   static objects = new Manager(UserModel);
   *   static override meta = { dbTable: "users" };
   * }
   * ```
   */
  static REQUIRED_FIELDS: string[] = [];

  /** Auto-incrementing primary key. */
  id = new AutoField({ primaryKey: true });

  /** Login identifier — used as the username equivalent. */
  email = new CharField({ maxLength: 254 });

  /**
   * Stored password hash in `pbkdf2_sha256$<iterations>$<salt>$<hash>` format.
   * Never store or compare plaintext passwords directly.
   */
  password = new CharField({ maxLength: 256, blank: true });

  /** The user's first (given) name. */
  firstName = new CharField({ maxLength: 150, blank: true });

  /** The user's last (family) name. */
  lastName = new CharField({ maxLength: 150, blank: true });

  /** Grants access to the admin panel when `true`. */
  isAdmin = new BooleanField({ default: false });

  /** Inactive users cannot log in. */
  isActive = new BooleanField({ default: true });

  /** Timestamp of when the account was created. Set automatically on insert. */
  dateJoined = new DateTimeField({ autoNowAdd: true });

  /** Timestamp of the user's most recent login. `null` if never logged in. */
  lastLogin = new DateTimeField({ null: true, blank: true });

  // ---------------------------------------------------------------------------
  // Password API
  // ---------------------------------------------------------------------------

  /**
   * Hash a plaintext password using PBKDF2-SHA256.
   *
   * Use this when creating or changing a user's password:
   * ```typescript
   * const hashed = await UserModel.hashPassword("mysecret");
   * await UserModel.objects.create({ email: "a@b.com", password: hashed });
   * ```
   */
  static async hashPassword(plain: string): Promise<string> {
    return pbkdf2Hash(plain);
  }

  /**
   * Verify a plaintext password against the stored hash on this instance.
   *
   * ```typescript
   * const user = await UserModel.objects.get({ email });
   * const ok = await user.verifyPassword(plaintextPassword);
   * ```
   */
  async verifyPassword(plain: string): Promise<boolean> {
    const stored = this.password.get() as string;
    if (!stored) return false;
    return pbkdf2Verify(plain, stored);
  }
}
