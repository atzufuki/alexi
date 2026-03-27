/**
 * Core email sending API for Alexi.
 *
 * Provides high-level helpers ({@link sendMail}, {@link sendMassMail},
 * {@link mailAdmins}, {@link mailManagers}) and the low-level
 * {@link getConnection} factory — mirroring `django.core.mail`.
 *
 * @module alexi_mail/mail
 */

import { BaseEmailBackend } from "./backends/base.ts";
import { EmailMessage, EmailMultiAlternatives } from "./message.ts";

// =============================================================================
// Backend registry
// =============================================================================

// =============================================================================
// getConnection
// =============================================================================

/**
 * Returns an instance of an email backend.
 *
 * When `backend` is omitted, the value of the `EMAIL_BACKEND` setting is
 * used (defaulting to `"smtp"`). Pass a backend key (`"smtp"`, `"console"`,
 * `"file"`, `"memory"`, `"dummy"`) or a fully-qualified module specifier
 * to load a custom backend.
 *
 * Extra keyword arguments are forwarded to the backend constructor.
 *
 * @param backend - Backend key or module specifier.
 * @param failSilently - Whether the backend should suppress send errors.
 * @param options - Additional options forwarded to the backend constructor.
 * @returns An instantiated {@link BaseEmailBackend}.
 *
 * @example Get the default connection
 * ```ts
 * import { getConnection } from "@alexi/mail";
 *
 * const conn = getConnection();
 * await conn.sendMessages([msg1, msg2]);
 * await conn.close();
 * ```
 *
 * @category Connection
 */
export function getConnection(
  backend?: string,
  failSilently = false,
  options: Record<string, unknown> = {},
): BaseEmailBackend {
  const key = backend ?? _getSetting("EMAIL_BACKEND", "smtp");
  return _instantiateBackend(key, failSilently, options);
}

// Synchronous backend instantiation cache to avoid async in getConnection.
// Backends are instantiated lazily; first call per key loads the module.
const _backendCache = new Map<
  string,
  new (...args: any[]) => BaseEmailBackend
>();

function _instantiateBackend(
  key: string,
  failSilently: boolean,
  options: Record<string, unknown>,
): BaseEmailBackend {
  if (_backendCache.has(key)) {
    const Cls = _backendCache.get(key)!;
    return new Cls({ failSilently, ...options });
  }

  // Resolve synchronously-registered backends via the BACKEND_MAP.
  // For built-in backends we do a sync require-style trick: we pre-register
  // classes via registerBackend() which is called in each backend module.
  // If the class hasn't been registered yet we throw a helpful error.
  throw new Error(
    `Email backend "${key}" is not registered. ` +
      `Import the backend module before calling getConnection(), or call ` +
      `registerBackend("${key}", YourBackendClass).`,
  );
}

/**
 * Registers an email backend class under the given key so that
 * {@link getConnection} can instantiate it synchronously.
 *
 * Built-in backends register themselves automatically when their module is
 * imported. You only need to call this for custom backends.
 *
 * @param key - Unique backend identifier.
 * @param cls - Backend class (must extend {@link BaseEmailBackend}).
 *
 * @example Register a custom backend
 * ```ts
 * import { registerBackend } from "@alexi/mail";
 * import { MyBackend } from "./my_backend.ts";
 *
 * registerBackend("mybackend", MyBackend);
 * ```
 *
 * @category Connection
 */
export function registerBackend(
  key: string,
  cls: new (...args: any[]) => BaseEmailBackend,
): void {
  _backendCache.set(key, cls);
}

// =============================================================================
// sendMail
// =============================================================================

/**
 * Convenience wrapper for sending a single email.
 *
 * Opens a new connection each time (use {@link sendMassMail} or
 * {@link getConnection} for batch sends).
 *
 * @param subject - Email subject.
 * @param message - Plain-text message body.
 * @param fromEmail - Sender address. Uses `DEFAULT_FROM_EMAIL` when `null`.
 * @param recipientList - List of recipient addresses.
 * @param options.failSilently - Suppress send errors.
 * @param options.authUser - Override `EMAIL_HOST_USER`.
 * @param options.authPassword - Override `EMAIL_HOST_PASSWORD`.
 * @param options.connection - Reuse an existing backend connection.
 * @param options.htmlMessage - If provided, sends a `multipart/alternative`
 *   email with `message` as the plain-text part and `htmlMessage` as
 *   the `text/html` part.
 * @returns `1` on success, `0` on failure (when `failSilently` is `true`).
 *
 * @example Send a plain-text email
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
 * @example Send a plain-text + HTML email
 * ```ts
 * await sendMail(
 *   "Hello",
 *   "Plain text version.",
 *   "from@example.com",
 *   ["to@example.com"],
 *   { htmlMessage: "<p>HTML version.</p>" },
 * );
 * ```
 *
 * @category Sending
 */
