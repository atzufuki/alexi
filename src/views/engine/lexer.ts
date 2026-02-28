/**
 * Alexi Template Engine - Lexer
 *
 * Tokenizes Django-style template syntax into a stream of tokens.
 * Handles `{{ var }}`, `{% tag %}`, and raw text.
 *
 * No Deno-specific APIs — compatible with Service Workers and browsers.
 */

// =============================================================================
// Token Types
// =============================================================================

export type TokenType =
  | "text" // Raw text / HTML
  | "variable" // {{ expression }}
  | "block_start" // {% tag ... %}
  | "comment"; // {# comment #}

export interface Token {
  type: TokenType;
  value: string; // Trimmed inner content (for variable/block/comment)
  raw: string; // Original source text
}

// =============================================================================
// Lexer
// =============================================================================

/**
 * Tokenize a template string into a flat list of tokens.
 *
 * Recognises:
 * - `{{ expr }}`  → variable token
 * - `{% tag %}`   → block_start token
 * - `{# text #}`  → comment token (discarded by parser)
 * - Everything else → text token
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  // Matches {{ }}, {% %}, {# #} — in that priority order.
  const pattern = /(\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\})/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const before = source.slice(lastIndex, match.index);
    if (before) {
      tokens.push({ type: "text", value: before, raw: before });
    }

    const raw = match[0];
    if (raw.startsWith("{{")) {
      tokens.push({
        type: "variable",
        value: raw.slice(2, -2).trim(),
        raw,
      });
    } else if (raw.startsWith("{%")) {
      tokens.push({
        type: "block_start",
        value: raw.slice(2, -2).trim(),
        raw,
      });
    } else {
      // {# comment #} — emit as comment so parser can skip it
      tokens.push({
        type: "comment",
        value: raw.slice(2, -2).trim(),
        raw,
      });
    }

    lastIndex = match.index + raw.length;
  }

  const trailing = source.slice(lastIndex);
  if (trailing) {
    tokens.push({ type: "text", value: trailing, raw: trailing });
  }

  return tokens;
}
