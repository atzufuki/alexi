/**
 * Throttling module for Alexi REST Framework
 *
 * @module @alexi/restframework/throttling
 */

export {
  AnonRateThrottle,
  BaseThrottle,
  clearThrottleCache,
  getCacheEntry,
  parseRate,
  ScopedRateThrottle,
  UserRateThrottle,
} from "./throttle.ts";

export type { ParsedRate, ThrottleClass } from "./throttle.ts";
