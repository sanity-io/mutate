import {map, type Observable} from 'rxjs'

import {
  type ListenerEndpointEvent,
  type ListenerMutationEvent,
} from '../../types'
import {ChannelError, DisconnectError} from '../errors'
/**
 * Takes a stream of /listen events and turn them into errors in case of disconnect or channelError
 */
export function withListenErrors() {
  return (input$: Observable<ListenerEndpointEvent>) =>
    input$.pipe(
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
