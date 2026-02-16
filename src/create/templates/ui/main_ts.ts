/**
 * UI main.ts template generator
 *
 * @module @alexi/create/templates/ui/main_ts
 */

/**
 * Generate main.ts content for the UI app
 */
export function generateUiMainTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} UI Entry Point
 *
 * Initializes backends, handles routing, and renders views.
 *
 * @module ${name}-ui/main
 */

import { setup } from "@alexi/db";
import { resolve, isRedirectResponse } from "@alexi/urls";
import { DATABASES, DEBUG } from "@${name}-ui/settings.ts";
import { urlpatterns } from "@${name}-ui/urls.ts";
import { navigate, normalizePath, isInternalLink, type ViewContext } from "@${name}-ui/utils.ts";

// Import components to register custom elements
import "@${name}-ui/components/mod.ts";

let rootElement: HTMLElement | null = null;

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Root element #app not found");
    return;
  }
  rootElement = root;

  // Step 1: Initialize backends
  await setup({ databases: DATABASES, debug: DEBUG });

  // Step 2: Set up navigation listeners
  globalThis.addEventListener("popstate", () => renderCurrentRoute(root));
  document.addEventListener("click", handleLinkClick);

  // Step 3: Render initial route
  await renderCurrentRoute(root);
});

/**
 * Render the current route
 */
async function renderCurrentRoute(root: HTMLElement): Promise<void> {
  const path = normalizePath(globalThis.location.pathname);
  const search = globalThis.location.search;

  const result = resolve(path, urlpatterns);

  if (!result) {
    root.replaceChildren(render404(path));
    return;
  }

  const ctx: ViewContext = {
    path,
    query: new URLSearchParams(search),
  };

  try {
    const view = await result.view(ctx, result.params);

    // Handle redirects (Django-style)
    if (isRedirectResponse(view)) {
      navigate(view.path, { replace: true });
      return;
    }

    root.replaceChildren(view);
  } catch (error) {
    console.error("Error rendering route:", error);
    root.replaceChildren(renderError(error));
  }
}

/**
 * Handle clicks on anchor elements
 */
function handleLinkClick(e: MouseEvent): void {
  const link = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
  if (!link || !isInternalLink(link)) return;

  e.preventDefault();
  navigate(link.pathname + link.search);
}

/**
 * Render 404 page
 */
function render404(path: string): Node {
  const div = document.createElement("div");
  div.style.cssText = "padding: 2rem; text-align: center;";
  div.innerHTML = \`
    <h1>404 - Page Not Found</h1>
    <p>The path <code>\${path}</code> was not found.</p>
    <p><a href="/">Go back to home</a></p>
  \`;
  return div;
}

/**
 * Render error page
 */
function renderError(error: unknown): Node {
  const div = document.createElement("div");
  div.style.cssText = "padding: 2rem; text-align: center; color: #c00;";
  div.innerHTML = \`
    <h1>Error</h1>
    <p>\${error instanceof Error ? error.message : String(error)}</p>
    <p><a href="/">Go back to home</a></p>
  \`;
  return div;
}
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
