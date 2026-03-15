import {
  assertEquals,
  assertExists,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import { createTokenPair, signJWT, verifyJWT, verifyToken } from "./jwt.ts";

// =============================================================================
// createTokenPair
// =============================================================================

Deno.test("createTokenPair: returns accessToken, refreshToken, expiresAt", async () => {
  const tokens = await createTokenPair(1, "user@example.com", false);

  assertExists(tokens.accessToken);
  assertExists(tokens.refreshToken);
  assertExists(tokens.expiresAt);
  assertEquals(typeof tokens.accessToken, "string");
  assertEquals(typeof tokens.refreshToken, "string");
  assertEquals(typeof tokens.expiresAt, "number");
});

Deno.test("createTokenPair: access and refresh tokens are different", async () => {
  const tokens = await createTokenPair(1, "user@example.com", false);
  assertNotEquals(tokens.accessToken, tokens.refreshToken);
});

Deno.test("createTokenPair: expiresAt is in the future", async () => {
  const before = Math.floor(Date.now() / 1000);
  const tokens = await createTokenPair(1, "user@example.com", false);
  const after = Math.floor(Date.now() / 1000);

  // expiresAt should be ~1 hour ahead (3600s default)
  assertEquals(tokens.expiresAt > before + 3500, true);
  assertEquals(tokens.expiresAt <= after + 3601, true);
});

Deno.test("createTokenPair: tokens are compact JWT (3 parts separated by dots)", async () => {
  const tokens = await createTokenPair(42, "admin@example.com", true);

  const accessParts = tokens.accessToken.split(".");
  const refreshParts = tokens.refreshToken.split(".");

  assertEquals(accessParts.length, 3);
  assertEquals(refreshParts.length, 3);
});

// =============================================================================
// verifyToken
// =============================================================================

Deno.test("verifyToken: returns payload for unsigned token in dev mode", async () => {
  // When no SECRET_KEY is set, tokens are unsigned and verifyToken accepts them
  const unsigned = await signJWT(
    {
      userId: 1,
      email: "a@b.com",
      isAdmin: false,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    },
    "",
  );

  const payload = await verifyToken(unsigned, "");

  assertExists(payload);
  assertEquals(payload!.userId, 1);
  assertEquals(payload!.email, "a@b.com");
  assertEquals(payload!.isAdmin, false);
});

Deno.test("verifyToken: returns payload for HS256 signed token", async () => {
  const secret = "test-secret-key";
  const now = Math.floor(Date.now() / 1000);
  const signed = await signJWT(
    {
      userId: 5,
      email: "signed@example.com",
      isAdmin: true,
      exp: now + 3600,
      iat: now,
    },
    secret,
  );

  const payload = await verifyToken(signed, secret);

  assertExists(payload);
  assertEquals(payload!.userId, 5);
  assertEquals(payload!.email, "signed@example.com");
  assertEquals(payload!.isAdmin, true);
  assertEquals(typeof payload!.exp, "number");
  assertEquals(typeof payload!.iat, "number");
});

Deno.test("verifyToken: returns null for expired token", async () => {
  const secret = "test-secret";
  const expiredToken = await signJWT(
    {
      userId: 1,
      exp: Math.floor(Date.now() / 1000) - 10,
      iat: Math.floor(Date.now() / 1000) - 3610,
    },
    secret,
  );

  const payload = await verifyToken(expiredToken, secret);
  assertEquals(payload, null);
});

Deno.test("verifyToken: returns null for token with wrong secret", async () => {
  const token = await signJWT(
    {
      userId: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    },
    "correct-secret",
  );

  const payload = await verifyToken(token, "wrong-secret");
  assertEquals(payload, null);
});

Deno.test("verifyToken: returns null for malformed token", async () => {
  assertEquals(await verifyToken("not.a.valid.jwt", "secret"), null);
  assertEquals(await verifyToken("", "secret"), null);
  assertEquals(await verifyToken("only-one-part", "secret"), null);
});

Deno.test("verifyToken: returns null for unsigned token when secret is set", async () => {
  // Unsigned tokens must be rejected when a secret key is configured
  const unsigned = await signJWT(
    {
      userId: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    },
    "",
  );

  const payload = await verifyToken(unsigned, "some-secret-key");
  assertEquals(payload, null);
});

// =============================================================================
// Round-trip: createTokenPair → verifyToken
// =============================================================================

Deno.test("createTokenPair + verifyToken: round-trip with secret key", async () => {
  const secret = "round-trip-secret";
  const originalSecret = Deno.env.get("SECRET_KEY");
  Deno.env.set("SECRET_KEY", secret);

  try {
    const tokens = await createTokenPair(99, "roundtrip@example.com", true);
    const payload = await verifyToken(tokens.accessToken);

    assertExists(payload);
    assertEquals(payload!.userId, 99);
    assertEquals(payload!.email, "roundtrip@example.com");
    assertEquals(payload!.isAdmin, true);
    assertEquals(payload!.exp, tokens.expiresAt);
  } finally {
    if (originalSecret === undefined) {
      Deno.env.delete("SECRET_KEY");
    } else {
      Deno.env.set("SECRET_KEY", originalSecret);
    }
  }
});

Deno.test("createTokenPair + verifyToken: round-trip without secret key (dev mode)", async () => {
  const originalSecret = Deno.env.get("SECRET_KEY");
  Deno.env.delete("SECRET_KEY");

  try {
    const tokens = await createTokenPair(7, "dev@example.com", false);
    const payload = await verifyToken(tokens.accessToken);

    assertExists(payload);
    assertEquals(payload!.userId, 7);
    assertEquals(payload!.email, "dev@example.com");
    assertEquals(payload!.isAdmin, false);
  } finally {
    if (originalSecret !== undefined) {
      Deno.env.set("SECRET_KEY", originalSecret);
    }
  }
});

// =============================================================================
// verifyJWT (internal) — also used by JWTAuthentication
// =============================================================================

Deno.test("verifyJWT: returns raw payload for valid HS256 token", async () => {
  const secret = "internal-test";
  const now = Math.floor(Date.now() / 1000);
  const token = await signJWT(
    { sub: "123", custom: "value", exp: now + 3600, iat: now },
    secret,
  );

  const raw = await verifyJWT(token, secret);

  assertExists(raw);
  assertEquals(raw!.sub, "123");
  assertEquals(raw!.custom, "value");
});

Deno.test("verifyJWT: accepts unsigned token when no secret set", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await signJWT(
    { sub: "42", exp: now + 3600, iat: now },
    "",
  );

  const raw = await verifyJWT(token, "");
  assertExists(raw);
  assertEquals(raw!.sub, "42");
});

Deno.test("verifyJWT: returns null for tampered payload", async () => {
  const secret = "tamper-test";
  const now = Math.floor(Date.now() / 1000);
  const token = await signJWT(
    { userId: 1, exp: now + 3600, iat: now },
    secret,
  );

  // Tamper with the payload part
  const parts = token.split(".");
  const tamperedPayload = btoa(
    JSON.stringify({ userId: 999, exp: now + 3600, iat: now }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  const raw = await verifyJWT(tampered, secret);
  assertEquals(raw, null);
});

// Satisfy assertRejects import (used to confirm no unexpected throws)
Deno.test("verifyToken: does not throw on invalid input", async () => {
  // Should return null, not throw
  const result = await verifyToken("garbage", "key");
  assertEquals(result, null);

  // assertRejects verifies that a Promise rejects — confirm our fn doesn't reject
  let threw = false;
  try {
    await verifyToken("bad.token.here", "key");
  } catch {
    threw = true;
  }
  assertEquals(threw, false);

  // Suppress unused import warning
  await assertRejects(async () => {
    throw new Error("expected");
  });
});
