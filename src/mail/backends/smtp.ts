/**
 * SMTP email backend.
 *
 * The default production backend. Delivers email over SMTP (plain, STARTTLS,
 * or SSL/TLS) using Deno's native TCP/TLS APIs — no external dependencies.
 *
 * Configure via settings:
 * ```ts
 * export const EMAIL_BACKEND = "smtp";  // default
 * export const EMAIL_HOST = "smtp.example.com";
 * export const EMAIL_PORT = 587;
 * export const EMAIL_HOST_USER = "user@example.com";
 * export const EMAIL_HOST_PASSWORD = "secret";
 * export const EMAIL_USE_TLS = true;   // STARTTLS
 * export const EMAIL_USE_SSL = false;  // Direct TLS (port 465)
 * ```
 *
 * @module alexi_mail/backends/smtp
 */

import { BaseEmailBackend } from "./base.ts";
import type { EmailMessage } from "../message.ts";
import { registerBackend } from "../mail.ts";

// =============================================================================
// Types
// =============================================================================

/** Constructor options for {@link SmtpEmailBackend}. */
export interface SmtpEmailBackendOptions {
  /** SMTP hostname. Falls back to `EMAIL_HOST` setting (`"localhost"`). */
  host?: string;
  /** SMTP port. Falls back to `EMAIL_PORT` setting (`587`). */
  port?: number;
  /** Login username. Falls back to `EMAIL_HOST_USER` setting. */
  username?: string;
  /** Login password. Falls back to `EMAIL_HOST_PASSWORD` setting. */
  password?: string;
  /**
   * Upgrade plain connection to TLS via STARTTLS after handshake.
   * Mutually exclusive with `useSsl`. Falls back to `EMAIL_USE_TLS` (`true`).
   */
  useTls?: boolean;
  /**
   * Connect directly over TLS (port 465 style).
   * Mutually exclusive with `useTls`. Falls back to `EMAIL_USE_SSL` (`false`).
   */
  useSsl?: boolean;
  /** Connection timeout in milliseconds. Falls back to `EMAIL_TIMEOUT`. */
  timeout?: number;
  /** Whether to suppress send errors. */
  failSilently?: boolean;
}

// =============================================================================
// SmtpEmailBackend
// =============================================================================

/**
 * SMTP email backend — the default production backend.
 *
 * Implements a minimal RFC 5321 SMTP client over Deno's `Deno.connect` and
 * `Deno.connectTls` APIs. Supports:
 *
 * - Plain SMTP (no auth, no encryption)
 * - STARTTLS (`EMAIL_USE_TLS = true`, port 587)
 * - Implicit TLS (`EMAIL_USE_SSL = true`, port 465)
 * - AUTH PLAIN / AUTH LOGIN
 *
 * Multiple messages sent via {@link sendMessages} share a single TCP session.
 *
 * @category Backends
 *
 * @example
 * ```ts
 * import { SmtpEmailBackend } from "@alexi/mail/backends/smtp";
 *
 * const backend = new SmtpEmailBackend({
 *   host: "smtp.gmail.com",
 *   port: 587,
 *   username: "me@gmail.com",
 *   password: "app-password",
 *   useTls: true,
 * });
 *
 * await backend.open();
 * await backend.sendMessages([email1, email2]);
 * await backend.close();
 * ```
 */
export class SmtpEmailBackend extends BaseEmailBackend {
  private readonly host: string;
  private readonly port: number;
  private readonly username: string;
  private readonly password: string;
  private readonly useTls: boolean;
  private readonly useSsl: boolean;
  private readonly timeout: number | undefined;

  /** Low-level SMTP session, open between {@link open} and {@link close}. */
  private _session: SmtpSession | null = null;
  /** Whether the session was opened by this call (vs. already open). */
  private _openedByUs = false;

  constructor(options: SmtpEmailBackendOptions = {}) {
    super({ failSilently: options.failSilently });
    this.host = options.host ?? _getSetting("EMAIL_HOST", "localhost");
    this.port = options.port ?? _getSetting("EMAIL_PORT", 587);
    this.username = options.username ?? _getSetting("EMAIL_HOST_USER", "");
    this.password = options.password ?? _getSetting("EMAIL_HOST_PASSWORD", "");
    this.useTls = options.useTls ?? _getSetting("EMAIL_USE_TLS", false);
    this.useSsl = options.useSsl ?? _getSetting("EMAIL_USE_SSL", false);
    this.timeout = options.timeout ?? _getSetting("EMAIL_TIMEOUT", undefined);
  }

