import * as errore from 'errore'

import {type ApplyPatchError} from '../apply'
import {type SanityDecodeError} from '../encoders/sanity/decode'
import {type SanityEncodeError} from '../encoders/sanity/encode'
import {type ListenerError} from './listeners/errors'

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

/**
 * Catch-all union of error values that may be emitted on the OptimisticStore's
 * public observable streams. `listenEvents(id)` and `listen(id)` widen to
 * `Event | StoreError`; consumers narrow with `instanceof Error`.
 *
 * Per the @sanity/mutate RxJS convention the Observable error channel is
 * reserved for panics.
 */
export type StoreError =
  | ListenerError
  | SanityDecodeError
  | SanityEncodeError
  | ApplyPatchError
  | ApplyMutationFailedError
  | UnknownMutationTypeError
  | MendozaRevisionMismatchError
  | MendozaMissingEffectsError
  | DocumentIdMissingFromMutationError
  | RebaseDmpApplyError
