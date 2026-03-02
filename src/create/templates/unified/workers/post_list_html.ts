/**
 * Worker post_list.html template generator
 *
 * @module @alexi/create/templates/unified/workers/post_list_html
 */

/**
 * Generate workers/<name>/templates/<name>/post_list.html content
 */
export function generateWorkerPostListHtml(name: string): string {
  const title = toPascalCase(name);

  return `{% extends "${name}/base.html" %}

{% block title %}Posts — ${title}{% endblock %}

{% block content %}
<h1>Posts</h1>

<a href="/posts/new/">New Post</a>

{% if posts %}
<ul>
  {% for post in posts %}
  <li>
    <strong>{{ post.title }}</strong>
    {% if post.published %}
    <span>(published)</span>
    {% else %}
    <span>(draft)</span>
    {% endif %}
  </li>
  {% endfor %}
</ul>
{% else %}
<p>No posts yet. <a href="/posts/new/">Create the first one.</a></p>
{% endif %}
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
