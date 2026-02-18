---
name: alexi-spec
description: Create GitHub issues for Alexi framework features, bugs, and improvements. 
  Use when specifying new functionality, documenting bugs, or planning enhancements.
---

# Alexi Specification Skill

Create well-structured GitHub issues for the Alexi framework.

## When to Use

- User describes a new feature needed
- User reports a bug or problem
- User wants to document a planned improvement
- User references documentation that needs updating

## Issue Creation Process

1. **Gather Context**
   - Read relevant documentation (`docs/`, `AGENTS.md`, `README.md`)
   - Search codebase for related code if applicable
   - Check existing issues to avoid duplicates: `gh issue list --search "keyword"`

2. **Draft the Issue**
   - Write a clear, concise title
   - Structure the body with appropriate sections (see templates below)
   - Include code examples where relevant
   - Reference related files or documentation

3. **Create the Issue**
   ```bash
   gh issue create --title "Title" --body "$(cat <<'EOF'
   Issue body here...
   EOF
   )"
   ```

4. **Report the URL** to the user

## Issue Templates

### Feature Request

```markdown
## Summary

[1-2 sentence description of the feature]

## Motivation

[Why is this needed? What problem does it solve?]

## Requirements

### Core Implementation
- [ ] Requirement 1
- [ ] Requirement 2

### Additional Considerations
- [ ] Consideration 1

## Technical Considerations

[Implementation notes, API design, file structure, etc.]

## Out of Scope (for initial implementation)

- Item 1
- Item 2

## References

- [Link 1](url)
- [Link 2](url)
```

### Bug Report

```markdown
## Description

[What is the bug?]

## Steps to Reproduce

1. Step 1
2. Step 2
3. Step 3

## Expected Behavior

[What should happen?]

## Actual Behavior

[What happens instead?]

## Environment

- Alexi version: x.x.x
- Deno version: x.x.x
- OS: [e.g., Windows 11, macOS, Linux]

## Possible Cause

[If known, what might be causing this?]

## Related Code

```typescript
// Relevant code snippet
```
```

### Documentation Update

```markdown
## Summary

[What documentation needs updating?]

## Current State

[What does the documentation currently say or lack?]

## Proposed Changes

- [ ] Change 1
- [ ] Change 2

## Affected Files

- `docs/file1.md`
- `docs/file2.md`
```

## Labels

Add labels when creating issues if appropriate:
- `enhancement` - New features
- `bug` - Bug reports
- `documentation` - Documentation updates
- `breaking-change` - Changes that break backward compatibility

```bash
gh issue create --title "Title" --body "..." --label "enhancement"
```

## Guidelines

- **Be specific**: Include version numbers, file paths, code examples
- **Be concise**: Focus on what's needed, not how to implement
- **Reference docs**: Link to relevant documentation
- **Check for duplicates**: Search existing issues first
- **Use checkboxes**: Make requirements trackable
