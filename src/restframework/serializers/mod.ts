/**
 * Serializers module for Alexi REST Framework
 *
 * Provides serialization, deserialization, and validation of data.
 *
 * @module @alexi/restframework/serializers
 *
 * @example Basic Serializer
 * ```ts
 * import { Serializer, CharField, IntegerField } from "@alexi/restframework/serializers";
 *
 * class AssetSerializer extends Serializer {
 *   protected getFieldDefinitions() {
 *     return {
 *       id: new IntegerField({ readOnly: true }),
 *       name: new CharField({ maxLength: 200 }),
 *       description: new TextField({ required: false }),
 *     };
 *   }
 * }
 * ```
 *
 * @example ModelSerializer
 * ```ts
 * import { ModelSerializer } from "@alexi/restframework/serializers";
 * import { AssetModel } from "@comachine/models";
 *
 * class AssetSerializer extends ModelSerializer {
 *   static Meta = {
 *     model: AssetModel,
 *     fields: ["id", "name", "description", "createdAt"],
 *     readOnlyFields: ["id", "createdAt"],
 *   };
 * }
 * ```
 */

// ============================================================================
// Fields
// ============================================================================

export {
  // Boolean field
  BooleanField,
  // String fields
  CharField,
  // Choice field
  ChoiceField,
  DateField,
  // Date/time fields
  DateTimeField,
  EmailField,
  FloatField,
  // Numeric fields
  IntegerField,
  JSONField,
  // Composite fields
  ListField,
  // Related fields
  PrimaryKeyRelatedField,
  // Base class
  SerializerField,
  // Method field
  SerializerMethodField,
  TextField,
  URLField,
  UUIDField,
} from "./fields.ts";

export type {
  BaseFieldOptions,
  CharFieldOptions,
  ChoiceFieldOptions,
  FieldValidationResult,
  FloatFieldOptions,
  IntegerFieldOptions,
  ListFieldOptions,
  PrimaryKeyRelatedFieldOptions,
  SerializerMethodFieldOptions,
  ValidationError as FieldError,
} from "./fields.ts";

// ============================================================================
// Serializer
// ============================================================================

export {
  FieldValidationError,
  Serializer,
  SerializerValidationError,
  ValidationError,
} from "./serializer.ts";

export type { SerializerOptions, ValidationErrors } from "./serializer.ts";

// ============================================================================
// ModelSerializer
// ============================================================================

export { createModelSerializer, ModelSerializer } from "./model_serializer.ts";

export type { ModelClass, ModelSerializerMeta } from "./model_serializer.ts";
