/**
 * Alexi's Django-style email sending support.
 *
 * `@alexi/mail` provides a complete email API mirroring `django.core.mail`:
 * high-level helpers ({@link sendMail}, {@link sendMassMail},
 * {@link mailAdmins}, {@link mailManagers}), full-featured message classes
 * ({@link EmailMessage}, {@link EmailMultiAlternatives}), and a pluggable
 * backend system ({@link BaseEmailBackend}).
 *
 * ## Quick start
 *
 * ```ts
 * import { sendMail } from "@alexi/mail";
 *
 * await sendMail(
 *   "Hello",
 *   "World",
 *   "from@example.com",
 *   ["to@example.com"],
 * );
 * ```
 *
 * ## Backends
 *
 * | Key        | Class                   | Use case                        |
 * |------------|-------------------------|---------------------------------|
 * | `"smtp"`   | `SmtpEmailBackend`      | Production (default)            |
 * | `"console"`| `ConsoleEmailBackend`   | Development — logs to stdout    |
 * | `"file"`   | `FileEmailBackend`      | Development — writes .eml files |
 * | `"memory"` | `MemoryEmailBackend`    | Testing — in-memory outbox      |
 * | `"dummy"`  | `DummyEmailBackend`     | Development — discards all mail |
 *
 * The active backend is selected by the `EMAIL_BACKEND` setting (default:
 * `"smtp"`). Import the backend module to auto-register it, then call
 * {@link getConnection}:
 *
 * ```ts
 * // settings.ts
 * export const EMAIL_BACKEND = "console";
 *
 * // app startup (import triggers registration)
 * import "@alexi/mail/backends/console";
 * ```
 *
 * ## Multipart email (text + HTML)
 *
 * ```ts
 * import { EmailMultiAlternatives } from "@alexi/mail";
 *
 * const msg = new EmailMultiAlternatives({
 *   subject: "Welcome!",
 *   body: "Plain text version.",
 *   fromEmail: "noreply@example.com",
 *   to: ["user@example.com"],
 * });
 * msg.attachAlternative("<p>HTML version.</p>", "text/html");
 * await msg.send();
 * ```
 *
 * ## Testing
 *
 * ```ts
 * import "@alexi/mail/backends/memory";
 * import { outbox } from "@alexi/mail/backends/memory";
 * import { sendMail } from "@alexi/mail";
 * import { assertEquals } from "@std/assert";
 *
 * outbox.length = 0;
 * await sendMail("Hi", "Hello", null, ["to@example.com"]);
 * assertEquals(outbox.length, 1);
 * assertEquals(outbox[0].subject, "Hi");
 * ```
 *
 * @module @alexi/mail
 */

// Messages
export {
  BadHeaderError,
  buildMimeMessage,
  EmailMessage,
  EmailMultiAlternatives,
} from "./message.ts";
export type {
  EmailAlternative,
  EmailAttachment,
  EmailMessageOptions,
} from "./message.ts";

// Backend base
export { BaseEmailBackend } from "./backends/base.ts";

// Core API
export {
  getConnection,
  mailAdmins,
  mailManagers,
  registerBackend,
  sendMail,
  sendMassMail,
} from "./mail.ts";
export type { MailTuple } from "./mail.ts";
