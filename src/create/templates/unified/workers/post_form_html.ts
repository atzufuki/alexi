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

  <div class="form-card">
    <h2>New Post</h2>
    <form method="post" action="/posts/new/">
      <div class="form-group">
        <label class="form-label" for="title">Title</label>
        <input class="form-input" type="text" id="title" name="title"
               placeholder="Enter a title…" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label" for="content">Content</label>
        <textarea class="form-textarea" id="content" name="content"
                  placeholder="Start writing…"></textarea>
      </div>
      <label class="form-check">
        <input type="checkbox" name="published" value="true">
        Publish immediately
      </label>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Create Post</button>
        <a href="/posts/" class="btn btn-ghost">Cancel</a>
      </div>
    </form>
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
