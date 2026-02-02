/**
 * Create Superuser Command for Alexi Auth
 *
 * Django-style command that creates a superuser (admin) account.
 * Similar to Django's `manage.py createsuperuser` command.
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
import { hashPassword, UserModel } from "@comachine-web/models";

// =============================================================================
// CreateSuperuserCommand Class
// =============================================================================

/**
 * Built-in command for creating a superuser (admin) account
 *
 * Creates a new user with admin privileges that can access the admin panel.
 *
 * @example Interactive usage
 * ```bash
 * deno run -A --unstable-kv manage.ts createsuperuser
 * ```
 *
 * @example Non-interactive usage
 * ```bash
 * deno run -A --unstable-kv manage.ts createsuperuser \
 *   --email admin@example.com \
 *   --password secretpassword \
 *   --first-name Admin \
 *   --last-name User
 * ```
 */
export class CreateSuperuserCommand extends BaseCommand {
  readonly name = "createsuperuser";
  readonly help = "Create superuser (admin) account";
  readonly description =
    "Creates a new user account with admin privileges (isAdmin: true). " +
    "This user can be used to log in to the admin panel at /admin/.";

  readonly examples = [
    "manage.ts createsuperuser                           - Interactive creation",
    "manage.ts createsuperuser --email admin@example.com - Specify email",
    "manage.ts createsuperuser --no-input --email admin@example.com --password secret",
  ];

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  addArguments(parser: IArgumentParser): void {
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

    this.stdout.log("");
    this.stdout.log("┌─────────────────────────────────────────────┐");
    this.stdout.log("│         Create Superuser (Admin)            │");
    this.stdout.log("└─────────────────────────────────────────────┘");
    this.stdout.log("");

    // Initialize database
    const kvPath = databasePath ?? Deno.env.get("DENO_KV_PATH");
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

      const user = await UserModel.objects.create({
        email,
        passwordHash,
        firstName: firstName || "",
        lastName: lastName || "",
        isAdmin: true,
        isActive: true,
        subscriptionPlan: "premium",
        allowedUnits: 100,
      });

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
