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
{% block nav_posts_active %}class="active"{% endblock %}

{% block content %}
<div class="page-wrapper">

  <div class="page-header">
    <h1>Posts</h1>
    <p>
      {% if posts %}
        {{ total }} post{{ total|pluralize }} &middot; {{ published_count }} published &middot; {{ draft_count }} draft{{ draft_count|pluralize }}
      {% else %}
        Create your first post
      {% endif %}
    </p>
  </div>

  <!-- Stats -->
  <div class="stats-bar">
    <div class="stat-card">
      <span class="stat-label">Total</span>
      <span class="stat-value total">{{ total }}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Published</span>
      <span class="stat-value published">{{ published_count }}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Drafts</span>
      <span class="stat-value draft">{{ draft_count }}</span>
    </div>
  </div>

  {% if posts %}
  <div class="post-list">
    {% for post in posts %}
    <div class="post-card">
      <div class="post-card-main">
        <div class="post-meta">
          <span class="badge {% if post.published %}badge-published{% else %}badge-draft{% endif %}">
            {% if post.published %}Published{% else %}Draft{% endif %}
          </span>
          <span class="post-date">{{ post.created_at }}</span>
        </div>
        <a href="/posts/{{ post.id }}/" style="display:block">
          <div class="post-title">{{ post.title }}</div>
          {% if post.excerpt %}
          <div class="post-excerpt">{{ post.excerpt }}</div>
          {% endif %}
        </a>
      </div>
      <div class="post-card-actions">
        {% if not post.published %}
        <form method="post" action="/posts/{{ post.id }}/publish/">
          <button type="submit" class="publish-btn">Publish</button>
        </form>
        {% endif %}
        <form method="post" action="/posts/{{ post.id }}/delete/">
          <button type="submit" class="icon-btn" title="Delete"
            onclick="return confirm('Delete this post?')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
    {% endfor %}
  </div>
  {% else %}
  <div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
    <h3>No posts yet</h3>
    <p><a href="/posts/new/">Create your first post</a></p>
  </div>
  {% endif %}

</div>
{% endblock %}

{% block footer_extra %}{{ total }} post{{ total|pluralize }}{% endblock %}
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
