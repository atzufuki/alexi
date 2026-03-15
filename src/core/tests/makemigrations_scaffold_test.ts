/**
 * Tests for MakemigrationsCommand scaffold template generation
 *
 * Verifies that the generated backwards() stubs use `deprecateModel` /
 * `deprecateField` (for forwards-direction removals) and `restoreModel` /
 * `restoreField` (for backwards-direction undos), as documented in AGENTS.md.
 *
 * @module @alexi/core/tests/makemigrations_scaffold_test
 */

import { assertMatch, assertStringIncludes } from "jsr:@std/assert@1";
import { MakemigrationsCommand } from "../management/commands/makemigrations.ts";

// =============================================================================
// Helpers
// =============================================================================

/** Access private methods on MakemigrationsCommand for testing. */
// deno-lint-ignore no-explicit-any
type AnyChange = any;

// deno-lint-ignore no-explicit-any
function cmd(): any {
  return new MakemigrationsCommand();
}

// =============================================================================
// Tests — backwards() stubs use deprecate* / restore*
// =============================================================================

Deno.test(
  "makemigrations scaffold: backwards stub for create_model uses deprecateModel",
  () => {
    const changes: AnyChange[] = [
      { type: "create_model", modelName: "Article", appLabel: "blog" },
    ];
    const result: string = cmd()._generateBackwardsHints(changes);
    assertStringIncludes(result, "schema.deprecateModel(");
  },
);

Deno.test(
  "makemigrations scaffold: backwards stub for delete_model uses restoreModel",
  () => {
    const changes: AnyChange[] = [
      { type: "delete_model", modelName: "Article", appLabel: "blog" },
    ];
    const result: string = cmd()._generateBackwardsHints(changes);
    assertStringIncludes(result, "schema.restoreModel(");
  },
);

Deno.test(
  "makemigrations scaffold: backwards stub for add_field uses deprecateField",
  () => {
    const changes: AnyChange[] = [
      {
        type: "add_field",
        modelName: "Article",
        appLabel: "blog",
        fieldName: "title",
        field: {
          type: "CharField",
          options: { maxLength: 200 },
          columnName: "title",
        },
      },
    ];
    const result: string = cmd()._generateBackwardsHints(changes);
    assertStringIncludes(result, "schema.deprecateField(");
    assertStringIncludes(result, '"title"');
  },
);

Deno.test(
  "makemigrations scaffold: backwards stub for remove_field uses restoreField",
  () => {
    const changes: AnyChange[] = [
      {
        type: "remove_field",
        modelName: "Article",
        appLabel: "blog",
        fieldName: "legacy",
        field: {
          type: "CharField",
          options: { maxLength: 100 },
          columnName: "legacy",
        },
      },
    ];
    const result: string = cmd()._generateBackwardsHints(changes);
    assertStringIncludes(result, "schema.restoreField(");
    assertStringIncludes(result, '"legacy"');
  },
);

Deno.test(
  "makemigrations scaffold: forwards stub for delete_model uses deprecateModel",
  () => {
    const changes: AnyChange[] = [
      { type: "delete_model", modelName: "Article", appLabel: "blog" },
    ];
    const result: string = cmd()._generateForwardsHints(changes);
    assertStringIncludes(result, "schema.deprecateModel(");
  },
);

Deno.test(
  "makemigrations scaffold: forwards stub for remove_field uses deprecateField",
  () => {
    const changes: AnyChange[] = [
      {
        type: "remove_field",
        modelName: "Article",
        appLabel: "blog",
        fieldName: "legacy",
        field: {
          type: "CharField",
          options: { maxLength: 100 },
          columnName: "legacy",
        },
      },
    ];
    const result: string = cmd()._generateForwardsHints(changes);
    assertStringIncludes(result, "schema.deprecateField(");
    assertStringIncludes(result, '"legacy"');
  },
);

Deno.test(
  "makemigrations scaffold: template comments reference restoreModel/restoreField",
  () => {
    const changes: AnyChange[] = [
      { type: "create_model", modelName: "Article", appLabel: "blog" },
    ];
    const result: string = cmd()._generateMigrationTemplate(
      "blog",
      "0001_create_article",
      [],
      false,
      changes,
    );
    assertStringIncludes(result, "restoreModel");
    assertStringIncludes(result, "restoreField");
    // Must NOT contain the old undeprecate terminology
    assertMatch(result, /^(?!.*undeprecate)[\s\S]*$/);
  },
);
