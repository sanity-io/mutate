import * as errore from 'errore'

export class ApplyMutationFailedError extends errore.createTaggedError({
  name: 'ApplyMutationFailedError',
  message: 'Failed to apply mutation: $reason',
}) {}

export class UnknownMutationTypeError extends errore.createTaggedError({
  name: 'UnknownMutationTypeError',
  message: 'Invalid mutation type: $type',
}) {}

export class MendozaRevisionMismatchError extends errore.createTaggedError({
  name: 'MendozaRevisionMismatchError',
  message:
    'Invalid document revision. The provided patch is calculated from a different revision than the current document',
}) {}

export class MendozaMissingEffectsError extends errore.createTaggedError({
  name: 'MendozaMissingEffectsError',
  message:
    'Mutation event is missing effects. Is the listener set up with effectFormat=mendoza?',
}) {}

export class DocumentIdMissingFromMutationError extends errore.createTaggedError(
  {
    name: 'DocumentIdMissingFromMutationError',
    message: 'Unable to get document id from mutation',
  },
) {}

export class RebaseDmpApplyError extends errore.createTaggedError({
  name: 'RebaseDmpApplyError',
  message: 'Failed to apply patch for document "$documentId": $reason',
}) {}
