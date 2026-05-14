import {map, type Observable} from 'rxjs'

import {
  type ListenerEndpointEvent,
  type ListenerMutationEvent,
} from '../../types'
import {ChannelError, DisconnectError} from '../errors'

/**
 * Takes a stream of /listen events and surfaces `disconnect`/`channelError`
 * notifications as tagged-error values emitted on `next`.
 *
 * Per the @sanity/mutate RxJS convention the error channel is reserved for
 * panics; operational failures flow as values.
 */
export function withListenErrors() {
  return (input$: Observable<ListenerEndpointEvent>) =>
    input$.pipe(
      map(event => {
        if (event.type === 'mutation') {
          return event as ListenerMutationEvent
        }
        if (event.type === 'disconnect') {
          return new DisconnectError({reason: event.reason})
        }
        if (event.type === 'channelError') {
          return new ChannelError({reason: event.message})
        }
        // pass on welcome and reconnect events
        // note: reconnect is special and should not be subject to error path + retry because that will reinstantiate the eventsource instance
        return event
      }),
    )
}
