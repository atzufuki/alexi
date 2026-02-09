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

import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";
import { setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";

// =============================================================================
// Types
// =============================================================================

/**
 * Interface for the UserModel class
 * Projects must export a UserModel that conforms to this interface
 */
interface UserModelInterface {
  // deno-lint-ignore no-explicit-any
  objects: {
    filter(criteria: Record<string, unknown>): { first(): Promise<unknown> };
    create(data: Record<string, unknown>): Promise<{ id: { get(): unknown } }>;
  };
}

/**
 * Interface for user creation data
 * Projects can extend this with additional fields
 */
interface UserCreateData {
  email: string;
  passwordHash: string;
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
    const databasePath = options.args.database as string | undefined;
    const settingsName = options.args.settings as string | undefined;

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
    const authUserModelPath = settings.AUTH_USER_MODEL as string | undefined;
    if (!authUserModelPath) {
      this.error("AUTH_USER_MODEL is not defined in settings.");
      this.info("");
      this.info("Add the following to your settings file:");
      this.info(
        '  export const AUTH_USER_MODEL = "./src/my-app/models/user.ts";',
      );
      this.info("");
      this.info("The module must export:");
      this.info(
        "  - UserModel: A Model class with email, passwordHash, isAdmin, isActive fields",
      );
      this.info("  - hashPassword: async function to hash passwords");
      return failure("AUTH_USER_MODEL not configured");
    }

    // Load user model and hashPassword function
    const { UserModel, hashPassword } = await this.loadUserModel(
      authUserModelPath,
    );
    if (!UserModel || !hashPassword) {
      return failure("Failed to load user model");
    }

    // Initialize database
    const kvPath = databasePath ??
      (settings.DATABASE as { path?: string })?.path ??
      Deno.env.get("DENO_KV_PATH");
    const backend = new DenoKVBackend({ name: "default", path: kvPath });
    await backend.connect();
    setup({ backend });

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
      const passwordHash = await hashPassword(password);

      const userData: UserCreateData = {
        email,
        passwordHash,
        firstName: firstName || "",
        lastName: lastName || "",
        isAdmin: true,
        isActive: true,
      };

      // Add extra fields from settings if defined
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
      await backend.disconnect();
    }
  }

  // ===========================================================================
  // Settings and Model Loading
  // ===========================================================================

  /**
   * Load project settings
   */
  private async loadSettings(
    settingsName: string,
  ): Promise<Record<string, unknown> | null> {
    const projectDir = Deno.cwd();
    const settingsPath = `${projectDir}/project/${settingsName}.settings.ts`;

    try {
      const settingsUrl = this.pathToFileUrl(settingsPath);
      const settings = await import(settingsUrl);
      return settings;
    } catch (error) {
      this.error(`Failed to load settings from: ${settingsPath}`);
      this.error(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Load UserModel and hashPassword from the configured module
   */
  private async loadUserModel(
    modulePath: string,
  ): Promise<
    {
      UserModel: UserModelInterface | null;
      hashPassword: HashPasswordFn | null;
    }
  > {
    const projectDir = Deno.cwd();

    // Resolve relative path
    let fullPath = modulePath;
    if (modulePath.startsWith("./") || modulePath.startsWith("../")) {
      fullPath = `${projectDir}/${modulePath}`;
    }

    try {
      const moduleUrl = this.pathToFileUrl(fullPath);
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

  /**
   * Convert a file path to a file:// URL
   * Handles Windows and Unix paths
   */
  private pathToFileUrl(path: string): string {
    // Already a URL
    if (path.startsWith("file://")) {
      return path;
    }

    // Normalize path separators
    const normalized = path.replace(/\\/g, "/");

    // Windows absolute path (C:/...)
    if (/^[A-Za-z]:\//.test(normalized)) {
      return `file:///${normalized}`;
    }

    // Unix absolute path
    if (normalized.startsWith("/")) {
      return `file://${normalized}`;
    }

    // Relative path - make absolute
    const cwd = Deno.cwd().replace(/\\/g, "/");
    const absolute = `${cwd}/${normalized}`;

    if (/^[A-Za-z]:\//.test(absolute)) {
      return `file:///${absolute}`;
    }

    return `file://${absolute}`;
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
