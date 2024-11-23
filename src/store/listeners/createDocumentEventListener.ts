import {type ReconnectEvent, type WelcomeEvent} from '@sanity/client'
import {
  catchError,
  concatMap,
  EMPTY,
  map,
  type Observable,
  of,
  throwError,
} from 'rxjs'

import {type SanityDocumentBase} from '../../mutations/types'
import {type ListenerMutationEvent, type ListenerSyncEvent} from '../types'
import {FetchError, isClientError, PermissionDeniedError} from './errors'
import {type DocumentLoader} from './types'
import {sequentializeListenerEvents} from './utils/sequentializeListenerEvents'

/**
 * Creates a function that can be used to listen for events that happens in a single document
 * Features
 *  - builtin retrying and connection recovery (track disconnected state by listening for `reconnect` events)
 *  - builtin mutation event ordering (they might arrive out of order), lost events detection (/listen endpoint doesn't guarantee delivery) and recovery
 *  - discards already-applied mutation events received while fetching the initial document snapshot
 * @param options
 */
export function createDocumentEventListener(options: {
  loadDocument: DocumentLoader
  listenerEvents: Observable<
    WelcomeEvent | ListenerMutationEvent | ReconnectEvent
  >
}) {
  const {listenerEvents, loadDocument} = options

  return function listen<Doc extends SanityDocumentBase>(documentId: string) {
    return listenerEvents.pipe(
      concatMap(event => {
        if (event.type === 'mutation') {
          return event.documentId === documentId ? of(event) : EMPTY
        }

        if (event.type === 'reconnect') {
          return of(event)
        }

        if (event.type === 'welcome') {
          return loadDocument(documentId).pipe(
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
            map(result => {
              if (result.accessible) {
                return result.document as Doc
              }
              if (result.reason === 'permission') {
                throw new PermissionDeniedError(
                  `Permission denied. Make sure the current user (or token) has permission to read the document with ID="${documentId}".`,
                )
              }
              return undefined
            }),
            map(
              (doc: undefined | Doc): ListenerSyncEvent<Doc> => ({
                type: 'sync',
                document: doc,
              }),
            ),
          )
        }
        // ignore unknown events
        return EMPTY
      }),
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
