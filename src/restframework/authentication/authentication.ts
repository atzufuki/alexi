/**
 * Authentication classes for Alexi REST Framework
 *
 * Provides DRF-style authentication classes for ViewSet-level user identification.
 * Authentication runs before permission checks and populates context.user.
 *
 * @module @alexi/restframework/authentication/authentication
 */

import type { ViewSetContext } from "../viewsets/viewset.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * The authenticated user shape populated by authentication classes
 */
export type AuthenticatedUser = NonNullable<ViewSetContext["user"]>;

/**
 * Authentication class constructor type
 */
export interface AuthenticationClass {
  new (): BaseAuthentication;
}

// ============================================================================
// Base Authentication
// ============================================================================

/**
 * Base authentication class
 *
 * All authentication classes should extend this class and implement
 * the authenticate method. Return a user object on success, or null
 * to indicate that this authenticator does not apply to the request
 * (allowing the next authenticator in the list to try).
 *
 * Authentication classes are tried in order. The first one that returns
 * a non-null user wins. If all return null, context.user remains undefined.
 *
 * @example
 * ```ts
 * class ApiKeyAuthentication extends BaseAuthentication {
 *   async authenticate(context: ViewSetContext): Promise<AuthenticatedUser | null> {
 *     const apiKey = context.request.headers.get("X-API-Key");
 *     if (!apiKey) return null;
 *
 *     const user = await UserModel.objects.filter({ apiKey }).first();
 *     if (!user) return null;
 *
 *     return {
 *       id: user.id.get(),
 *       email: user.email.get(),
 *       isAdmin: user.isAdmin.get(),
 *     };
 *   }
 * }
 * ```
 */
export abstract class BaseAuthentication {
  /**
   * Authenticate the request and return a user object, or null.
   *
   * Return null to indicate this authenticator does not apply — the
   * next authenticator in authentication_classes will be tried.
   *
   * Return a user object to indicate successful authentication.
   * The returned object will be set as context.user.
   *
   * @param context - The ViewSet context with request and params
   * @returns Authenticated user or null
   */
  abstract authenticate(
    context: ViewSetContext,
  ): Promise<AuthenticatedUser | null> | AuthenticatedUser | null;
}

// ============================================================================
// Built-in Authentication Classes
// ============================================================================

/**
 * JWT Bearer token authentication
 *
 * Reads a JWT from the `Authorization: Bearer <token>` header and
 * verifies it using the SECRET_KEY environment variable.
 *
 * The token payload must contain `userId` (or `sub`), and optionally
 * `email` and `isAdmin`.
 *
 * @example
 * ```ts
 * class ArticleViewSet extends ModelViewSet {
 *   authentication_classes = [JWTAuthentication];
 *   permission_classes = [IsAuthenticated];
 * }
 * ```
 *
 * @example With custom secret key
 * ```ts
 * class MyAuth extends JWTAuthentication {
 *   override secretKey = Deno.env.get("MY_SECRET_KEY") ?? "fallback";
 * }
 * ```
 */
export class JWTAuthentication extends BaseAuthentication {
  /**
   * Secret key used to verify JWT signatures.
   * Defaults to the SECRET_KEY environment variable.
   */
  secretKey: string = Deno.env.get("SECRET_KEY") ?? "";

  async authenticate(
    context: ViewSetContext,
  ): Promise<AuthenticatedUser | null> {
    const authHeader = context.request.headers.get("Authorization");
    if (!authHeader) return null;

    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) return null;

    try {
      const payload = await verifyJWT(token, this.secretKey);
      if (!payload) return null;

      const userId = payload.userId ?? payload.sub;
      if (userId == null) return null;

      return {
        id: typeof userId === "number" ? userId : Number(userId) || userId,
        email: typeof payload.email === "string" ? payload.email : undefined,
        isAdmin: payload.isAdmin === true,
        ...payload,
      } as AuthenticatedUser;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// JWT Utilities
// ============================================================================

/**
 * Verify a JWT token and return its payload.
 *
 * Supports both HS256-signed JWTs (using Web Crypto API) and
 * unsigned/development tokens encoded as base64url JSON.
 *
 * @param token - The JWT string to verify
 * @param secretKey - The HMAC-SHA256 secret key
 * @returns Decoded payload, or null if invalid/expired
 */
async function verifyJWT(
  token: string,
  secretKey: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  // Decode header to check algorithm
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

  // Verify signature for HS256
  if (alg === "HS256") {
    if (!secretKey) {
      // No secret key configured — cannot verify
      return null;
    }

    const valid = await verifyHmacSha256(
      `${headerB64}.${payloadB64}`,
      signatureB64,
      secretKey,
    );

    if (!valid) return null;
  } else if (alg === "none" || !alg) {
    // Unsigned token — only allowed in development (no secret key set)
    if (secretKey) {
      // If secret key is set, refuse unsigned tokens for security
      return null;
    }
  } else {
    // Unsupported algorithm
    return null;
  }

  return payload;
}

/**
 * Verify an HMAC-SHA256 signature using the Web Crypto API
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
 * Decode a base64url string to a UTF-8 string
 */
function base64UrlDecode(input: string): string {
  // Convert base64url to base64
  const base64 = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(input.length + (4 - (input.length % 4)) % 4, "=");
  return atob(base64);
}

/**
 * Decode a base64url string to a Uint8Array
 */
function base64UrlToBytes(input: string): Uint8Array {
  const binary = base64UrlDecode(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
