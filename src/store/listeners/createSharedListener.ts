import {
  type ReconnectEvent,
  type SanityClient,
  type WelcomeEvent,
} from '@sanity/client'
import {type Observable, timer} from 'rxjs'

import {type ListenerMutationEvent} from '../types'
import {listenWithErrors} from './utils/listenWithErrors'
import {shareReplayLatest} from './utils/shareReplayLatest'

export interface ListenerOptions {
  client: SanityClient
  /**
   * Provide a custom filter to the listener. By default, this listener will include all events
   * Note: make sure the filter includes events from documents you will subscribe to.
   */
  filter?: string
  /**
   * Whether to include system documents or not
   * This will be ignored if a custom filter is provided
   */
  includeSystemDocuments?: boolean
  /**
   * How long after the last subscriber is unsubscribed to keep the connection open
   */
  shutdownDelay?: number
  /**
   * Include mutations in listener events
   */
  includeMutations?: boolean

  /**
   * Request tag
   */
  tag?: string
}

/**
 * Creates a (low level) shared listener that will emit 'welcome' for all new subscribers immediately, and thereafter emit every listener event, including welcome, mutation, and reconnects
 */
export function createSharedListener(
  options: ListenerOptions,
): Observable<WelcomeEvent | ListenerMutationEvent | ReconnectEvent> {
  const {
    client,
    filter,
    tag,
    shutdownDelay,
    includeSystemDocuments,
    includeMutations,
  } = options

  const query = filter
    ? `*[${filter}]`
    : includeSystemDocuments
      ? '*[!(_id in path("_.**"))]'
      : '*'

  return listenWithErrors(
    client,
    query,
    {},
    {
      events: ['welcome', 'mutation', 'reconnect'],
      includeResult: false,
      includePreviousRevision: false,
      visibility: 'transaction',
      effectFormat: 'mendoza',
      ...(includeMutations ? {} : {includeMutations: false}),
      tag,
    },
  ).pipe(
    shareReplayLatest({
      // note: resetOnError and resetOnComplete are both default true
      resetOnError: true,
      resetOnComplete: true,
      predicate: event =>
        event.type === 'welcome' || event.type === 'reconnect',
      resetOnRefCountZero:
        typeof shutdownDelay === 'number' ? () => timer(shutdownDelay) : true,
    }),
  )
}
