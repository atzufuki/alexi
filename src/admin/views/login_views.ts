/**
 * Alexi Admin Login Views
 *
 * Handles GET /admin/login/, POST /admin/login/, and GET|POST /admin/logout/.
 * Authentication is JWT-based: on success the browser stores the token in
 * localStorage (via admin.js) and subsequent HTMX requests inject it as
 * Authorization: Bearer <token>.
 *
 * @module
 */

import type { AdminSite } from "../site.ts";
import type { DatabaseBackend } from "@alexi/db";
import { loginTemplate } from "../templates/mpa/base.ts";

// =============================================================================
// Types
// =============================================================================

export interface LoginViewContext {
  request: Request;
  params: Record<string, string>;
  adminSite: AdminSite;
  backend: DatabaseBackend;
  /** Settings object, used to load AUTH_USER_MODEL and SECRET_KEY */
  settings?: Record<string, unknown>;
}

// =============================================================================
// JWT Helpers (inline — avoids dependency on @alexi/auth internals)
// =============================================================================

/**
 * Base64url-encode a Uint8Array.
 */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/,
    "",
  );
}

/**
 * Create an HS256-signed JWT.
 * Falls back to unsigned (alg: none) when no secret is set — dev only.
 */
async function createJWT(
  payload: Record<string, unknown>,
  secretKey: string,
): Promise<string> {
  const encoder = new TextEncoder();

  if (secretKey) {
    const header = base64UrlEncode(
      encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    );
    const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
    const signingInput = `${header}.${body}`;

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
      encoder.encode(signingInput),
    );

    const sig = base64UrlEncode(new Uint8Array(signatureBuffer));
    return `${signingInput}.${sig}`;
  } else {
    // No secret — unsigned token (development only)
    const header = base64UrlEncode(
      encoder.encode(JSON.stringify({ alg: "none", typ: "JWT" })),
    );
    const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
    return `${header}.${body}.`;
  }
}

/**
 * Create an access token for the given user.
 * Expires in 15 minutes.
 */
async function createAccessToken(
  userId: unknown,
  email: string,
  isAdmin: boolean,
  secretKey: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return createJWT(
    {
      userId,
      email,
      isAdmin,
      iat: now,
      exp: now + 15 * 60, // 15 minutes
    },
    secretKey,
  );
}

// =============================================================================
// User Model Helpers
// =============================================================================

interface UserRecord {
  id: unknown;
  email: string;
  passwordHash: string;
  isAdmin: boolean;
  isActive: boolean;
}

type UserModelLike = {
  objects: {
    using(b: DatabaseBackend): {
      filter(q: Record<string, unknown>): {
        first(): Promise<unknown>;
      };
    };
  };
};

/**
 * Dynamically load UserModel and verifyPassword from AUTH_USER_MODEL setting.
 */
async function loadUserModel(
  authUserModelPath: string,
): Promise<{
  UserModel: UserModelLike | null;
  verifyPassword: ((plain: string, hash: string) => Promise<boolean>) | null;
}> {
  try {
    // Resolve file path to URL
    let url = authUserModelPath;
    if (!url.startsWith("file://") && !url.startsWith("http")) {
      const normalized = url.replace(/\\/g, "/");
      if (/^[A-Za-z]:\//.test(normalized)) {
        url = `file:///${normalized}`;
      } else if (normalized.startsWith("/")) {
        url = `file://${normalized}`;
      } else {
        const cwd = Deno.cwd().replace(/\\/g, "/");
        const abs = `${cwd}/${normalized}`;
        url = /^[A-Za-z]:\//.test(abs) ? `file:///${abs}` : `file://${abs}`;
      }
    }

    const mod = await import(url);
    const UserModel = (mod.UserModel as UserModelLike | undefined) ?? null;
    const verifyPassword = (mod.verifyPassword as
      | ((plain: string, hash: string) => Promise<boolean>)
      | undefined) ?? null;

    return { UserModel, verifyPassword };
  } catch {
    return { UserModel: null, verifyPassword: null };
  }
}

/**
 * Extract a plain value from a model field (supports .get() accessor or raw value).
 */
function fieldValue(model: unknown, key: string): unknown {
  const obj = model as Record<string, unknown>;
  const field = obj[key];
  if (field && typeof field === "object" && "get" in field) {
    return (field as { get(): unknown }).get();
  }
  return field;
}

// =============================================================================
// GET /admin/login/
// =============================================================================

/**
 * Render the login page (GET).
 */
