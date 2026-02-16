/**
 * UI styles/global.css template generator
 *
 * Generates the global CSS styles implementing the Alexi Design System.
 *
 * @module @alexi/create/templates/ui/styles_css
 */

/**
 * Generate styles/global.css content for the UI app
 */
export function generateGlobalCss(): string {
  return `/* ==========================================================================
   ALEXI DESIGN SYSTEM - Global Styles
   A playful, friendly visual identity for the Alexi framework
   ========================================================================== */

/* ==========================================================================
   1. CSS CUSTOM PROPERTIES (Design Tokens)
   ========================================================================== */

:root {
  /* -------------------------------------------------------------------------
     1.1 COLOR PALETTE
     ------------------------------------------------------------------------- */

  /* Primary - Fresh Green */
  --alexi-primary-50: #ecfdf5;
  --alexi-primary-100: #d1fae5;
  --alexi-primary-200: #a7f3d0;
  --alexi-primary-300: #6ee7b7;
  --alexi-primary-400: #34d399;
  --alexi-primary-500: #10b981;
  --alexi-primary-600: #059669;
  --alexi-primary-700: #047857;
  --alexi-primary-800: #065f46;
  --alexi-primary-900: #064e3b;
  --alexi-primary-950: #022c22;

  /* Accent - Deep Purple (playful complement) */
  --alexi-accent-50: #f3e5f5;
  --alexi-accent-100: #ede7f6;
  --alexi-accent-200: #d1c4e9;
  --alexi-accent-300: #b39ddb;
  --alexi-accent-400: #7e57c2;
  --alexi-accent-500: #673ab7;
  --alexi-accent-600: #5e35b1;
  --alexi-accent-700: #512da8;
  --alexi-accent-800: #4527a0;
  --alexi-accent-900: #311b92;
  --alexi-accent-950: #1a0a52;

  /* Neutral - Pure Gray */
  --alexi-neutral-0: #ffffff;
  --alexi-neutral-50: #fafafa;
  --alexi-neutral-100: #f4f4f5;
  --alexi-neutral-200: #e4e4e7;
  --alexi-neutral-300: #d4d4d8;
  --alexi-neutral-400: #a1a1aa;
  --alexi-neutral-500: #71717a;
  --alexi-neutral-600: #52525b;
  --alexi-neutral-700: #3f3f46;
  --alexi-neutral-800: #27272a;
  --alexi-neutral-900: #18181b;
  --alexi-neutral-950: #09090b;

  /* Semantic colors */
  --alexi-success-500: #10b981;
  --alexi-warning-500: #f59e0b;
  --alexi-error-500: #f43f5e;
  --alexi-info-500: #0ea5e9;

  /* -------------------------------------------------------------------------
     1.2 SEMANTIC MAPPINGS
     ------------------------------------------------------------------------- */

  /* Surface */
  --alexi-surface: var(--alexi-neutral-0);
  --alexi-surface-dim: var(--alexi-neutral-50);
  --alexi-surface-raised: var(--alexi-neutral-0);

  /* Text */
  --alexi-text: var(--alexi-neutral-900);
  --alexi-text-secondary: var(--alexi-neutral-600);
  --alexi-text-muted: var(--alexi-neutral-400);

  /* Primary */
  --alexi-primary: var(--alexi-primary-600);
  --alexi-primary-hover: var(--alexi-primary-700);

  /* Border */
  --alexi-border: var(--alexi-neutral-200);
  --alexi-border-strong: var(--alexi-neutral-300);

  /* -------------------------------------------------------------------------
     1.3 TYPOGRAPHY
     ------------------------------------------------------------------------- */

  --alexi-font-sans: "Nunito", "Quicksand", system-ui, -apple-system, sans-serif;
  --alexi-font-display: "Fredoka", "Nunito", system-ui, sans-serif;
  --alexi-font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;

  /* -------------------------------------------------------------------------
     1.4 SPACING & RADIUS
     ------------------------------------------------------------------------- */

  --alexi-radius-sm: 0.5rem;
  --alexi-radius-md: 0.75rem;
  --alexi-radius-lg: 1rem;
  --alexi-radius-xl: 1.5rem;
  --alexi-radius-full: 9999px;

  /* -------------------------------------------------------------------------
     1.5 SHADOWS
     ------------------------------------------------------------------------- */

  --alexi-shadow-sm: 0 2px 8px -2px rgba(0, 0, 0, 0.1);
  --alexi-shadow-md: 0 4px 16px -4px rgba(0, 0, 0, 0.15);
  --alexi-shadow-lg: 0 8px 24px -6px rgba(0, 0, 0, 0.2);
  --alexi-shadow-glow: 0 0 20px -5px var(--alexi-primary-400);

  /* -------------------------------------------------------------------------
     1.6 TRANSITIONS
     ------------------------------------------------------------------------- */

  --alexi-ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --alexi-ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --alexi-duration-fast: 150ms;
  --alexi-duration-normal: 200ms;
}

/* ==========================================================================
   2. DARK MODE
   ========================================================================== */

@media (prefers-color-scheme: dark) {
  :root {
    --alexi-surface: var(--alexi-neutral-900);
    --alexi-surface-dim: var(--alexi-neutral-950);
    --alexi-surface-raised: var(--alexi-neutral-800);
    --alexi-text: var(--alexi-neutral-100);
    --alexi-text-secondary: var(--alexi-neutral-400);
    --alexi-text-muted: var(--alexi-neutral-500);
    --alexi-primary: var(--alexi-primary-400);
    --alexi-primary-hover: var(--alexi-primary-300);
    --alexi-border: var(--alexi-neutral-700);
    --alexi-border-strong: var(--alexi-neutral-600);
    --alexi-shadow-sm: 0 2px 8px -2px rgba(0, 0, 0, 0.3);
    --alexi-shadow-md: 0 4px 16px -4px rgba(0, 0, 0, 0.4);
    --alexi-shadow-lg: 0 8px 24px -6px rgba(0, 0, 0, 0.5);
  }
}

/* ==========================================================================
   3. BASE STYLES
   ========================================================================== */

@import url("https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Fredoka:wght@400;500;600;700&display=swap");

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--alexi-font-sans);
  font-size: 1rem;
  line-height: 1.5;
  color: var(--alexi-text);
  background: linear-gradient(
    135deg,
    var(--alexi-surface-dim) 0%,
    var(--alexi-surface) 50%,
    var(--alexi-surface-dim) 100%
  );
  min-height: 100vh;
  transition:
    background-color var(--alexi-duration-normal) var(--alexi-ease-smooth),
    color var(--alexi-duration-normal) var(--alexi-ease-smooth);
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ==========================================================================
   4. TYPOGRAPHY
   ========================================================================== */

h1, h2, h3, h4, h5, h6 {
  font-family: var(--alexi-font-display);
  font-weight: 600;
  line-height: 1.2;
  margin: 0;
  color: var(--alexi-text);
}

h1 {
  font-size: 2.5rem;
}

h2 {
  font-size: 2rem;
}

h3 {
  font-size: 1.5rem;
}

p {
  margin: 0;
  line-height: 1.6;
}

a {
  color: var(--alexi-primary);
  text-decoration: none;
  transition: color var(--alexi-duration-fast) var(--alexi-ease-smooth);
}

a:hover {
  color: var(--alexi-primary-hover);
}

/* ==========================================================================
   5. UTILITY CLASSES
   ========================================================================== */

.alexi-card {
  background: var(--alexi-surface-raised);
  border: 1px solid var(--alexi-border);
  border-radius: var(--alexi-radius-xl);
  box-shadow: var(--alexi-shadow-md);
  padding: 1.5rem;
  transition: all var(--alexi-duration-fast) var(--alexi-ease-smooth);
}

.alexi-card:hover {
  box-shadow: var(--alexi-shadow-lg);
  transform: translateY(-2px);
}

.alexi-card-static {
  background: var(--alexi-surface-raised);
  border: 1px solid var(--alexi-border);
  border-radius: var(--alexi-radius-xl);
  box-shadow: var(--alexi-shadow-md);
  padding: 1.5rem;
}

.alexi-gradient-text {
  background: linear-gradient(135deg, var(--alexi-primary-400), var(--alexi-accent-400));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.alexi-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: var(--alexi-radius-full);
  background: var(--alexi-primary-100);
  color: var(--alexi-primary-700);
}

@media (prefers-color-scheme: dark) {
  .alexi-badge {
    background: var(--alexi-primary-900);
    color: var(--alexi-primary-200);
  }
}

/* ==========================================================================
   6. SCROLLBAR STYLING
   ========================================================================== */

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--alexi-surface-dim);
}

::-webkit-scrollbar-thumb {
  background: var(--alexi-neutral-300);
  border-radius: var(--alexi-radius-full);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--alexi-neutral-400);
}

@media (prefers-color-scheme: dark) {
  ::-webkit-scrollbar-track {
    background: var(--alexi-neutral-900);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--alexi-neutral-600);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--alexi-neutral-500);
  }
}

/* ==========================================================================
   7. FOCUS STYLES
   ========================================================================== */

:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.4);
  border-radius: var(--alexi-radius-sm);
}

/* ==========================================================================
   8. SELECTION
   ========================================================================== */

::selection {
  background: var(--alexi-primary-200);
  color: var(--alexi-primary-900);
}

@media (prefers-color-scheme: dark) {
  ::selection {
    background: var(--alexi-primary-800);
    color: var(--alexi-primary-100);
  }
}
`;
}
