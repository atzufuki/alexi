# Migration CI Workflow

This document describes a recommended CI workflow for catching migration
conflicts **before merge**, preventing broken main branches.

## Problem

When two developers create migrations in parallel:

1. Developer A creates `0002_add_email.ts`
2. Developer B creates `0002_add_phone.ts`
3. Both PRs pass CI individually
4. After merge: **conflict** - two migrations with the same number

## Solution

Add a CI check that:

1. Triggers when a PR is ready for review
2. Simulates a merge with the latest main
3. Validates the migration chain
4. Fails if conflicts would occur

## GitHub Actions Workflow

Create `.github/workflows/migration-check.yml`:

```yaml
name: Migration Conflict Check

on:
  pull_request:
    types: [ready_for_review, synchronize]
  push:
    branches: [main]

jobs:
  check-migrations:
    runs-on: ubuntu-latest
    if: github.event.pull_request.draft == false

    steps:
      - name: Checkout PR branch
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Deno
        uses: denoland/setup-deno@v1
        with:
          deno-version: v2.x

      - name: Fetch main branch
        run: git fetch origin main

      - name: Simulate merge
        id: merge-check
        run: |
          # Create a temporary merge to detect conflicts
          git config user.email "ci@example.com"
          git config user.name "CI Bot"

          if ! git merge origin/main --no-commit --no-ff; then
            echo "::error::Merge conflict detected. Please rebase onto main."
            git merge --abort
            exit 1
          fi

          git merge --abort || true
        continue-on-error: false

      - name: Check migration chain
        run: |
          # Rebase onto main for migration check
          git rebase origin/main

          # Run migration validation
          deno task manage makemigrations --check --strict

      - name: Migration check passed
        if: success()
        run: echo "✅ No migration conflicts detected"

      - name: Migration check failed
        if: failure()
        run: |
          echo "❌ Migration conflict detected!"
          echo ""
          echo "To fix:"
          echo "1. git fetch origin main"
          echo "2. git rebase origin/main"
          echo "3. deno task manage makemigrations --rebase"
          echo "4. git push --force-with-lease"
```

## Strict Mode

The `--strict` flag enables additional checks:

```bash
deno task manage makemigrations --check --strict
```

Strict mode validates:

1. **No duplicate migration numbers** within an app
2. **No gaps in migration numbers** (0001, 0002, 0003...)
3. **All dependencies exist** and are applied
4. **No circular dependencies**

## Developer Workflow

### Before Creating a PR

```bash
# Fetch latest main
git fetch origin main

# Rebase onto main
git rebase origin/main

# If migrations conflict, renumber them
deno task manage makemigrations --rebase
```

### After Main Updates

When main is updated while your PR is open:

```bash
# Fetch and rebase
git fetch origin main
git rebase origin/main

# Renumber migrations if needed
deno task manage makemigrations --rebase

# Force push (with lease for safety)
git push --force-with-lease
```

## The `--rebase` Flag

When rebasing causes migration number conflicts, use `--rebase` to automatically
renumber:

```bash
deno task manage makemigrations --rebase
```

This will:

1. Scan for duplicate migration numbers
2. Renumber your migrations to follow the latest on main
3. Update dependency references

### Example

Before rebase:

```
main:       0001_initial → 0002_add_email
your-branch: 0001_initial → 0002_add_phone (conflict!)
```

After `makemigrations --rebase`:

```
main:       0001_initial → 0002_add_email
your-branch: 0001_initial → 0002_add_email → 0003_add_phone (fixed!)
```

## Flow Diagram

```
Developer creates PR (draft)
         │
         ▼
Works on feature, normal CI runs tests
         │
         ▼
Clicks "Ready for review"
         │
         ▼
┌─────────────────────────────────────┐
│  CI: Migration Conflict Check       │
│  1. Simulate merge with main        │
│  2. Check migration chain           │
│  3. Validate dependencies           │
└─────────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
   OK?      Conflict?
    │         │
    ▼         ▼
Ready for   "Please rebase and run
 review     makemigrations --rebase"
```

## Handling Conflicts

### Scenario 1: Simple Renumber

Your migration `0002_add_phone.ts` conflicts with merged `0002_add_email.ts`:

```bash
# Rebase onto main
git rebase origin/main

# Renumber your migration
deno task manage makemigrations --rebase

# This renames 0002_add_phone.ts → 0003_add_phone.ts
# And updates the dependencies array

git add .
git rebase --continue
git push --force-with-lease
```

### Scenario 2: Dependency Conflict

Your migration depends on a field that was removed on main:

```bash
# Rebase onto main
git rebase origin/main

# Check what changed
deno task manage showmigrations

# Manually update your migration to handle the change
# Then continue rebase
git add .
git rebase --continue
```

### Scenario 3: Data Migration Conflict

Two data migrations modify the same data:

This requires manual resolution. Consider:

1. Combining the migrations
2. Adding a dependency to ensure order
3. Making one migration idempotent

## Common Error Messages

### "Duplicate migration number detected"

```
Error: Duplicate migration number: users.0002
  - 0002_add_email.ts (main)
  - 0002_add_phone.ts (your branch)

Run: deno task manage makemigrations --rebase
```

### "Missing dependency"

```
Error: Migration users.0003_add_bio depends on users.0002_add_profile
       but users.0002_add_profile does not exist

Check your dependencies array.
```

### "Circular dependency detected"

```
Error: Circular dependency: users.0002 → auth.0003 → users.0002

Break the cycle by:
1. Combining related changes
2. Using a bridge migration
3. Reordering dependencies
```

## Best Practices

### 1. Rebase Early and Often

Don't let your branch get too far behind main:

```bash
# Daily routine
git fetch origin main
git rebase origin/main
```

### 2. Keep Migrations Atomic

One logical change per migration makes conflicts easier to resolve.

### 3. Use Draft PRs

Keep PRs in draft until ready. The migration check only runs on ready PRs.

### 4. Communicate About Migrations

If you know another team member is creating migrations in the same app,
coordinate to avoid conflicts.

### 5. Run Local Checks

Before pushing:

```bash
deno task manage makemigrations --check
```

## Integration with Branch Protection

Add the migration check as a required status check:

1. Go to repository Settings → Branches
2. Edit the branch protection rule for `main`
3. Enable "Require status checks to pass"
4. Add "Migration Conflict Check" to required checks

This ensures no PR can merge with migration conflicts.
