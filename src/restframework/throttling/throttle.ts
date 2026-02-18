/**
 * Throttling classes for Alexi REST Framework
 *
 * Provides DRF-style request throttling/rate limiting for API endpoints.
 * Returns 429 Too Many Requests when the rate limit is exceeded.
 *
 * @module @alexi/restframework/throttling/throttle
 */

import type { ViewSetContext } from "../viewsets/viewset.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Throttle class constructor type
 */
export interface ThrottleClass {
  new (): BaseThrottle;
}

/**
 * Parsed rate (number of requests allowed per duration in seconds)
 */
export interface ParsedRate {
  /** Maximum number of requests allowed */
  numRequests: number;
  /** Time window in seconds */
  duration: number;
}

// ============================================================================
// Rate Parsing
// ============================================================================

/**
 * Duration names mapped to seconds
 */
const DURATION_MAP: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
};

/**
 * Parse a rate string like "100/day", "10/minute", "5/second"
 *
 * @param rate - Rate string in the format "N/period" where period is
 *               second, minute, hour, or day
 * @returns Parsed rate object or null if rate is null/undefined
 * @throws Error if the rate format is invalid
 *
 * @example
 * ```ts
 * parseRate("100/day")    // { numRequests: 100, duration: 86400 }
 * parseRate("10/minute")  // { numRequests: 10, duration: 60 }
 * parseRate("5/second")   // { numRequests: 5, duration: 1 }
 * ```
 */
export function parseRate(rate: string | null | undefined): ParsedRate | null {
  if (rate == null) {
    return null;
  }

  const parts = rate.split("/");
  if (parts.length !== 2) {
    throw new Error(
      `Invalid throttle rate format: "${rate}". Expected "N/period" (e.g. "100/day")`,
    );
  }

  const numRequests = parseInt(parts[0], 10);
  if (isNaN(numRequests) || numRequests <= 0) {
    throw new Error(
      `Invalid throttle rate: "${rate}". Number of requests must be a positive integer.`,
    );
  }

  const periodStr = parts[1].toLowerCase();
  const duration = DURATION_MAP[periodStr];
  if (duration == null) {
    throw new Error(
      `Invalid throttle period: "${
        parts[1]
      }". Must be one of: second, minute, hour, day`,
    );
  }

  return { numRequests, duration };
}

// ============================================================================
// Throttle Cache (in-memory)
// ============================================================================

/**
 * In-memory throttle cache entry
 */
interface CacheEntry {
  /** Timestamps of recent requests (Unix time in seconds) */
  history: number[];
}

/**
 * Global in-memory throttle cache
 *
 * Maps cache key → entry. This is suitable for single-process servers.
 * For multi-process deployments, use a shared cache (e.g., Redis/DenoKV).
 */
const throttleCache = new Map<string, CacheEntry>();

/**
 * Get throttle history for a cache key
 */
export function getCacheEntry(key: string): CacheEntry {
  let entry = throttleCache.get(key);
  if (!entry) {
    entry = { history: [] };
    throttleCache.set(key, entry);
  }
  return entry;
}

/**
 * Clear the throttle cache (used in tests)
 */
export function clearThrottleCache(): void {
  throttleCache.clear();
}

// ============================================================================
// Base Throttle
// ============================================================================

/**
 * Base throttle class
 *
 * All throttle classes should extend this class and implement
 * the `getCache()` and `getRate()` methods.
 *
 * @example
 * ```ts
 * class CustomThrottle extends BaseThrottle {
 *   scope = "custom";
 *
 *   override getRate(): string | null {
 *     return "50/hour";
 *   }
 *
 *   override getCacheKey(context: ViewSetContext): string | null {
 *     return `throttle_custom_${context.user?.id ?? "anon"}`;
 *   }
 * }
 * ```
 */
export abstract class BaseThrottle {
  /**
   * Human-readable message shown when the rate limit is exceeded
   */
  message = "Request was throttled.";

  /**
   * The parsed rate (number of requests per duration)
   * Cached after first parse. `undefined` means not yet parsed.
   */
  protected parsedRate: ParsedRate | null | undefined = undefined;

  /**
   * Get the rate string for this throttle (e.g., "100/day")
   *
   * Return null to disable throttling.
   */
  abstract getRate(): string | null;

  /**
   * Get the cache key for this request
   *
   * Return null to not throttle this request.
   */
  abstract getCacheKey(context: ViewSetContext): string | null;

  /**
   * Get the parsed rate, caching the result
   */
  protected getParsedRate(): ParsedRate | null {
    if (this.parsedRate !== undefined) {
      return this.parsedRate;
    }
    this.parsedRate = parseRate(this.getRate());
    return this.parsedRate;
  }

  /**
   * Check if the request is allowed
   *
   * Returns true if the request should be allowed, false to throttle.
   * Also updates the throttle history when allowed.
   *
   * @param context - The ViewSet context
   * @returns true if the request is allowed, false if throttled
   */
  allowRequest(context: ViewSetContext): boolean {
    const rate = this.getParsedRate();
    if (!rate) {
      return true; // No rate limit configured - allow all
    }

    const cacheKey = this.getCacheKey(context);
    if (!cacheKey) {
      return true; // No cache key - allow (e.g., unauthenticated but UserRateThrottle)
    }

    const now = Date.now() / 1000;
    const entry = getCacheEntry(cacheKey);

    // Remove timestamps outside the current window
    const windowStart = now - rate.duration;
    entry.history = entry.history.filter((t) => t > windowStart);

    if (entry.history.length >= rate.numRequests) {
      // Rate limit exceeded - record when the next request will be allowed
      this.message = `Request was throttled. Expected available in ${
        Math.ceil(entry.history[0] + rate.duration - now)
      } seconds.`;
      return false;
    }

    // Allow request and record timestamp
    entry.history.push(now);
    return true;
  }

