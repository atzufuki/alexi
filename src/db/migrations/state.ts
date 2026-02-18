/**
 * State tracking for migrations
 *
 * ProjectState and ModelState track the current state of models as defined
 * by migrations. This is used to compare against the actual model definitions
 * and detect changes that need new migrations.
 *
 * @module
 */

import type { Field } from "../fields/field.ts";
import type { IndexDefinition, Model, ModelMeta } from "../models/model.ts";

// ============================================================================
// Field State
// ============================================================================

/**
 * Serializable representation of a field's state
 */
export interface FieldState {
  /** Field type name (e.g., "CharField", "IntegerField") */
  type: string;
  /** Field options */
  options: Record<string, unknown>;
  /** Database column name */
  columnName: string;
}

/**
 * Extract field state from a Field instance
 */
export function fieldToState(field: Field<unknown>): FieldState {
  return {
    type: field.constructor.name,
    options: { ...field.options },
    columnName: field.getColumnName(),
  };
}

// ============================================================================
// Model State
// ============================================================================

/**
 * Serializable representation of a model's state
 */
export interface ModelStateData {
  /** Model class name */
  name: string;
  /** App label (e.g., "auth", "myapp") */
  appLabel: string;
  /** Database table name */
  dbTable: string;
  /** Field states by field name */
  fields: Record<string, FieldState>;
  /** Index definitions */
  indexes: IndexDefinition[];
  /** Unique together constraints */
  uniqueTogether: string[][];
  /** Whether this is an abstract model */
  abstract: boolean;
}

/**
 * Represents the state of a model at a point in migration history
 */
export class ModelState {
  readonly name: string;
  readonly appLabel: string;
  readonly dbTable: string;
  readonly fields: Map<string, FieldState>;
  readonly indexes: IndexDefinition[];
  readonly uniqueTogether: string[][];
  readonly abstract: boolean;

  constructor(data: ModelStateData) {
    this.name = data.name;
    this.appLabel = data.appLabel;
    this.dbTable = data.dbTable;
    this.fields = new Map(Object.entries(data.fields));
    this.indexes = data.indexes;
    this.uniqueTogether = data.uniqueTogether;
    this.abstract = data.abstract;
  }

  /**
   * Create ModelState from a Model class
   */
  static fromModel(
    // deno-lint-ignore no-explicit-any
    ModelClass: new () => Model,
    appLabel: string,
  ): ModelState {
    const instance = new ModelClass();
    const fields = instance.getFields();
    const meta = (ModelClass as unknown as { meta: ModelMeta }).meta || {};

    const fieldStates: Record<string, FieldState> = {};
    for (const [name, field] of Object.entries(fields)) {
      fieldStates[name] = fieldToState(field);
    }

    return new ModelState({
      name: ModelClass.name,
      appLabel,
      dbTable: meta.dbTable ?? ModelClass.name.toLowerCase() + "s",
      fields: fieldStates,
      indexes: meta.indexes ?? [],
      uniqueTogether: meta.uniqueTogether ?? [],
      abstract: meta.abstract ?? false,
    });
  }

  /**
   * Get field names
   */
  getFieldNames(): string[] {
    return Array.from(this.fields.keys());
  }

  /**
   * Get a specific field
   */
  getField(name: string): FieldState | undefined {
    return this.fields.get(name);
  }

  /**
   * Check if a field exists
   */
  hasField(name: string): boolean {
    return this.fields.has(name);
  }

  /**
   * Get full name (appLabel.modelName)
   */
  getFullName(): string {
    return `${this.appLabel}.${this.name}`;
  }

  /**
   * Clone this model state
   */
  clone(): ModelState {
    return new ModelState({
      name: this.name,
      appLabel: this.appLabel,
      dbTable: this.dbTable,
      fields: Object.fromEntries(this.fields),
      indexes: [...this.indexes],
      uniqueTogether: [...this.uniqueTogether],
      abstract: this.abstract,
    });
  }

