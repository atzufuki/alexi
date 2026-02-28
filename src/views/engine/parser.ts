/**
 * Alexi Template Engine - Parser
 *
 * Converts a flat token stream (from the lexer) into an AST.
 *
 * No Deno-specific APIs — compatible with Service Workers and browsers.
 */

import { tokenize } from "./lexer.ts";
import type {
  ASTNode,
  BlockNode,
  ExtendsNode,
  ForNode,
  IfNode,
  IncludeNode,
} from "./nodes.ts";

// =============================================================================
// Parse Error
// =============================================================================

export class TemplateParseError extends Error {
  constructor(message: string) {
    super(`TemplateParseError: ${message}`);
    this.name = "TemplateParseError";
  }
}

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse a template source string into an AST node list.
 */
export function parse(source: string): ASTNode[] {
  const tokens = tokenize(source);
  const iter = new TokenIterator(tokens);
  return parseBody(iter, null);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

import type { Token } from "./lexer.ts";

class TokenIterator {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  hasMore(): boolean {
    return this.pos < this.tokens.length;
  }
}

/**
 * Parse tokens into AST nodes until one of the `stopTags` is encountered
 * (e.g. `endblock`, `endfor`, `endif`, `else`, `elif`, `empty`).
 *
 * @param iter    - Token stream
 * @param stopAt  - Set of block tag names that terminate this body, or null
 * @returns Parsed nodes (the stop tag token is NOT consumed)
 */
function parseBody(
  iter: TokenIterator,
  stopAt: Set<string> | null,
): ASTNode[] {
  const nodes: ASTNode[] = [];

  while (iter.hasMore()) {
    const tok = iter.peek()!;

    if (tok.type === "text") {
      iter.next();
      nodes.push({ type: "text", content: tok.value });
      continue;
    }

    if (tok.type === "comment") {
      iter.next();
      nodes.push({ type: "comment" });
      continue;
    }

    if (tok.type === "variable") {
      iter.next();
      nodes.push({ type: "variable", path: tok.value });
      continue;
    }

    // block_start
    if (tok.type === "block_start") {
      const tagName = firstWord(tok.value);

      // Check if this is a stop tag
      if (stopAt && stopAt.has(tagName)) {
        // Leave the token in the stream for the caller to consume
        return nodes;
      }

      iter.next(); // consume the tag

      switch (tagName) {
        case "extends":
          nodes.push(parseExtends(tok.value));
          break;
        case "block":
          nodes.push(parseBlock(tok.value, iter));
          break;
        case "for":
          nodes.push(parseFor(tok.value, iter));
          break;
        case "if":
          nodes.push(parseIf(tok.value, iter));
          break;
        case "include":
          nodes.push(parseInclude(tok.value));
          break;
        case "endblock":
        case "endfor":
        case "endif":
          throw new TemplateParseError(
            `Unexpected tag "${tagName}" with no matching opening tag`,
          );
        default:
          // Unknown tags → emit as-is so they don't silently disappear
          nodes.push({ type: "text", content: tok.raw });
      }
      continue;
    }

    // Should never reach here
    iter.next();
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Tag parsers
// ---------------------------------------------------------------------------

function parseExtends(tagContent: string): ExtendsNode {
  // {% extends "base.html" %} or {% extends 'base.html' %}
  const m = tagContent.match(/^extends\s+["'](.+?)["']$/);
  if (!m) {
    throw new TemplateParseError(
      `Invalid extends tag: {% ${tagContent} %}`,
    );
  }
  return { type: "extends", templateName: m[1] };
}

function parseBlock(tagContent: string, iter: TokenIterator): BlockNode {
  // {% block name %}
  const m = tagContent.match(/^block\s+(\w+)$/);
  if (!m) {
    throw new TemplateParseError(`Invalid block tag: {% ${tagContent} %}`);
  }
  const name = m[1];
  const body = parseBody(iter, new Set(["endblock"]));
  consumeTag(iter, "endblock");
  return { type: "block", name, body };
}

function parseFor(tagContent: string, iter: TokenIterator): ForNode {
  // {% for item in items %}
  const m = tagContent.match(/^for\s+(\w+)\s+in\s+(\S+)$/);
  if (!m) {
    throw new TemplateParseError(`Invalid for tag: {% ${tagContent} %}`);
  }
  const variable = m[1];
  const iterable = m[2];

  const body = parseBody(iter, new Set(["endfor", "empty"]));

  // Check for optional {% empty %}
  let emptyBody: ASTNode[] = [];
  const next = iter.peek();
  if (
    next && next.type === "block_start" && firstWord(next.value) === "empty"
  ) {
    iter.next(); // consume {% empty %}
    emptyBody = parseBody(iter, new Set(["endfor"]));
  }

  consumeTag(iter, "endfor");
  return { type: "for", variable, iterable, body, emptyBody };
}

function parseIf(tagContent: string, iter: TokenIterator): IfNode {
  // {% if condition %}
  const condition = tagContent.replace(/^if\s+/, "").trim();
  if (!condition) {
    throw new TemplateParseError(`Empty if condition: {% ${tagContent} %}`);
  }

  const branches: IfNode["branches"] = [];

  let currentCondition: string | null = condition;
  let currentBody = parseBody(
    iter,
    new Set(["elif", "else", "endif"]),
  );
  branches.push({ condition: currentCondition, body: currentBody });

  while (iter.hasMore()) {
    const tok = iter.peek()!;
    if (tok.type !== "block_start") break;
    const tag = firstWord(tok.value);
    if (tag === "endif") {
      iter.next(); // consume {% endif %}
      break;
    }
    if (tag === "elif") {
      iter.next();
      currentCondition = tok.value.replace(/^elif\s+/, "").trim();
      currentBody = parseBody(iter, new Set(["elif", "else", "endif"]));
      branches.push({ condition: currentCondition, body: currentBody });
    } else if (tag === "else") {
      iter.next();
      currentBody = parseBody(iter, new Set(["endif"]));
      branches.push({ condition: null, body: currentBody });
    } else {
      break;
    }
  }

  return { type: "if", branches };
}

function parseInclude(tagContent: string): IncludeNode {
  // {% include "partial.html" %} or {% include 'partial.html' %}
  const m = tagContent.match(/^include\s+["'](.+?)["']$/);
  if (!m) {
    throw new TemplateParseError(`Invalid include tag: {% ${tagContent} %}`);
  }
  return { type: "include", templateName: m[1] };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function firstWord(s: string): string {
  return s.trimStart().split(/\s+/)[0] ?? "";
}

function consumeTag(iter: TokenIterator, expectedTag: string): void {
  const tok = iter.next();
  if (
    !tok || tok.type !== "block_start" || firstWord(tok.value) !== expectedTag
  ) {
    throw new TemplateParseError(
      `Expected {%% ${expectedTag} %%} but got ${
        tok?.raw ?? "end of template"
      }`,
    );
  }
}
