# Alexi Skills

AI coding assistant skills for the Alexi framework. These skills teach AI
assistants how to work with Alexi packages using modern best practices.

## Skills

| Skill      | Package     | Description                             |
| ---------- | ----------- | --------------------------------------- |
| `alexi-db` | `@alexi/db` | Django-style ORM with multiple backends |

## Key Principles

These skills enforce Alexi's patterns:

1. **Django-style APIs** - Models, QuerySets, Managers, Serializers, ViewSets
2. **TypeScript first** - Full type safety with Deno
3. **Multiple backends** - Server (DenoKV), Browser (IndexedDB), REST, Sync
4. **Offline-first** - SyncBackend for seamless online/offline operation

## Specification

These skills follow the
[Agent Skills Specification](https://agentskills.io/specification).

## Installation

### Claude Code

**Option 1: Install as a plugin** (when published)

```bash
/plugin marketplace add atzufuki/alexi-skills
/plugin install alexi-skills@atzufuki-alexi-skills
```

**Option 2: Manual installation**

```bash
# Clone the repository
git clone https://github.com/atzufuki/alexi.git /tmp/alexi

# Copy skills to your personal skills directory
cp -r /tmp/alexi/src/skills/alexi-db ~/.claude/skills/

# Or for project-specific installation
cp -r /tmp/alexi/src/skills/* .claude/skills/
```

### Cursor

```bash
# Clone the repository
git clone https://github.com/atzufuki/alexi.git /tmp/alexi

# Copy skills to your Cursor skills directory
cp -r /tmp/alexi/src/skills/* ~/.cursor/skills/

# Or for project-specific installation
cp -r /tmp/alexi/src/skills/* .cursor/skills/
```

### VS Code with GitHub Copilot

```bash
# Clone the repository
git clone https://github.com/atzufuki/alexi.git /tmp/alexi

# Copy skills to your project's skills directory
mkdir -p .github/skills
cp -r /tmp/alexi/src/skills/* .github/skills/
```

## Usage

Once installed, your AI assistant will automatically apply Alexi best practices
when:

- Working in projects with `@alexi/*` imports
- Creating models, serializers, or viewsets
- Setting up database backends
- Implementing offline-first patterns

## Adding New Skills

Each skill targets one Alexi package. To add a new skill:

1. Create a directory: `src/skills/alexi-{package}/`
2. Add `SKILL.md` with YAML frontmatter and Markdown content
3. Follow the naming pattern: `alexi-{package}` (e.g., `alexi-restframework`)

### SKILL.md Structure

```markdown
---
name: alexi-{package}
description: Brief description of when to use this skill.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/{package}"
---

# Title

## Overview

What this package does.

## When to Use This Skill

When the AI should activate this skill.

## Installation

How to install the package.

## Core Concepts

Main patterns and APIs.

## Common Mistakes

What to avoid.

## Import Reference

All exports.
```

## Documentation Resources

- [Alexi Documentation](https://github.com/atzufuki/alexi)
- [Agent Skills Specification](https://agentskills.io/specification)

## License

MIT
