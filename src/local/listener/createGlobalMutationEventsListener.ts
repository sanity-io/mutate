import {
  type ReconnectEvent,
  type SanityClient,
  type WelcomeEvent,
} from '@sanity/client'
import {map, type Observable, timer} from 'rxjs'

import {type ListenerMutationEvent} from '../types'
import {ChannelError, DisconnectError} from './errors'
import {shareReplayLatest} from './shareReplayLatest'

export interface GlobalMutationEventListenerOptions {
  client: SanityClient
  shutdownDelay?: number
  includeSystemDocuments?: boolean
  includeMutations?: boolean
  tag?: string
}

export type GlobalMutationEventStream = Observable<
  WelcomeEvent | ListenerMutationEvent | ReconnectEvent
>

/**
 * Creates a listener that will emit 'welcome' for all new subscribers immediately, and thereafter emit every listener event, including welcome, mutation, and reconnects
 */
export function createGlobalMutationEventsListener(
  options: GlobalMutationEventListenerOptions,
): GlobalMutationEventStream {
  const {client, tag, shutdownDelay, includeSystemDocuments, includeMutations} =
    options

  return client
    .listen(
      includeSystemDocuments ? '*' : '*[!(_id in path("_.**"))]',
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
    )
    .pipe(
      shareReplayLatest({
        predicate: event =>
          event.type === 'welcome' || event.type === 'reconnect',
        resetOnRefCountZero:
          typeof shutdownDelay === 'number' ? () => timer(shutdownDelay) : true,
      }),
      map(event => {
        if (event.type === 'mutation') {
          return event as ListenerMutationEvent
        }
        return event
      }),
      map(event => {
        if (event.type === 'disconnect') {
          throw new DisconnectError(`DisconnectError: ${event.reason}`)
        }
        return event
      }),
      map(event => {
        if (event.type === 'channelError') {
          throw new ChannelError(`ChannelError: ${event.message}`)
        }
        return event
      }),
      // note: reconnect is special and should not be subject to error path + retry because that will reinstantiate the eventsource instance
    )
}
