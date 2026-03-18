/**
 * Alexi's Django-inspired ORM and query layer.
 *
 * `@alexi/db` provides the model system, field classes, relation fields,
 * managers, `QuerySet` API, and backend abstraction used across the framework.
 * It is the foundation for Alexi apps that want Django-style data modeling in
 * TypeScript while staying portable across Deno KV, IndexedDB, and custom
 * backends.
 *
 * Start with `Model`, `Manager`, and concrete field types such as `CharField`,
 * `IntegerField`, and `ForeignKey` when defining models. Use `QuerySet`, `Q`,
 * and aggregation helpers like `Count` and `Sum` to express queries. Runtime
 * setup is handled through `setup()`, `setBackend()`, or `registerBackend()`
 * depending on whether you want a single default backend or named backends.
 *
 * The ORM itself is environment-neutral, but individual backend implementations
 * have runtime constraints: Deno KV is server-side, IndexedDB is browser-only,
 * and REST backends are intended for HTTP-connected clients.
 *
 * @module @alexi/db
 *
 * @example Define and query a model
 * ```ts
 * import { CharField, Manager, Model } from "@alexi/db";
 *
 * class Article extends Model {
 *   title = new CharField({ maxLength: 200 });
 *
 *   static objects = new Manager(Article);
 * }
 *
 * const published = await Article.objects.filter({ status: "published" })
 *   .orderBy("-createdAt")
 *   .fetch();
 * ```
 */

// ============================================================================
// App Configuration
// ============================================================================

export { default } from "./app.ts";

// ============================================================================
// Models
// ============================================================================

export { Model, ModelRegistry } from "./models/mod.ts";
export type {
  IndexDefinition,
  ModelData,
  ModelMeta,
  ModelOperationOptions,
  PartialModelData,
  ReverseRelationDef,
} from "./models/mod.ts";

export {
  DoesNotExist,
  Manager,
  MultipleObjectsReturned,
} from "./models/mod.ts";

// ============================================================================
// Fields
// ============================================================================

export { Field, FieldValidationError } from "./fields/mod.ts";
export type {
  FieldOptions,
  ValidationResult,
  Validator,
} from "./fields/mod.ts";

// Concrete field types
export {
  AutoField,
  BinaryField,
  BooleanField,
  CharField,
  DateField,
  DateTimeField,
  DecimalField,
  FileField,
  FloatField,
  ImageField,
  IntegerField,
  JSONField,
  TextField,
  UUIDField,
} from "./fields/mod.ts";

export type {
  CharFieldOptions,
  DateFieldOptions,
  DecimalFieldOptions,
  FileFieldOptions,
} from "./fields/mod.ts";

// Relation fields
export {
  ForeignKey,
  ManyToManyField,
  ManyToManyManager,
  OnDelete,
  OneToOneField,
  RelatedManager,
} from "./fields/mod.ts";

export type {
  ForeignKeyOptions,
  LazyModelRef,
  ManyToManyFieldOptions,
  ModelClass,
  RelatedQuerySetLike,
} from "./fields/mod.ts";

// ============================================================================
// Query
// ============================================================================

export { QuerySet, ValuesListQuerySet, ValuesQuerySet } from "./query/mod.ts";
export type { SaveResult } from "./query/mod.ts";

export { andQ, orQ, Q, q } from "./query/mod.ts";
export type { QConnector, ResolvedQ } from "./query/mod.ts";

// Aggregation functions
export { Avg, Count, Max, Min, Sum } from "./query/mod.ts";

export type {
  AggregateFunction,
  Aggregation,
  Aggregations,
  Annotations,
  CompiledQuery,
  FilterConditions,
  LookupType,
  OrderByField,
  ParsedFilter,
  ParsedOrdering,
  QueryOperation,
  QueryState,
} from "./query/mod.ts";

// ============================================================================
// Backend
// ============================================================================

export { DatabaseBackend } from "./backends/backend.ts";
export type {
  DatabaseConfig,
  SchemaEditor,
  Transaction,
} from "./backends/backend.ts";

// ============================================================================
// Setup & Configuration
// ============================================================================

export {
  getBackend,
  getBackendByName,
  getBackendNames,
  hasBackend,
  isInitialized,
  registerBackend,
  reset,
  setBackend,
  shutdown,
} from "./setup.ts";
