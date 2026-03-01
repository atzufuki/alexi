/**
 * Alexi - A Django-inspired full-stack framework for Deno
 *
 * This module provides a unified entry point for all Alexi functionality.
 * For more granular imports, use the specific module paths like @alexi/core,
 * @alexi/db, @alexi/restframework, etc.
 *
 * @module
 */

// =============================================================================
// Core - management commands, application, configuration
// =============================================================================

export {
  Application,
  ArgumentParser,
  BaseCommand,
  CommandRegistry,
  configure,
  createApplication,
  execute,
  failure,
  getSettings as getCoreSettings,
  getSettingsModuleName,
  getSettingsModulePath,
  globalRegistry,
  HelpCommand,
  initializeDatabase,
  isConfigured,
  isDatabaseInitialized,
  loadSettings,
  loadUrlPatterns,
  ManagementUtility,
  registerCommand,
  resetConfiguration,
  success,
  TestCommand,
} from "./core/management/mod.ts";

export { setup } from "./core/mod.ts";

export type {
  AlexiSettings as CoreSettings,
  ApplicationOptions,
  ArgumentConfig,
  ArgumentType,
  CommandConstructor,
  CommandMeta,
  CommandOptions,
  CommandResult,
  DatabaseConfig as CoreDatabaseConfig,
  Handler,
  IArgumentParser,
  ICommand,
  ICommandRegistry,
  IConsole,
  ManagementConfig,
  ParsedArguments,
  ServeOptions,
  ServerConfig,
  TestConfig,
} from "./core/management/mod.ts";

export type { DatabasesConfig } from "./core/mod.ts";

// =============================================================================
// Database ORM - models, fields, queries, backends
// =============================================================================

export {
  // Query
  andQ,
  // Fields
  AutoField,
  Avg,
  BinaryField,
  BooleanField as DbBooleanField,
  CharField as DbCharField,
  Count,
  // Backend
  DatabaseBackend,
  DateField as DbDateField,
  DateTimeField as DbDateTimeField,
  DecimalField,
  // Models
  DoesNotExist,
  Field,
  FloatField as DbFloatField,
  ForeignKey,
  // Setup
  getBackend,
  IntegerField as DbIntegerField,
  isInitialized,
  JSONField as DbJSONField,
  Manager,
  ManyToManyField,
  ManyToManyManager,
  Max,
  Min,
  Model,
  ModelRegistry,
  MultipleObjectsReturned,
  OnDelete,
  OneToOneField,
  orQ,
  Q,
  q,
  QuerySet,
  reset,
  setBackend,
  shutdown,
  Sum,
  TextField as DbTextField,
  UUIDField as DbUUIDField,
  ValuesListQuerySet,
  ValuesQuerySet,
} from "./db/mod.ts";

export type {
  // Query
  Aggregation,
  Aggregations,
  Annotations,
  // Fields
  CharFieldOptions as DbCharFieldOptions,
  CompiledQuery,
  // Backend
  DatabaseConfig,
  DateFieldOptions,
  DecimalFieldOptions,
  FieldOptions,
  FilterConditions,
  ForeignKeyOptions,
  // Models
  IndexDefinition,
  LazyModelRef,
  LookupType,
  ManyToManyFieldOptions,
  ModelClass as DbModelClass,
  ModelData,
  ModelMeta,
  OrderByField,
  ParsedFilter,
  ParsedOrdering,
  PartialModelData,
  QConnector,
  QueryOperation,
  QueryState,
  ResolvedQ,
  SchemaEditor,
  Transaction,
  ValidationResult,
  Validator,
} from "./db/mod.ts";

// =============================================================================
// URL Routing
// =============================================================================

export {
  clearRegistryCache,
  include,
  path,
  pathInclude,
  resolve,
  reverse,
} from "./urls/mod.ts";

export type {
  CompiledPattern,
  CompiledSegment,
  ResolveResult,
  URLPattern,
  URLPatternOptions,
  View,
} from "./urls/mod.ts";

// =============================================================================
// Middleware
// =============================================================================

export {
  allowAllOriginsMiddleware,
  BadRequestError,
  ConflictError,
  corsMiddleware,
  debugErrorHandler,
  errorHandlerMiddleware,
  ForbiddenError,
  HttpError,
  InternalServerError,
  loggingMiddleware,
  MethodNotAllowedError,
  NotFoundError as HttpNotFoundError,
  simpleErrorHandler,
  simpleLoggingMiddleware,
  UnauthorizedError,
  ValidationError as HttpValidationError,
} from "./middleware/mod.ts";

export type {
  CorsOptions,
  ErrorHandlerOptions,
  LoggingOptions,
  Middleware,
  NextFunction,
} from "./middleware/mod.ts";

// =============================================================================
// Views
// =============================================================================

export {
  clearTemplateCache,
  invalidateTemplate,
  templateView,
} from "./views/mod.ts";

export type { TemplateViewOptions } from "./views/mod.ts";

// =============================================================================
// REST Framework - serializers, viewsets, routers
// =============================================================================

