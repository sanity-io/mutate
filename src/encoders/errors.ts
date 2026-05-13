import * as errore from 'errore'

export class UnsupportedEncodeMutationError extends errore.createTaggedError({
  name: 'UnsupportedEncodeMutationError',
  message: 'Cannot encode mutation: invalid mutation type "$type"',
}) {}

export class UnsupportedEncodeOperationError extends errore.createTaggedError({
  name: 'UnsupportedEncodeOperationError',
  message: 'Cannot encode operation: invalid operation type "$type"',
}) {}

export class UnsupportedDecodeMutationError extends errore.createTaggedError({
  name: 'UnsupportedDecodeMutationError',
  message: 'Cannot decode mutation: $reason',
}) {}

export class UnsupportedDecodeOperationError extends errore.createTaggedError({
  name: 'UnsupportedDecodeOperationError',
  message: 'Cannot decode operation: invalid type "$type"',
}) {}

export class MissingKeyError extends errore.createTaggedError({
  name: 'MissingKeyError',
  message: 'Cannot decode upsert patch: referenceItem is missing key',
}) {}

export class AmbiguousInsertPositionError extends errore.createTaggedError({
  name: 'AmbiguousInsertPositionError',
  message:
    'Insert patch is ambiguous. Should contain only one of: before, replace, after. Instead found: $found',
}) {}

export class MissingInsertPositionError extends errore.createTaggedError({
  name: 'MissingInsertPositionError',
  message: 'Insert patch missing position',
}) {}

export class UnsupportedSanityOperationError extends errore.createTaggedError({
  name: 'UnsupportedSanityOperationError',
  message: '$operation is not supported by Sanity',
}) {}

export class UnsupportedFormPatchPathError extends errore.createTaggedError({
  name: 'UnsupportedFormPatchPathError',
  message: 'Form patch paths cannot include arrays',
}) {}

export class UnsupportedFormPatchTypeError extends errore.createTaggedError({
  name: 'UnsupportedFormPatchTypeError',
  message: 'Unknown form patch type: $type',
}) {}
