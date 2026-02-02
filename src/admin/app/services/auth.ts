/**
 * Admin Auth Service
 *
 * Handles authentication for the admin panel.
 * Uses the same auth endpoints as the main app but stores
 * tokens separately for admin access.
 *
 * @module
 */

// =============================================================================
// Types
// =============================================================================

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AdminUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: AdminUser | null;
  tokens: AuthTokens | null;
}

// =============================================================================
// Storage Keys
// =============================================================================

const ADMIN_TOKENS_KEY = "alexi_admin_tokens";
const ADMIN_USER_KEY = "alexi_admin_user";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the API base URL
 */
function getApiUrl(): string {
  return globalThis.location?.origin ?? "http://localhost:8000";
}

/**
 * Calculate token expiration date
 */
function calculateExpiresAt(expiresIn: number): string {
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
  return expiresAt.toISOString();
}

// =============================================================================
// Token Storage
// =============================================================================

/**
 * Save auth tokens to localStorage
 */
function saveTokens(tokens: AuthTokens): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(ADMIN_TOKENS_KEY, JSON.stringify(tokens));
  } catch (error) {
    console.warn("[AdminAuth] Failed to save tokens:", error);
  }
}

/**
 * Load auth tokens from localStorage
 */
function loadTokens(): AuthTokens | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const stored = localStorage.getItem(ADMIN_TOKENS_KEY);
    if (!stored) return null;

    const tokens: AuthTokens = JSON.parse(stored);

    // Check if tokens are expired
    if (new Date(tokens.expiresAt) <= new Date()) {
      clearTokens();
      return null;
    }

    return tokens;
  } catch (error) {
    console.warn("[AdminAuth] Failed to load tokens:", error);
    return null;
  }
}

/**
 * Clear auth tokens from localStorage
 */
function clearTokens(): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.removeItem(ADMIN_TOKENS_KEY);
  } catch (error) {
    console.warn("[AdminAuth] Failed to clear tokens:", error);
  }
}

// =============================================================================
// User Storage
// =============================================================================

/**
 * Save user to localStorage
 */
function saveUser(user: AdminUser): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn("[AdminAuth] Failed to save user:", error);
  }
}

/**
 * Load user from localStorage
 */
function loadUser(): AdminUser | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const stored = localStorage.getItem(ADMIN_USER_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.warn("[AdminAuth] Failed to load user:", error);
    return null;
  }
}

/**
 * Clear user from localStorage
 */
function clearUser(): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.removeItem(ADMIN_USER_KEY);
  } catch (error) {
    console.warn("[AdminAuth] Failed to clear user:", error);
  }
}

// =============================================================================
// Auth API Functions
// =============================================================================

/**
 * Login with email and password
 *
 * @param credentials - Email and password
 * @returns Login response with user and tokens
 * @throws Error if login fails or user is not admin
 */
export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  const response = await fetch(`${getApiUrl()}/api/auth/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.detail || error.message || `Login failed: ${response.status}`,
    );
  }

  const data: LoginResponse = await response.json();

  // Normalize user data (handle snake_case from API)
  const userData = data.user as unknown as Record<string, unknown>;
  const user: AdminUser = {
    id: String(data.user.id),
    email: data.user.email,
    firstName: (userData.first_name as string) ||
      data.user.firstName || "",
    lastName: (userData.last_name as string) ||
      data.user.lastName || "",
    isAdmin: (userData.is_admin as boolean) ??
      data.user.isAdmin ?? false,
  };

  // Check if user is admin
  if (!user.isAdmin) {
    throw new Error("Access denied. Admin privileges required.");
  }

  // Calculate expiration and save tokens
  const tokens: AuthTokens = {
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
    expiresAt: calculateExpiresAt(data.tokens.expiresIn),
  };

  saveTokens(tokens);
  saveUser(user);

  return {
    user,
    tokens: data.tokens,
  };
}

/**
 * Logout the current user
 */
export async function logout(): Promise<void> {
  const tokens = loadTokens();

  if (tokens) {
    try {
      await fetch(`${getApiUrl()}/api/auth/logout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokens.accessToken}`,
        },
      });
    } catch (error) {
      console.warn("[AdminAuth] Logout request failed:", error);
    }
  }

  clearTokens();
  clearUser();
}

/**
 * Get current auth state
 */
export function getAuthState(): AuthState {
  const tokens = loadTokens();
  const user = loadUser();

  if (!tokens || !user) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      user: null,
      tokens: null,
    };
  }

  return {
    isAuthenticated: true,
    isAdmin: user.isAdmin,
    user,
    tokens,
  };
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getAuthState().isAuthenticated;
}

/**
 * Check if user is admin
 */
export function isAdmin(): boolean {
  const state = getAuthState();
  return state.isAuthenticated && state.isAdmin;
}

/**
 * Get current user
 */
export function getCurrentUser(): AdminUser | null {
  return loadUser();
}

/**
 * Get access token for API requests
 */
export function getAccessToken(): string | null {
  const tokens = loadTokens();
  return tokens?.accessToken ?? null;
}

/**
 * Refresh the access token using the refresh token
 *
 * @returns New tokens if refresh successful, null otherwise
 */
export async function refreshToken(): Promise<AuthTokens | null> {
  const currentTokens = loadTokens();
  if (!currentTokens?.refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${getApiUrl()}/api/auth/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken: currentTokens.refreshToken,
      }),
    });

    if (!response.ok) {
      clearTokens();
      clearUser();
      return null;
    }

    const data = await response.json();

    const tokens: AuthTokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || currentTokens.refreshToken,
      expiresAt: calculateExpiresAt(data.expiresIn || 3600),
    };

    saveTokens(tokens);
    return tokens;
  } catch (error) {
    console.warn("[AdminAuth] Token refresh failed:", error);
    clearTokens();
    clearUser();
    return null;
  }
}

/**
 * Make an authenticated API request
 *
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Response
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  let token = getAccessToken();

  // Try to refresh if no token
  if (!token) {
    const newTokens = await refreshToken();
    token = newTokens?.accessToken ?? null;
  }

  if (!token) {
    throw new Error("Not authenticated");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If unauthorized, try to refresh and retry
  if (response.status === 401) {
    const newTokens = await refreshToken();

    if (newTokens) {
      headers.set("Authorization", `Bearer ${newTokens.accessToken}`);
      return fetch(url, {
        ...options,
        headers,
      });
    }
  }

  return response;
}
