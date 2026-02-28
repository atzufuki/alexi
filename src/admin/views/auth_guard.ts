/**
 * Alexi Admin Auth Guard
 *
 * Provides a thin JWT verification helper for admin views.
 * Reads the Authorization: Bearer <token> header and verifies it
 * using the same logic as JWTAuthentication in @alexi/restframework.
 *
 * @module
 */

// =============================================================================
// Types
// =============================================================================

export interface AuthGuardResult {
  /** Whether the request carries a valid, non-expired JWT */
  authenticated: boolean;
  /** User ID from the token payload (if authenticated) */
  userId?: number;
  /** Email from the token payload (if authenticated) */
  email?: string;
  /** isAdmin flag from the token payload (if authenticated) */
  isAdmin?: boolean;
}

// =============================================================================
// Base64url Helpers
// =============================================================================

function base64UrlDecode(str: string): string {
  // Restore standard base64 padding
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const b64 = pad === 0 ? padded : padded + "=".repeat(4 - pad);
  return atob(b64);
}

// =============================================================================
// HMAC-SHA256 Verification
// =============================================================================

async function verifyHmacSha256(
  signingInput: string,
  signatureB64: string,
  secretKey: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  // Decode the base64url signature to bytes
  const b64 = signatureB64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  const paddedB64 = pad === 0 ? b64 : b64 + "=".repeat(4 - pad);
  const binary = atob(paddedB64);
  const sigBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    sigBytes[i] = binary.charCodeAt(i);
  }

  return crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    encoder.encode(signingInput),
  );
}

// =============================================================================
// verifyAdminToken
// =============================================================================

/**
 * Verify the JWT in the request's Authorization header or adminToken cookie.
 *
 * Checks Authorization: Bearer <token> first (used by HTMX requests via
 * admin.js), then falls back to the adminToken cookie (used by normal browser
 * navigation such as window.location.href redirects after login).
 *
 * Returns an AuthGuardResult with `authenticated: true` if the token is
 * present, valid, and not expired.  Returns `authenticated: false` otherwise.
 *
 * @param request - The incoming HTTP request
 * @param settings - Optional settings object (reads SECRET_KEY if provided)
 */
export async function verifyAdminToken(
  request: Request,
  settings?: Record<string, unknown>,
): Promise<AuthGuardResult> {
  // 1. Try Authorization: Bearer header (HTMX requests)
  let token: string | null = null;
  const authHeader = request.headers.get("Authorization") ??
    request.headers.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer" && parts[1]) {
      token = parts[1];
    }
  }

  // 2. Fall back to adminToken cookie (normal browser navigation)
  if (!token) {
    const cookieHeader = request.headers.get("Cookie") ??
      request.headers.get("cookie");
    if (cookieHeader) {
      for (const part of cookieHeader.split(";")) {
        const [name, ...rest] = part.trim().split("=");
        if (name.trim() === "adminToken") {
          token = rest.join("=").trim();
          break;
        }
      }
    }
  }

  if (!token) return { authenticated: false };

  // Split JWT
  const segments = token.split(".");
  if (segments.length !== 3) return { authenticated: false };

  const [headerB64, payloadB64, signatureB64] = segments;

  // Decode header
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch {
    return { authenticated: false };
  }

  // Decode payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return { authenticated: false };
  }

  // Check expiry
  if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) {
    return { authenticated: false };
  }

  const alg = header.alg as string | undefined;

  if (alg === "HS256") {
    const secretKey = (settings?.SECRET_KEY as string | undefined) ??
      Deno.env.get("SECRET_KEY") ??
      "";
    if (!secretKey) return { authenticated: false };

    const valid = await verifyHmacSha256(
      `${headerB64}.${payloadB64}`,
      signatureB64,
      secretKey,
    );
    if (!valid) return { authenticated: false };
  } else if (alg === "none") {
    // Unsigned dev token — accept only when no SECRET_KEY is set
    const secretKey = (settings?.SECRET_KEY as string | undefined) ??
      Deno.env.get("SECRET_KEY") ??
      "";
    if (secretKey) {
      // Secret configured but unsigned token presented — reject
      return { authenticated: false };
    }
  } else {
    // Unknown algorithm
    return { authenticated: false };
  }

  const userId = payload.userId ?? payload.sub;
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const isAdmin = payload.isAdmin === true;

  return {
    authenticated: true,
    userId: userId != null
      ? (typeof userId === "number" ? userId : Number(userId))
      : undefined,
    email,
    isAdmin,
  };
}
