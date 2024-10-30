import {type SanityClient} from '@sanity/client'
import {catchError, concatMap, map, of, throwError} from 'rxjs'

import {type SanityDocumentBase} from '../../mutations/types'
import {type ListenerSyncEvent} from '../types'
import {type GlobalMutationEventStream} from './createGlobalMutationEventsListener'
import {FetchError, isClientError} from './errors'
import {sequentializeListenerEvents} from './sequentializeListenerEvents'

/**
 * Creates a resilient document observer that will always do it's best to maintain a local copy of the latest document from a sanity dataset
 * Features
 *  - builtin retrying and connection recovery (track disconnected state by listening for `reconnect` events)
 *  - builtin mutation event ordering (they might arrive out of order), lost events detection (listen endpoint doesn't guarantee delivery) and recovery
 *  - discards already-applied mutation events received while fetching the initial document snapshot
 * @param options
 */
export function createDocumentObserver(options: {
  client: SanityClient
  globalEvents: GlobalMutationEventStream
}) {
  const {client, globalEvents} = options
  return function observe<Doc extends SanityDocumentBase>(documentId: string) {
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
              catchError((err: unknown) => {
                const error = toError(err)
                if (isClientError(error)) {
                  return throwError(() => error)
                }
                return throwError(
                  () =>
                    new FetchError(
                      `An unexpected error occurred while fetching document: ${error?.message}`,
                      {cause: error},
                    ),
                )
              }),
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

function toError(maybeErr: unknown) {
  if (maybeErr instanceof Error) {
    return maybeErr
  }
  if (typeof maybeErr === 'object' && maybeErr) {
    return Object.assign(new Error(), maybeErr)
  }
  return new Error(String(maybeErr))
}
