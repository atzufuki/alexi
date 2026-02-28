/**
 * Tests for the Alexi template engine.
 *
 * Covers: lexer, parser, renderer (variables, for, if, extends, include, empty)
 * and the MemoryTemplateLoader.
 *
 * No Deno-specific filesystem access — all tests use MemoryTemplateLoader.
 */

import { assertEquals, assertMatch, assertRejects } from "jsr:@std/assert@1";

import { tokenize } from "./engine/lexer.ts";
import { parse, TemplateParseError } from "./engine/parser.ts";
import { render } from "./engine/renderer.ts";
import {
  MemoryTemplateLoader,
  TemplateNotFoundError,
} from "./engine/registry.ts";

// =============================================================================
// Helper
// =============================================================================

/** Render a template string directly using an in-memory loader. */
async function renderStr(
  source: string,
  ctx: Record<string, unknown> = {},
  extra: Record<string, string> = {},
): Promise<string> {
  const loader = new MemoryTemplateLoader();
  loader.register("__main__", source);
  for (const [name, src] of Object.entries(extra)) {
    loader.register(name, src);
  }
  return render("__main__", ctx, loader);
}

// =============================================================================
// Lexer
// =============================================================================

Deno.test("lexer: tokenises text-only source", () => {
  const tokens = tokenize("<p>Hello</p>");
  assertEquals(tokens.length, 1);
  assertEquals(tokens[0].type, "text");
  assertEquals(tokens[0].value, "<p>Hello</p>");
});

Deno.test("lexer: tokenises variable", () => {
  const tokens = tokenize("{{ name }}");
  assertEquals(tokens.length, 1);
  assertEquals(tokens[0].type, "variable");
  assertEquals(tokens[0].value, "name");
});

Deno.test("lexer: tokenises block tag", () => {
  const tokens = tokenize("{% if x %}y{% endif %}");
  assertEquals(tokens[0].type, "block_start");
  assertEquals(tokens[0].value, "if x");
  assertEquals(tokens[1].type, "text");
  assertEquals(tokens[2].type, "block_start");
  assertEquals(tokens[2].value, "endif");
});

Deno.test("lexer: tokenises comment", () => {
  const tokens = tokenize("{# this is a comment #}");
  assertEquals(tokens.length, 1);
  assertEquals(tokens[0].type, "comment");
});

Deno.test("lexer: mixed content", () => {
  const tokens = tokenize("<h1>{{ title }}</h1>");
  assertEquals(tokens.length, 3);
  assertEquals(tokens[0].type, "text");
  assertEquals(tokens[1].type, "variable");
  assertEquals(tokens[2].type, "text");
});

// =============================================================================
// Parser — basic structure
// =============================================================================

Deno.test("parser: text node", () => {
  const nodes = parse("hello");
  assertEquals(nodes.length, 1);
  assertEquals(nodes[0].type, "text");
});

Deno.test("parser: variable node", () => {
  const nodes = parse("{{ title }}");
  assertEquals(nodes.length, 1);
  assertEquals(nodes[0].type, "variable");
  assertEquals((nodes[0] as { path: string }).path, "title");
});

Deno.test("parser: for node", () => {
  const nodes = parse("{% for item in items %}{{ item }}{% endfor %}");
  assertEquals(nodes.length, 1);
  assertEquals(nodes[0].type, "for");
});

Deno.test("parser: if/elif/else node", () => {
  const nodes = parse(
    "{% if x %}a{% elif y %}b{% else %}c{% endif %}",
  );
  assertEquals(nodes.length, 1);
  const ifNode = nodes[0] as { type: string; branches: unknown[] };
  assertEquals(ifNode.type, "if");
  assertEquals(ifNode.branches.length, 3);
});

Deno.test("parser: block node", () => {
  const nodes = parse("{% block title %}Default{% endblock %}");
  assertEquals(nodes.length, 1);
  assertEquals(nodes[0].type, "block");
});

Deno.test("parser: comment is discarded", () => {
  const nodes = parse("{# this is ignored #}");
  assertEquals(nodes.length, 1);
  assertEquals(nodes[0].type, "comment");
});

