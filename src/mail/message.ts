/**
 * Email message classes for Alexi.
 *
 * Provides {@link EmailMessage} and {@link EmailMultiAlternatives} — the
 * primary objects used to construct outgoing emails before handing them off
 * to an {@link BaseEmailBackend} for delivery.
 *
 * @module alexi_mail/message
 */

// =============================================================================
// Errors
// =============================================================================

/**
 * Raised when a header value contains a newline character, which could be
 * exploited for email header injection attacks.
 *
 * @category Errors
 */
export class BadHeaderError extends Error {
  constructor(message = "Header values must not contain newline characters.") {
    super(message);
    this.name = "BadHeaderError";
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * A single file attachment on an {@link EmailMessage}.
 *
 * @category Messages
 */
export interface EmailAttachment {
  /** File name as it will appear in the email. */
  filename: string;
  /** Raw file content. */
  content: string | Uint8Array;
  /** MIME type, e.g. `"image/png"`. */
  mimetype: string;
}

/**
 * An alternative body representation (e.g. `text/html` alongside `text/plain`).
 *
 * @category Messages
 */
export interface EmailAlternative {
  /** The alternative body content. */
  content: string;
  /** MIME type, e.g. `"text/html"`. */
  mimetype: string;
}

/**
 * Constructor options for {@link EmailMessage}.
 *
 * @category Messages
 */
export interface EmailMessageOptions {
  /** Email subject line. */
  subject?: string;
  /** Plain-text body. */
  body?: string;
  /**
   * Sender address. Accepts both `"user@example.com"` and
   * `"Display Name <user@example.com>"` forms.
   * Falls back to the `DEFAULT_FROM_EMAIL` setting when omitted.
   */
  fromEmail?: string;
  /** Primary recipient addresses. */
  to?: string[];
  /** Blind-carbon-copy addresses. */
  bcc?: string[];
  /** Carbon-copy addresses. */
  cc?: string[];
  /** Reply-To addresses. */
  replyTo?: string[];
  /** Extra RFC 2822 headers (key → value). */
  headers?: Record<string, string>;
  /** File attachments. */
  attachments?: EmailAttachment[];
  /** Reuse an existing backend connection. */
  connection?: import("./backends/base.ts").BaseEmailBackend;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Validates that a header value does not contain characters that could be
 * exploited for header injection.
 *
 * @param value - Header value to validate.
 * @throws {BadHeaderError} If the value contains `\n` or `\r`.
 */
function validateHeader(value: string): void {
  if (/[\r\n]/.test(value)) {
    throw new BadHeaderError(
      `Header value contains forbidden characters (\\r or \\n): ${
        JSON.stringify(value)
      }`,
    );
  }
}

/**
 * Validate all string values in a headers map.
 *
 * @param headers - Map of header name → value.
 */
function validateHeaders(headers: Record<string, string>): void {
  for (const [key, value] of Object.entries(headers)) {
    validateHeader(key);
    validateHeader(value);
  }
}

// =============================================================================
// EmailMessage
// =============================================================================

/**
 * Represents a single outgoing email message.
 *
 * `EmailMessage` is responsible for constructing the email. The
 * {@link BaseEmailBackend} is responsible for delivery. For messages that
 * need both a plain-text and an HTML body, use
 * {@link EmailMultiAlternatives} instead.
 *
 * Header injection is prevented automatically — any subject, from address,
 * or custom header value that contains `\r` or `\n` will throw a
 * {@link BadHeaderError}.
 *
 * @category Messages
 *
 * @example Send a plain-text email
 * ```ts
 * import { EmailMessage } from "@alexi/mail";
 *
 * const email = new EmailMessage({
 *   subject: "Hello",
 *   body: "World",
 *   fromEmail: "from@example.com",
 *   to: ["to@example.com"],
 * });
 * await email.send();
 * ```
 */
export class EmailMessage {
  /** Email subject line. */
  subject: string;
  /** Plain-text body. */
  body: string;
  /** Sender address. */
  fromEmail: string;
  /** Primary recipient addresses. */
  to: string[];
  /** Blind-carbon-copy addresses. */
  bcc: string[];
  /** Carbon-copy addresses. */
  cc: string[];
  /** Reply-To addresses. */
  replyTo: string[];
  /** Extra RFC 2822 headers. */
  extraHeaders: Record<string, string>;
  /** File attachments. */
  attachments: EmailAttachment[];
  /**
   * Optional pre-opened backend connection to reuse.
   * When omitted, `send()` opens a new connection via `getConnection()`.
   */
  connection?: import("./backends/base.ts").BaseEmailBackend;

  /**
   * MIME subtype for the body. Defaults to `"plain"` (`text/plain`).
   * Set to `"html"` if the body is HTML and no alternatives are needed.
   */
  contentSubtype = "plain";

  constructor(options: EmailMessageOptions = {}) {
    this.subject = options.subject ?? "";
    this.body = options.body ?? "";
    this.fromEmail = options.fromEmail ?? _getDefaultFromEmail();
    this.to = options.to ?? [];
    this.bcc = options.bcc ?? [];
    this.cc = options.cc ?? [];
    this.replyTo = options.replyTo ?? [];
    this.extraHeaders = options.headers ?? {};
    this.attachments = options.attachments ?? [];
    this.connection = options.connection;

    // Validate headers eagerly to surface injection attempts immediately.
    validateHeader(this.subject);
    validateHeader(this.fromEmail);
    validateHeaders(this.extraHeaders);
  }

  /**
   * Returns the full recipient list (`to` + `cc` + `bcc` combined).
   *
   * Override this method if you add additional recipient sources in a subclass.
   *
   * @returns All recipient addresses.
   */
  recipients(): string[] {
    return [...this.to, ...this.cc, ...this.bcc];
  }

  /**
   * Adds a file attachment to the message.
   *
   * When `mimetype` is omitted it is guessed from the file extension.
   *
   * @param filename - Attachment file name.
   * @param content - Raw content.
   * @param mimetype - Optional MIME type.
   *
   * @example
   * ```ts
   * email.attach("report.pdf", pdfBytes, "application/pdf");
   * ```
   */
  attach(
    filename: string,
    content: string | Uint8Array,
    mimetype?: string,
  ): void {
    this.attachments.push({
      filename,
      content,
      mimetype: mimetype ?? guessMimetype(filename),
    });
  }

  /**
   * Reads a file from the filesystem and attaches it to the message.
   *
   * This method is **server-only**. It will throw in browser / Service Worker
   * environments where `Deno` is not available.
   *
   * @param path - Absolute or relative path to the file.
   * @param mimetype - Optional MIME type (guessed from extension when omitted).
   *
   * @example
   * ```ts
   * await email.attachFile("/var/reports/annual.pdf");
   * ```
   */
  async attachFile(path: string, mimetype?: string): Promise<void> {
    if (typeof Deno === "undefined") {
      throw new Error(
        "attachFile() is only available in server (Deno) environments.",
      );
    }
    const content = await Deno.readFile(path);
    const filename = path.split("/").pop() ?? path.split("\\").pop() ?? path;
    this.attach(filename, content, mimetype ?? guessMimetype(filename));
  }

  /**
   * Builds a raw RFC 2822 / MIME message string suitable for SMTP transmission.
   *
   * @returns The formatted email message.
   */
  message(): string {
    return buildMimeMessage(this);
  }

  /**
   * Sends the email using the configured (or default) backend.
   *
   * @param failSilently - When `true`, exceptions are suppressed and `0` is
   *   returned instead of re-throwing.
   * @returns `1` if the message was sent successfully, `0` otherwise.
   */
  async send(failSilently = false): Promise<number> {
    const { getConnection } = await import("./mail.ts");
    const conn = this.connection ?? getConnection();
    try {
      return await conn.sendMessages([this]);
    } catch (err) {
      if (failSilently) {
        return 0;
      }
      throw err;
    }
  }
}

// =============================================================================
// EmailMultiAlternatives
// =============================================================================

/**
 * An {@link EmailMessage} subclass that supports multiple body representations.
 *
 * Use this when you want to send both a plain-text fallback and an HTML version
 * (or any other alternative MIME type).
 *
 * @category Messages
 *
 * @example Send a multipart text + HTML email
 * ```ts
 * import { EmailMultiAlternatives } from "@alexi/mail";
 *
 * const msg = new EmailMultiAlternatives({
 *   subject: "Hello",
 *   body: "Plain text fallback.",
 *   fromEmail: "from@example.com",
 *   to: ["to@example.com"],
 * });
 * msg.attachAlternative("<p>HTML version.</p>", "text/html");
 * await msg.send();
 * ```
 */
export class EmailMultiAlternatives extends EmailMessage {
  /**
   * List of alternative body representations attached via
   * {@link attachAlternative}.
   */
  alternatives: EmailAlternative[] = [];

  /**
   * Attaches an alternative body representation.
   *
   * @param content - The alternative body content.
   * @param mimetype - MIME type (e.g. `"text/html"`).
   *
   * @example
   * ```ts
   * msg.attachAlternative("<p>Hello</p>", "text/html");
   * ```
   */
  attachAlternative(content: string, mimetype: string): void {
    this.alternatives.push({ content, mimetype });
  }

  /**
   * Returns `true` when the given text appears in the plain-text body **and**
   * in every `text/*` alternative.
   *
   * Useful for asserting email content in tests.
   *
   * @param text - Substring to search for.
   * @returns Whether all text parts contain the given string.
   *
   * @example
   * ```ts
   * assert(msg.bodyContains("Hello"));
   * ```
   */
  bodyContains(text: string): boolean {
    if (!this.body.includes(text)) return false;
    for (const alt of this.alternatives) {
      if (alt.mimetype.startsWith("text/") && !alt.content.includes(text)) {
        return false;
      }
    }
    return true;
  }

  override message(): string {
    return buildMimeMessage(this);
  }
}

// =============================================================================
// MIME message builder
// =============================================================================

/**
 * Builds a minimal RFC 2822 / MIME message string from an {@link EmailMessage}
 * or {@link EmailMultiAlternatives} instance.
 *
 * Handles:
 *   - Single plain-text body
 *   - `multipart/alternative` (text + HTML or other alternatives)
 *   - `multipart/mixed` (body + file attachments)
 *   - Base64 encoding of binary attachments
 *   - RFC 2047 encoded-word encoding for non-ASCII subjects / addresses
 *
 * @param msg - The message to serialise.
 * @returns RFC 2822 formatted string.
 */
export function buildMimeMessage(msg: EmailMessage): string {
  const boundary = `alexi_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `alexi_alt_${Date.now()}_${
    Math.random().toString(36).slice(2)
  }`;

  const isMultiAlt = msg instanceof EmailMultiAlternatives &&
    msg.alternatives.length > 0;
  const hasAttachments = msg.attachments.length > 0;

  // ------- Headers -------
  const headers: string[] = [];

  const push = (name: string, value: string) =>
    headers.push(`${name}: ${value}`);

  push("MIME-Version", "1.0");
  push("Subject", encodeHeader(msg.subject));
  push("From", msg.fromEmail);
  if (msg.to.length) push("To", msg.to.join(", "));
  if (msg.cc.length) push("Cc", msg.cc.join(", "));
  if (msg.bcc.length) push("Bcc", msg.bcc.join(", "));
  if (msg.replyTo.length) push("Reply-To", msg.replyTo.join(", "));
  push("Date", new Date().toUTCString());

  for (const [k, v] of Object.entries(msg.extraHeaders)) {
    push(k, v);
  }

  // ------- Body -------
  let contentType: string;
  let bodyParts: string[] = [];

  if (hasAttachments) {
    contentType = `multipart/mixed; boundary="${boundary}"`;

    // Inner body (plain text or multipart/alternative)
    if (isMultiAlt) {
      const innerParts = [
        `--${altBoundary}\r\n` +
        `Content-Type: text/${msg.contentSubtype}; charset="utf-8"\r\n\r\n` +
        msg.body,
        ...(msg as EmailMultiAlternatives).alternatives.map((alt) =>
          `--${altBoundary}\r\n` +
          `Content-Type: ${alt.mimetype}; charset="utf-8"\r\n\r\n` +
          alt.content
        ),
        `--${altBoundary}--`,
      ];
      bodyParts.push(
        `--${boundary}\r\n` +
          `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n` +
          innerParts.join("\r\n"),
      );
    } else {
      bodyParts.push(
        `--${boundary}\r\n` +
          `Content-Type: text/${msg.contentSubtype}; charset="utf-8"\r\n\r\n` +
          msg.body,
      );
    }

    // Attachments
    for (const att of msg.attachments) {
      const encoded = typeof att.content === "string"
        ? btoa(att.content)
        : btoa(String.fromCharCode(...att.content));
      bodyParts.push(
        `--${boundary}\r\n` +
          `Content-Type: ${att.mimetype}; name="${att.filename}"\r\n` +
          `Content-Transfer-Encoding: base64\r\n` +
          `Content-Disposition: attachment; filename="${att.filename}"\r\n\r\n` +
          encoded,
      );
    }
    bodyParts.push(`--${boundary}--`);
  } else if (isMultiAlt) {
    contentType = `multipart/alternative; boundary="${boundary}"`;
    bodyParts = [
      `--${boundary}\r\n` +
      `Content-Type: text/${msg.contentSubtype}; charset="utf-8"\r\n\r\n` +
      msg.body,
      ...(msg as EmailMultiAlternatives).alternatives.map((alt) =>
        `--${boundary}\r\n` +
        `Content-Type: ${alt.mimetype}; charset="utf-8"\r\n\r\n` +
        alt.content
      ),
      `--${boundary}--`,
    ];
  } else {
    contentType = `text/${msg.contentSubtype}; charset="utf-8"`;
    bodyParts = [msg.body];
  }

  push("Content-Type", contentType);

  const body = hasAttachments || isMultiAlt
    ? bodyParts.join("\r\n")
    : bodyParts[0];

  return headers.join("\r\n") + "\r\n\r\n" + body;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Returns the configured `DEFAULT_FROM_EMAIL` setting, falling back to a
 * sensible default when no settings module is loaded.
 */
function _getDefaultFromEmail(): string {
  try {
    // Read from the shared mail settings store written by configureMailSettings()
    // deno-lint-ignore no-explicit-any
    const mailSettings = (globalThis as any).__alexiMailSettings;
    if (mailSettings && "DEFAULT_FROM_EMAIL" in mailSettings) {
      return mailSettings["DEFAULT_FROM_EMAIL"];
    }
    // Legacy fallback: manual user assignment
    // deno-lint-ignore no-explicit-any
    const legacy = (globalThis as any).__alexiSettings;
    return legacy?.DEFAULT_FROM_EMAIL ?? "webmaster@localhost";
  } catch {
    return "webmaster@localhost";
  }
}

/**
 * RFC 2047 encoded-word encoding for non-ASCII header values.
 * ASCII-safe values are returned unchanged.
 *
 * @param value - Header value to encode.
 * @returns Encoded header value safe for RFC 2822 transmission.
 */
function encodeHeader(value: string): string {
  // If value is pure ASCII, no encoding needed.
  // deno-lint-ignore no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const encoded = btoa(unescape(encodeURIComponent(value)));
  return `=?utf-8?B?${encoded}?=`;
}

/** Common MIME type mappings keyed by file extension. */
const MIME_TYPES: Record<string, string> = {
  txt: "text/plain",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  xml: "application/xml",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  zip: "application/zip",
  csv: "text/csv",
  md: "text/markdown",
};

/**
 * Returns the MIME type for a given filename based on its extension.
 * Falls back to `application/octet-stream` when the extension is unknown.
 *
 * @param filename - File name (with extension).
 * @returns MIME type string.
 */
function guessMimetype(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[ext] ?? "application/octet-stream";
}
