/**
 * Abstract email backend base class.
 *
 * All concrete email backends must extend {@link BaseEmailBackend} and
 * implement {@link BaseEmailBackend.sendMessages}.
 *
 * @module alexi_mail/backends/base
 */

import type { EmailMessage } from "../message.ts";

// =============================================================================
// BaseEmailBackend
// =============================================================================

/**
 * Abstract base for all Alexi email backends.
 *
 * Mirrors `django.core.mail.backends.base.BaseEmailBackend`.
 *
 * Backends optionally support a persistent connection via {@link open} and
 * {@link close}. Instances also implement `Symbol.asyncDispose` so they can
 * be used with `await using`:
 *
 * @example Use as an async context
 * ```ts
 * import { getConnection } from "@alexi/mail";
 *
 * await using conn = getConnection();
 * await conn.sendMessages([msg1, msg2]);
 * ```
 *
 * @category Backends
 */
export abstract class BaseEmailBackend {
  /**
   * When `true`, exceptions during sending are silently swallowed and `0` is
   * returned instead of being re-thrown.
   */
  failSilently: boolean;

  constructor(options: { failSilently?: boolean } = {}) {
    this.failSilently = options.failSilently ?? false;
  }

  /**
   * Opens a persistent connection to the email transport.
   *
   * The default implementation is a no-op. SMTP backends override this to
   * establish and cache a TCP/TLS connection so that multiple messages can be
   * delivered over a single session.
   */
  async open(): Promise<void> {}

  /**
   * Closes the persistent connection opened by {@link open}.
   *
   * The default implementation is a no-op.
   */
  async close(): Promise<void> {}

  /**
   * Sends a list of {@link EmailMessage} instances.
   *
   * Implementations must open a connection if one is not already open,
   * deliver all messages, and then close the connection. If the connection
   * was already open before this call it should be left open afterward.
   *
   * @param emailMessages - Messages to send.
   * @returns The number of messages successfully delivered.
   */
  abstract sendMessages(emailMessages: EmailMessage[]): Promise<number>;

  /**
   * Supports `await using` via the TC39 Explicit Resource Management proposal.
   * Calls {@link close} on disposal.
   *
   * @example
   * ```ts
   * await using conn = getConnection();
   * await conn.sendMessages([msg]);
   * // conn.close() is called automatically here
   * ```
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}