  /**
   * Calculate seconds until the next allowed request
   *
   * Used for the Retry-After response header.
   *
   * @param context - The ViewSet context
   * @returns Seconds until next allowed request, or null if not throttled
   */
  waitTime(context: ViewSetContext): number | null {
    const rate = this.getParsedRate();
    if (!rate) {
      return null;
    }

    const cacheKey = this.getCacheKey(context);
    if (!cacheKey) {
      return null;
    }

    const now = Date.now() / 1000;
    const entry = getCacheEntry(cacheKey);

    const windowStart = now - rate.duration;
    const recentHistory = entry.history.filter((t) => t > windowStart);

    if (recentHistory.length < rate.numRequests) {
      return null; // Not throttled
    }

    // Time until the oldest request in the window expires
    return Math.ceil(recentHistory[0] + rate.duration - now);
  }
}

// ============================================================================
// Built-in Throttle Classes
// ============================================================================

/**
 * Rate limit unauthenticated (anonymous) requests by IP address
 *
 * The default rate can be set via the `rate` property. Override `getRate()`
 * to return the rate dynamically (e.g., from settings).
 *
 * @example
 * ```ts
 * class MyViewSet extends ModelViewSet {
 *   throttle_classes = [AnonRateThrottle];
 *   throttle_rates = { anon: "100/day" };
 * }
 * ```
 */
export class AnonRateThrottle extends BaseThrottle {
  /**
   * Throttle scope name - used to look up the rate in throttle_rates
   */
  scope = "anon";

  /**
   * Default rate (null = disabled unless set via throttle_rates)
   */
  protected _rate: string | null = null;

  getRate(): string | null {
    return this._rate;
  }

  /**
   * Set the rate (called by ViewSet when throttle_rates is configured)
   */
  setRate(rate: string): void {
    this._rate = rate;
    this.parsedRate = undefined; // Reset cached parsed rate
  }

  /**
   * Get the client IP address from the request
   */
  protected getClientIp(request: Request): string {
    // Check common proxy headers first
    const forwarded = request.headers.get("X-Forwarded-For");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    const realIp = request.headers.get("X-Real-IP");
    if (realIp) {
      return realIp.trim();
    }
    // Fall back to a placeholder (in Deno, remote addr is not on Request)
    return "unknown";
  }

  getCacheKey(context: ViewSetContext): string | null {
    // Only throttle anonymous (unauthenticated) requests
    if (context.user != null) {
      return null;
    }
    const ip = this.getClientIp(context.request);
    return `throttle_anon_${ip}`;
  }
}

/**
 * Rate limit authenticated requests by user ID
 *
 * @example
 * ```ts
 * class MyViewSet extends ModelViewSet {
 *   throttle_classes = [UserRateThrottle];
 *   throttle_rates = { user: "1000/day" };
 * }
 * ```
 */
export class UserRateThrottle extends BaseThrottle {
  /**
   * Throttle scope name - used to look up the rate in throttle_rates
   */
  scope = "user";

  /**
   * Default rate (null = disabled unless set via throttle_rates)
   */
  protected _rate: string | null = null;

  getRate(): string | null {
    return this._rate;
  }

  /**
   * Set the rate (called by ViewSet when throttle_rates is configured)
   */
  setRate(rate: string): void {
    this._rate = rate;
    this.parsedRate = undefined; // Reset cached parsed rate
  }

  getCacheKey(context: ViewSetContext): string | null {
    // Only throttle authenticated requests
    if (context.user == null) {
      return null;
    }
    return `throttle_user_${context.user.id}`;
  }
}

/**
 * Rate limit requests by a named scope
 *
 * Useful for applying different rate limits to different parts of the API.
 * Set the `scope` property to identify the rate in `throttle_rates`.
 *
 * @example
 * ```ts
 * class BurstThrottle extends ScopedRateThrottle {
 *   override scope = "burst";
 * }
 *
 * class SustainedThrottle extends ScopedRateThrottle {
 *   override scope = "sustained";
 * }
 *
 * class MyViewSet extends ModelViewSet {
 *   throttle_classes = [BurstThrottle, SustainedThrottle];
 *   throttle_rates = {
 *     burst: "60/minute",
 *     sustained: "1000/day",
 *   };
 * }
 * ```
 */
export class ScopedRateThrottle extends BaseThrottle {
  /**
   * Throttle scope name - must match a key in throttle_rates
   */
  scope = "default";

  /**
   * Default rate (null = disabled unless set via throttle_rates)
   */
  protected _rate: string | null = null;

  getRate(): string | null {
    return this._rate;
  }

  /**
   * Set the rate (called by ViewSet when throttle_rates is configured)
   */
  setRate(rate: string): void {
    this._rate = rate;
    this.parsedRate = undefined; // Reset cached parsed rate
  }

  getCacheKey(context: ViewSetContext): string | null {
    const userId = context.user?.id ?? "anon";
    return `throttle_${this.scope}_${userId}`;
  }
}