export {
  // ViewSets
  action,
  // Serializer fields
  BooleanField,
  CharField,
  ChoiceField,
  CreateModelMixin,
  // Serializer classes
  createModelSerializer,
  DateField,
  DateTimeField,
  // Routers
  DefaultRouter,
  DestroyModelMixin,
  EmailField,
  FieldValidationError,
  FloatField,
  getActions,
  IntegerField,
  JSONField,
  ListField,
  ListModelMixin,
  ModelSerializer,
  ModelViewSet,
  NotFoundError,
  PrimaryKeyRelatedField,
  ReadOnlyModelViewSet,
  RetrieveModelMixin,
  Serializer,
  SerializerField,
  SerializerMethodField,
  SerializerValidationError,
  SimpleRouter,
  TextField,
  UpdateModelMixin,
  URLField,
  UUIDField,
  ValidationError,
  ViewSet,
} from "./restframework/mod.ts";

export type {
  // ViewSet types
  ActionMetadata,
  ActionOptions,
  ActionType,
  // Serializer types
  BaseFieldOptions,
  CharFieldOptions,
  ChoiceFieldOptions,
  FieldValidationResult,
  FloatFieldOptions,
  HttpMethod,
  IntegerFieldOptions,
  ListFieldOptions,
  ModelClass,
  ModelSerializerMeta,
  ModelWithManager,
  PrimaryKeyRelatedFieldOptions,
  // Router types
  RegisterOptions,
  SerializerClass,
  SerializerMethodFieldOptions,
  SerializerOptions,
  ValidationErrors,
  ViewSetContext,
} from "./restframework/mod.ts";

// =============================================================================
// Authentication
// =============================================================================

export { default as authConfig } from "./auth/app.ts";

// =============================================================================
// Admin
// =============================================================================

export {
  AdminRouter,
  AdminSite,
  buildActionConfig,
  clearFilterParams,
  countActiveFilters,
  createErrorResult,
  createSuccessResult,
  DEFAULT_ADMIN_SITE_OPTIONS,
  DEFAULT_MODEL_ADMIN_OPTIONS,
  extractRelatedId,
  extractRelatedIds,
  formatRelatedObject,
  getAdminUrls,
  getAvailableActions,
  getDisplayValue,
  getEditableFields,
  getFieldInfo,
  getFilterChoices,
  getFiltersForFields,
  getListDisplayFields,
  getModelFields,
  getModelMeta,
  getRelatedModelInfo,
  getRelationFieldInfo,
  getRelationFields,
  getWidgetForField,
  hasActiveFilters,
  isRelationField,
  mergeFilterParams,
  ModelAdmin,
  parseFilterParams,
  register,
  serializeFilterParams,
  validateActionSelection,
} from "./admin/mod.ts";

export type {
  ActionConfig,
  ActionDefinition,
  ActionResult,
  AdminHandler,
  AdminSiteOptions,
  AdminUrlPattern,
  AdminViewType,
  BuildActionOptions,
  DateRangeValue,
  FieldInfo,
  FieldInfoOptions,
  Fieldset,
  FilterConfig,
  FilterType,
  FilterValue,
  FilterValues,
  ModelAdminBase,
  ModelAdminClass,
  ModelAdminOptions,
  ModelClass as AdminModelClass,
  ModelMeta as AdminModelMeta,
  RelatedModelInfo,
  RelationFieldInfo,
  RelationType,
  ValidationResult as AdminValidationResult,
} from "./admin/mod.ts";

// =============================================================================
// Static Files
// =============================================================================

export {
  AppDirectoriesFinder,
  extractStaticPath,
  FileSystemFinder,
  FileSystemStorage,
  getContentType,
  isStaticFileRequest,
  serveBundleMiddleware,
  StaticFileFinders,
  staticFilesMiddleware,
  StaticFilesStorage,
  staticServe,
} from "./staticfiles/mod.ts";

export type {
  AppDirectoriesFinderOptions,
  FileSystemFinderOptions,
  FinderResult,
  StaticFile,
  StaticFileFinder,
  StaticFileStorage,
  StaticServeOptions,
  StorageOptions,
} from "./staticfiles/mod.ts";

// =============================================================================
// Web Server
// =============================================================================

export { default as webConfig } from "./web/app.ts";

// =============================================================================
// WebUI (Desktop)
// =============================================================================

export {
  appConfig as webuiAppConfig,
  createDefaultBindings,
  WebUILauncher,
} from "./webui/mod.ts";

export type {
  WebUIBindings,
  WebUIConfig,
  WebUILauncherOptions,
} from "./webui/mod.ts";

// =============================================================================
// Capacitor (Mobile - placeholder)
// =============================================================================

export { default as capacitorAppConfig } from "./capacitor/app.ts";

// =============================================================================
// Types
// =============================================================================

export type {
  AppConfig,
  BundleConfig,
  CliTargetConfig,
  DesktopConfig,
  DesktopSettings,
  DesktopTargetConfig,
  SpaTargetConfig,
  TargetConfig,
  TargetOutputConfig,
  TargetType,
  WebTargetConfig,
} from "./types/mod.ts";

// =============================================================================
// HTTP (legacy compatibility re-exports)
// Note: Use @alexi/core, @alexi/middleware, @alexi/views instead
// =============================================================================

// Re-export from http for backwards compatibility
// The http module itself re-exports from other modules
