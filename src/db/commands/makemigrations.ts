/**
 * Makemigrations Command
 *
 * Generate migration templates based on model changes.
 *
 * @module @alexi/db/commands/makemigrations
 */

import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";

// =============================================================================
// MakemigrationsCommand Class
// =============================================================================

/**
 * Generate migration templates
 *
 * Creates a new migration file with detected changes as comments.
 * The developer then fills in the forwards() and backwards() implementations.
 *
 * @example Create a new migration
 * ```bash
 * deno run -A manage.ts makemigrations users --name add_email
 * ```
 *
 * @example Check for unmigrated changes without creating files
 * ```bash
 * deno run -A manage.ts makemigrations --check
 * ```
 *
 * @example Show what would be generated
 * ```bash
 * deno run -A manage.ts makemigrations users --dry-run
 * ```
 */
export class MakemigrationsCommand extends BaseCommand {
  readonly name = "makemigrations";
  readonly help = "Generate new migration file";
  override readonly description =
    "Creates a new migration file with a template. Detected model changes " +
    "are added as comments to guide implementation.";

  override readonly examples = [
    "manage.ts makemigrations users                - Create migration for 'users' app",
    "manage.ts makemigrations users --name add_email - Create with custom name",
    "manage.ts makemigrations --check               - Check for unmigrated changes",
    "manage.ts makemigrations --empty users         - Create empty migration",
    "manage.ts makemigrations --dry-run             - Show what would be generated",
  ];

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("app", {
      type: "string",
      required: false,
      help: "App label to create migration for",
    });

    parser.addArgument("--name", {
      type: "string",
      alias: "-n",
      help: "Custom migration name suffix (e.g., 'add_email')",
    });

    parser.addArgument("--empty", {
      type: "boolean",
      default: false,
      help: "Create an empty migration template",
    });

    parser.addArgument("--check", {
      type: "boolean",
      default: false,
      help: "Check for unmigrated changes without creating files",
    });

    parser.addArgument("--dry-run", {
      type: "boolean",
      default: false,
      help: "Show what would be generated without writing files",
    });

