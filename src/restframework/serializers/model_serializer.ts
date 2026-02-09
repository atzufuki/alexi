/**
 * ModelSerializer for Alexi REST Framework
 *
 * Automatically generates serializer fields from alexi/db Model definitions.
 *
 * @module @alexi/restframework/serializers/model_serializer
 */

import type { Model } from "@alexi/db";
import type { Field } from "@alexi/db";
import type { SerializerField } from "./fields.ts";
import {
  BooleanField,
  CharField,
  DateField,
  DateTimeField,
  FloatField,
  IntegerField,
  JSONField,
  TextField,
} from "./fields.ts";
import {
  FieldValidationError,
  Serializer,
  type SerializerOptions,
  ValidationError,
  type ValidationErrors,
} from "./serializer.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Model class type (constructor)
 */
export type ModelClass<T extends Model = Model> = new () => T;

/**
 * Meta options for ModelSerializer
 */
export interface ModelSerializerMeta {
  /** The model class to serialize */
  model: ModelClass;

  /** Fields to include (use "__all__" for all fields) */
  fields: string[] | "__all__";

  /** Fields to exclude */
  exclude?: string[];

  /** Read-only fields */
  readOnlyFields?: string[];

  /** Extra keyword arguments for specific fields */
  extraKwargs?: Record<string, Partial<SerializerFieldOptions>>;
}

/**
 * Options for field generation
 */
interface SerializerFieldOptions {
  required?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  allowNull?: boolean;
  default?: unknown;
  maxLength?: number;
  minLength?: number;
  minValue?: number;
  maxValue?: number;
}

// ============================================================================
// ModelSerializer Class
// ============================================================================

/**
 * ModelSerializer automatically generates fields from an alexi/db Model
 *
 * @example
 * ```ts
 * import { AssetModel } from "@comachine/models";
 *
 * class AssetSerializer extends ModelSerializer {
 *   static Meta = {
 *     model: AssetModel,
 *     fields: ["id", "name", "description", "createdAt"],
 *     readOnlyFields: ["id", "createdAt"],
 *   };
 * }
 *
 * // Serialize a model instance
 * const serializer = new AssetSerializer({ instance: asset });
 * const data = serializer.data;
 *
 * // Validate input data
 * const serializer = new AssetSerializer({ data: requestData });
 * if (serializer.isValid()) {
 *   const asset = await serializer.save();
 * }
 * ```
 */
export abstract class ModelSerializer extends Serializer {
  /**
   * Meta configuration - must be defined in subclass
   */
  static Meta: ModelSerializerMeta;

  /**
   * Get the Meta configuration from the class
   */
  protected getMeta(): ModelSerializerMeta {
    const constructor = this.constructor as typeof ModelSerializer;
    if (!constructor.Meta) {
      throw new Error(
        `${constructor.name} must define a static Meta property with model and fields.`,
      );
    }
    return constructor.Meta;
  }

  /**
   * Generate field definitions from the Model
   */
  protected override getFieldDefinitions(): Record<string, SerializerField> {
    const meta = this.getMeta();
    const modelInstance = new meta.model();
    const modelFields = modelInstance.getFields();

    // Determine which fields to include
    let fieldNames: string[];
    if (meta.fields === "__all__") {
      fieldNames = Object.keys(modelFields);
    } else {
      fieldNames = meta.fields;
    }

    // Remove excluded fields
    if (meta.exclude) {
      fieldNames = fieldNames.filter((name) => !meta.exclude!.includes(name));
    }

    // Generate serializer fields
    const fields: Record<string, SerializerField> = {};
    for (const fieldName of fieldNames) {
      const modelField = modelFields[fieldName];
      if (!modelField) {
        console.warn(
          `Field "${fieldName}" not found on model ${meta.model.name}`,
        );
        continue;
      }

      // Check if read-only
      const isReadOnly = meta.readOnlyFields?.includes(fieldName) ?? false;

      // Get extra kwargs for this field
      const extraKwargs = meta.extraKwargs?.[fieldName] ?? {};

      // Convert model field to serializer field
      fields[fieldName] = this.buildField(modelField, fieldName, {
        readOnly: isReadOnly,
        ...extraKwargs,
      });
    }

    return fields;
  }