  /**
   * Opens the SMTP session.
   * Called automatically by {@link sendMessages} when the session is not yet open.
   */
  override async open(): Promise<void> {
    if (this._session) return;
    this._session = await SmtpSession.connect({
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      useTls: this.useTls,
      useSsl: this.useSsl,
      timeout: this.timeout,
    });
    this._openedByUs = false;
  }

  /**
   * Closes the SMTP session if it was opened by us.
   */
  override async close(): Promise<void> {
    if (this._session) {
      await this._session.quit();
      this._session = null;
    }
  }

  /**
   * Sends a list of messages over a single SMTP connection.
   *
   * @param emailMessages - Messages to deliver.
   * @returns Number of successfully delivered messages.
   */
  override async sendMessages(emailMessages: EmailMessage[]): Promise<number> {
    if (!emailMessages.length) return 0;

    const alreadyOpen = this._session !== null;
    if (!alreadyOpen) {
      this._openedByUs = true;
      await this.open();
    }

    let sent = 0;
    try {
      for (const msg of emailMessages) {
        try {
          await this._session!.sendMessage(msg);
          sent++;
        } catch (err) {
          if (!this.failSilently) throw err;
        }
      }
    } finally {
      if (!alreadyOpen && this._openedByUs) {
        await this.close();
        this._openedByUs = false;
      }
    }
    return sent;
  }
}

registerBackend("smtp", SmtpEmailBackend);

// =============================================================================
// SmtpSession — minimal RFC 5321 client
// =============================================================================

interface SmtpSessionOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
  useSsl: boolean;
  timeout?: number;
}

/**
 * Minimal RFC 5321 SMTP session over Deno TCP/TLS.
 *
 * Supports:
 * - EHLO / HELO
 * - STARTTLS (when `useTls` is true)
 * - AUTH PLAIN and AUTH LOGIN
 * - MAIL FROM / RCPT TO / DATA
 * - QUIT
 *
 * @internal
 */
class SmtpSession {
  private conn!: Deno.TcpConn | Deno.TlsConn;
  private reader!: ReadableStreamDefaultReader<Uint8Array>;
  private writer!: WritableStreamDefaultWriter<Uint8Array>;
  private readonly enc = new TextEncoder();
  private readonly dec = new TextDecoder();
  private buf = "";

  private constructor() {}

  /**
   * Establishes a new SMTP session.
   *
   * @param options - Connection options.
   * @returns Connected session.
   */
  static async connect(options: SmtpSessionOptions): Promise<SmtpSession> {
    const s = new SmtpSession();
    await s._connect(options);
    return s;
  }

  private async _connect(options: SmtpSessionOptions): Promise<void> {
    const { host, port, username, password, useTls, useSsl } = options;

    if (useSsl) {
      // Direct TLS connection (implicit TLS, port 465)
      this.conn = await Deno.connectTls({ hostname: host, port });
    } else {
      // Plain TCP, optionally upgraded via STARTTLS
      this.conn = await Deno.connect({ hostname: host, port });
    }

    this.reader = this.conn.readable.getReader();
    this.writer = this.conn.writable.getWriter();

    // Read server greeting
    await this._readResponse(220);

    // EHLO
    await this._sendCmd(`EHLO alexi`);
    const ehloResp = await this._readResponse(250);

    // STARTTLS upgrade
    if (useTls && !useSsl) {
      if (!ehloResp.includes("STARTTLS")) {
        throw new Error(
          `SMTP server ${host}:${port} does not support STARTTLS.`,
        );
      }
      await this._sendCmd("STARTTLS");
      await this._readResponse(220);

      // Release plain reader/writer before upgrading
      this.reader.releaseLock();
      this.writer.releaseLock();

      this.conn = await Deno.startTls(this.conn as Deno.TcpConn, {
        hostname: host,
      });
      this.reader = this.conn.readable.getReader();
      this.writer = this.conn.writable.getWriter();

      // Re-greet after TLS upgrade
      await this._sendCmd(`EHLO alexi`);
      await this._readResponse(250);
    }

    // AUTH
    if (username) {
      await this._authenticate(username, password, ehloResp);
    }
  }

