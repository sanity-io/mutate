import * as errore from 'errore'

export class RevisionMismatchError extends errore.createTaggedError({
  name: 'RevisionMismatchError',
  message: 'Revision mismatch: expected "$expected" but document has "$actual"',
}) {}

export class DocumentIdMismatchError extends errore.createTaggedError({
  name: 'DocumentIdMismatchError',
  message:
    'Document id mismatch. Refusing to apply mutation for document with id="$mutationId" on the given document with id="$documentId"',
}) {}

export class DocumentAlreadyExistsError extends errore.createTaggedError({
  name: 'DocumentAlreadyExistsError',
  message: 'Document with id "$id" already exists',
}) {}

export class DocumentNotFoundError extends errore.createTaggedError({
  name: 'DocumentNotFoundError',
  message: 'Cannot apply $operation on nonexistent document',
}) {}

export class DocumentIdMissingError extends errore.createTaggedError({
  name: 'DocumentIdMissingError',
  message: 'Cannot $operation on document without _id',
}) {}

export class UnsupportedMutationTypeError extends errore.createTaggedError({
  name: 'UnsupportedMutationTypeError',
  message: 'Invalid mutation type: $type',
}) {}

export class UnsupportedOperationError extends errore.createTaggedError({
  name: 'UnsupportedOperationError',
  message: 'Invalid operation type: "$type"',
}) {}

export class TypeMismatchError extends errore.createTaggedError({
  name: 'TypeMismatchError',
  message:
    'Cannot apply "$operation()" on $actualType value (expected $expectedType)',
}) {}

export class MissingArrayItemError extends errore.createTaggedError({
  name: 'MissingArrayItemError',
  message: 'Found no matching array element to $operation',
}) {}

export class InvalidPathSegmentError extends errore.createTaggedError({
  name: 'InvalidPathSegmentError',
  message:
    "Expected path segment to be addressing a single array item either by numeric index or by '_key'. Instead saw $segment",
}) {}

export class InvalidPathError extends errore.createTaggedError({
  name: 'InvalidPathError',
  message:
    'Cannot apply operation of type "$operation" to path $path on $valueType value',
}) {}

export type ApplyMutationError =
  | RevisionMismatchError
  | DocumentIdMismatchError
  | DocumentAlreadyExistsError
  | DocumentNotFoundError
  | DocumentIdMissingError
  | UnsupportedMutationTypeError
  | ApplyPatchError

export type ApplyPatchError =
  | ApplyOpError
  | InvalidPathError
  | MissingArrayItemError
  | InvalidPathSegmentError

export type ApplyOpError =
  | UnsupportedOperationError
  | TypeMismatchError
  | MissingArrayItemError
