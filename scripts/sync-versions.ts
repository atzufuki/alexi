#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Syncs package versions across the Alexi monorepo.
 *
 * Reads the version from the root deno.json and updates all
 * subpackage deno.jsonc files to match.
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

    if (oldVersion === targetVersion) {
      console.log(`  ⏭️  ${pkg.name} - already ${targetVersion}`);
      skippedCount++;
      continue;
    }

    pkg.version = targetVersion;
    await writeJson(pkgPath, pkg);

    console.log(`  ✓ ${pkg.name} - ${oldVersion} → ${targetVersion}`);
    updatedCount++;
  }

  console.log(`\n✅ Done!`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Total: ${subpackages.length}`);

  if (updatedCount > 0) {
    console.log(`\n💡 Don't forget to commit the changes!`);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("❌ Error:", error.message);
    Deno.exit(1);
  });
}
