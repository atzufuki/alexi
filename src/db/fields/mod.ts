/**
 * Fields module for Alexi ORM
 *
 * This module exports all field types and related utilities.
 *
 * @module
 */

// Base field class and types
export { Field } from "./field.ts";
export type { FieldOptions, ValidationResult, Validator } from "./field.ts";

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
} from "./types.ts";

export type { CharFieldOptions, DateFieldOptions, DecimalFieldOptions } from "./types.ts";

// Relation fields
export {
  ForeignKey,
  ManyToManyField,
  ManyToManyManager,
  OnDelete,
  OneToOneField,
} from "./relations.ts";

export type {
  ForeignKeyOptions,
  LazyModelRef,
  ManyToManyFieldOptions,
  ModelClass,
} from "./relations.ts";
