import * as errore from 'errore'

export class UnsupportedFormatMutationError extends errore.createTaggedError({
  name: 'UnsupportedFormatMutationError',
  message: 'Cannot format mutation: invalid mutation type "$type"',
}) {}

export class UnsupportedFormatOperationError extends errore.createTaggedError({
  name: 'UnsupportedFormatOperationError',
  message: 'Cannot format operation: invalid operation type "$type"',
}) {}