  /**
   * Build a serializer field from a model field
   */
  protected buildField(
    modelField: Field<unknown>,
    fieldName: string,
    options: Partial<SerializerFieldOptions>,
  ): SerializerField {
    const fieldOptions = modelField.options;
    const fieldType = modelField.constructor.name;

    // Base options
    const baseOptions: SerializerFieldOptions = {
      required: !fieldOptions.blank && !fieldOptions.null && !options.readOnly,
      allowNull: fieldOptions.null ?? false,
      readOnly: options.readOnly ?? false,
      writeOnly: options.writeOnly ?? false,
      ...options,
    };

    // Handle default values
    if (modelField.hasDefault()) {
      baseOptions.default = modelField.getDefault();
      baseOptions.required = false;
    }

    // Map model field types to serializer field types
    switch (fieldType) {
      case "AutoField":
        return new IntegerField({ ...baseOptions, readOnly: true });

      case "CharField":
        return new CharField({
          ...baseOptions,
          maxLength: (fieldOptions as { maxLength?: number }).maxLength,
        });

      case "TextField":
        return new TextField(baseOptions);

      case "IntegerField":
        return new IntegerField(baseOptions);

      case "FloatField":
      case "DecimalField":
        return new FloatField(baseOptions);

      case "BooleanField":
        return new BooleanField(baseOptions);

      case "DateTimeField":
        // Auto fields are read-only
        const dateTimeOpts = fieldOptions as {
          autoNow?: boolean;
          autoNowAdd?: boolean;
        };
        if (dateTimeOpts.autoNow || dateTimeOpts.autoNowAdd) {
          return new DateTimeField({ ...baseOptions, readOnly: true });
        }
        return new DateTimeField(baseOptions);

      case "DateField":
        const dateOpts = fieldOptions as {
          autoNow?: boolean;
          autoNowAdd?: boolean;
        };
        if (dateOpts.autoNow || dateOpts.autoNowAdd) {
          return new DateField({ ...baseOptions, readOnly: true });
        }
        return new DateField(baseOptions);

      case "JSONField":
        return new JSONField(baseOptions);

      case "UUIDField":
        return new CharField({ ...baseOptions, maxLength: 36 });

      case "ForeignKey":
      case "OneToOneField":
        // For relations, use integer field for the ID
        return new IntegerField(baseOptions);

      default:
        // Default to CharField for unknown types
        console.warn(
          `Unknown field type "${fieldType}" for field "${fieldName}", using CharField`,
        );
        return new CharField(baseOptions);
    }
  }

  /**
   * Create a new model instance from validated data
   */
  override async create(
    validatedData: Record<string, unknown>,
  ): Promise<Model> {
    const meta = this.getMeta();
    const ModelClass = meta.model;

    // Get the manager from the model class
    const manager = (ModelClass as unknown as {
      objects: { create: (data: Record<string, unknown>) => Promise<Model> };
    }).objects;

    if (!manager || typeof manager.create !== "function") {
      throw new Error(
        `Model ${ModelClass.name} does not have an objects manager with create method.`,
      );
    }

    // Create the instance
    const instance = await manager.create(validatedData);
    return instance;
  }

  /**
   * Update an existing model instance
   */
  override async update(
    instance: unknown,
    validatedData: Record<string, unknown>,
  ): Promise<Model> {
    const modelInstance = instance as Model;

    // Update fields on the instance
    for (const [key, value] of Object.entries(validatedData)) {
      const field = (modelInstance as unknown as Record<string, unknown>)[key];
      if (field && typeof field === "object" && "set" in field) {
        (field as { set: (v: unknown) => void }).set(value);
        modelInstance.markDirty(key);
      }
    }

    // Note: Saving requires a backend, which should be handled by the viewset
    // The viewset should call backend.update(instance) after this
    return modelInstance;
  }

  /**
   * Get the model instance from serializer
   */
  getModelInstance(): Model | undefined {
    return this.instance as Model | undefined;
  }
}

// ============================================================================
// Helper function to create a ModelSerializer class
// ============================================================================

/**
 * Create a ModelSerializer class dynamically
 *
 * @example
 * ```ts
 * const AssetSerializer = createModelSerializer({
 *   model: AssetModel,
 *   fields: ["id", "name", "description"],
 *   readOnlyFields: ["id"],
 * });
 *
 * const serializer = new AssetSerializer({ instance: asset });
 * ```
 */
export function createModelSerializer(
  meta: ModelSerializerMeta,
): typeof ModelSerializer {
  class DynamicModelSerializer extends ModelSerializer {
    static override Meta = meta;
  }
  return DynamicModelSerializer;
}

// Re-export for convenience
export { FieldValidationError, ValidationError };
export type { ValidationErrors };
