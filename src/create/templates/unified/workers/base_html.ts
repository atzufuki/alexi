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
  <style>
    /* ── Design tokens ─────────────────────────────────────── */
    :root {
      --bg:           #0f0f13;
      --surface:      #18181f;
      --surface2:     #22222c;
      --border:       #2e2e3a;
      --accent:       #7c6af7;
      --accent2:      #a78bfa;
      --accent-glow:  rgba(124,106,247,.22);
      --text:         #e8e8f0;
      --muted:        #7a7a90;
      --success:      #34d399;
      --danger:       #f87171;
      --radius:       12px;
      --radius-sm:    6px;
      --shadow:       0 4px 24px rgba(0,0,0,.45);
    }

    /* ── Reset ─────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 16px; scroll-behavior: smooth; }
    body {
      font-family: "Inter", system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
    }
    a { color: inherit; text-decoration: none; }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    /* ── Nav ───────────────────────────────────────────────── */
    nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(15,15,19,.85);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      padding: 0 clamp(1rem, 5vw, 3rem);
      display: flex;
      align-items: center;
      gap: 1rem;
      height: 56px;
    }
    .nav-logo {
      font-size: .85rem;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--accent2);
      display: flex;
      align-items: center;
      gap: .45rem;
    }
    .nav-logo svg { width: 20px; height: 20px; }
    .nav-links {
      display: flex;
      gap: .25rem;
      list-style: none;
      margin-left: auto;
      align-items: center;
    }
    .nav-links a {
      color: var(--muted);
      font-size: .85rem;
      padding: .35rem .75rem;
      border-radius: var(--radius-sm);
      transition: color .15s, background .15s;
    }
    .nav-links a:hover { color: var(--text); background: var(--surface2); }
    .nav-links a.active { color: var(--text); background: var(--surface2); }
    .btn-new {
      background: var(--accent) !important;
      color: #fff !important;
      font-weight: 600;
      font-size: .8rem !important;
      padding: .4rem .9rem !important;
      border-radius: var(--radius-sm) !important;
      transition: background .15s, box-shadow .15s !important;
    }
    .btn-new:hover {
      background: var(--accent2) !important;
      box-shadow: 0 0 18px var(--accent-glow) !important;
    }

    /* ── Page wrapper ──────────────────────────────────────── */
    .page-wrapper {
      max-width: 860px;
      margin: 0 auto;
      padding: 2rem clamp(1rem, 5vw, 3rem) 3rem;
      width: 100%;
    }

    /* ── Page header ───────────────────────────────────────── */
    .page-header { margin-bottom: 1.5rem; }
    .page-header h1 {
      font-size: clamp(1.5rem, 4vw, 2.2rem);
      font-weight: 800;
      letter-spacing: -.02em;
      line-height: 1.15;
    }
    .page-header p { color: var(--muted); margin-top: .35rem; font-size: .88rem; }

    /* ── Stats bar ─────────────────────────────────────────── */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      border-radius: var(--radius);
      overflow: hidden;
      border: 1px solid var(--border);
      margin-bottom: 1.25rem;
    }
    .stat-card {
      background: var(--surface);
      padding: .9rem 1.2rem;
      display: flex;
      flex-direction: column;
      gap: .15rem;
      transition: background .15s;
    }
    .stat-card:hover { background: var(--surface2); }
    .stat-label {
      font-size: .68rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .07em;
      font-weight: 600;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -.03em;
    }
    .stat-value.total     { color: var(--text); }
    .stat-value.published { color: var(--success); }
    .stat-value.draft     { color: var(--accent2); }

    /* ── Post list ─────────────────────────────────────────── */
    .post-list {
      display: flex;
      flex-direction: column;
      gap: 1px;
      border-radius: var(--radius);
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .post-card {
      background: var(--surface);
      padding: 1.1rem 1.4rem;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: .5rem 1.25rem;
      align-items: start;
      transition: background .15s;
      position: relative;
    }
    .post-card::before {
      content: "";
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      background: transparent;
      transition: background .15s;
    }
    .post-card:hover { background: var(--surface2); }
    .post-card:hover::before { background: var(--accent); }
    .post-card-main { min-width: 0; }

    .post-meta {
      display: flex;
      align-items: center;
      gap: .45rem;
      margin-bottom: .25rem;
    }
    .badge {
      font-size: .65rem;
      font-weight: 700;
      letter-spacing: .05em;
      text-transform: uppercase;
      padding: .13rem .45rem;
      border-radius: 4px;
    }
    .badge-published { background: rgba(52,211,153,.13); color: var(--success); }
    .badge-draft     { background: rgba(122,122,144,.1);  color: var(--muted); }
    .post-date       { font-size: .72rem; color: var(--muted); }

    .post-title {
      font-size: .95rem;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
    }
    .post-excerpt {
      font-size: .8rem;
      color: var(--muted);
      margin-top: .2rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.5;
    }
    .post-card-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: .4rem;
      padding-top: .05rem;
    }

    .publish-btn {
      font-size: .7rem;
      font-weight: 600;
      padding: .22rem .55rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--accent);
      background: transparent;
      color: var(--accent2);
      cursor: pointer;
      white-space: nowrap;
      transition: background .15s, color .15s;
      font-family: inherit;
    }
    .publish-btn:hover { background: var(--accent); color: #fff; }

    .icon-btn {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      padding: .28rem;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      transition: color .15s, background .15s;
    }
    .icon-btn:hover { color: var(--danger); background: rgba(248,113,113,.08); }
    .icon-btn svg { width: 14px; height: 14px; }

    /* ── Empty state ───────────────────────────────────────── */
    .empty-state {
      text-align: center;
      padding: 3.5rem 1rem;
      color: var(--muted);
    }
    .empty-state svg { width: 44px; height: 44px; opacity: .25; margin-bottom: .9rem; }
    .empty-state h3  { font-size: .95rem; font-weight: 600; color: var(--text); margin-bottom: .3rem; }
    .empty-state p   { font-size: .82rem; }
    .empty-state a   { color: var(--accent2); text-decoration: underline; text-underline-offset: 3px; }

    /* ── Detail view ───────────────────────────────────────── */
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      font-size: .82rem;
      color: var(--muted);
      margin-bottom: 1.5rem;
      transition: color .15s;
    }
    .back-link:hover { color: var(--text); }
    .back-link svg { width: 13px; height: 13px; }

    .detail-header {
      margin-bottom: 1.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .detail-header h1 {
      font-size: clamp(1.4rem, 4vw, 2rem);
      font-weight: 800;
      letter-spacing: -.02em;
      line-height: 1.2;
      margin-bottom: .7rem;
    }
    .detail-meta {
      display: flex;
      align-items: center;
      gap: .7rem;
      flex-wrap: wrap;
    }
    .detail-meta time { font-size: .78rem; color: var(--muted); }
    .detail-content {
      font-size: .93rem;
      line-height: 1.8;
      color: #c0c0d4;
      white-space: pre-wrap;
    }

    /* ── Forms ─────────────────────────────────────────────── */
    .form-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem;
      max-width: 600px;
    }
    .form-card h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1.1rem; }
    .form-label {
      display: block;
      font-size: .75rem;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .06em;
      margin-bottom: .38rem;
    }
    .form-input, .form-textarea {
      width: 100%;
      background: var(--surface2);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: .9rem;
      padding: .6rem .85rem;
      border-radius: var(--radius-sm);
      outline: none;
      font-family: inherit;
      transition: border-color .15s;
    }
    .form-input:focus, .form-textarea:focus { border-color: var(--accent); }
    .form-textarea { min-height: 150px; resize: vertical; line-height: 1.55; }
    .form-check {
      display: flex;
      align-items: center;
      gap: .45rem;
      font-size: .83rem;
      color: var(--muted);
      cursor: pointer;
      margin-bottom: 1.4rem;
    }
    .form-check input { accent-color: var(--accent); width: 15px; height: 15px; cursor: pointer; }
    .form-actions { display: flex; gap: .6rem; }
    .btn {
      font-size: .83rem;
      font-weight: 600;
      padding: .55rem 1.1rem;
      border-radius: var(--radius-sm);
      border: none;
      cursor: pointer;
      transition: all .15s;
      font-family: inherit;
    }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { background: var(--accent2); box-shadow: 0 0 18px var(--accent-glow); }
    .btn-ghost {
      background: var(--surface2);
      color: var(--muted);
      border: 1px solid var(--border);
    }
    .btn-ghost:hover { color: var(--text); border-color: var(--muted); }

    /* ── Footer ────────────────────────────────────────────── */
    footer {
      border-top: 1px solid var(--border);
      padding: .9rem clamp(1rem, 5vw, 3rem);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: .72rem;
      color: var(--muted);
    }

    /* ── Responsive ────────────────────────────────────────── */
    @media (max-width: 540px) {
      .stats-bar { grid-template-columns: 1fr; }
      .post-card { grid-template-columns: 1fr; }
      .post-card-actions { flex-direction: row; padding-top: 0; }
    }
  </style>
</head>
<body hx-boost="true">
  <nav>
    <a class="nav-logo" href="/">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      ${title}
    </a>
    <ul class="nav-links">
      <li><a href="/posts/" {% block nav_posts_active %}{% endblock %}>Posts</a></li>
      <li><a href="/posts/new/" class="btn-new">+ New</a></li>
    </ul>
  </nav>

  {% block content %}{% endblock %}

  <footer>
    <span>${title}</span>
    <span>{% block footer_extra %}{% endblock %}</span>
  </footer>

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
