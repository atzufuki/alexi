/**
 * Alexi Template Engine - Renderer
 *
 * Renders a parsed AST against a context object, resolving template
 * inheritance, includes, loops and conditionals.
 *
 * No Deno-specific APIs — compatible with Service Workers and browsers.
 */

import { parse, TemplateParseError } from "./parser.ts";
import type {
  ASTNode,
  BlockNode,
  ExtendsNode,
  ForNode,
  IfNode,
} from "./nodes.ts";

// =============================================================================
// Context
// =============================================================================

/** A plain-object context passed to template rendering */
export type TemplateContext = Record<string, unknown>;

// =============================================================================
// Template Loader Interface
// =============================================================================

/**
 * Interface for resolving template names to source strings.
 * Implemented differently on server (filesystem) and in SW (registry).
 */
export interface TemplateLoader {
  load(templateName: string): Promise<string>;
}

// =============================================================================
// Renderer
// =============================================================================

/**
 * Render a template by name using the provided loader and context.
 */
export async function render(
  templateName: string,
  context: TemplateContext,
  loader: TemplateLoader,
): Promise<string> {
  const source = await loader.load(templateName);
  const nodes = parse(source);
  return renderNodes(nodes, context, loader, new Map());
}

// ---------------------------------------------------------------------------
// Internal rendering
// ---------------------------------------------------------------------------

/**
 * Render a list of AST nodes.
 *
 * @param nodes   - AST nodes to render
 * @param ctx     - Template context
 * @param loader  - Template loader for extends/include
 * @param blocks  - Block overrides from child templates
 */
async function renderNodes(
  nodes: ASTNode[],
  ctx: TemplateContext,
  loader: TemplateLoader,
  blocks: Map<string, BlockNode>,
): Promise<string> {
  // Check if the first real node is {% extends %}
  const firstSignificant = nodes.find(
    (n) =>
      n.type !== "text" || (n as { content: string }).content.trim() !== "",
  );

  if (firstSignificant?.type === "extends") {
    return renderExtends(
      firstSignificant as ExtendsNode,
      nodes,
      ctx,
      loader,
      blocks,
    );
  }

  const parts: string[] = [];
  for (const node of nodes) {
    parts.push(await renderNode(node, ctx, loader, blocks));
  }
  return parts.join("");
}