  private async _authenticate(
    username: string,
    password: string,
    ehloResp: string,
  ): Promise<void> {
    if (ehloResp.includes("AUTH") && ehloResp.includes("PLAIN")) {
      // AUTH PLAIN: base64("\0username\0password")
      const creds = btoa(`\0${username}\0${password}`);
      await this._sendCmd(`AUTH PLAIN ${creds}`);
      await this._readResponse(235);
    } else {
      // AUTH LOGIN fallback
      await this._sendCmd("AUTH LOGIN");
      await this._readResponse(334);
      await this._sendCmd(btoa(username));
      await this._readResponse(334);
      await this._sendCmd(btoa(password));
      await this._readResponse(235);
    }
  }

  /**
   * Sends a single {@link EmailMessage} over the open session.
   *
   * @param msg - Message to send.
   */
  async sendMessage(msg: EmailMessage): Promise<void> {
    const from = extractAddress(msg.fromEmail);
    await this._sendCmd(`MAIL FROM:<${from}>`);
    await this._readResponse(250);

    for (const rcpt of msg.recipients()) {
      const addr = extractAddress(rcpt);
      await this._sendCmd(`RCPT TO:<${addr}>`);
      await this._readResponse(250);
    }

    await this._sendCmd("DATA");
    await this._readResponse(354);

    const rawMsg = msg.message().replace(/\n\./g, "\n.."); // dot-stuffing
    await this._send(rawMsg + "\r\n.");
    await this._readResponse(250);
  }

  /**
   * Gracefully closes the SMTP session.
   */
  async quit(): Promise<void> {
    try {
      await this._sendCmd("QUIT");
      await this._readResponse(221);
    } catch {
      // Ignore errors on quit
    } finally {
      try {
        this.reader.releaseLock();
        this.writer.releaseLock();
        this.conn.close();
      } catch {
        // Already closed
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Low-level I/O helpers
  // ---------------------------------------------------------------------------

  private async _send(data: string): Promise<void> {
    await this.writer.write(this.enc.encode(data));
  }

  private async _sendCmd(cmd: string): Promise<void> {
    await this._send(cmd + "\r\n");
  }

  private async _readResponse(expectedCode: number): Promise<string> {
    const full: string[] = [];
    while (true) {
      const line = await this._readLine();
      full.push(line);
      const code = parseInt(line.slice(0, 3), 10);
      const isContinuation = line[3] === "-";
      if (!isContinuation) {
        if (code !== expectedCode) {
          throw new Error(
            `SMTP error: expected ${expectedCode}, got ${code}: ${
              full.join(" | ")
            }`,
          );
        }
        return full.join("\n");
      }
    }
  }

  private async _readLine(): Promise<string> {
    while (true) {
      const nlIdx = this.buf.indexOf("\n");
      if (nlIdx !== -1) {
        const line = this.buf.slice(0, nlIdx).replace(/\r$/, "");
        this.buf = this.buf.slice(nlIdx + 1);
        return line;
      }
      const { value, done } = await this.reader.read();
      if (done) throw new Error("SMTP connection closed unexpectedly.");
      this.buf += this.dec.decode(value);
    }
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extracts the bare email address from a display-name form.
 *
 * `"Display Name <user@example.com>"` → `"user@example.com"`
 * `"user@example.com"` → `"user@example.com"`
 *
 * @param address - Full address string.
 * @returns Bare email address.
 */
function extractAddress(address: string): string {
  const match = address.match(/<([^>]+)>/);
  return match ? match[1] : address.trim();
}

/**
 * Reads a value from the runtime-attached settings object.
 *
 * @param key - Setting key.
 * @param defaultValue - Fallback value.
 * @returns Setting value or default.
 */
function _getSetting<T>(key: string, defaultValue: T): T {
  try {
    const settings = (globalThis as any).__alexiSettings;
    if (settings && key in settings) return settings[key] as T;
  } catch {
    // ignore
  }
  return defaultValue;
}
