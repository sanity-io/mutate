import {ClientError as SanityClientError} from '@sanity/client'
import * as errore from 'errore'

import {type ListenerSequenceState} from './utils/sequentializeListenerEvents'

export const ClientError = SanityClientError

export class FetchError extends errore.createTaggedError({
  name: 'FetchError',
  message: 'An unexpected error occurred while fetching document: $reason',
}) {}

export class PermissionDeniedError extends errore.createTaggedError({
  name: 'PermissionDeniedError',
  message:
    'Permission denied. Make sure the current user (or token) has permission to read the document with ID="$documentId".',
}) {}

export class ChannelError extends errore.createTaggedError({
  name: 'ChannelError',
  message: 'ChannelError: $reason',
}) {}

export class DisconnectError extends errore.createTaggedError({
  name: 'DisconnectError',
  message: 'DisconnectError: $reason',
}) {}

export class DeadlineExceededError extends errore.createTaggedError({
  name: 'DeadlineExceededError',
  message: 'Did not resolve chain within a deadline of $deadlineMs ms',
}) {
  readonly state: ListenerSequenceState
  constructor(args: {
    deadlineMs: number
    state: ListenerSequenceState
    cause?: unknown
  }) {
    super({deadlineMs: args.deadlineMs, cause: args.cause})
    this.state = args.state
  }
}

export class MaxBufferExceededError extends errore.createTaggedError({
  name: 'MaxBufferExceededError',
  message: 'Too many unchainable mutation events: $bufferLength',
}) {
  readonly state: ListenerSequenceState
  constructor(args: {
    bufferLength: number
    state: ListenerSequenceState
    cause?: unknown
  }) {
    super({bufferLength: args.bufferLength, cause: args.cause})
    this.state = args.state
  }
}

/**
 * Union of all out-of-sync conditions emitted by the sequencer.
 * Discriminated by `_tag`.
 */
export type OutOfSyncError = DeadlineExceededError | MaxBufferExceededError

export type ListenerError =
  | FetchError
  | PermissionDeniedError
  | ChannelError
  | DisconnectError
  | OutOfSyncError

export function isClientError(e: unknown): e is SanityClientError {
  if (typeof e !== 'object') return false
  if (!e) return false
  return 'statusCode' in e && 'response' in e
}