  /**
   * Create a new ModelState with an added field
   */
  withAddedField(name: string, field: FieldState): ModelState {
    const newFields = Object.fromEntries(this.fields);
    newFields[name] = field;
    return new ModelState({
      name: this.name,
      appLabel: this.appLabel,
      dbTable: this.dbTable,
      fields: newFields,
      indexes: this.indexes,
      uniqueTogether: this.uniqueTogether,
      abstract: this.abstract,
    });
  }

  /**
   * Create a new ModelState with a removed field
   */
  withRemovedField(name: string): ModelState {
    const newFields = Object.fromEntries(this.fields);
    delete newFields[name];
    return new ModelState({
      name: this.name,
      appLabel: this.appLabel,
      dbTable: this.dbTable,
      fields: newFields,
      indexes: this.indexes,
      uniqueTogether: this.uniqueTogether,
      abstract: this.abstract,
    });
  }

  /**
   * Create a new ModelState with an altered field
   */
  withAlteredField(name: string, field: FieldState): ModelState {
    const newFields = Object.fromEntries(this.fields);
    newFields[name] = field;
    return new ModelState({
      name: this.name,
      appLabel: this.appLabel,
      dbTable: this.dbTable,
      fields: newFields,
      indexes: this.indexes,
      uniqueTogether: this.uniqueTogether,
      abstract: this.abstract,
    });
  }

  /**
   * Create a new ModelState with a renamed field
   */
  withRenamedField(oldName: string, newName: string): ModelState {
    const newFields = Object.fromEntries(this.fields);
    const field = newFields[oldName];
    if (field) {
      delete newFields[oldName];
      newFields[newName] = field;
    }
    return new ModelState({
      name: this.name,
      appLabel: this.appLabel,
      dbTable: this.dbTable,
      fields: newFields,
      indexes: this.indexes,
      uniqueTogether: this.uniqueTogether,
      abstract: this.abstract,
    });
  }

  /**
   * Serialize to plain object
   */
  toJSON(): ModelStateData {
    return {
      name: this.name,
      appLabel: this.appLabel,
      dbTable: this.dbTable,
      fields: Object.fromEntries(this.fields),
      indexes: this.indexes,
      uniqueTogether: this.uniqueTogether,
      abstract: this.abstract,
    };
  }
}

// ============================================================================
// Project State
// ============================================================================

/**
 * Serializable representation of project state
 */
export interface ProjectStateData {
  /** Model states by full name (appLabel.modelName) */
  models: Record<string, ModelStateData>;
}

/**
 * Represents the state of all models at a point in migration history
 *
 * ProjectState is immutable - all mutations return new instances.
 */
export class ProjectState {
  private readonly _models: Map<string, ModelState>;

  constructor(models?: Map<string, ModelState>) {
    this._models = models ?? new Map();
  }

  /**
   * Create an empty project state
   */
  static empty(): ProjectState {
    return new ProjectState();
  }

  /**
   * Create project state from current model definitions
   *
   * @param models - Map of appLabel -> array of Model classes
   */
  static fromModels(
    // deno-lint-ignore no-explicit-any
    models: Map<string, Array<new () => Model>>,
  ): ProjectState {
    const state = new Map<string, ModelState>();

    for (const [appLabel, modelClasses] of models) {
      for (const ModelClass of modelClasses) {
        const modelState = ModelState.fromModel(ModelClass, appLabel);
        if (!modelState.abstract) {
          state.set(modelState.getFullName(), modelState);
        }
      }
    }

    return new ProjectState(state);
  }

  /**
   * Get all model states
   */
  getModels(): Map<string, ModelState> {
    return new Map(this._models);
  }

  /**
   * Get model state by full name
   */
  getModel(fullName: string): ModelState | undefined {
    return this._models.get(fullName);
  }

  /**
   * Check if a model exists
   */
  hasModel(fullName: string): boolean {
    return this._models.has(fullName);
  }

  /**
   * Get model names for an app
   */
  getModelsForApp(appLabel: string): ModelState[] {
    const models: ModelState[] = [];
    for (const [name, model] of this._models) {
      if (name.startsWith(appLabel + ".")) {
        models.push(model);
      }
    }
    return models;
  }

