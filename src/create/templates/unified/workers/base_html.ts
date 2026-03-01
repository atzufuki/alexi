/**
 * Worker base.html template generator
 *
 * @module @alexi/create/templates/unified/workers/base_html
 */

/**
 * Generate workers/<name>/templates/<name>/base.html content
 */
export function generateWorkerBaseHtml(name: string): string {
  const title = toPascalCase(name);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{% block title %}${title}{% endblock %}</title>
  <script type="module" src="/static/${name}/${name}.js"></script>
</head>
<body>
  <main hx-boost="true">
    {% block content %}{% endblock %}
  </main>
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
