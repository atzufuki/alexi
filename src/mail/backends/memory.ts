/**
 * In-memory email backend.
 *
 * Stores sent messages in an exported {@link outbox} array instead of
 * transmitting them. Intended for use in tests.
 *
 * Mirrors `django.core.mail.backends.locmem.EmailBackend`.
 *
 * Configure via settings:
 * ```ts
 * export const EMAIL_BACKEND = "memory";
 * ```
 *
 * Then in tests:
 * ```ts
 * import { outbox } from "@alexi/mail/backends/memory";
 *
 * // Reset before each test
 * outbox.length = 0;
 *
 * // After your action:
 * assertEquals(outbox.length, 1);
 * assertEquals(outbox[0].subject, "Welcome!");
 * ```
 *
 * @module alexi_mail/backends/memory
 */

import { BaseEmailBackend } from "./base.ts";
import type { EmailMessage } from "../message.ts";
import { registerBackend } from "../mail.ts";

// =============================================================================
// outbox
// =============================================================================

/**
 * Global in-memory outbox.
 *
 * Every message sent via {@link MemoryEmailBackend} is appended here.
 * Reset this array (`outbox.length = 0`) at the start of each test.
 *
 * @category Testing
 *
 * @example
 * ```ts
 * import { outbox } from "@alexi/mail/backends/memory";
 * import { assertEquals } from "@std/assert";
 *
 * outbox.length = 0;
 * await sendMail("Hi", "Hello", "from@example.com", ["to@example.com"]);
 * assertEquals(outbox.length, 1);
 * assertEquals(outbox[0].subject, "Hi");
 * ```
 */
export const outbox: EmailMessage[] = [];

// =============================================================================
// MemoryEmailBackend
// =============================================================================

/**
 * Email backend that stores messages in the in-memory {@link outbox} array.
 *
 * @category Backends
 *
 * @example
 * ```ts
 * import { MemoryEmailBackend, outbox } from "@alexi/mail/backends/memory";
 *
 * const backend = new MemoryEmailBackend();
 * await backend.sendMessages([email]);
 * console.log(outbox.length); // 1
 * ```
 */
export class MemoryEmailBackend extends BaseEmailBackend {
  /**
   * Appends each message to the global {@link outbox}.
   *
   * @param emailMessages - Messages to store.
   * @returns Number of messages stored.
   */
  override async sendMessages(emailMessages: EmailMessage[]): Promise<number> {
    let sent = 0;
    for (const msg of emailMessages) {
      try {
        outbox.push(msg);
        sent++;
      } catch (err) {
        if (!this.failSilently) throw err;
      }
    }
    return sent;
  }
}

registerBackend("memory", MemoryEmailBackend);
