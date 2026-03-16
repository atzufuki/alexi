/**
 * JWT utilities for Alexi authentication.
 *
 * Provides `createTokenPair` for issuing signed HS256 access and refresh
 * tokens, and `verifyToken` for verifying and decoding them.  These primitives
 * are also reused by `@alexi/restframework`'s `JWTAuthentication` class so that
 * tokens issued here are guaranteed to be accepted by ViewSet auth.
 *
 * @module
 */

// =============================================================================
// Types
// =============================================================================

/**
 * A signed JWT token pair returned by {@link createTokenPair}.
 *
 * @category JWT
 */
export interface TokenPair {
  /** Signed HS256 JWT access token. Expires in 1 hour by default. */
  accessToken: string;
  /** Signed HS256 JWT refresh token. Expires in 7 days by default. */
  refreshToken: string;
  /** Unix timestamp (seconds) when the access token expires. */
  expiresAt: number;
}

/**
 * The decoded payload returned by {@link verifyToken}.
 *
 * @category JWT
 */
export interface TokenPayload {
  /** The user's primary key. */
  userId: number | string;
  /** The user's email address. */
  email?: string;
  /** Whether the user has admin privileges. */
  isAdmin?: boolean;
  /** Unix timestamp (seconds) when the token expires. */
  exp: number;
  /** Unix timestamp (seconds) when the token was issued. */
  iat: number;
  /** Allows additional claims present in the payload. */
  [key: string]: unknown;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Issue a signed HS256 access + refresh token pair for the given user.
 *
 * The secret key is read from the `SECRET_KEY` environment variable.
 * Token lifetimes default to 1 hour (access) and 7 days (refresh); override
 * them via the `ACCESS_TOKEN_LIFETIME` and `REFRESH_TOKEN_LIFETIME` environment
 * variables (values in seconds).
 *
 * @param userId - The user's primary key.
 * @param email - The user's email address (optional).
 * @param isAdmin - Whether the user is an admin (optional, defaults to false).
 * @returns A {@link TokenPair} containing signed access and refresh tokens.
 *
 * @example
 * ```ts
 * const tokens = await createTokenPair(user.id.get(), user.email.get(), user.isAdmin.get());
 * return Response.json(tokens);
 * ```
 *
 * @category JWT
 */
export async function createTokenPair(
  userId: number | string,
  email?: string,
  isAdmin?: boolean,
): Promise<TokenPair> {
  const secretKey = Deno.env.get("SECRET_KEY") ?? "";
  const accessLifetime = Number(Deno.env.get("ACCESS_TOKEN_LIFETIME") ?? 3600);
  const refreshLifetime = Number(
    Deno.env.get("REFRESH_TOKEN_LIFETIME") ?? 604800,
  );

  const now = Math.floor(Date.now() / 1000);
  const accessExp = now + accessLifetime;
  const refreshExp = now + refreshLifetime;

  const accessPayload: Record<string, unknown> = {
    userId,
    email,
    isAdmin: isAdmin ?? false,
    exp: accessExp,
    iat: now,
  };

  const refreshPayload: Record<string, unknown> = {
    userId,
    email,
    isAdmin: isAdmin ?? false,
    exp: refreshExp,
    iat: now,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signJWT(accessPayload, secretKey),
    signJWT(refreshPayload, secretKey),
  ]);

  return { accessToken, refreshToken, expiresAt: accessExp };
}

/**
 * Verify a JWT token and return its decoded payload.
 *
 * Accepts HS256-signed tokens issued by {@link createTokenPair}.  Also accepts
 * unsigned (`"alg":"none"`) tokens when `SECRET_KEY` is not set, to aid
 * development and testing without a configured secret.
 *
 * Returns `null` if the token is invalid, expired, or uses an unsupported
 * algorithm.
 *
 * @param token - The JWT string to verify.
 * @param secretKey - Optional secret key override. Defaults to the `SECRET_KEY`
 *   environment variable.
 * @returns The decoded {@link TokenPayload}, or `null` on failure.
 *
 * @example
 * ```ts
 * const payload = await verifyToken(accessToken);
 * if (!payload) return Response.json({ error: "Unauthorized" }, { status: 401 });
 * console.log(payload.userId, payload.email);
 * ```
 *
 * @category JWT
 */
export async function verifyToken(
  token: string,
  secretKey?: string,
): Promise<TokenPayload | null> {
  let key: string;
  if (secretKey !== undefined) {
    key = secretKey;
  } else {
    try {
      key = Deno.env.get("SECRET_KEY") ?? "";
    } catch {
      // Deno is not available (e.g. Service Worker / browser environment)
      key = "";
    }
  }
  const raw = await verifyJWT(token, key);
  if (!raw) return null;

  const userId = raw.userId ?? raw.sub;
  if (userId == null) return null;

  return raw as TokenPayload;
}

