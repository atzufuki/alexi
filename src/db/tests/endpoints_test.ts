/**
 * Tests for declarative REST endpoint configuration (DRF-style)
 *
 * Tests cover:
 * - camelToKebab utility
 * - DetailAction, ListAction, SingletonQuery descriptors
 * - ModelEndpoint introspection
 * - Type guards
 * - RestBackend integration (endpoint registration, action(), special handlers)
 *
 * @module
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "jsr:@std/assert";

import { AutoField, CharField, IntegerField, Manager, Model } from "../mod.ts";

import {
  camelToKebab,
  DetailAction,
  introspectEndpoint,
  introspectEndpoints,
  isDetailAction,
  isEndpointDescriptor,
  isListAction,
  isSingletonQuery,
  ListAction,
  ModelEndpoint,
  SingletonQuery,
} from "../backends/rest/endpoints.ts";

import type {
  EndpointIntrospection,
  RegisteredAction,
} from "../backends/rest/endpoints.ts";

// ============================================================================
// Test Models
// ============================================================================

class ProjectModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 200 });
  status = new CharField({ maxLength: 20, default: "draft" });

  static objects = new Manager(ProjectModel);
  static override meta = {
    dbTable: "projects",
    ordering: ["name"],
  };
}

class OrganisationModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 200 });

  static objects = new Manager(OrganisationModel);
  static override meta = {
    dbTable: "organisations",
    ordering: ["name"],
  };
}

class UserModel extends Model {
  id = new AutoField({ primaryKey: true });
  email = new CharField({ maxLength: 200 });

  static objects = new Manager(UserModel);
  static override meta = {
    dbTable: "users",
    ordering: ["-id"],
  };
}

class ConnectionModel extends Model {
  id = new AutoField({ primaryKey: true });
  status = new CharField({ maxLength: 20 });

  static objects = new Manager(ConnectionModel);
  static override meta = {
    dbTable: "connections",
    ordering: ["-id"],
  };
}

class NoMetaModel extends Model {
  id = new AutoField({ primaryKey: true });
  static objects = new Manager(NoMetaModel);
}

// ============================================================================
// Test Endpoints
// ============================================================================

class ProjectEndpoint extends ModelEndpoint {
  model = ProjectModel;
  path = "/projects/";

  publish = new DetailAction();
  unpublish = new DetailAction();
  archive = new DetailAction({ method: "DELETE" });
  published = new ListAction({ method: "GET" });
  bulkCreate = new ListAction();
  statistics = new ListAction({ method: "GET", single: true });
}

class OrganisationEndpoint extends ModelEndpoint {
  model = OrganisationModel;
  path = "/organisations/";

  current = new SingletonQuery();
  activate = new DetailAction();
  deactivate = new DetailAction();
}

class UserEndpoint extends ModelEndpoint {
  model = UserModel;
  path = "/users/";

  current = new SingletonQuery();
}

class ConnectionEndpoint extends ModelEndpoint {
  model = ConnectionModel;
  path = "/connections/";

  accept = new DetailAction();
  decline = new DetailAction();
  shareProject = new DetailAction();
  shareEmployees = new DetailAction();
}

class ExplicitEndpointPath extends ModelEndpoint {
  model = ProjectModel;
  path = "/custom-projects/";

  publish = new DetailAction();
}

class NoMetaEndpoint extends ModelEndpoint {
  model = NoMetaModel;
  path = "/no-meta/";

  refresh = new DetailAction();
}

class CustomUrlSegmentEndpoint extends ModelEndpoint {
  model = ProjectModel;
  path = "/projects/";

  myAction = new DetailAction({ urlSegment: "do-something" });
  myList = new ListAction({ method: "GET", urlSegment: "special-list" });
  myQuery = new SingletonQuery({ urlSegment: "me" });
}

class CustomMatchValueEndpoint extends ModelEndpoint {
  model = OrganisationModel;
  path = "/organisations/";

  status = new SingletonQuery({ matchValue: "active", urlSegment: "active" });
}

class EmptyEndpoint extends ModelEndpoint {
  model = ProjectModel;
  path = "/projects/";
}

// ============================================================================
// camelToKebab Tests
// ============================================================================

Deno.test("camelToKebab: simple lowercase word", () => {
  assertEquals(camelToKebab("publish"), "publish");
});

Deno.test("camelToKebab: two words", () => {
  assertEquals(camelToKebab("shareProject"), "share-project");
});

Deno.test("camelToKebab: multiple words", () => {
  assertEquals(camelToKebab("shareEmployeesData"), "share-employees-data");
});

Deno.test("camelToKebab: already lowercase", () => {
  assertEquals(camelToKebab("accept"), "accept");
});

Deno.test("camelToKebab: single character words", () => {
  assertEquals(camelToKebab("getMe"), "get-me");
});

Deno.test("camelToKebab: consecutive uppercase (acronym)", () => {
  assertEquals(camelToKebab("getHTTPResponse"), "get-http-response");
});

Deno.test("camelToKebab: empty string", () => {
  assertEquals(camelToKebab(""), "");
});

Deno.test("camelToKebab: with numbers", () => {
  assertEquals(camelToKebab("step2Action"), "step2-action");
});

// ============================================================================
// Descriptor Construction Tests
// ============================================================================

Deno.test("DetailAction: default options", () => {
  const action = new DetailAction();
  assertEquals(action._type, "detail");
  assertEquals(action.method, "POST");
  assertEquals(action.urlSegment, undefined);
});

Deno.test("DetailAction: custom method", () => {
  const action = new DetailAction({ method: "DELETE" });
  assertEquals(action.method, "DELETE");
});

Deno.test("DetailAction: custom method PATCH", () => {
  const action = new DetailAction({ method: "PATCH" });
  assertEquals(action.method, "PATCH");
});

Deno.test("DetailAction: custom method PUT", () => {
  const action = new DetailAction({ method: "PUT" });
  assertEquals(action.method, "PUT");
});

Deno.test("DetailAction: custom urlSegment", () => {
  const action = new DetailAction({ urlSegment: "do-it" });
  assertEquals(action.urlSegment, "do-it");
  assertEquals(action.method, "POST");
});

Deno.test("ListAction: default options", () => {
  const action = new ListAction();
  assertEquals(action._type, "list");
  assertEquals(action.method, "POST");
  assertEquals(action.single, false);
  assertEquals(action.urlSegment, undefined);
});

Deno.test("ListAction: GET method", () => {
  const action = new ListAction({ method: "GET" });
  assertEquals(action.method, "GET");
});

Deno.test("ListAction: single response", () => {
  const action = new ListAction({ method: "GET", single: true });
  assertEquals(action.single, true);
});

Deno.test("ListAction: custom urlSegment", () => {
  const action = new ListAction({ urlSegment: "my-list" });
  assertEquals(action.urlSegment, "my-list");
});

Deno.test("SingletonQuery: default options", () => {
  const query = new SingletonQuery();
  assertEquals(query._type, "singleton");
  assertEquals(query.urlSegment, undefined);
  assertEquals(query.matchValue, true);
});

Deno.test("SingletonQuery: custom urlSegment", () => {
  const query = new SingletonQuery({ urlSegment: "me" });
  assertEquals(query.urlSegment, "me");
});

Deno.test("SingletonQuery: custom matchValue", () => {
  const query = new SingletonQuery({ matchValue: "active" });
  assertEquals(query.matchValue, "active");
});

Deno.test("SingletonQuery: both options", () => {
  const query = new SingletonQuery({
    urlSegment: "active",
    matchValue: "active",
  });
  assertEquals(query.urlSegment, "active");
  assertEquals(query.matchValue, "active");
});

// ============================================================================
// Type Guard Tests
// ============================================================================

Deno.test("isDetailAction: true for DetailAction", () => {
  assertEquals(isDetailAction(new DetailAction()), true);
});

Deno.test("isDetailAction: false for ListAction", () => {
  assertEquals(isDetailAction(new ListAction()), false);
});

Deno.test("isDetailAction: false for SingletonQuery", () => {
  assertEquals(isDetailAction(new SingletonQuery()), false);
});

Deno.test("isDetailAction: false for plain object", () => {
  assertEquals(isDetailAction({ _type: "detail" }), false);
});

Deno.test("isDetailAction: false for null", () => {
  assertEquals(isDetailAction(null), false);
});

Deno.test("isListAction: true for ListAction", () => {
  assertEquals(isListAction(new ListAction()), true);
});

Deno.test("isListAction: false for DetailAction", () => {
  assertEquals(isListAction(new DetailAction()), false);
});

Deno.test("isSingletonQuery: true for SingletonQuery", () => {
  assertEquals(isSingletonQuery(new SingletonQuery()), true);
});

Deno.test("isSingletonQuery: false for DetailAction", () => {
  assertEquals(isSingletonQuery(new DetailAction()), false);
});

Deno.test("isEndpointDescriptor: true for all descriptor types", () => {
  assertEquals(isEndpointDescriptor(new DetailAction()), true);
  assertEquals(isEndpointDescriptor(new ListAction()), true);
  assertEquals(isEndpointDescriptor(new SingletonQuery()), true);
});

Deno.test("isEndpointDescriptor: false for non-descriptors", () => {
  assertEquals(isEndpointDescriptor("string"), false);
  assertEquals(isEndpointDescriptor(42), false);
  assertEquals(isEndpointDescriptor(null), false);
  assertEquals(isEndpointDescriptor(undefined), false);
  assertEquals(isEndpointDescriptor({}), false);
});

// ============================================================================
// Introspection Tests
// ============================================================================

Deno.test("introspectEndpoint: uses explicit path property", () => {
  const info = introspectEndpoint(ProjectEndpoint);
  assertEquals(info.path, "/projects/");
  assertEquals(info.endpoint, "projects");
  assertEquals(info.modelName, "ProjectModel");
  assertEquals(info.modelClass, ProjectModel);
});

Deno.test("introspectEndpoint: uses custom path", () => {
  const info = introspectEndpoint(ExplicitEndpointPath);
  assertEquals(info.path, "/custom-projects/");
  assertEquals(info.endpoint, "custom-projects");
});

Deno.test("introspectEndpoint: endpoint derived from path by trimming slashes", () => {
  const info = introspectEndpoint(NoMetaEndpoint);
  assertEquals(info.path, "/no-meta/");
  assertEquals(info.endpoint, "no-meta");
});

Deno.test("introspectEndpoint: extracts detail actions", () => {
  const info = introspectEndpoint(ProjectEndpoint);

  assertEquals(info.detailActions.length, 3);

  const publish = info.detailActions.find((a) => a.propertyName === "publish");
  assertExists(publish);
  assertEquals(publish.type, "detail");
  assertEquals(publish.urlSegment, "publish");
  assertEquals(publish.method, "POST");
  assertEquals(publish.endpoint, "projects");

  const unpublish = info.detailActions.find(
    (a) => a.propertyName === "unpublish",
  );
  assertExists(unpublish);
  assertEquals(unpublish.urlSegment, "unpublish");
  assertEquals(unpublish.method, "POST");

  const archive = info.detailActions.find(
    (a) => a.propertyName === "archive",
  );
  assertExists(archive);
  assertEquals(archive.urlSegment, "archive");
  assertEquals(archive.method, "DELETE");
});

Deno.test("introspectEndpoint: extracts list actions", () => {
  const info = introspectEndpoint(ProjectEndpoint);

  assertEquals(info.listActions.length, 3);

  const published = info.listActions.find(
    (a) => a.propertyName === "published",
  );
  assertExists(published);
  assertEquals(published.type, "list");
  assertEquals(published.urlSegment, "published");
  assertEquals(published.method, "GET");
  assertEquals(published.single, false);
  assertEquals(published.endpoint, "projects");

  const bulkCreate = info.listActions.find(
    (a) => a.propertyName === "bulkCreate",
  );
  assertExists(bulkCreate);
  assertEquals(bulkCreate.urlSegment, "bulk-create"); // camelToKebab
  assertEquals(bulkCreate.method, "POST");

  const statistics = info.listActions.find(
    (a) => a.propertyName === "statistics",
  );
  assertExists(statistics);
  assertEquals(statistics.single, true);
  assertEquals(statistics.method, "GET");
});

Deno.test("introspectEndpoint: extracts singleton queries", () => {
  const info = introspectEndpoint(OrganisationEndpoint);

  assertEquals(info.singletonQueries.length, 1);

  const handler = info.singletonQueries[0];

  // Should match filter({current: true})
  assertEquals(
    handler.matches([{ field: "current", lookup: "exact", value: true }]),
    true,
  );

  // Should NOT match other filters
  assertEquals(
    handler.matches([{ field: "current", lookup: "exact", value: false }]),
    false,
  );
  assertEquals(
    handler.matches([{ field: "other", lookup: "exact", value: true }]),
    false,
  );
  assertEquals(
    handler.matches([
      { field: "current", lookup: "exact", value: true },
      { field: "extra", lookup: "exact", value: "foo" },
    ]),
    false,
  );

  // Should generate correct endpoint URL
  assertEquals(handler.getEndpoint([]), "/organisations/current/");

  // Should be singleton
  assertEquals(handler.returnsSingle, true);
});

Deno.test("introspectEndpoint: camelCase action names → kebab-case URLs", () => {
  const info = introspectEndpoint(ConnectionEndpoint);

  const shareProject = info.detailActions.find(
    (a) => a.propertyName === "shareProject",
  );
  assertExists(shareProject);
  assertEquals(shareProject.urlSegment, "share-project");

  const shareEmployees = info.detailActions.find(
    (a) => a.propertyName === "shareEmployees",
  );
  assertExists(shareEmployees);
  assertEquals(shareEmployees.urlSegment, "share-employees");
});

Deno.test("introspectEndpoint: custom urlSegment overrides on descriptors", () => {
  const info = introspectEndpoint(CustomUrlSegmentEndpoint);

  const detail = info.detailActions.find(
    (a) => a.propertyName === "myAction",
  );
  assertExists(detail);
  assertEquals(detail.urlSegment, "do-something");

  const list = info.listActions.find((a) => a.propertyName === "myList");
  assertExists(list);
  assertEquals(list.urlSegment, "special-list");

  const singleton = info.singletonQueries[0];
  assertExists(singleton);
  assertEquals(singleton.getEndpoint([]), "/projects/me/");
});

Deno.test("introspectEndpoint: custom matchValue on SingletonQuery", () => {
  const info = introspectEndpoint(CustomMatchValueEndpoint);

  assertEquals(info.singletonQueries.length, 1);

  const handler = info.singletonQueries[0];

  // Should match filter({status: "active"})
  assertEquals(
    handler.matches([{ field: "status", lookup: "exact", value: "active" }]),
    true,
  );

  // Should NOT match filter({status: true})
  assertEquals(
    handler.matches([{ field: "status", lookup: "exact", value: true }]),
    false,
  );

  // Should NOT match filter({status: "inactive"})
  assertEquals(
    handler.matches([{ field: "status", lookup: "exact", value: "inactive" }]),
    false,
  );

  assertEquals(handler.getEndpoint([]), "/organisations/active/");
});

Deno.test("introspectEndpoint: empty endpoint (no descriptors)", () => {
  const info = introspectEndpoint(EmptyEndpoint);

  assertEquals(info.endpoint, "projects");
  assertEquals(info.detailActions.length, 0);
  assertEquals(info.listActions.length, 0);
  assertEquals(info.singletonQueries.length, 0);
});

Deno.test("introspectEndpoint: detail actions on OrganisationEndpoint", () => {
  const info = introspectEndpoint(OrganisationEndpoint);

  assertEquals(info.detailActions.length, 2);

  const activate = info.detailActions.find(
    (a) => a.propertyName === "activate",
  );
  assertExists(activate);
  assertEquals(activate.urlSegment, "activate");
  assertEquals(activate.method, "POST");

  const deactivate = info.detailActions.find(
    (a) => a.propertyName === "deactivate",
  );
  assertExists(deactivate);
  assertEquals(deactivate.urlSegment, "deactivate");
});

Deno.test("introspectEndpoint: ConnectionEndpoint has 4 detail actions", () => {
  const info = introspectEndpoint(ConnectionEndpoint);

  assertEquals(info.detailActions.length, 4);

  const names = info.detailActions.map((a) => a.propertyName).sort();
  assertEquals(names, ["accept", "decline", "shareEmployees", "shareProject"]);
});

Deno.test("introspectEndpoint: UserEndpoint has singleton query", () => {
  const info = introspectEndpoint(UserEndpoint);

  assertEquals(info.singletonQueries.length, 1);
  assertEquals(info.detailActions.length, 0);
  assertEquals(info.listActions.length, 0);

  const handler = info.singletonQueries[0];
  assertEquals(
    handler.matches([{ field: "current", lookup: "exact", value: true }]),
    true,
  );
  assertEquals(handler.getEndpoint([]), "/users/current/");
});

// ============================================================================
// introspectEndpoints (batch) Tests
// ============================================================================

Deno.test("introspectEndpoints: processes multiple endpoints", () => {
  const results = introspectEndpoints([
    ProjectEndpoint,
    OrganisationEndpoint,
    UserEndpoint,
  ]);

  assertEquals(results.length, 3);
  assertEquals(results[0].endpoint, "projects");
  assertEquals(results[1].endpoint, "organisations");
  assertEquals(results[2].endpoint, "users");
});

Deno.test("introspectEndpoints: empty array", () => {
  const results = introspectEndpoints([]);
  assertEquals(results.length, 0);
});

// ============================================================================
// Singleton Query Matching Edge Cases
// ============================================================================

Deno.test("SingletonQuery: does not match lookup !== 'exact'", () => {
  const info = introspectEndpoint(OrganisationEndpoint);
  const handler = info.singletonQueries[0];

  assertEquals(
    handler.matches([{ field: "current", lookup: "contains", value: true }]),
    false,
  );
});

Deno.test("SingletonQuery: does not match empty filters", () => {
  const info = introspectEndpoint(OrganisationEndpoint);
  const handler = info.singletonQueries[0];

  assertEquals(handler.matches([]), false);
});

Deno.test("SingletonQuery: does not match multiple filters even if one matches", () => {
  const info = introspectEndpoint(OrganisationEndpoint);
  const handler = info.singletonQueries[0];

  assertEquals(
    handler.matches([
      { field: "current", lookup: "exact", value: true },
      { field: "name", lookup: "exact", value: "Test" },
    ]),
    false,
  );
});

// ============================================================================
// Endpoint Resolution Priority Tests
// ============================================================================

Deno.test("endpoint resolution: explicit endpoint takes priority over meta.dbTable", () => {
  // ExplicitEndpointPath has model = ProjectModel (meta.dbTable = "projects")
  // but endpoint = "custom-projects"
  const info = introspectEndpoint(ExplicitEndpointPath);
  assertEquals(info.endpoint, "custom-projects");
});

Deno.test("endpoint resolution: path is used directly", () => {
  // ProjectEndpoint has path = "/projects/"
  const info = introspectEndpoint(ProjectEndpoint);
  assertEquals(info.path, "/projects/");
  assertEquals(info.endpoint, "projects");
});

Deno.test("endpoint resolution: endpoint derived from path by stripping slashes", () => {
  const info = introspectEndpoint(NoMetaEndpoint);
  // NoMetaEndpoint has path = "/no-meta/"
  assertEquals(info.path, "/no-meta/");
  assertEquals(info.endpoint, "no-meta");
});

// ============================================================================
// Detail Action URL Construction Tests
// ============================================================================

Deno.test("detail action URL: simple name", () => {
  const info = introspectEndpoint(ProjectEndpoint);
  const publish = info.detailActions.find((a) => a.propertyName === "publish")!;
  // Expected URL: /projects/{id}/publish/
  assertEquals(publish.endpoint, "projects");
  assertEquals(publish.urlSegment, "publish");
});

Deno.test("detail action URL: camelCase name becomes kebab-case", () => {
  const info = introspectEndpoint(ConnectionEndpoint);
  const shareProject = info.detailActions.find(
    (a) => a.propertyName === "shareProject",
  )!;
  // Expected URL: /connections/{id}/share-project/
  assertEquals(shareProject.endpoint, "connections");
  assertEquals(shareProject.urlSegment, "share-project");
});

Deno.test("detail action URL: explicit endpoint path", () => {
  const info = introspectEndpoint(ExplicitEndpointPath);
  const publish = info.detailActions.find((a) => a.propertyName === "publish")!;
  // Expected URL: /custom-projects/{id}/publish/
  assertEquals(publish.endpoint, "custom-projects");
  assertEquals(publish.urlSegment, "publish");
});

// ============================================================================
// List Action URL Construction Tests
// ============================================================================

Deno.test("list action URL: simple name", () => {
  const info = introspectEndpoint(ProjectEndpoint);
  const published = info.listActions.find(
    (a) => a.propertyName === "published",
  )!;
  // Expected URL: /projects/published/
  assertEquals(published.endpoint, "projects");
  assertEquals(published.urlSegment, "published");
});

Deno.test("list action URL: camelCase name becomes kebab-case", () => {
  const info = introspectEndpoint(ProjectEndpoint);
  const bulkCreate = info.listActions.find(
    (a) => a.propertyName === "bulkCreate",
  )!;
  // Expected URL: /projects/bulk-create/
  assertEquals(bulkCreate.endpoint, "projects");
  assertEquals(bulkCreate.urlSegment, "bulk-create");
});
