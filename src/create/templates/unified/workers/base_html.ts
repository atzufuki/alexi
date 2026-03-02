/**
 * Base HTML template generator (shared by server and Service Worker)
 *
 * @module @alexi/create/templates/unified/workers/base_html
 */

/**
 * Generate templates/<name>/base.html content
 */
export function generateWorkerBaseHtml(name: string): string {
  const title = toPascalCase(name);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{% block title %}${title}{% endblock %}</title>
  <script src="https://unpkg.com/htmx.org@2/dist/htmx.min.js"></script>
  <script type="module" src="/static/${name}/${name}.js"></script>
</head>
<body hx-boost="true">
  <nav>
    <a href="/">Home</a>
    <a href="/posts/">Posts</a>
  </nav>
  <main>
    {% block content %}{% endblock %}
  </main>
  <script>
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/static/${name}/worker.js", { type: "module" });
    }
  </script>
</body>
</html>
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