/**
 * Decode a JWT token and return its payload **without verifying the signature**.
 *
 * Use this in environments where the secret key is not available, such as
 * Service Workers running in the browser.  The token is still checked for
 * structural validity and expiry, but the HMAC signature is not verified.
 *
 * > **Security note:** Never use this on the server side.  The decoded payload
 * > must be treated as untrusted — it is only suitable for UX purposes (e.g.
 * > reading the user's name or redirecting to `/login/` when the token is
 * > absent or expired).  All security-sensitive operations must use
 * > {@link verifyToken} on the server.
 *
 * @param token - The JWT string to decode.
 * @returns The decoded {@link TokenPayload}, or `null` if the token is
 *   structurally invalid or expired.
 *
 * @example
 * ```ts
 * // In a Service Worker middleware — no SECRET_KEY available
 * import { decodeToken } from "@alexi/auth";
 *
 * const payload = decodeToken(authHeader.slice(7));
 * if (payload) {
 *   // Use payload for UX only — not for security decisions
 * }
 * ```
 *
 * @category JWT
 */
export function decodeToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [, payloadB64] = parts;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }

  // Check expiry
  if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) {
    return null;
  }

  const userId = payload.userId ?? payload.sub;
  if (userId == null) return null;

  return payload as TokenPayload;
}

// =============================================================================
// Internal JWT primitives (shared with @alexi/restframework)
// =============================================================================

/**
 * Sign a payload as a compact HS256 JWT.
 *
 * @param payload - JSON-serialisable claims object.
 * @param secretKey - HMAC-SHA256 secret.  When empty, produces an unsigned
 *   (`"alg":"none"`) token suitable for development/testing.
 * @returns The compact serialisation `header.payload.signature`.
 *
 * @internal
 */
export async function signJWT(
  payload: Record<string, unknown>,
  secretKey: string,
): Promise<string> {
  const header = secretKey
    ? { alg: "HS256", typ: "JWT" }
    : { alg: "none", typ: "JWT" };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  if (!secretKey) {
    return `${signingInput}.`;
  }

  const signatureB64 = await signHmacSha256(signingInput, secretKey);
  return `${signingInput}.${signatureB64}`;
}

/**
 * Verify a JWT token and return its raw payload object.
 *
 * Supports HS256-signed tokens and unsigned tokens (development mode).
 *
 * @param token - The JWT compact serialisation to verify.
 * @param secretKey - HMAC-SHA256 secret used for signature verification.
 * @returns Decoded payload claims, or `null` if invalid / expired.
 *
 * @internal
 */
export async function verifyJWT(
  token: string,
  secretKey: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  // Decode header
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch {
    return null;
  }

  // Decode payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }

  // Check expiry
  if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) {
    return null;
  }

  const alg = header.alg as string | undefined;

  if (alg === "HS256") {
    if (!secretKey) return null;

    const valid = await verifyHmacSha256(
      `${headerB64}.${payloadB64}`,
      signatureB64,
      secretKey,
    );
    if (!valid) return null;
  } else if (alg === "none" || !alg) {
    // Unsigned token — only accepted in development (no secret key configured)
    if (secretKey) return null;
  } else {
    // Unsupported algorithm
    return null;
  }

  return payload;
}

// =============================================================================
// Crypto helpers
// =============================================================================

/**
 * Produce an HMAC-SHA256 signature over `data` encoded as base64url.
 *
 * @internal
 */
async function signHmacSha256(
  data: string,
  secretKey: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode(data),
  );
  return bytesToBase64Url(new Uint8Array(signatureBuffer));
}

/**
 * Verify an HMAC-SHA256 signature.
 *
 * @internal
 */
async function verifyHmacSha256(
  data: string,
  signatureB64: string,
  secretKey: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secretKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signatureBytes = base64UrlToBytes(signatureB64);
    return await crypto.subtle.verify(
      "HMAC",
      keyMaterial,
      signatureBytes.buffer as ArrayBuffer,
      encoder.encode(data),
    );
  } catch {
    return false;
  }
}

/**
 * Encode a UTF-8 string as base64url (no padding).
 *
 * @internal
 */
function base64UrlEncode(input: string): string {
  return btoa(
    encodeURIComponent(input).replace(
      /%([0-9A-F]{2})/g,
      (_match, p1) => String.fromCharCode(parseInt(p1, 16)),
    ),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode a base64url string to a UTF-8 string.
 *
 * @internal
 */
function base64UrlDecode(input: string): string {
  const base64 = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(input.length + (4 - (input.length % 4)) % 4, "=");
  return atob(base64);
}

/**
 * Decode a base64url string to a `Uint8Array`.
 *
 * @internal
 */
function base64UrlToBytes(input: string): Uint8Array {
  const binary = base64UrlDecode(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode a `Uint8Array` as a base64url string (no padding).
 *
 * @internal
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