Deno.test("parser: extends node", () => {
  const nodes = parse('{% extends "base.html" %}');
  assertEquals(nodes.length, 1);
  assertEquals(nodes[0].type, "extends");
  assertEquals(
    (nodes[0] as { templateName: string }).templateName,
    "base.html",
  );
});

Deno.test("parser: throws on invalid for", () => {
  const fn = () => parse("{% for bad %} {% endfor %}");
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    assertEquals(e instanceof TemplateParseError, true);
  }
  assertEquals(threw, true);
});

// =============================================================================
// Renderer — variables
// =============================================================================

Deno.test("renderer: simple variable", async () => {
  const out = await renderStr("Hello {{ name }}!", { name: "World" });
  assertEquals(out, "Hello World!");
});

Deno.test("renderer: dot-notation", async () => {
  const out = await renderStr("{{ user.profile.name }}", {
    user: { profile: { name: "Alice" } },
  });
  assertEquals(out, "Alice");
});

Deno.test("renderer: missing variable renders empty string", async () => {
  const out = await renderStr("{{ missing }}", {});
  assertEquals(out, "");
});

Deno.test("renderer: comment produces no output", async () => {
  const out = await renderStr("{# hidden #}visible");
  assertEquals(out, "visible");
});

// =============================================================================
// Renderer — for loop
// =============================================================================

Deno.test("renderer: for loop", async () => {
  const out = await renderStr(
    "{% for item in items %}[{{ item }}]{% endfor %}",
    { items: ["a", "b", "c"] },
  );
  assertEquals(out, "[a][b][c]");
});

Deno.test("renderer: for loop with object properties", async () => {
  const out = await renderStr(
    "{% for note in notes %}{{ note.title }}|{% endfor %}",
    { notes: [{ title: "First" }, { title: "Second" }] },
  );
  assertEquals(out, "First|Second|");
});

Deno.test("renderer: for loop forloop variable", async () => {
  const out = await renderStr(
    "{% for item in items %}{{ forloop.counter }}{% endfor %}",
    { items: ["x", "y"] },
  );
  assertEquals(out, "12");
});

Deno.test("renderer: for loop empty body", async () => {
  const out = await renderStr(
    "{% for item in items %}{{ item }}{% empty %}nothing{% endfor %}",
    { items: [] },
  );
  assertEquals(out, "nothing");
});

Deno.test("renderer: for loop non-array shows empty body", async () => {
  const out = await renderStr(
    "{% for item in items %}{{ item }}{% empty %}nada{% endfor %}",
    { items: null },
  );
  assertEquals(out, "nada");
});

// =============================================================================
// Renderer — if/elif/else
// =============================================================================

Deno.test("renderer: if true branch", async () => {
  const out = await renderStr(
    "{% if show %}yes{% endif %}",
    { show: true },
  );
  assertEquals(out, "yes");
});

Deno.test("renderer: if false branch skipped", async () => {
  const out = await renderStr(
    "{% if show %}yes{% endif %}",
    { show: false },
  );
  assertEquals(out, "");
});

Deno.test("renderer: if/else", async () => {
  const out = await renderStr(
    "{% if x %}A{% else %}B{% endif %}",
    { x: false },
  );
  assertEquals(out, "B");
});

Deno.test("renderer: if/elif/else", async () => {
  const out = await renderStr(
    "{% if x %}A{% elif y %}B{% else %}C{% endif %}",
    { x: false, y: true },
  );
  assertEquals(out, "B");
});

Deno.test("renderer: if with equality check", async () => {
  const out = await renderStr(
    '{% if status == "open" %}Open{% else %}Closed{% endif %}',
    { status: "open" },
  );
  assertEquals(out, "Open");
});

Deno.test("renderer: if with not", async () => {
  const out = await renderStr(
    "{% if not hidden %}visible{% endif %}",
    { hidden: false },
  );
  assertEquals(out, "visible");
});

Deno.test("renderer: if with greater-than", async () => {
  const out = await renderStr(
    "{% if count > 0 %}has items{% endif %}",
    { count: 5 },
  );
  assertEquals(out, "has items");
});

// =============================================================================
// Renderer — include
// =============================================================================

Deno.test("renderer: include", async () => {
  const out = await renderStr(
    'Before{% include "partial.html" %}After',
    {},
    { "partial.html": "<b>partial</b>" },
  );
  assertEquals(out, "Before<b>partial</b>After");
});

