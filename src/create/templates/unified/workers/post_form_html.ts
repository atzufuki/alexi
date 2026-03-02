/**
 * Worker post_form.html template generator
 *
 * @module @alexi/create/templates/unified/workers/post_form_html
 */

/**
 * Generate workers/<name>/templates/<name>/post_form.html content
 */
export function generateWorkerPostFormHtml(name: string): string {
  const title = toPascalCase(name);

  return `{% extends "${name}/base.html" %}

{% block title %}New Post — ${title}{% endblock %}

{% block content %}
<h1>New Post</h1>

<form method="post" action="/posts/new/">
  <div>
    <label for="title">Title</label>
    <input type="text" id="title" name="title" required>
  </div>
  <div>
    <label for="content">Content</label>
    <textarea id="content" name="content" rows="6"></textarea>
  </div>
  <div>
    <button type="submit">Create Post</button>
    <a href="/posts/">Cancel</a>
  </div>
</form>
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