  /**
   * Get all app labels
   */
  getAppLabels(): string[] {
    const apps = new Set<string>();
    for (const name of this._models.keys()) {
      const [appLabel] = name.split(".");
      apps.add(appLabel);
    }
    return Array.from(apps).sort();
  }

  /**
   * Clone this project state
   */
  clone(): ProjectState {
    const newModels = new Map<string, ModelState>();
    for (const [name, model] of this._models) {
      newModels.set(name, model.clone());
    }
    return new ProjectState(newModels);
  }

  // =========================================================================
  // Mutations (return new ProjectState)
  // =========================================================================

  /**
   * Add a model to the state
   */
  withAddedModel(model: ModelState): ProjectState {
    const newModels = new Map(this._models);
    newModels.set(model.getFullName(), model);
    return new ProjectState(newModels);
  }

  /**
   * Remove a model from the state
   */
  withRemovedModel(fullName: string): ProjectState {
    const newModels = new Map(this._models);
    newModels.delete(fullName);
    return new ProjectState(newModels);
  }

  /**
   * Add a field to a model
   */
  withAddedField(
    modelFullName: string,
    fieldName: string,
    field: FieldState,
  ): ProjectState {
    const model = this._models.get(modelFullName);
    if (!model) {
      throw new Error(`Model ${modelFullName} not found`);
    }
    const newModel = model.withAddedField(fieldName, field);
    return this.withAddedModel(newModel);
  }

  /**
   * Remove a field from a model
   */
  withRemovedField(modelFullName: string, fieldName: string): ProjectState {
    const model = this._models.get(modelFullName);
    if (!model) {
      throw new Error(`Model ${modelFullName} not found`);
    }
    const newModel = model.withRemovedField(fieldName);
    return this.withAddedModel(newModel);
  }

  /**
   * Alter a field in a model
   */
  withAlteredField(
    modelFullName: string,
    fieldName: string,
    field: FieldState,
  ): ProjectState {
    const model = this._models.get(modelFullName);
    if (!model) {
      throw new Error(`Model ${modelFullName} not found`);
    }
    const newModel = model.withAlteredField(fieldName, field);
    return this.withAddedModel(newModel);
  }

  /**
   * Rename a field in a model
   */
  withRenamedField(
    modelFullName: string,
    oldName: string,
    newName: string,
  ): ProjectState {
    const model = this._models.get(modelFullName);
    if (!model) {
      throw new Error(`Model ${modelFullName} not found`);
    }
    const newModel = model.withRenamedField(oldName, newName);
    return this.withAddedModel(newModel);
  }

  /**
   * Rename a model
   */
  withRenamedModel(
    oldFullName: string,
    newName: string,
    newDbTable?: string,
  ): ProjectState {
    const model = this._models.get(oldFullName);
    if (!model) {
      throw new Error(`Model ${oldFullName} not found`);
    }

    const newModel = new ModelState({
      name: newName,
      appLabel: model.appLabel,
      dbTable: newDbTable ?? model.dbTable,
      fields: Object.fromEntries(model.fields),
      indexes: model.indexes,
      uniqueTogether: model.uniqueTogether,
      abstract: model.abstract,
    });

    const newModels = new Map(this._models);
    newModels.delete(oldFullName);
    newModels.set(newModel.getFullName(), newModel);
    return new ProjectState(newModels);
  }

  /**
   * Serialize to plain object
   */
  toJSON(): ProjectStateData {
    const models: Record<string, ModelStateData> = {};
    for (const [name, model] of this._models) {
      models[name] = model.toJSON();
    }
    return { models };
  }

  /**
   * Deserialize from plain object
   */
  static fromJSON(data: ProjectStateData): ProjectState {
    const models = new Map<string, ModelState>();
    for (const [name, modelData] of Object.entries(data.models)) {
      models.set(name, new ModelState(modelData));
    }
    return new ProjectState(models);
  }
}
