/**
 * Worker post_detail.html template generator
 *
 * @module @alexi/create/templates/unified/workers/post_detail_html
 */

/**
 * Generate workers/<name>/templates/<name>/post_detail.html content
 */
export function generateWorkerPostDetailHtml(name: string): string {
  const title = toPascalCase(name);

  return `{% extends "${name}/base.html" %}

{% block title %}{{ post.title }} — ${title}{% endblock %}
{% block nav_posts_active %}class="active"{% endblock %}

{% block content %}
<div class="page-wrapper">

  <a class="back-link" href="/posts/">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back
  </a>

  <div class="detail-header">
    <h1>{{ post.title }}</h1>
    <div class="detail-meta">
      <span class="badge {% if post.published %}badge-published{% else %}badge-draft{% endif %}">
        {% if post.published %}Published{% else %}Draft{% endif %}
      </span>
      <time>{{ post.created_at }}</time>
      {% if not post.published %}
      <form method="post" action="/posts/{{ post.id }}/publish/" style="margin:0">
        <button type="submit" class="publish-btn">Publish now</button>
      </form>
      {% endif %}
    </div>
  </div>

  {% if post.content %}
  <div class="detail-content">{{ post.content }}</div>
  {% else %}
  <p style="color:var(--muted); font-style:italic; font-size:.88rem;">No content.</p>
  {% endif %}

</div>
{% endblock %}

{% block footer_extra %}{{ post.created_at }}{% endblock %}
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
