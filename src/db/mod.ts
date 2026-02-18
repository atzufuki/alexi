/**
 * Alexi ORM - Django-inspired TypeScript ORM
 *
 * A Django-like ORM for TypeScript/Deno with support for multiple backends.
 *
 * @module @alexi/db
 *
 * @example Using setup() (recommended)
 * ```ts
 * import { setup, getBackend, Model, CharField, Manager } from '@alexi/db';
 *
 * // In main.ts - initialize before mounting app
 * await setup({
 *   database: {
 *     engine: 'indexeddb',
 *     name: 'myapp',
 *   },
 * });
 *
 * // In any component - use getBackend()
 * const backend = getBackend();
 * const articles = await Article.objects.using(backend).all().fetch();
 * ```
 *
 * @example Using with DenoKV (server-side)
 * ```ts
 * await setup({
 *   database: {
 *     engine: 'denokv',
 *     name: 'myapp',
 *     path: './data/myapp.db',
 *   },
 * });
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
} from "./models/mod.ts";

export {
  DoesNotExist,
  Manager,
  MultipleObjectsReturned,
} from "./models/mod.ts";

// ============================================================================
// Fields
// ============================================================================

export { Field } from "./fields/mod.ts";
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
  FloatField,
  IntegerField,
  JSONField,
  TextField,
  UUIDField,
} from "./fields/mod.ts";

export type {
  CharFieldOptions,
  DateFieldOptions,
  DecimalFieldOptions,
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
  getSettings,
  hasBackend,
  isInitialized,
  registerBackend,
  reset,
  setBackend,
  setup,
  shutdown,
} from "./setup.ts";

export type {
  AlexiSettings,
  DatabaseEngine,
  DatabasesConfig,
  DatabaseSettings,
} from "./setup.ts";

// ============================================================================
// Migrations
// ============================================================================

// Migration classes and types - also available via @alexi/db/migrations
export { DataMigration, Migration } from "./migrations/mod.ts";
export { MigrationSchemaEditor } from "./migrations/mod.ts";
export { MigrationLoader } from "./migrations/mod.ts";
export { MigrationExecutor } from "./migrations/mod.ts";
export { MigrationRecorder } from "./migrations/mod.ts";
export { DeprecationRecorder } from "./migrations/mod.ts";
export type {
  MigrationDependency,
  MigrationOptions,
} from "./migrations/mod.ts";
export type { AlterFieldOptions, DeprecationInfo } from "./migrations/mod.ts";

// ============================================================================
// Commands
// ============================================================================

export {
  MakemigrationsCommand,
  MigrateCommand,
  ShowmigrationsCommand,
} from "./commands/mod.ts";
