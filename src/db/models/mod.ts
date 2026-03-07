/**
 * Models module for Alexi ORM
 *
 * This module exports the Model base class and Manager.
 *
 * @module
 */

// Model base class and types
export { Model, ModelRegistry } from "./model.ts";
export type {
  IndexDefinition,
  ModelData,
  ModelMeta,
  ModelOperationOptions,
  PartialModelData,
  ReverseRelationDef,
} from "./model.ts";
export { RelatedManager } from "../fields/relations.ts";
export { Field } from "../fields/field.ts";

// Manager class and exceptions
export { DoesNotExist, Manager, MultipleObjectsReturned } from "./manager.ts";
