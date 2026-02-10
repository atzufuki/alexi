#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Install Git hooks for Alexi development.
 *
 * This script creates a pre-commit hook that automatically formats
 * staged files with `deno fmt` before committing.
 *
 * Run with: deno run -A scripts/install-hooks.ts
 */

const PRE_COMMIT_HOOK = `#!/bin/sh
#
# Alexi pre-commit hook
# Automatically formats staged files with deno fmt
#

# Get list of staged .ts, .tsx, .js, .jsx, .json, .md files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(ts|tsx|js|jsx|json|md|jsonc)$' || true)

if [ -n "$STAGED_FILES" ]; then
  echo "🔧 Formatting staged files..."

  # Format the staged files
  echo "$STAGED_FILES" | xargs deno fmt

  # Re-add the formatted files to staging
  echo "$STAGED_FILES" | xargs git add

  echo "✅ Formatting complete"
fi

exit 0
`;

async function main() {
  const gitDir = ".git";
  const hooksDir = `${gitDir}/hooks`;
  const preCommitPath = `${hooksDir}/pre-commit`;

  // Check if we're in a git repository
  try {
    await Deno.stat(gitDir);
  } catch {
    console.error("❌ Error: Not a git repository (no .git directory found)");
    console.error("   Run this script from the repository root.");
    Deno.exit(1);
  }

  // Create hooks directory if it doesn't exist
  try {
    await Deno.mkdir(hooksDir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }

  // Check if pre-commit hook already exists
  try {
    const existing = await Deno.readTextFile(preCommitPath);
    if (existing.includes("Alexi pre-commit hook")) {
      console.log("✅ Pre-commit hook already installed");
      return;
    }

    // Backup existing hook
    const backupPath = `${preCommitPath}.backup`;
    await Deno.writeTextFile(backupPath, existing);
    console.log(`📦 Backed up existing pre-commit hook to ${backupPath}`);
  } catch {
    // No existing hook, that's fine
  }

  // Write pre-commit hook
  await Deno.writeTextFile(preCommitPath, PRE_COMMIT_HOOK);

  // Make it executable (Unix only)
  if (Deno.build.os !== "windows") {
    const command = new Deno.Command("chmod", {
      args: ["+x", preCommitPath],
    });
    await command.output();
  }

  console.log("✅ Pre-commit hook installed successfully!");
  console.log("");
  console.log(
    "The hook will automatically format staged files before each commit.",
  );
  console.log("");
  console.log("To skip the hook temporarily, use: git commit --no-verify");
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  Deno.exit(1);
});
