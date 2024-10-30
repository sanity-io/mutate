import {
  type ListenOptions,
  type ListenParams,
  type SanityClient,
} from '@sanity/client'
import {map} from 'rxjs'

import {type ListenerMutationEvent} from '../../types'
import {ChannelError, DisconnectError} from '../errors'

/**
 * A client.listen() wrapper that throws in case of disconnect or channelError
 * Also casts mutation event type to the internal ListenerMutationEvent type
 * @param client
 * @param query
 * @param params
 * @param options
 */
export function listenWithErrors(
  client: SanityClient,
  query: string,
  params?: ListenParams,
  options?: ListenOptions,
) {
  return client.listen(query, params, options).pipe(
    map(event => {
      if (event.type === 'mutation') {
        return event as ListenerMutationEvent
      }
      if (event.type === 'disconnect') {
        throw new DisconnectError(`DisconnectError: ${event.reason}`)
      }
      if (event.type === 'channelError') {
        throw new ChannelError(`ChannelError: ${event.message}`)
      }
      // pass on welcome and reconnect events
      // note: reconnect is special and should not be subject to error path + retry because that will reinstantiate the eventsource instance
      return event
    }),
  )
}
