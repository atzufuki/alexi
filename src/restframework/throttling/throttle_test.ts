/**
 * Tests for Throttling classes
 *
 * @module @alexi/restframework/throttling/throttle_test
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  AnonRateThrottle,
  clearThrottleCache,
  parseRate,
  ScopedRateThrottle,
  UserRateThrottle,
} from "./throttle.ts";
import { ViewSet } from "../viewsets/viewset.ts";
import type { ViewSetContext } from "../viewsets/viewset.ts";

// ============================================================================
// Helpers
// ============================================================================

function makeContext(overrides: Partial<ViewSetContext> = {}): ViewSetContext {
  return {
    request: new Request("http://localhost/api/test/"),
    params: {},
    action: "list",
    ...overrides,
  };
}

function makeAuthContext(
  userId: number | string = 1,
): ViewSetContext {
  return makeContext({ user: { id: userId, email: "user@test.com" } });
}

function makeAnonContext(ip?: string): ViewSetContext {
  const headers: Record<string, string> = {};
  if (ip) {
    headers["X-Forwarded-For"] = ip;
  }
  return {
    request: new Request("http://localhost/api/test/", { headers }),
    params: {},
    action: "list",
  };
}

// ============================================================================
// parseRate tests
// ============================================================================

Deno.test("parseRate: parses per-second rate", () => {
  const rate = parseRate("5/second");
  assertExists(rate);
  assertEquals(rate.numRequests, 5);
  assertEquals(rate.duration, 1);
});

Deno.test("parseRate: parses per-minute rate", () => {
  const rate = parseRate("60/minute");
  assertExists(rate);
  assertEquals(rate.numRequests, 60);
  assertEquals(rate.duration, 60);
});

Deno.test("parseRate: parses per-hour rate", () => {
  const rate = parseRate("1000/hour");
  assertExists(rate);
  assertEquals(rate.numRequests, 1000);
  assertEquals(rate.duration, 3600);
});

Deno.test("parseRate: parses per-day rate", () => {
  const rate = parseRate("100/day");
  assertExists(rate);
  assertEquals(rate.numRequests, 100);
  assertEquals(rate.duration, 86400);
});

Deno.test("parseRate: returns null for null input", () => {
  assertEquals(parseRate(null), null);
  assertEquals(parseRate(undefined), null);
});

Deno.test("parseRate: throws on invalid format", () => {
  let threw = false;
  try {
    parseRate("invalid");
  } catch (_e) {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("parseRate: throws on invalid period", () => {
  let threw = false;
  try {
    parseRate("100/week");
  } catch (_e) {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("parseRate: throws on non-positive number", () => {
  let threw = false;
  try {
    parseRate("0/day");
  } catch (_e) {
    threw = true;
  }
  assertEquals(threw, true);
});

// ============================================================================
// AnonRateThrottle tests
// ============================================================================

Deno.test({
  name: "AnonRateThrottle: allows requests within limit",
  fn() {
    clearThrottleCache();
    const throttle = new AnonRateThrottle();
    throttle.setRate("3/minute");
    const ctx = makeAnonContext("192.168.1.1");

    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
  },
});

Deno.test({
  name: "AnonRateThrottle: blocks after limit exceeded",
  fn() {
    clearThrottleCache();
    const throttle = new AnonRateThrottle();
    throttle.setRate("3/minute");
    const ctx = makeAnonContext("10.0.0.1");

    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), false); // 4th request blocked
  },
});

Deno.test({
  name: "AnonRateThrottle: does not throttle authenticated users",
  fn() {
    clearThrottleCache();
    const throttle = new AnonRateThrottle();
    throttle.setRate("1/minute");
    const ctx = makeAuthContext(42);

    // Authenticated requests are not throttled by AnonRateThrottle
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
  },
});

Deno.test({
  name: "AnonRateThrottle: uses X-Forwarded-For header for IP",
  fn() {
    clearThrottleCache();
    const throttle = new AnonRateThrottle();
    throttle.setRate("2/minute");

    const ctx1 = makeAnonContext("1.2.3.4");
    const ctx2 = makeAnonContext("5.6.7.8");

    // Two different IPs should have separate limits
    assertEquals(throttle.allowRequest(ctx1), true);
    assertEquals(throttle.allowRequest(ctx1), true);
    assertEquals(throttle.allowRequest(ctx1), false); // 1.2.3.4 exceeded

    assertEquals(throttle.allowRequest(ctx2), true); // 5.6.7.8 not affected
  },
});

Deno.test({
  name: "AnonRateThrottle: allows all when no rate set",
  fn() {
    clearThrottleCache();
    const throttle = new AnonRateThrottle();
    // No rate set
    const ctx = makeAnonContext("1.1.1.1");

    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
  },
});

Deno.test({
  name: "AnonRateThrottle: scope is 'anon'",
  fn() {
    const throttle = new AnonRateThrottle();
    assertEquals(throttle.scope, "anon");
  },
});

// ============================================================================
// UserRateThrottle tests
// ============================================================================

Deno.test({
  name: "UserRateThrottle: allows requests within limit",
  fn() {
    clearThrottleCache();
    const throttle = new UserRateThrottle();
    throttle.setRate("3/minute");
    const ctx = makeAuthContext(1);

    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
  },
});

Deno.test({
  name: "UserRateThrottle: blocks after limit exceeded",
  fn() {
    clearThrottleCache();
    const throttle = new UserRateThrottle();
    throttle.setRate("2/minute");
    const ctx = makeAuthContext(99);

    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), false); // 3rd request blocked
  },
});

Deno.test({
  name: "UserRateThrottle: different users have separate limits",
  fn() {
    clearThrottleCache();
    const throttle = new UserRateThrottle();
    throttle.setRate("2/minute");

    const ctx1 = makeAuthContext(1);
    const ctx2 = makeAuthContext(2);

    assertEquals(throttle.allowRequest(ctx1), true);
    assertEquals(throttle.allowRequest(ctx1), true);
    assertEquals(throttle.allowRequest(ctx1), false); // user 1 exceeded

    assertEquals(throttle.allowRequest(ctx2), true); // user 2 not affected
  },
});

Deno.test({
  name: "UserRateThrottle: does not throttle anonymous users",
  fn() {
    clearThrottleCache();
    const throttle = new UserRateThrottle();
    throttle.setRate("1/minute");
    const ctx = makeAnonContext();

    // Anonymous requests not throttled by UserRateThrottle
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
  },
});

Deno.test({
  name: "UserRateThrottle: scope is 'user'",
  fn() {
    const throttle = new UserRateThrottle();
    assertEquals(throttle.scope, "user");
  },
});

// ============================================================================
// ScopedRateThrottle tests
// ============================================================================

Deno.test({
  name: "ScopedRateThrottle: allows requests within limit (anon)",
  fn() {
    clearThrottleCache();
    const throttle = new ScopedRateThrottle();
    throttle.scope = "burst";
    throttle.setRate("3/minute");
    const ctx = makeAnonContext();

    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
  },
});

Deno.test({
  name: "ScopedRateThrottle: blocks after limit exceeded",
  fn() {
    clearThrottleCache();
    const throttle = new ScopedRateThrottle();
    throttle.scope = "sustained";
    throttle.setRate("2/day");
    const ctx = makeAuthContext(5);

    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), true);
    assertEquals(throttle.allowRequest(ctx), false);
  },
});

Deno.test({
  name: "ScopedRateThrottle: different scopes are independent",
  fn() {
    clearThrottleCache();
    const burst = new ScopedRateThrottle();
    burst.scope = "burst";
    burst.setRate("2/minute");

    const sustained = new ScopedRateThrottle();
    sustained.scope = "sustained";
    sustained.setRate("10/day");

    const ctx = makeAuthContext(1);

    assertEquals(burst.allowRequest(ctx), true);
    assertEquals(burst.allowRequest(ctx), true);
    assertEquals(burst.allowRequest(ctx), false); // burst exceeded

    assertEquals(sustained.allowRequest(ctx), true); // sustained not affected
  },
});

Deno.test({
  name: "ScopedRateThrottle: default scope is 'default'",
  fn() {
    const throttle = new ScopedRateThrottle();
    assertEquals(throttle.scope, "default");
  },
});

// ============================================================================
// waitTime tests
// ============================================================================

Deno.test({
  name: "waitTime: returns null when not throttled",
  fn() {
    clearThrottleCache();
    const throttle = new UserRateThrottle();
    throttle.setRate("5/minute");
    const ctx = makeAuthContext(10);

    throttle.allowRequest(ctx);
    assertEquals(throttle.waitTime(ctx), null);
  },
});

Deno.test({
  name: "waitTime: returns positive number when throttled",
  fn() {
    clearThrottleCache();
    const throttle = new UserRateThrottle();
    throttle.setRate("2/minute");
    const ctx = makeAuthContext(20);

    throttle.allowRequest(ctx);
    throttle.allowRequest(ctx);
    throttle.allowRequest(ctx); // throttled

    const wait = throttle.waitTime(ctx);
    assertExists(wait);
    assertEquals(wait > 0, true);
    assertEquals(wait <= 60, true);
  },
});

// ============================================================================
// ViewSet integration tests
// ============================================================================

Deno.test({
  name: "ViewSet.checkThrottles: returns null when no throttle_classes",
  fn() {
    clearThrottleCache();
    const vs = new ViewSet();
    const ctx = makeContext();
    assertEquals(vs.checkThrottles(ctx), null);
  },
});

Deno.test({
  name: "ViewSet.checkThrottles: returns null when throttle allows",
  fn() {
    clearThrottleCache();
    const vs = new ViewSet();
    vs.throttle_classes = [AnonRateThrottle];
    vs.throttle_rates = { anon: "10/minute" };
    const ctx = makeAnonContext("2.2.2.2");
    assertEquals(vs.checkThrottles(ctx), null);
  },
});

Deno.test({
  name: "ViewSet.checkThrottles: returns 429 when throttled",
  fn() {
    clearThrottleCache();
    const vs = new ViewSet();
    vs.throttle_classes = [AnonRateThrottle];
    vs.throttle_rates = { anon: "2/minute" };
    const ctx = makeAnonContext("3.3.3.3");

    vs.checkThrottles(ctx); // 1
    vs.checkThrottles(ctx); // 2

    // Re-create viewset to reset throttle instance (but cache persists)
    const vs2 = new ViewSet();
    vs2.throttle_classes = [AnonRateThrottle];
    vs2.throttle_rates = { anon: "2/minute" };

    const response = vs2.checkThrottles(ctx); // 3 - should be throttled
    assertExists(response);
    assertEquals(response!.status, 429);
    assertExists(response!.headers.get("Retry-After"));
  },
});

Deno.test({
  name: "ViewSet.getThrottles: applies throttle_rates to scoped throttles",
  fn() {
    clearThrottleCache();
    const vs = new ViewSet();
    vs.throttle_classes = [AnonRateThrottle, UserRateThrottle];
    vs.throttle_rates = { anon: "50/hour", user: "500/hour" };

    const throttles = vs.getThrottles();
    assertEquals(throttles.length, 2);
    assertEquals(throttles[0].getRate(), "50/hour");
    assertEquals(throttles[1].getRate(), "500/hour");
  },
});
