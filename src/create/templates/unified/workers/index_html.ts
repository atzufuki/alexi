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

{% block title %}${title}{% endblock %}

{% block content %}
<div class="page-wrapper">
  <div class="page-header" style="text-align:center; padding: 3rem 0 2rem;">
    <h1>Welcome to ${title}</h1>
    <p style="margin-top:.6rem; font-size:.95rem;">
      Write, manage and publish your thoughts.
    </p>
    <div style="margin-top:1.5rem; display:flex; gap:.75rem; justify-content:center; flex-wrap:wrap;">
      <a href="/posts/" class="btn btn-primary" style="font-size:.88rem;">Browse posts</a>
      <a href="/posts/new/" class="btn btn-ghost" style="font-size:.88rem;">Write new</a>
    </div>
  </div>
</div>
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
