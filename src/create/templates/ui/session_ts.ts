/**
 * UI session.ts template generator
 *
 * @module @alexi/create/templates/ui/session_ts
 */

/**
 * Generate session.ts content for the UI app
 */
export function generateUiSessionTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} UI Session
 *
 * Session management for shareable todo lists.
 * Each user gets a unique 5-character session ID in the URL (e.g., /abc12).
 * Sharing the URL shares the todo list.
 *
 * @module ${name}-ui/session
 */

const SESSION_STORAGE_KEY = "${name}_session_id";

/**
 * Generate a random 5-character alphanumeric ID
 */
function generateSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get the current session ID
 *
 * Returns the session ID from localStorage, or generates a new one if none exists.
 */
export function getSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Extract session ID from a URL pathname
 *
 * @param pathname - The URL pathname (e.g., "/abc12" or "/abc12/")
 * @returns The session ID or null if not found
 */
export function getSessionIdFromUrl(pathname: string): string | null {
  // Remove leading/trailing slashes and get the first segment
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const firstSegment = segments[0];
  // Validate: must be exactly 5 alphanumeric characters
  if (/^[a-z0-9]{5}$/.test(firstSegment)) {
    return firstSegment;
  }
  return null;
}

/**
 * Set the session ID in localStorage
 *
 * Used when navigating to a shared URL to adopt that session.
 */
export function setSessionId(sessionId: string): void {
  localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
}

/**
 * Check if a string is a valid session ID format
 */
export function isValidSessionId(id: string): boolean {
  return /^[a-z0-9]{5}$/.test(id);
}
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
