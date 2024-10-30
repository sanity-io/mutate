import {ClientError as SanityClientError} from '@sanity/client'

import {type ListenerSequenceState} from './utils/sequentializeListenerEvents'

/*
 * This file should include all errors that can be thrown by the document observer
 */

export const ClientError = SanityClientError

export class FetchError extends Error {
  cause?: Error
  constructor(message: string, extra?: {cause?: Error}) {
    super(message)
    this.cause = extra?.cause
    this.name = 'FetchError'
  }
}

export class ChannelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChannelError'
  }
}

export class DisconnectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DisconnectError'
  }
}

export class OutOfSyncError extends Error {
  /**
   * Attach state to the error for debugging/reporting
   */
  state: ListenerSequenceState
  constructor(message: string, state: ListenerSequenceState) {
    super(message)
    this.name = 'OutOfSyncError'
    this.state = state
  }
}

export class DeadlineExceededError extends OutOfSyncError {
  constructor(message: string, state: ListenerSequenceState) {
    super(message, state)
    this.name = 'DeadlineExceededError'
  }
}
export class MaxBufferExceededError extends OutOfSyncError {
  constructor(message: string, state: ListenerSequenceState) {
    super(message, state)
    this.name = 'MaxBufferExceededError'
  }
}

export function isClientError(e: unknown): e is SanityClientError {
  if (typeof e !== 'object') return false
  if (!e) return false
  return 'statusCode' in e && 'response' in e
}