export async function sendMail(
  subject: string,
  message: string,
  fromEmail: string | null,
  recipientList: string[],
  options: {
    failSilently?: boolean;
    authUser?: string;
    authPassword?: string;
    connection?: BaseEmailBackend;
    htmlMessage?: string;
  } = {},
): Promise<number> {
  const {
    failSilently = false,
    connection,
    htmlMessage,
    authUser,
    authPassword,
  } = options;

  const connOptions: Record<string, unknown> = {};
  if (authUser !== undefined) connOptions.username = authUser;
  if (authPassword !== undefined) connOptions.password = authPassword;

  const conn = connection ??
    getConnection(undefined, failSilently, connOptions);

  const resolvedFrom = fromEmail ??
    _getSetting("DEFAULT_FROM_EMAIL", "webmaster@localhost");

  let email: EmailMessage;

  if (htmlMessage != null) {
    const multi = new EmailMultiAlternatives({
      subject,
      body: message,
      fromEmail: resolvedFrom,
      to: recipientList,
    });
    multi.attachAlternative(htmlMessage, "text/html");
    email = multi;
  } else {
    email = new EmailMessage({
      subject,
      body: message,
      fromEmail: resolvedFrom,
      to: recipientList,
    });
  }

  email.connection = conn;
  return email.send(failSilently);
}

// =============================================================================
// sendMassMail
// =============================================================================

/**
 * A tuple describing a single email for use with {@link sendMassMail}.
 *
 * @category Sending
 */
export type MailTuple = [
  subject: string,
  message: string,
  fromEmail: string,
  recipientList: string[],
];

/**
 * Sends multiple emails using a **single** backend connection.
 *
 * More efficient than calling {@link sendMail} in a loop because the
 * connection (e.g. SMTP session) is established only once.
 *
 * @param dataTuple - Array of {@link MailTuple} values.
 * @param options.failSilently - Suppress send errors.
 * @param options.authUser - Override `EMAIL_HOST_USER`.
 * @param options.authPassword - Override `EMAIL_HOST_PASSWORD`.
 * @param options.connection - Reuse an existing backend connection.
 * @returns Total number of successfully delivered messages.
 *
 * @example
 * ```ts
 * import { sendMassMail } from "@alexi/mail";
 *
 * await sendMassMail([
 *   ["Subject 1", "Body 1", "from@example.com", ["alice@example.com"]],
 *   ["Subject 2", "Body 2", "from@example.com", ["bob@example.com"]],
 * ]);
 * ```
 *
 * @category Sending
 */
export async function sendMassMail(
  dataTuple: MailTuple[],
  options: {
    failSilently?: boolean;
    authUser?: string;
    authPassword?: string;
    connection?: BaseEmailBackend;
  } = {},
): Promise<number> {
  const { failSilently = false, connection, authUser, authPassword } = options;

  const connOptions: Record<string, unknown> = {};
  if (authUser !== undefined) connOptions.username = authUser;
  if (authPassword !== undefined) connOptions.password = authPassword;

  const conn = connection ??
    getConnection(undefined, failSilently, connOptions);

  const messages = dataTuple.map(([subject, message, fromEmail, recipients]) =>
    new EmailMessage({ subject, body: message, fromEmail, to: recipients })
  );

  return conn.sendMessages(messages);
}

// =============================================================================
// mailAdmins / mailManagers
// =============================================================================

/**
 * Sends an email to all addresses listed in the `ADMINS` setting.
 *
 * The subject is prefixed with `EMAIL_SUBJECT_PREFIX` and the From address
 * is taken from `SERVER_EMAIL`.
 *
 * @param subject - Email subject (will be prefixed).
 * @param message - Plain-text message body.
 * @param options.failSilently - Suppress send errors.
 * @param options.connection - Reuse an existing backend connection.
 * @param options.htmlMessage - Optional HTML alternative body.
 *
 * @example
 * ```ts
 * import { mailAdmins } from "@alexi/mail";
 *
 * await mailAdmins("Server error", "500 on /api/users/");
 * ```
 *
 * @category Sending
 */
