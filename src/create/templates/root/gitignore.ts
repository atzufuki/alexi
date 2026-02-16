/**
 * .gitignore template generator
 *
 * @module @alexi/create/templates/root/gitignore
 */

/**
 * Generate .gitignore content for a new project
 */
export function generateGitignore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/
.parcel-cache/

# Static files (generated)
static/

# Database
*.db
*.sqlite

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Test coverage
coverage/

# Temporary files
tmp/
temp/
`;
}
