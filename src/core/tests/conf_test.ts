/**
 * Tests for the global settings registry (conf)
 */

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  conf,
  configureSettings,
  isSettingsConfigured,
  resetSettings,
} from "../conf.ts";

Deno.test("conf: throws before configuration", () => {
  resetSettings();
  assertThrows(
    () => conf.DEBUG,
    Error,
    "Alexi settings are not configured",
  );
});

Deno.test("conf: isSettingsConfigured returns false before configure", () => {
  resetSettings();
  assertEquals(isSettingsConfigured(), false);
});

Deno.test("conf: isSettingsConfigured returns true after configure", () => {
  resetSettings();
  configureSettings({ DEBUG: true });
  assertEquals(isSettingsConfigured(), true);
  resetSettings();
});

Deno.test("conf: reads settings after configureSettings", () => {
  resetSettings();
  configureSettings({ DEBUG: true });
  assertEquals(conf.DEBUG, true);
  resetSettings();
});

Deno.test("conf: reads undefined for missing keys", () => {
  resetSettings();
  configureSettings({ DEBUG: false });
  assertEquals(conf.DATABASES, undefined);
  resetSettings();
});

Deno.test("conf: reflects updated settings after reconfiguration", () => {
  resetSettings();
  configureSettings({ DEBUG: false });
  assertEquals(conf.DEBUG, false);

  configureSettings({ DEBUG: true });
  assertEquals(conf.DEBUG, true);
  resetSettings();
});

Deno.test("conf: reads all configured fields correctly", () => {
  resetSettings();
  const mockSettings = {
    DEBUG: true,
    DATABASES: undefined,
    MIDDLEWARE: [],
  };
  configureSettings(mockSettings);

  assertEquals(conf.DEBUG, true);
  assertEquals(conf.DATABASES, undefined);
  assertEquals(conf.MIDDLEWARE, []);

  resetSettings();
});