Deno.test("renderer: include passes context", async () => {
  const out = await renderStr(
    '{% include "partial.html" %}',
    { name: "Alexi" },
    { "partial.html": "Hello {{ name }}" },
  );
  assertEquals(out, "Hello Alexi");
});

// =============================================================================
// Renderer — template inheritance
// =============================================================================

Deno.test("renderer: extends with block override", async () => {
  const base =
    `<html><title>{% block title %}Base{% endblock %}</title></html>`;
  const child = `{% extends "base.html" %}{% block title %}Child{% endblock %}`;

  const out = await renderStr(child, {}, { "base.html": base });
  assertEquals(out, "<html><title>Child</title></html>");
});

Deno.test("renderer: extends uses default block content", async () => {
  const base = `<main>{% block content %}default{% endblock %}</main>`;
  const child = `{% extends "base.html" %}`;

  const out = await renderStr(child, {}, { "base.html": base });
  assertEquals(out, "<main>default</main>");
});

Deno.test("renderer: extends with context variable in block", async () => {
  const base = `{% block title %}{% endblock %}`;
  const child =
    `{% extends "base.html" %}{% block title %}{{ pageTitle }}{% endblock %}`;

  const out = await renderStr(child, { pageTitle: "Notes" }, {
    "base.html": base,
  });
  assertEquals(out, "Notes");
});

Deno.test("renderer: three-level inheritance", async () => {
  const grandparent = `GP:{% block x %}gp{% endblock %}`;
  const parent =
    `{% extends "gp.html" %}{% block x %}parent-{% block y %}py{% endblock %}{% endblock %}`;
  const child = `{% extends "parent.html" %}{% block y %}child{% endblock %}`;

  const loader = new MemoryTemplateLoader();
  loader.register("gp.html", grandparent);
  loader.register("parent.html", parent);
  loader.register("child.html", child);

  const out = await render("child.html", {}, loader);
  assertEquals(out, "GP:parent-child");
});

// =============================================================================
// MemoryTemplateLoader
// =============================================================================

Deno.test("MemoryTemplateLoader: throws TemplateNotFoundError", async () => {
  const loader = new MemoryTemplateLoader();
  await assertRejects(
    () => loader.load("missing.html"),
    TemplateNotFoundError,
  );
});

Deno.test("MemoryTemplateLoader: registerAll", async () => {
  const loader = new MemoryTemplateLoader();
  loader.registerAll({ "a.html": "A", "b.html": "B" });
  assertEquals(await loader.load("a.html"), "A");
  assertEquals(await loader.load("b.html"), "B");
});

Deno.test("MemoryTemplateLoader: has", () => {
  const loader = new MemoryTemplateLoader();
  loader.register("x.html", "content");
  assertEquals(loader.has("x.html"), true);
  assertEquals(loader.has("y.html"), false);
});

Deno.test("MemoryTemplateLoader: clear", async () => {
  const loader = new MemoryTemplateLoader();
  loader.register("x.html", "content");
  loader.clear();
  await assertRejects(
    () => loader.load("x.html"),
    TemplateNotFoundError,
  );
});

// =============================================================================
// Full integration — issue example templates
// =============================================================================

Deno.test("integration: issue #163 example templates", async () => {
  const baseHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>{% block title %}My App{% endblock %}</title>
</head>
<body>
  <main id="content">
    {% block content %}{% endblock %}
  </main>
</body>
</html>`;

  const noteListHtml = `{% extends "my-app/base.html" %}

{% block title %}Notes{% endblock %}

{% block content %}
<h1>Notes</h1>
<ul>
  {% for note in notes %}
  <li>{{ note.title }}</li>
  {% endfor %}
</ul>
{% endblock %}`;

  const loader = new MemoryTemplateLoader();
  loader.register("my-app/base.html", baseHtml);
  loader.register("my-app/note_list.html", noteListHtml);

  const out = await render("my-app/note_list.html", {
    notes: [{ title: "Alpha" }, { title: "Beta" }],
  }, loader);

  assertMatch(out, /<title>Notes<\/title>/);
  assertMatch(out, /<h1>Notes<\/h1>/);
  assertMatch(out, /Alpha/);
  assertMatch(out, /Beta/);
});
