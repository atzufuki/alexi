/**
 * .gitignore template generator
 *
 * @module @alexi/create/templates/gitignore
 */

/**
 * Generate .gitignore content for a new project
 */
export function generateGitignore(): string {
  return `# Dependencies
node_modules/

# Deno
.deno/

# Build outputs
dist/
build/
.bundle/

# Static files (collected)
staticfiles/

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

# Test
coverage/
.playwright/

# Database (local dev)
*.db
*.db-shm
*.db-wal
.test_db_*

# Compiled binaries
*.exe
*.dll
*.so
*.dylib
`;
}
