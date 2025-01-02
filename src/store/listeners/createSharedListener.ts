import {
  type ReconnectEvent,
  type SanityClient,
  type WelcomeEvent,
} from '@sanity/client'
import {type Observable, timer} from 'rxjs'

import {
  type ListenerEndpointEvent,
  type ListenerMutationEvent,
  type QueryParams,
} from '../types'
import {shareReplayLatest} from './utils/shareReplayLatest'
import {withListenErrors} from './utils/withListenErrors'

export interface ListenerOptions {
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

export type SharedListenerListenFn = (
  query: string,
  queryParams: QueryParams,
  options: RequestOptions,
) => Observable<ListenerEndpointEvent>

/**
 * These are fixed, and it's up to the implementation of the listen function to turn them into request parameters
 */
export interface RequestOptions {
  events: ['welcome', 'mutation', 'reconnect']
  includeResult: false
  includePreviousRevision: false
  visibility: 'transaction'
  effectFormat: 'mendoza'
  includeMutations?: boolean
  tag?: string
}

/**
 * Creates a (low level) shared listener that will emit 'welcome' for all new subscribers immediately, and thereafter emit every listener event, including welcome, mutation, and reconnects
 * Requires a Sanity client instance
 */
export function createSharedListenerFromClient(
  client: SanityClient,
  options?: ListenerOptions,
): Observable<WelcomeEvent | ListenerMutationEvent | ReconnectEvent> {
  const listener = (
    query: string,
    queryParams: QueryParams,
    request: RequestOptions,
  ) => {
    return client.listen(
      query,
      queryParams,
      request,
    ) as Observable<ListenerEndpointEvent>
  }

  return createSharedListener(listener, options)
}

/**
 * Creates a (low level) shared listener that will emit 'welcome' for all new subscribers immediately, and thereafter emit every listener event, including welcome, mutation, and reconnects
 * Useful for cases where you need control of how the listen request is set up
 */
export function createSharedListener(
  listen: SharedListenerListenFn,
  options: ListenerOptions = {},
): Observable<WelcomeEvent | ListenerMutationEvent | ReconnectEvent> {
  const {filter, tag, shutdownDelay, includeSystemDocuments, includeMutations} =
    options

  const query = filter
    ? `*[${filter}]`
    : includeSystemDocuments
      ? '*[!(_id in path("_.**"))]'
      : '*'

  return listen(
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
    withListenErrors(),
  )
}