export function renderLoginPage(
  adminSite: AdminSite,
  options: { error?: string; next?: string } = {},
): Response {
  const html = loginTemplate({
    siteTitle: adminSite.title,
    urlPrefix: (() => {
      const p = adminSite.urlPrefix.replace(/\/$/, "");
      return p.startsWith("/") ? p : `/${p}`;
    })(),
    error: options.error,
    next: options.next,
  });

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// =============================================================================
// POST /admin/login/
// =============================================================================

/**
 * Handle login form submission (POST).
 *
 * On success:
 *   - Returns HTML with an inline <script> that stores the token in localStorage
 *   - Sets HX-Redirect: /admin/ header so HTMX (or admin.js) redirects the page
 *
 * On failure:
 *   - Re-renders the login page with an error message
 */
export async function handleLoginPost(
  context: LoginViewContext,
): Promise<Response> {
  const { request, adminSite, backend, settings } = context;
  let urlPrefix = adminSite.urlPrefix.replace(/\/$/, "");
  if (!urlPrefix.startsWith("/")) urlPrefix = `/${urlPrefix}`;
  let email = "";
  let password = "";
  let next = "";

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      email = params.get("email") ?? "";
      password = params.get("password") ?? "";
      next = params.get("next") ?? "";
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      email = (formData.get("email") as string) ?? "";
      password = (formData.get("password") as string) ?? "";
      next = (formData.get("next") as string) ?? "";
    }
  } catch {
    return renderLoginPage(adminSite, { error: "Invalid form submission." });
  }

  if (!email || !password) {
    return renderLoginPage(adminSite, {
      error: "Please enter both email and password.",
      next,
    });
  }

  // Load AUTH_USER_MODEL
  const authUserModelPath = settings?.AUTH_USER_MODEL as string | undefined;
  if (!authUserModelPath) {
    return renderLoginPage(adminSite, {
      error: "Authentication is not configured (AUTH_USER_MODEL missing).",
      next,
    });
  }

  const { UserModel, verifyPassword } = await loadUserModel(authUserModelPath);

  if (!UserModel || !verifyPassword) {
    return renderLoginPage(adminSite, {
      error:
        "Authentication configuration error. Check AUTH_USER_MODEL exports.",
      next,
    });
  }

  // Look up the user
  let user: unknown = null;
  try {
    user = await UserModel.objects.using(backend).filter({ email }).first();
  } catch {
    return renderLoginPage(adminSite, {
      error: "An error occurred during authentication.",
      next,
    });
  }

  if (!user) {
    return renderLoginPage(adminSite, {
      error: "Invalid email or password.",
      next,
    });
  }

  // Verify password
  const storedHash = fieldValue(user, "passwordHash") as string;
  let passwordValid = false;
  try {
    passwordValid = await verifyPassword(password, storedHash);
  } catch {
    return renderLoginPage(adminSite, {
      error: "An error occurred during authentication.",
      next,
    });
  }

  if (!passwordValid) {
    return renderLoginPage(adminSite, {
      error: "Invalid email or password.",
      next,
    });
  }

  // Check isActive
  const isActive = fieldValue(user, "isActive") as boolean;
  if (!isActive) {
    return renderLoginPage(adminSite, {
      error: "This account is inactive.",
      next,
    });
  }

  // Check isAdmin (admin panel requires admin access)
  const isAdmin = fieldValue(user, "isAdmin") as boolean;
  if (!isAdmin) {
    return renderLoginPage(adminSite, {
      error: "You do not have permission to access the admin panel.",
      next,
    });
  }

  // Create JWT token
  const userId = fieldValue(user, "id");
  const userEmail = fieldValue(user, "email") as string;
  const secretKey = (settings?.SECRET_KEY as string | undefined) ??
    Deno.env.get("SECRET_KEY") ??
    "";

  let token: string;
  try {
    token = await createAccessToken(userId, userEmail, isAdmin, secretKey);
  } catch {
    return renderLoginPage(adminSite, {
      error: "Failed to create session token.",
      next,
    });
  }

  // Determine redirect target
  const redirectTo = next && next.startsWith("/") ? next : `${urlPrefix}/`;

  // Return response with X-Admin-Token header (for admin.js to store in
  // localStorage for HTMX requests) and Set-Cookie (for normal browser
  // navigation, since window.location.href does not carry custom headers).
  return new Response("", {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Admin-Token": token,
      "X-Admin-Redirect": redirectTo,
      "Set-Cookie":
        `adminToken=${token}; Path=/admin; SameSite=Strict; HttpOnly`,
    },
  });
}

// =============================================================================
// GET|POST /admin/logout/
// =============================================================================

/**
 * Handle logout.
 *
 * Returns HTML that clears localStorage and redirects to the login page.
 * Also sets HX-Redirect for HTMX clients.
 */
export function handleLogout(adminSite: AdminSite): Response {
  let urlPrefix = adminSite.urlPrefix.replace(/\/$/, "");
  if (!urlPrefix.startsWith("/")) urlPrefix = `/${urlPrefix}`;
  const loginUrl = `${urlPrefix}/login/`;

  // Return an empty response with X-Admin-Logout + X-Admin-Redirect headers.
  // admin.js clears localStorage. Cookie is cleared via Set-Cookie Max-Age=0
  // so normal browser navigation also loses the session.
  return new Response("", {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Admin-Logout": "true",
      "X-Admin-Redirect": loginUrl,
      "Set-Cookie":
        `adminToken=; Path=/admin; SameSite=Strict; HttpOnly; Max-Age=0`,
    },
  });
}
