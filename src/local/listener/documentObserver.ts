import {type SanityClient} from '@sanity/client'
import {concatMap, map, of} from 'rxjs'

import {type SanityDocumentLike} from '../../mutations/types'
import {type ListenerSyncEvent} from '../types'
import {type GlobalMutationEventStream} from './createGlobalMutationEventsListener'
import {sequentializeListenerEvents} from './sequentializeListenerEvents'

export function createDocumentObserver(options: {
  client: SanityClient
  globalEvents: GlobalMutationEventStream
}) {
  const {client, globalEvents} = options
  return function observe<Doc extends SanityDocumentLike>(documentId: string) {
    return globalEvents.pipe(
      concatMap(event =>
        event.type === 'welcome'
          ? client.observable.getDocument<Doc>(documentId).pipe(
              map(
                (doc: undefined | Doc): ListenerSyncEvent<Doc> => ({
                  type: 'sync',
                  transactionId: doc?._id,
                  document: doc,
                }),
              ),
            )
          : of(event),
      ),
      sequentializeListenerEvents<Doc>({
        maxBufferSize: 10,
        resolveChainDeadline: 10_000,
      }),
    )
  }
}
