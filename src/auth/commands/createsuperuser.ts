/**
 * Create Superuser Command for Alexi Auth
 *
 * Django-style command that creates a superuser (admin) account.
 * Similar to Django's `manage.py createsuperuser` command.
 *
 * Requires AUTH_USER_MODEL setting in project settings that points to
 * a module exporting UserModel and hashPassword.
 *
 * @module @alexi/auth/commands/createsuperuser
 */

import { setup } from "@alexi/core";
import type { DatabasesConfig } from "@alexi/core";
import {
  BaseCommand,
  failure,
  resolveSettingsPath,
  success,
  toImportUrl,
} from "@alexi/core/management";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core/management";

// =============================================================================
// Types
// =============================================================================

/**
 * Interface for the UserModel class.
 *
 * Supports both the new `AbstractUser`-based pattern (static `hashPassword`)
 * and the legacy pattern (standalone `hashPassword` export in the module).
 */
interface UserModelInterface {
  // deno-lint-ignore no-explicit-any
  objects: {
    filter(criteria: Record<string, unknown>): { first(): Promise<unknown> };
    create(data: Record<string, unknown>): Promise<{ id: { get(): unknown } }>;
  };
  /** Available when AUTH_USER_MODEL is an AbstractUser subclass. */
  hashPassword?: (password: string) => Promise<string>;
  /**
   * Extra fields the command must prompt for / accept as CLI arguments.
   * Mirrors Django's `AbstractBaseUser.REQUIRED_FIELDS`.
   */
  REQUIRED_FIELDS?: string[];
}

/**
 * Interface for user creation data
 * Projects can extend this with additional fields
 */
interface UserCreateData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
  isActive: boolean;
  [key: string]: unknown;
}

/**
 * Function signature for password hashing
 */
type HashPasswordFn = (password: string) => Promise<string>;

// =============================================================================
// CreateSuperuserCommand Class
// =============================================================================

/**
 * Built-in command for creating a superuser (admin) account
 *
 * Creates a new user with admin privileges that can access the admin panel.
 *
 * Requires the following settings in project settings.ts:
 * - AUTH_USER_MODEL: Path to module exporting UserModel and hashPassword
 *
 * @example Project settings.ts
 * ```typescript
 * export const AUTH_USER_MODEL = "./src/my-app/models/user.ts";
 * ```
 *
 * @example User model module
 * ```typescript
 * // ./src/my-app/models/user.ts
 * export class UserModel extends Model {
 *   id = new AutoField({ primaryKey: true });
 *   email = new CharField({ maxLength: 200 });
 *   passwordHash = new CharField({ maxLength: 500 });
 *   firstName = new CharField({ maxLength: 100 });
 *   lastName = new CharField({ maxLength: 100 });
 *   isAdmin = new BooleanField({ default: false });
 *   isActive = new BooleanField({ default: true });
 *   static objects = new Manager(UserModel);
 * }
 *
 * export async function hashPassword(password: string): Promise<string> {
 *   // Your password hashing implementation
 * }
 * ```
 *
 * @example Interactive usage
 * ```bash
 * deno run -A --unstable-kv manage.ts createsuperuser --settings web
 * ```
 *
 * @example Non-interactive usage
 * ```bash
 * deno run -A --unstable-kv manage.ts createsuperuser --settings web \
 *   --email admin@example.com \
 *   --password secretpassword \
 *   --first-name Admin \
 *   --last-name User
 * ```
 *
 * @example With extra REQUIRED_FIELDS
 * ```bash
 * # UserModel has REQUIRED_FIELDS = ["status"]
 * # Interactive — prompts for "status":
 * deno run -A --unstable-kv manage.ts createsuperuser --settings web
 *
 * # Non-interactive — supply via CLI or environment variable:
 * deno run -A --unstable-kv manage.ts createsuperuser --settings web \
 *   --no-input \
 *   --email admin@example.com \
 *   --password secret \
 *   --status active
 * # OR via env: ALEXI_SUPERUSER_STATUS=active
 * ```
 */
export class CreateSuperuserCommand extends BaseCommand {
  readonly name = "createsuperuser";
  readonly help = "Create superuser (admin) account";
  override readonly description =
    "Creates a new user account with admin privileges (isAdmin: true). " +
    "This user can be used to log in to the admin panel at /admin/. " +
    "Requires AUTH_USER_MODEL setting in project settings.";

