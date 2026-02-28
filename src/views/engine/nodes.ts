/**
 * Alexi Template Engine - AST Node Types
 *
 * Abstract Syntax Tree nodes produced by the parser and consumed
 * by the renderer.
 *
 * No Deno-specific APIs — compatible with Service Workers and browsers.
 */

// =============================================================================
// AST Nodes
// =============================================================================

export type ASTNode =
  | TextNode
  | VariableNode
  | BlockNode
  | ForNode
  | IfNode
  | ExtendsNode
  | IncludeNode
  | CommentNode;

/** Raw text / HTML output */
export interface TextNode {
  type: "text";
  content: string;
}

/** `{{ expression }}` — dot-notation path into context */
export interface VariableNode {
  type: "variable";
  /** e.g. "user.profile.name" */
  path: string;
}

/** `{% block name %}...{% endblock %}` */
export interface BlockNode {
  type: "block";
  name: string;
  body: ASTNode[];
}

/** `{% for item in items %}...{% endfor %}` */
export interface ForNode {
  type: "for";
  /** Loop variable name */
  variable: string;
  /** Context path for iterable */
  iterable: string;
  body: ASTNode[];
  /** Optional `{% empty %}` body */
  emptyBody: ASTNode[];
}

/** `{% if cond %}...{% elif cond %}...{% else %}...{% endif %}` */
export interface IfNode {
  type: "if";
  branches: Array<{
    /** null means the `else` branch */
    condition: string | null;
    body: ASTNode[];
  }>;
}

/** `{% extends "base.html" %}` — must be first node in template */
export interface ExtendsNode {
  type: "extends";
  templateName: string;
}

/** `{% include "partial.html" %}` */
export interface IncludeNode {
  type: "include";
  templateName: string;
}

/** `{# comment #}` — no output */
export interface CommentNode {
  type: "comment";
}
