/**
 * getWorkerApplication / DEFAULT_FILE_STORAGE tests
 *
 * Verifies that `getWorkerApplication()` wires a `DEFAULT_FILE_STORAGE`
 * backend into `setStorage()` so that `getStorage()` is available after
 * application startup.
 *
 * @module @alexi/core/get_application_test
 */

import { assertEquals } from "jsr:@std/assert@1";
import { getStorage, isStorageInitialized, resetStorage } from "@alexi/storage";
import { MemoryStorage } from "@alexi/storage/backends/memory";
import { getWorkerApplication } from "./get_application.ts";

Deno.test({
  name: "getWorkerApplication: wires DEFAULT_FILE_STORAGE on startup",
  async fn() {
    resetStorage();

    const storage = new MemoryStorage();
    await getWorkerApplication({
      DEFAULT_FILE_STORAGE: storage,
    });

    assertEquals(isStorageInitialized(), true);
    assertEquals(getStorage(), storage);

    // Cleanup
    resetStorage();
  },
});

Deno.test({
  name:
    "getWorkerApplication: skips storage setup when DEFAULT_FILE_STORAGE is absent",
  async fn() {
    resetStorage();

    await getWorkerApplication({});

    assertEquals(isStorageInitialized(), false);

    // Cleanup
    resetStorage();
  },
});