    parser.addArgument("--migrations-dir", {
      type: "string",
      required: false,
      help: "Path to migrations directory",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const appLabel = options.args.app as string | undefined;
    const customName = options.args.name as string | undefined;
    const isEmpty = options.args.empty as boolean;
    const checkOnly = options.args.check as boolean;
    const dryRun = options.args["dry-run"] as boolean;
    const migrationsDir = options.args["migrations-dir"] as string | undefined;

    try {
      // Validate app label for creating migrations
      if (!appLabel && !checkOnly) {
        return failure("Please provide an app label: makemigrations <app>");
      }

      // Get existing migrations to determine next number
      const existingMigrations = await this._findExistingMigrations(
        appLabel ?? "",
        migrationsDir,
      );

      if (checkOnly) {
        // TODO: Implement change detection
        this.stdout.log("Change detection not yet implemented.");
        this.stdout.log("Create migrations manually using --empty flag.");
        return success();
      }

      // Generate migration number
      const nextNum = this._getNextMigrationNumber(existingMigrations);
      const migrationName = customName ?? (isEmpty ? "auto" : "changes");
      const fullName = `${nextNum}_${migrationName}`;

      // Generate migration content
      const content = this._generateMigrationTemplate(
        appLabel!,
        fullName,
        existingMigrations,
        isEmpty,
      );

      // Output or write
      if (dryRun) {
        this.stdout.log(`\nWould create migration: ${fullName}.ts\n`);
        this.stdout.log("```typescript");
        this.stdout.log(content);
        this.stdout.log("```");
        return success();
      }

      // Determine output path
      const outputPath = await this._getMigrationPath(
        appLabel!,
        fullName,
        migrationsDir,
      );

      // Ensure directory exists
      await this._ensureDirectory(outputPath);

      // Write file
      await Deno.writeTextFile(outputPath, content);

      this.success(`Created migration: ${outputPath}`);
      return success();
    } catch (error) {
      this.error(
        error instanceof Error ? error.message : String(error),
      );
      return failure();
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private async _findExistingMigrations(
    appLabel: string,
    migrationsDir?: string,
  ): Promise<string[]> {
    const baseDir = migrationsDir ?? Deno.cwd();
    const migrationPaths = [
      `${baseDir}/${appLabel}/migrations`,
      `${baseDir}/migrations/${appLabel}`,
      `${baseDir}/migrations`,
    ];

    const migrations: string[] = [];

    for (const dir of migrationPaths) {
      try {
        for await (const entry of Deno.readDir(dir)) {
          if (
            entry.isFile && entry.name.endsWith(".ts") &&
            !entry.name.startsWith("_")
          ) {
            migrations.push(entry.name.replace(".ts", ""));
          }
        }
        break; // Found migrations directory
      } catch {
        // Directory doesn't exist, try next
      }
    }

    return migrations.sort();
  }

  private _getNextMigrationNumber(existingMigrations: string[]): string {
    if (existingMigrations.length === 0) {
      return "0001";
    }

    // Extract numbers from existing migrations
    const numbers = existingMigrations
      .map((name) => {
        const match = name.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));

    const maxNum = Math.max(...numbers, 0);
    return String(maxNum + 1).padStart(4, "0");
  }

  private _generateMigrationTemplate(
    appLabel: string,
    migrationName: string,
    existingMigrations: string[],
    isEmpty: boolean,
  ): string {
    const className = `Migration${migrationName.replace(/_/g, "")}`;
    const lastMigration = existingMigrations[existingMigrations.length - 1];
    const dependency = lastMigration ? `"${lastMigration}"` : "";

    const detectedChanges = isEmpty ? "" : `
  // TODO: Detected changes (implement these operations):
  // 
  // - Add new models with: await schema.createModel(ModelClass)
  // - Add fields with: await schema.addField(Model, "fieldName", new FieldType())
  // - Alter fields with: await schema.alterField(Model, "fieldName", new FieldType())
  // - Create indexes with: await schema.createIndex(Model, ["field1", "field2"])
  //
  // For backwards():
  // - Use schema.deprecateModel() instead of dropping tables
  // - Use schema.deprecateField() instead of removing columns
  // - Use schema.restoreModel() / schema.restoreField() to undo deprecations
  //
  // See: https://alexi.dev/docs/migrations
`;

    return `/**
 * Migration: ${migrationName}
 *
 * App: ${appLabel}
 * Created: ${new Date().toISOString()}
 */

import { Migration, MigrationSchemaEditor } from "@alexi/db/migrations";
// import { Model, AutoField, CharField, ... } from "@alexi/db";

// ============================================================================
// Snapshot Models (frozen at this migration's point in time)
// ============================================================================

// Define your models here as they should exist AFTER this migration runs.
// These are "snapshot" models - they won't change when you modify the actual
// model classes later.
//
// Example:
// class UserModel extends Model {
//   static meta = { dbTable: "users" };
//   id = new AutoField({ primaryKey: true });
//   email = new CharField({ maxLength: 255 });
// }

// ============================================================================
// Migration
// ============================================================================

export default class ${className} extends Migration {
  name = "${migrationName}";
  dependencies = [${dependency}];
${detectedChanges}
  async forwards(schema: MigrationSchemaEditor): Promise<void> {
    // Implement forward migration here
    throw new Error("Migration not implemented");
  }

  async backwards(schema: MigrationSchemaEditor): Promise<void> {
    // Implement backward migration here (undo forwards)
    // Use deprecation methods for safety:
    // - schema.deprecateModel() instead of dropping tables
    // - schema.deprecateField() instead of removing columns
    throw new Error("Migration backwards not implemented");
  }
}
`;
  }

  private async _getMigrationPath(
    appLabel: string,
    migrationName: string,
    migrationsDir?: string,
  ): Promise<string> {
    const baseDir = migrationsDir ?? Deno.cwd();

    // Try common directory structures
    const possibleDirs = [
      `${baseDir}/${appLabel}/migrations`,
      `${baseDir}/migrations/${appLabel}`,
      `${baseDir}/apps/${appLabel}/migrations`,
    ];

    // Check which one exists
    for (const dir of possibleDirs) {
      try {
        const stat = await Deno.stat(dir);
        if (stat.isDirectory) {
          return `${dir}/${migrationName}.ts`;
        }
      } catch {
        // Directory doesn't exist
      }
    }

    // Default: create in first location
    return `${possibleDirs[0]}/${migrationName}.ts`;
  }

  private async _ensureDirectory(filePath: string): Promise<void> {
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    try {
      await Deno.mkdir(dir, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }
  }
}