  override readonly examples = [
    "manage.ts createsuperuser --settings web                    - Interactive creation",
    "manage.ts createsuperuser --settings web --email admin@example.com - Specify email",
    "manage.ts createsuperuser --settings web --no-input --email admin@example.com --password secret",
  ];

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("--email", {
      type: "string",
      required: false,
      help: "User's email address",
    });

    parser.addArgument("--password", {
      type: "string",
      required: false,
      help: "User's password (at least 8 characters)",
    });

    parser.addArgument("--first-name", {
      type: "string",
      required: false,
      help: "User's first name",
    });

    parser.addArgument("--last-name", {
      type: "string",
      required: false,
      help: "User's last name",
    });

    parser.addArgument("--no-input", {
      type: "boolean",
      default: false,
      help: "Do not prompt for missing information interactively",
    });

    parser.addArgument("--database", {
      type: "string",
      required: false,
      help:
        "Database path (DenoKV). Defaults to DENO_KV_PATH or default location.",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const noInput = options.args["no-input"] as boolean;
    const settingsName = (options.args.settings as string | undefined) ??
      Deno.env.get("ALEXI_SETTINGS_MODULE");

    this.stdout.log("");
    this.stdout.log("┌─────────────────────────────────────────────┐");
    this.stdout.log("│         Create Superuser (Admin)            │");
    this.stdout.log("└─────────────────────────────────────────────┘");
    this.stdout.log("");

    // Load settings
    if (!settingsName) {
      this.error("--settings is required (e.g., --settings web)");
      this.info("The settings module must export AUTH_USER_MODEL.");
      return failure("Settings not specified");
    }

    const settings = await this.loadSettings(settingsName);
    if (!settings) {
      return failure("Failed to load settings");
    }

    // Check for AUTH_USER_MODEL
    const authUserModel = settings.AUTH_USER_MODEL;
    if (!authUserModel) {
      this.error("AUTH_USER_MODEL is not defined in settings.");
      this.info("");
      this.info("Add the following to your settings file:");
      this.info("  import { UserModel } from '@my-app/models';");
      this.info("  export const AUTH_USER_MODEL = UserModel;");
      this.info("");
      this.info(
        "  UserModel must extend AbstractUser from @alexi/auth or provide",
      );
      this.info(
        "  a static hashPassword(password) method and the required fields.",
      );
      return failure("AUTH_USER_MODEL not configured");
    }

    // Load user model and hashPassword function
    const { UserModel, hashPassword } = await this.loadUserModel(authUserModel);
    if (!UserModel || !hashPassword) {
      return failure("Failed to load user model");
    }

    // Initialize database from settings DATABASES
    const databases = settings.DATABASES as DatabasesConfig | undefined;
    if (!databases) {
      this.error(
        "DATABASES is not defined in settings. Cannot initialize database.",
      );
      this.info("Add a DATABASES dict to your settings file, e.g.:");
      this.info(
        '  import { DenoKVBackend } from "@alexi/db/backends/denokv";',
      );
      this.info(
        '  export const DATABASES = { default: new DenoKVBackend({ name: "myapp" }) };',
      );
      return failure("DATABASES not configured");
    }
    await this.runSetup({ DATABASES: databases });

    try {
      // Get user details
      const email = await this.getEmail(
        options.args.email as string | undefined,
        noInput,
      );
      if (!email) {
        return failure("Email address is required");
      }

      // Check if user already exists
      const existingUser = await UserModel.objects.filter({ email }).first();
      if (existingUser) {
        this.error(`User with email "${email}" already exists.`);
        return failure("User already exists");
      }

      const password = await this.getPassword(
        options.args.password as string | undefined,
        noInput,
      );
      if (!password) {
        return failure("Password is required");
      }

      if (password.length < 8) {
        this.error("Password must be at least 8 characters long.");
        return failure("Password too short");
      }

      const firstName = await this.getFirstName(
        options.args["first-name"] as string | undefined,
        noInput,
      );

      const lastName = await this.getLastName(
        options.args["last-name"] as string | undefined,
        noInput,
      );

      // Create the superuser
      const hashedPassword = await hashPassword(password);

      const userData: UserCreateData = {
        email,
        password: hashedPassword,
        firstName: firstName || "",
        lastName: lastName || "",
        isAdmin: true,
        isActive: true,
      };

      // Collect values for REQUIRED_FIELDS defined on the model (Django parity).
      // Each field is read from:
      //   1. --<field-name> CLI argument, or
      //   2. ALEXI_SUPERUSER_<FIELD_NAME> environment variable, or
      //   3. interactive prompt (when not --no-input).
      const requiredFields: string[] =
        (UserModel as unknown as { REQUIRED_FIELDS?: string[] })
          .REQUIRED_FIELDS ?? [];

      for (const fieldName of requiredFields) {
        const cliKey = fieldName.replace(
          /([A-Z])/g,
          (m) => `-${m.toLowerCase()}`,
        );
        const envKey = `ALEXI_SUPERUSER_${fieldName.toUpperCase()}`;

        let value: string | undefined =
          (options.args[cliKey] as string | undefined) ??
            (options.args[fieldName] as string | undefined) ??
            Deno.env.get(envKey);

        if (!value) {
          if (noInput) {
            this.error(
              `--${cliKey} is required when using --no-input (or set ${envKey}).`,
            );
            return failure(`Missing required field: ${fieldName}`);
          }
          const prompted = prompt(`${fieldName}:`);
          if (!prompted || prompted.trim() === "") {
            this.error(`${fieldName} is required.`);
            return failure(`Missing required field: ${fieldName}`);
          }
          value = prompted.trim();
        }

        userData[fieldName] = value;
      }

      // Legacy escape hatch — still supported for backwards compatibility.
      // Prefer REQUIRED_FIELDS on the model instead.
      const extraFields = settings.AUTH_USER_EXTRA_FIELDS as
        | Record<string, unknown>
        | undefined;
      if (extraFields) {
        Object.assign(userData, extraFields);
      }

      const user = await UserModel.objects.create(userData);

      this.stdout.log("");
      this.success("Superuser account created successfully!");
      this.stdout.log("");
      this.stdout.log("  Details:");
      this.stdout.log(`    ID:           ${user.id.get()}`);
      this.stdout.log(`    Email:        ${email}`);
      this.stdout.log(
        `    Name:         ${firstName || "-"} ${lastName || "-"}`,
      );
      this.stdout.log(`    Admin:        Yes`);
      this.stdout.log("");
      this.stdout.log("  You can now log in to the admin panel at:");
      this.stdout.log("    http://localhost:8000/admin/");
      this.stdout.log("");

      return success();
    } catch (error) {
      this.error(
        `User creation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return failure("User creation failed");
    } finally {
      // Backends are managed by the DATABASES registry; no explicit disconnect needed here.
    }
  }

  // ===========================================================================
  // Settings and Model Loading
  // ===========================================================================

  /**
   * Initialize the database backends from settings.
   *
   * Extracted as a protected method so tests can override it without a real
   * database connection.
   *
   * @param config - The databases configuration to pass to `setup()`.
   */
  protected async runSetup(
    config: { DATABASES: DatabasesConfig },
  ): Promise<void> {
    await setup(config);
  }

  /**
   * Load project settings.
   *
   * Accepts the same argument formats as other management commands:
   * - Short name:    "web"                  → <cwd>/project/web.settings.ts
   * - Dotted module: "project.web"          → <cwd>/project/web.ts
   * - Relative path: "./project/settings.ts" → <cwd>/project/settings.ts
   * - Absolute path: "/home/user/settings.ts"
   */
  private async loadSettings(
    settingsName: string,
  ): Promise<Record<string, unknown> | null> {
    const settingsPath = resolveSettingsPath(settingsName);

    try {
      const settingsUrl = toImportUrl(settingsPath);
      const settings = await import(settingsUrl);
      return settings;
    } catch (error) {
      this.error(`Failed to load settings from: ${settingsPath}`);
      this.error(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Load UserModel and hashPassword from AUTH_USER_MODEL.
   *
   * Accepts either:
   * - A model class directly (new pattern — AbstractUser subclass with static hashPassword)
   * - A legacy file path string (old pattern — module must export UserModel + hashPassword)
   */
  private async loadUserModel(
    authUserModel: unknown,
  ): Promise<
    {
      UserModel: UserModelInterface | null;
      hashPassword: HashPasswordFn | null;
    }
  > {
    // New pattern: model class passed directly
    if (typeof authUserModel === "function") {
      const UserModel = authUserModel as unknown as UserModelInterface;
      const hashPassword = (authUserModel as { hashPassword?: HashPasswordFn })
        .hashPassword;

      if (!hashPassword) {
        this.error(
          "AUTH_USER_MODEL class does not have a static hashPassword() method.",
        );
        this.info(
          "Make sure your UserModel extends AbstractUser from @alexi/auth.",
        );
        return { UserModel: null, hashPassword: null };
      }

      return { UserModel, hashPassword: hashPassword.bind(authUserModel) };
    }

    // Legacy pattern: file path string — dynamic import
    if (typeof authUserModel !== "string") {
      this.error(
        "AUTH_USER_MODEL must be a model class or a file path string.",
      );
      return { UserModel: null, hashPassword: null };
    }

    const modulePath = authUserModel;
    const projectDir = Deno.cwd();

    // Resolve relative path
    let fullPath = modulePath;
    if (modulePath.startsWith("./") || modulePath.startsWith("../")) {
      fullPath = `${projectDir}/${modulePath}`;
    }

    try {
      const moduleUrl = toImportUrl(fullPath);
      const module = await import(moduleUrl);

      const UserModel = module.UserModel as UserModelInterface | undefined;
      const hashPassword = module.hashPassword as HashPasswordFn | undefined;

      if (!UserModel) {
        this.error("UserModel not found in AUTH_USER_MODEL module.");
        this.info("The module must export a UserModel class.");
        return { UserModel: null, hashPassword: null };
      }

      if (!hashPassword) {
        this.error(
          "hashPassword function not found in AUTH_USER_MODEL module.",
        );
        this.info(
          "The module must export an async hashPassword(password: string) function.",
        );
        return { UserModel: null, hashPassword: null };
      }

      if (typeof hashPassword !== "function") {
        this.error("hashPassword must be a function.");
        return { UserModel: null, hashPassword: null };
      }

      return { UserModel, hashPassword };
    } catch (error) {
      this.error(`Failed to load user model from: ${modulePath}`);
      this.error(error instanceof Error ? error.message : String(error));
      return { UserModel: null, hashPassword: null };
    }
  }

  // ===========================================================================
  // Interactive Input Helpers
  // ===========================================================================

  /**
   * Get email from args or prompt
   */
  private async getEmail(
    argValue: string | undefined,
    noInput: boolean,
  ): Promise<string | null> {
    if (argValue) {
      return argValue;
    }

    if (noInput) {
      this.error("--email is required when using --no-input");
      return null;
    }

    const email = prompt("Email:");
    if (!email || email.trim() === "") {
      this.error("Email address is required");
      return null;
    }

    // Basic email validation
    if (!email.includes("@") || !email.includes(".")) {
      this.error("Invalid email address");
      return null;
    }

    return email.trim();
  }

  /**
   * Get password from args or prompt
   */
  private async getPassword(
    argValue: string | undefined,
    noInput: boolean,
  ): Promise<string | null> {
    if (argValue) {
      return argValue;
    }

    if (noInput) {
      this.error("--password is required when using --no-input");
      return null;
    }

    // Note: prompt() doesn't hide input, but it's the simplest cross-platform solution
    const password = prompt("Password (at least 8 characters):");
    if (!password || password.trim() === "") {
      this.error("Password is required");
      return null;
    }

    // Confirm password
    const confirmPassword = prompt("Confirm password:");
    if (password !== confirmPassword) {
      this.error("Passwords do not match");
      return null;
    }

    return password;
  }

  /**
   * Get first name from args or prompt
   */
  private async getFirstName(
    argValue: string | undefined,
    noInput: boolean,
  ): Promise<string> {
    if (argValue) {
      return argValue;
    }

    if (noInput) {
      return "";
    }

    const firstName = prompt("First name (optional):");
    return firstName?.trim() || "";
  }

  /**
   * Get last name from args or prompt
   */
  private async getLastName(
    argValue: string | undefined,
    noInput: boolean,
  ): Promise<string> {
    if (argValue) {
      return argValue;
    }

    if (noInput) {
      return "";
    }

    const lastName = prompt("Last name (optional):");
    return lastName?.trim() || "";
  }
}