async function renderNode(
  node: ASTNode,
  ctx: TemplateContext,
  loader: TemplateLoader,
  blocks: Map<string, BlockNode>,
): Promise<string> {
  switch (node.type) {
    case "text":
      return node.content;

    case "comment":
      return "";

    case "variable":
      return String(resolvePath(node.path, ctx) ?? "");

    case "block": {
      // If a child template overrode this block, use the override
      const override = blocks.get(node.name);
      const bodyToRender = override ? override.body : node.body;
      return renderNodes(bodyToRender, ctx, loader, blocks);
    }

    case "for":
      return renderFor(node as ForNode, ctx, loader, blocks);

    case "if":
      return renderIf(node as IfNode, ctx, loader, blocks);

    case "include": {
      const partial = await loader.load(node.templateName);
      const partialNodes = parse(partial);
      return renderNodes(partialNodes, ctx, loader, blocks);
    }

    case "extends":
      throw new TemplateParseError(
        "{% extends %} must be the first tag in a template",
      );

    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// {% extends %}
// ---------------------------------------------------------------------------

async function renderExtends(
  extendsNode: ExtendsNode,
  childNodes: ASTNode[],
  ctx: TemplateContext,
  loader: TemplateLoader,
  inheritedBlocks: Map<string, BlockNode>,
): Promise<string> {
  // Collect block definitions from the child template.
  // Blocks defined in the child override blocks with the same name in parent.
  const childBlocks = new Map<string, BlockNode>(inheritedBlocks);
  for (const node of childNodes) {
    if (node.type === "block") {
      // Child block overrides parent — but only if not already set by a
      // grandchild (deeper inheritance keeps the deepest override).
      if (!childBlocks.has(node.name)) {
        childBlocks.set(node.name, node);
      }
    }
  }

  // Load and parse the parent template
  const parentSource = await loader.load(extendsNode.templateName);
  const parentNodes = parse(parentSource);

  // Render the parent with the child's block overrides
  return renderNodes(parentNodes, ctx, loader, childBlocks);
}

// ---------------------------------------------------------------------------
// {% for %}
// ---------------------------------------------------------------------------

async function renderFor(
  node: ForNode,
  ctx: TemplateContext,
  loader: TemplateLoader,
  blocks: Map<string, BlockNode>,
): Promise<string> {
  const iterable = resolvePath(node.iterable, ctx);
  if (!Array.isArray(iterable) || iterable.length === 0) {
    // Render {% empty %} body if present
    if (node.emptyBody.length > 0) {
      return renderNodes(node.emptyBody, ctx, loader, blocks);
    }
    return "";
  }

  const parts: string[] = [];
  for (let i = 0; i < iterable.length; i++) {
    const loopCtx: TemplateContext = {
      ...ctx,
      [node.variable]: iterable[i],
      forloop: {
        counter: i + 1,
        counter0: i,
        revcounter: iterable.length - i,
        revcounter0: iterable.length - i - 1,
        first: i === 0,
        last: i === iterable.length - 1,
      },
    };
    parts.push(await renderNodes(node.body, loopCtx, loader, blocks));
  }
  return parts.join("");
}

// ---------------------------------------------------------------------------
// {% if %}
// ---------------------------------------------------------------------------

async function renderIf(
  node: IfNode,
  ctx: TemplateContext,
  loader: TemplateLoader,
  blocks: Map<string, BlockNode>,
): Promise<string> {
  for (const branch of node.branches) {
    // `else` branch has condition === null
    if (branch.condition === null || evaluateCondition(branch.condition, ctx)) {
      return renderNodes(branch.body, ctx, loader, blocks);
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a simple condition expression.
 *
 * Supported forms:
 * - `variable`          — truthy check
 * - `not variable`      — negation
 * - `a == b`            — equality
 * - `a != b`            — inequality
 * - `a > b`             — greater than
 * - `a >= b`            — >=
 * - `a < b`             — less than
 * - `a <= b`            — <=
 */
function evaluateCondition(expr: string, ctx: TemplateContext): boolean {
  const trimmed = expr.trim();

  // `not X`
  const notMatch = trimmed.match(/^not\s+(.+)$/);
  if (notMatch) {
    return !isTruthy(resolveValue(notMatch[1].trim(), ctx));
  }

  // Binary operators
  const binMatch = trimmed.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (binMatch) {
    const left = resolveValue(binMatch[1].trim(), ctx);
    const right = resolveValue(binMatch[3].trim(), ctx);
    switch (binMatch[2]) {
      case "==":
        return left == right; // intentional loose equality
      case "!=":
        return left != right;
      case ">":
        return (left as number) > (right as number);
      case ">=":
        return (left as number) >= (right as number);
      case "<":
        return (left as number) < (right as number);
      case "<=":
        return (left as number) <= (right as number);
    }
  }

  // Simple truthy
  return isTruthy(resolveValue(trimmed, ctx));
}

// ---------------------------------------------------------------------------
// Value resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a single value token — either a literal or a context path.
 */
function resolveValue(token: string, ctx: TemplateContext): unknown {
  // String literals
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1);
  }
  // Numeric literals
  if (/^-?\d+(\.\d+)?$/.test(token)) {
    return Number(token);
  }
  // Boolean / null literals
  if (token === "true") return true;
  if (token === "false") return false;
  if (token === "null" || token === "None") return null;

  // Context path
  return resolvePath(token, ctx);
}

/**
 * Resolve a dot-notation path into a context object.
 *
 * @example resolvePath("user.profile.name", ctx)
 */
function resolvePath(path: string, ctx: TemplateContext): unknown {
  const parts = path.split(".");
  let value: unknown = ctx;
  for (const part of parts) {
    if (value == null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

/**
 * Django-style truthiness: false for `false`, `0`, `""`, `null`,
 * `undefined`, and empty arrays/objects.
 */
function isTruthy(value: unknown): boolean {
  if (value === false || value === null || value === undefined) return false;
  if (value === 0 || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}
