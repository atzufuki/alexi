#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * Syncs package versions across the Alexi monorepo.
 *
 * Reads the version from the root deno.json and updates all
 * subpackage deno.jsonc files to match, including:
 * - The "version" field
 * - Any @alexi/* imports in the "imports" field
 *
 * Usage:
 *   deno run --allow-read --allow-write scripts/sync-versions.ts
 */

import { parse } from "jsr:@std/jsonc@^1.0.0";
import { walk } from "jsr:@std/fs@^1.0.0";
import { join } from "jsr:@std/path@^1.0.0";

interface PackageJson {
  name: string;
  version: string;
  imports?: Record<string, string>;
  [key: string]: unknown;
}

async function readJson(path: string): Promise<PackageJson> {
  const content = await Deno.readTextFile(path);
  return parse(content) as PackageJson;
}

async function writeJson(path: string, data: PackageJson): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await Deno.writeTextFile(path, content + "\n");
}

/**
 * Updates @alexi/* imports to use the target version
 * e.g., "jsr:@alexi/db@0.5.0" -> "jsr:@alexi/db@0.6.0"
 */
function updateAlexiImports(
  imports: Record<string, string>,
  targetVersion: string,
): { updated: Record<string, string>; changes: string[] } {
  const updated: Record<string, string> = {};
  const changes: string[] = [];

  for (const [key, value] of Object.entries(imports)) {
    if (typeof value === "string" && value.startsWith("jsr:@alexi/")) {
      // Match pattern like "jsr:@alexi/db@0.5.0" or "jsr:@alexi/db@^0.5.0"
      const match = value.match(/^(jsr:@alexi\/[^@]+)@[\^~]?[\d.]+(.*)$/);
      if (match) {
        const [, prefix, suffix] = match;
        const newValue = `${prefix}@${targetVersion}${suffix}`;
        if (newValue !== value) {
          changes.push(`${key}: ${value} → ${newValue}`);
        }
        updated[key] = newValue;
      } else {
        updated[key] = value;
      }
    } else {
      updated[key] = value;
    }
  }

  return { updated, changes };
}

async function main() {
  const rootPath = join(Deno.cwd(), "deno.json");

  console.log("📦 Syncing versions across Alexi monorepo...\n");

  // Read root version
  const rootPackage = await readJson(rootPath);
  const targetVersion = rootPackage.version;

  console.log(`✓ Root version: ${targetVersion}`);
  console.log(`  Package: ${rootPackage.name}\n`);

  // Find all subpackage manifests
  const subpackages: string[] = [];

  for await (
    const entry of walk("src", {
      maxDepth: 2,
      match: [/deno\.jsonc?$/],
    })
  ) {
    if (entry.isFile) {
      subpackages.push(entry.path);
    }
  }

  if (subpackages.length === 0) {
    console.log("⚠️  No subpackages found in src/");
    Deno.exit(1);
  }

  console.log(`Found ${subpackages.length} subpackages:\n`);

  // Update each subpackage
  let updatedCount = 0;
  let skippedCount = 0;

  for (const pkgPath of subpackages) {
    const pkg = await readJson(pkgPath);
    const oldVersion = pkg.version;
    let hasChanges = false;
    const changeDetails: string[] = [];

    // Update version field
    if (oldVersion !== targetVersion) {
      pkg.version = targetVersion;
      hasChanges = true;
      changeDetails.push(`version: ${oldVersion} → ${targetVersion}`);
    }

    // Update @alexi/* imports
    if (pkg.imports) {
      const { updated, changes } = updateAlexiImports(
        pkg.imports,
        targetVersion,
      );
      if (changes.length > 0) {
        pkg.imports = updated;
        hasChanges = true;
        changeDetails.push(...changes.map((c) => `  imports.${c}`));
      }
    }

    if (!hasChanges) {
      console.log(`  ⏭️  ${pkg.name} - already up to date`);
      skippedCount++;
      continue;
    }

    await writeJson(pkgPath, pkg);

    console.log(`  ✓ ${pkg.name}`);
    for (const detail of changeDetails) {
      console.log(`      ${detail}`);
    }
    updatedCount++;
  }

  console.log(`\n✅ Done!`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Total: ${subpackages.length}`);

  if (updatedCount > 0) {
    console.log(`\n🔄 Regenerating deno.lock...`);

    // Remove old lock file
    try {
      await Deno.remove("deno.lock");
    } catch {
      // Lock file might not exist
    }

    // Regenerate lock by caching dependencies
    const cacheCmd = new Deno.Command("deno", {
      args: [
        "cache",
        "--reload",
        "src/mod.ts",
        "src/db/tests/indexeddb_test.ts",
      ],
      stdout: "inherit",
      stderr: "inherit",
    });

    const cacheResult = await cacheCmd.output();
    if (cacheResult.success) {
      console.log(`✅ deno.lock regenerated successfully`);
    } else {
      console.log(
        `⚠️  Failed to regenerate deno.lock - run 'deno cache' manually`,
      );
    }

    console.log(`\n💡 Don't forget to commit the changes!`);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("❌ Error:", error.message);
    Deno.exit(1);
  });
}
