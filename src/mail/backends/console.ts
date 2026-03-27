/**
 * Console email backend.
 *
 * Writes email content to stdout instead of transmitting it.
 * Intended for development use only — mirrors
 * `django.core.mail.backends.console.EmailBackend`.
 *
 * Configure via settings:
 * ```ts
 * export const EMAIL_BACKEND = "console";
 * ```
 *
 * @module alexi_mail/backends/console
 */

import { BaseEmailBackend } from "./base.ts";
import type { EmailMessage } from "../message.ts";
import { registerBackend } from "../mail.ts";

// =============================================================================
// ConsoleEmailBackend
// =============================================================================

/**
 * Email backend that prints messages to the console (stdout).
 *
 * No emails are actually sent. Each message is rendered as a formatted block
 * containing headers and body, making it easy to inspect outgoing mail during
 * local development.
 *
 * @category Backends
 *
 * @example
 * ```ts
 * import { ConsoleEmailBackend } from "@alexi/mail/backends/console";
 *
 * const backend = new ConsoleEmailBackend();
 * await backend.sendMessages([email]);
 * ```
 */
export class ConsoleEmailBackend extends BaseEmailBackend {
  /**
   * Renders and logs each message to stdout.
   *
   * @param emailMessages - Messages to display.
   * @returns Number of messages logged.
   */
  override async sendMessages(emailMessages: EmailMessage[]): Promise<number> {
    let sent = 0;
    for (const msg of emailMessages) {
      try {
        console.log(formatEmailForConsole(msg));
        sent++;
      } catch (err) {
        if (!this.failSilently) throw err;
      }
    }
    return sent;
  }
}

registerBackend("console", ConsoleEmailBackend);

// =============================================================================
// Formatting helper
// =============================================================================

/**
 * Formats an {@link EmailMessage} as a human-readable block for console output.
 *
 * @param msg - The message to format.
 * @returns Formatted string.
 */
function formatEmailForConsole(msg: EmailMessage): string {
  const divider = "-".repeat(72);
  const lines: string[] = [
    divider,
    `[Alexi Mail] ${new Date().toISOString()}`,
    `Subject   : ${msg.subject}`,
    `From      : ${msg.fromEmail}`,
    `To        : ${msg.to.join(", ") || "(none)"}`,
  ];

  if (msg.cc.length) lines.push(`Cc        : ${msg.cc.join(", ")}`);
  if (msg.bcc.length) lines.push(`Bcc       : ${msg.bcc.join(", ")}`);
  if (msg.replyTo.length) lines.push(`Reply-To  : ${msg.replyTo.join(", ")}`);

  for (const [k, v] of Object.entries(msg.extraHeaders)) {
    lines.push(`${k.padEnd(10)}: ${v}`);
  }

  lines.push(``, msg.body);

  // Show HTML alternative if present
  const { EmailMultiAlternatives } = msg.constructor as any;
  if (
    "alternatives" in msg &&
    Array.isArray((msg as any).alternatives) &&
    (msg as any).alternatives.length
  ) {
    for (const alt of (msg as any).alternatives) {
      lines.push(``, `-- Alternative: ${alt.mimetype} --`, alt.content);
    }
  }

  if (msg.attachments.length) {
    lines.push(
      ``,
      `-- Attachments (${msg.attachments.length}) --`,
      ...msg.attachments.map(
        (a) =>
          `  ${a.filename} (${a.mimetype}, ${
            typeof a.content === "string"
              ? a.content.length
              : a.content.byteLength
          } bytes)`,
      ),
    );
  }

  lines.push(divider);
  return lines.join("\n");
}
