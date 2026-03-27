/**
 * File-based email backend.
 *
 * Writes each email session to a `.eml` file in a configurable directory
 * instead of transmitting it. Intended for development use only.
 *
 * Mirrors `django.core.mail.backends.filebased.EmailBackend`.
 *
 * Configure via settings:
 * ```ts
 * export const EMAIL_BACKEND = "file";
 * export const EMAIL_FILE_PATH = "/tmp/alexi-messages";
 * ```
 *
 * @module alexi_mail/backends/file
 */

import { BaseEmailBackend } from "./base.ts";
import type { EmailMessage } from "../message.ts";
import { registerBackend } from "../mail.ts";

// =============================================================================
// FileEmailBackend
// =============================================================================

/** Constructor options for {@link FileEmailBackend}. */
export interface FileEmailBackendOptions {
  /**
   * Directory path where `.eml` files are written.
   * Falls back to the `EMAIL_FILE_PATH` setting (`"/tmp/alexi-messages"`).
   */
  filePath?: string;
  /** Whether to suppress send errors. */
  failSilently?: boolean;
}

/**
 * Email backend that writes each message to a `.eml` file.
 *
 * A new uniquely-named file is created for each session (each call to
 * {@link sendMessages}). The file contains the RFC 2822 representation of
 * every message sent in that session, separated by a divider line.
 *
 * This backend is **server-only** (requires `Deno.writeTextFile`).
 *
 * @category Backends
 *
 * @example
 * ```ts
 * import { FileEmailBackend } from "@alexi/mail/backends/file";
 *
 * const backend = new FileEmailBackend({ filePath: "/tmp/mail" });
 * await backend.sendMessages([email]);
 * // Creates /tmp/mail/2026-03-27T12-00-00-000Z_abc123.eml
 * ```
 */
export class FileEmailBackend extends BaseEmailBackend {
  private readonly filePath: string;

  constructor(options: FileEmailBackendOptions = {}) {
    super({ failSilently: options.failSilently });
    this.filePath = options.filePath ??
      _getSetting("EMAIL_FILE_PATH", "/tmp/alexi-messages");
  }

  /**
   * Writes all messages in this session to a single `.eml` file.
   *
   * @param emailMessages - Messages to write.
   * @returns Number of messages written.
   */
  override async sendMessages(emailMessages: EmailMessage[]): Promise<number> {
    if (!emailMessages.length) return 0;

    if (typeof Deno === "undefined") {
      throw new Error(
        "FileEmailBackend is only available in server (Deno) environments.",
      );
    }

    let sent = 0;
    try {
      // Ensure the directory exists.
      await Deno.mkdir(this.filePath, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const random = Math.random().toString(36).slice(2, 8);
      const filename = `${this.filePath}/${timestamp}_${random}.eml`;

      const divider = `\n${"=".repeat(72)}\n`;
      const content = emailMessages
        .map((msg) => msg.message())
        .join(divider);

      await Deno.writeTextFile(filename, content);
      sent = emailMessages.length;
    } catch (err) {
      if (!this.failSilently) throw err;
    }

    return sent;
  }
}

registerBackend("file", FileEmailBackend);

// =============================================================================
// Helpers
// =============================================================================

function _getSetting<T>(key: string, defaultValue: T): T {
  try {
    const settings = (globalThis as any).__alexiSettings;
    if (settings && key in settings) return settings[key] as T;
  } catch {
    // ignore
  }
  return defaultValue;
}
