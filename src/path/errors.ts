import * as errore from 'errore'

export class PathParseError extends errore.createTaggedError({
  name: 'PathParseError',
  message: 'Invalid path: $reason',
}) {}