export async function mailAdmins(
  subject: string,
  message: string,
  options: {
    failSilently?: boolean;
    connection?: BaseEmailBackend;
    htmlMessage?: string;
  } = {},
): Promise<void> {
  const admins: Array<[string, string]> = _getSetting("ADMINS", []);
  if (!admins.length) return;
  const recipients = admins.map(([, email]) => email);
  const prefix: string = _getSetting("EMAIL_SUBJECT_PREFIX", "[Alexi] ");
  const serverEmail: string = _getSetting("SERVER_EMAIL", "root@localhost");
  await sendMail(prefix + subject, message, serverEmail, recipients, options);
}

/**
 * Sends an email to all addresses listed in the `MANAGERS` setting.
 *
 * The subject is prefixed with `EMAIL_SUBJECT_PREFIX` and the From address
 * is taken from `SERVER_EMAIL`.
 *
 * @param subject - Email subject (will be prefixed).
 * @param message - Plain-text message body.
 * @param options.failSilently - Suppress send errors.
 * @param options.connection - Reuse an existing backend connection.
 * @param options.htmlMessage - Optional HTML alternative body.
 *
 * @example
 * ```ts
 * import { mailManagers } from "@alexi/mail";
 *
 * await mailManagers("New signup", "User john@example.com signed up.");
 * ```
 *
 * @category Sending
 */
export async function mailManagers(
  subject: string,
  message: string,
  options: {
    failSilently?: boolean;
    connection?: BaseEmailBackend;
    htmlMessage?: string;
  } = {},
): Promise<void> {
  const managers: Array<[string, string]> = _getSetting("MANAGERS", []);
  if (!managers.length) return;
  const recipients = managers.map(([, email]) => email);
  const prefix: string = _getSetting("EMAIL_SUBJECT_PREFIX", "[Alexi] ");
  const serverEmail: string = _getSetting("SERVER_EMAIL", "root@localhost");
  await sendMail(prefix + subject, message, serverEmail, recipients, options);
}

// =============================================================================
// Settings helper
// =============================================================================

/** Module-level mail settings store, populated by configureMailSettings(). */
// deno-lint-ignore no-explicit-any
let _mailSettings: Record<string, any> | null = null;

/**
 * Configure the mail settings store.
 *
 * This is called automatically by `getHttpApplication()` and
 * `getWorkerApplication()` — you do not normally need to call it directly.
 *
 * Calling it replaces any previously configured settings. Pass `null` to
 * reset (useful in tests).
 *
 * @param settings - An object whose keys are mail-related settings constants
 *   (e.g. `EMAIL_BACKEND`, `EMAIL_HOST`, `DEFAULT_FROM_EMAIL`, …).
 *
 * @example
 * ```ts
 * import { configureMailSettings } from "@alexi/mail";
 *
 * configureMailSettings({
 *   EMAIL_BACKEND: "smtp",
 *   EMAIL_HOST: "smtp.example.com",
 *   EMAIL_PORT: 587,
 *   EMAIL_HOST_USER: "user@example.com",
 *   EMAIL_HOST_PASSWORD: "secret",
 *   EMAIL_USE_TLS: true,
 * });
 * ```
 *
 * @category Configuration
 */
// deno-lint-ignore no-explicit-any
export function configureMailSettings(
  settings: Record<string, any> | null,
): void {
  _mailSettings = settings;
  // Also write to globalThis.__alexiMailSettings so that modules that cannot
  // import from mail.ts (e.g. message.ts, which mail.ts imports from) can
  // still access the configured settings synchronously.
  // deno-lint-ignore no-explicit-any
  (globalThis as any).__alexiMailSettings = settings;
}

/**
 * Reads a value from the mail settings store, falling back to
 * `globalThis.__alexiSettings` (legacy) and then to `defaultValue`.
 *
 * Exported so that mail backend modules can share the same settings store
 * without duplicating the lookup logic.
 *
 * @param key - Settings key.
 * @param defaultValue - Fallback value.
 * @returns The setting value or `defaultValue`.
 *
 * @internal
 */
export function getMailSetting<T>(key: string, defaultValue: T): T {
  // 1. Prefer the framework-configured settings store
  if (_mailSettings !== null && key in _mailSettings) {
    return _mailSettings[key] as T;
  }
  // 2. Legacy fallback: globalThis.__alexiSettings (manual user assignment)
  try {
    // deno-lint-ignore no-explicit-any
    const legacy = (globalThis as any).__alexiSettings;
    if (legacy && key in legacy) return legacy[key] as T;
  } catch {
    // ignore
  }
  return defaultValue;
}

// Internal alias used within this module
const _getSetting = getMailSetting;
