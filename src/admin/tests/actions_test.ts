/**
 * Alexi Admin - Actions and Confirm Dialog Tests
 *
 * TDD tests for Phase 6: Bulk actions and confirmation dialogs
 *
 * @module
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { AutoField, BooleanField, CharField, Manager, Model } from "@alexi/db";

// =============================================================================
// Test Models
// =============================================================================

class TestUserModel extends Model {
  id = new AutoField({ primaryKey: true });
  email = new CharField({ maxLength: 200 });
  isActive = new BooleanField({ default: true });

  static objects = new Manager(TestUserModel);
  static meta = {
    dbTable: "test_users",
  };
}

// =============================================================================
// Import action utilities (to be implemented)
// =============================================================================

import {
  type ActionConfig,
  type ActionResult,
  buildActionConfig,
  getAvailableActions,
  validateActionSelection,
} from "../actions.ts";
import { ModelAdmin } from "../model_admin.ts";

// =============================================================================
// Test ModelAdmin with Actions
// =============================================================================

class TestUserAdmin extends ModelAdmin {
  model = TestUserModel;
  listDisplay = ["id", "email", "isActive"];
  actions = ["delete_selected", "activate_selected", "deactivate_selected"];
}

// =============================================================================
// Action Configuration Tests
// =============================================================================

Deno.test("getAvailableActions: returns default delete action", () => {
  const admin = new ModelAdmin();

  const actions = getAvailableActions(admin);

  assertEquals(actions.length, 1);
  assertEquals(actions[0].name, "delete_selected");
});

Deno.test("getAvailableActions: returns custom actions from ModelAdmin", () => {
  const admin = new TestUserAdmin();

  const actions = getAvailableActions(admin);

  assertEquals(actions.length, 3);
  const names = actions.map((a) => a.name);
  assertEquals(names.includes("delete_selected"), true);
  assertEquals(names.includes("activate_selected"), true);
  assertEquals(names.includes("deactivate_selected"), true);
});

Deno.test("getAvailableActions: includes labels for actions", () => {
  const admin = new TestUserAdmin();

  const actions = getAvailableActions(admin);

  const deleteAction = actions.find((a) => a.name === "delete_selected");
  assertExists(deleteAction);
  assertEquals(deleteAction.label, "Delete Selected");
});

Deno.test("getAvailableActions: generates human-readable labels", () => {
  const admin = new TestUserAdmin();

  const actions = getAvailableActions(admin);

  const activateAction = actions.find((a) => a.name === "activate_selected");
  assertExists(activateAction);
  assertEquals(activateAction.label, "Activate Selected");
});

// =============================================================================
// Action Config Tests
// =============================================================================

Deno.test("buildActionConfig: creates config for delete action", () => {
  const config = buildActionConfig("delete_selected", {
    selectedIds: ["1", "2", "3"],
  });

  assertEquals(config.actionName, "delete_selected");
  assertEquals(config.selectedIds.length, 3);
  assertEquals(config.requiresConfirmation, true);
});

Deno.test("buildActionConfig: sets danger type for delete action", () => {
  const config = buildActionConfig("delete_selected", {
    selectedIds: ["1"],
  });

  assertEquals(config.confirmationType, "danger");
});

Deno.test("buildActionConfig: sets default confirmation type for other actions", () => {
  const config = buildActionConfig("activate_selected", {
    selectedIds: ["1"],
  });

  assertEquals(config.confirmationType, "warning");
});

Deno.test("buildActionConfig: calculates item count", () => {
  const config = buildActionConfig("delete_selected", {
    selectedIds: ["1", "2", "3", "4", "5"],
  });

  assertEquals(config.itemCount, 5);
});

Deno.test("buildActionConfig: generates confirmation message", () => {
  const config = buildActionConfig("delete_selected", {
    selectedIds: ["1", "2"],
    modelName: "User",
  });

  assertEquals(config.confirmMessage.includes("2"), true);
  assertEquals(config.confirmMessage.includes("User"), true);
});

// =============================================================================
// Action Validation Tests
// =============================================================================

Deno.test("validateActionSelection: returns error for empty selection", () => {
  const result = validateActionSelection("delete_selected", []);

  assertEquals(result.valid, false);
  assertEquals(result.error, "No items selected");
});

Deno.test("validateActionSelection: returns valid for non-empty selection", () => {
  const result = validateActionSelection("delete_selected", ["1", "2"]);

  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

Deno.test("validateActionSelection: returns error for empty action name", () => {
  const result = validateActionSelection("", ["1"]);

  assertEquals(result.valid, false);
  assertEquals(result.error, "No action selected");
});

// =============================================================================
// Action Result Tests
// =============================================================================

Deno.test("ActionResult: success result structure", () => {
  const result: ActionResult = {
    success: true,
    message: "Successfully deleted 3 items",
    affectedCount: 3,
  };

  assertEquals(result.success, true);
  assertEquals(result.affectedCount, 3);
});

Deno.test("ActionResult: error result structure", () => {
  const result: ActionResult = {
    success: false,
    message: "Failed to delete items",
    error: "Permission denied",
  };

  assertEquals(result.success, false);
  assertExists(result.error);
});

// =============================================================================
// Bulk Delete Tests
// =============================================================================

Deno.test("buildActionConfig: delete confirmation includes warning", () => {
  const config = buildActionConfig("delete_selected", {
    selectedIds: ["1"],
    modelName: "Article",
  });

  assertEquals(config.confirmTitle, "Delete Article");
  assertEquals(config.confirmMessage.includes("cannot be undone"), true);
});

Deno.test("buildActionConfig: plural form for multiple items", () => {
  const config = buildActionConfig("delete_selected", {
    selectedIds: ["1", "2", "3"],
    modelName: "Article",
  });

  assertEquals(config.confirmTitle, "Delete Articles");
});

Deno.test("buildActionConfig: singular form for single item", () => {
  const config = buildActionConfig("delete_selected", {
    selectedIds: ["1"],
    modelName: "Article",
  });

  assertEquals(config.confirmTitle, "Delete Article");
});

// =============================================================================
// Custom Action Tests
// =============================================================================

Deno.test("getAvailableActions: handles ModelAdmin with no custom actions", () => {
  class MinimalAdmin extends ModelAdmin {
    actions: string[] = [];
  }

  const admin = new MinimalAdmin();
  const actions = getAvailableActions(admin);

  assertEquals(actions.length, 0);
});

Deno.test("buildActionConfig: custom action defaults to no confirmation", () => {
  const config = buildActionConfig("export_csv", {
    selectedIds: ["1", "2"],
  });

  assertEquals(config.requiresConfirmation, false);
});

Deno.test("buildActionConfig: custom action with explicit confirmation", () => {
  const config = buildActionConfig("archive_selected", {
    selectedIds: ["1", "2"],
    requiresConfirmation: true,
  });

  assertEquals(config.requiresConfirmation, true);
});

// =============================================================================
// Action Label Generation Tests
// =============================================================================

Deno.test("getAvailableActions: converts snake_case to Title Case", () => {
  class CustomAdmin extends ModelAdmin {
    actions = ["send_email_notification"];
  }

  const admin = new CustomAdmin();
  const actions = getAvailableActions(admin);

  assertEquals(actions[0].label, "Send Email Notification");
});

Deno.test("getAvailableActions: handles single word actions", () => {
  class CustomAdmin extends ModelAdmin {
    actions = ["archive"];
  }

  const admin = new CustomAdmin();
  const actions = getAvailableActions(admin);

  assertEquals(actions[0].label, "Archive");
});

// =============================================================================
// Action Permission Tests
// =============================================================================

Deno.test("ActionConfig: includes permission check flag", () => {
  const config = buildActionConfig("delete_selected", {
    selectedIds: ["1"],
    checkPermissions: true,
  });

  assertEquals(config.checkPermissions, true);
});

Deno.test("ActionConfig: default permission check is false", () => {
  const config = buildActionConfig("delete_selected", {
    selectedIds: ["1"],
  });

  assertEquals(config.checkPermissions, false);
});

// =============================================================================
// Dangerous Actions Tests
// =============================================================================

const DANGEROUS_ACTIONS = [
  "delete_selected",
  "remove_selected",
  "purge_selected",
];

Deno.test("buildActionConfig: identifies dangerous actions", () => {
  for (const actionName of DANGEROUS_ACTIONS) {
    const config = buildActionConfig(actionName, { selectedIds: ["1"] });
    assertEquals(
      config.requiresConfirmation,
      true,
      `${actionName} should require confirmation`,
    );
    assertEquals(
      config.confirmationType,
      "danger",
      `${actionName} should be danger type`,
    );
  }
});

// =============================================================================
// Edge Cases
// =============================================================================

Deno.test("buildActionConfig: handles very large selection", () => {
  const selectedIds = Array.from({ length: 1000 }, (_, i) => String(i));
  const config = buildActionConfig("delete_selected", { selectedIds });

  assertEquals(config.itemCount, 1000);
  assertEquals(config.confirmMessage.includes("1000"), true);
});

Deno.test("buildActionConfig: handles special characters in model name", () => {
  const config = buildActionConfig("delete_selected", {
    selectedIds: ["1"],
    modelName: "User's Profile",
  });

  assertEquals(config.confirmTitle.includes("User's Profile"), true);
});

Deno.test("validateActionSelection: handles null/undefined gracefully", () => {
  const result1 = validateActionSelection(
    "delete",
    null as unknown as string[],
  );
  assertEquals(result1.valid, false);

  const result2 = validateActionSelection(
    "delete",
    undefined as unknown as string[],
  );
  assertEquals(result2.valid, false);
});
