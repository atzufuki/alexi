/**
 * Alexi Template Engine - Public API
 *
 * Re-exports all public symbols from the template engine sub-modules.
 */

export { tokenize } from "./lexer.ts";
export type { Token, TokenType } from "./lexer.ts";

export type { ASTNode } from "./nodes.ts";

export { parse, TemplateParseError } from "./parser.ts";

export { render } from "./renderer.ts";
export type { TemplateContext, TemplateLoader } from "./renderer.ts";

export {
  ChainTemplateLoader,
  FilesystemTemplateLoader,
  MemoryTemplateLoader,
  TemplateNotFoundError,
  templateRegistry,
} from "./registry.ts";
