/**
 * README.md template generator
 *
 * @module @alexi/create/templates/readme
 */

/**
 * Generate README.md content for a new project
 */
export function generateReadme(name: string): string {
  // Convert name to title case for display
  const title = name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return `# ${title}

A web application built with [Alexi](https://github.com/atzufuki/alexi) - a Django-inspired full-stack framework for Deno.

## Requirements

- [Deno](https://deno.com/) 2.0+

## Getting Started

\`\`\`bash
# Start development server
deno task dev

# Run tests
deno task test
\`\`\`

## Project Structure

\`\`\`
${name}/
├── project/
│   └── settings.ts       # Project settings
├── src/
│   └── ${name}/          # Main application
│       ├── app.ts        # App configuration
│       ├── models.ts     # Database models
│       ├── urls.ts       # URL patterns
│       ├── views.ts      # View functions
│       └── tests/        # Tests
├── manage.ts             # CLI tool
└── deno.json             # Deno configuration
\`\`\`

## Available Commands

| Command | Description |
|---------|-------------|
| \`deno task dev\` | Start development server |
| \`deno task test\` | Run tests |
| \`deno task bundle\` | Bundle frontend assets |
| \`deno task collectstatic\` | Collect static files |

## Creating New Apps

\`\`\`bash
deno run -A manage.ts startapp myapp
\`\`\`

## Documentation

- [Alexi Documentation](https://github.com/atzufuki/alexi)
- [Deno Documentation](https://docs.deno.com/)

## License

MIT
`;
}
