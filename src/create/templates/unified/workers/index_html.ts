/**
 * Worker index.html template generator
 *
 * @module @alexi/create/templates/unified/workers/index_html
 */

/**
 * Generate workers/<name>/templates/<name>/index.html content
 */
export function generateWorkerIndexHtml(name: string): string {
  const title = toPascalCase(name);

  return `{% extends "${name}/base.html" %}

{% block title %}{{ title }}{% endblock %}

{% block content %}
<h1>Welcome to ${title}</h1>
<p>This page is rendered by a Service Worker using Alexi.</p>
{% endblock %}
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
