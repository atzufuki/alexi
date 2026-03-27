/**
 * Dummy email backend.
 *
 * Silently discards all messages without sending or storing them.
 * Intended for development environments where email sending should be
 * completely disabled.
 *
 * Mirrors `django.core.mail.backends.dummy.EmailBackend`.
 *
 * Configure via settings:
 * ```ts
 * export const EMAIL_BACKEND = "dummy";
 * ```
 *
 * @module alexi_mail/backends/dummy
 */

import { BaseEmailBackend } from "./base.ts";
import type { EmailMessage } from "../message.ts";
import { registerBackend } from "../mail.ts";

// =============================================================================
// DummyEmailBackend
// =============================================================================

/**
 * Email backend that silently discards all messages.
 *
 * Useful when you want email-related code to run without any email actually
 * being sent or logged.
 *
 * @category Backends
 *
 * @example
 * ```ts
 * import { DummyEmailBackend } from "@alexi/mail/backends/dummy";
 *
 * const backend = new DummyEmailBackend();
 * const sent = await backend.sendMessages([email]);
 * console.log(sent); // 0
 * ```
 */
export class DummyEmailBackend extends BaseEmailBackend {
  /**
   * Discards all messages and returns `0`.
   *
   * @param _emailMessages - Messages to discard.
   * @returns Always `0`.
   */
  override async sendMessages(_emailMessages: EmailMessage[]): Promise<number> {
    return 0;
  }
}

registerBackend("dummy", DummyEmailBackend);
