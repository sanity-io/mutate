import {
  type ClientError as SanityClientError,
  type ReconnectEvent,
  type WelcomeEvent,
} from '@sanity/client'
import {catchError, concatMap, EMPTY, map, type Observable, of} from 'rxjs'

import {type SanityDocumentBase} from '../../mutations/types'
import {type ListenerMutationEvent, type ListenerSyncEvent} from '../types'
import {
  type ChannelError,
  type DisconnectError,
  FetchError,
  isClientError,
  PermissionDeniedError,
} from './errors'
import {type DocumentLoader} from './types'
import {dedupeListenerEvents} from './utils/dedupeListenerEvents'
import {sequentializeListenerEvents} from './utils/sequentializeListenerEvents'

/**
 * Creates a function that can be used to listen for events that happens in a single document
 * Features
 *  - builtin retrying and connection recovery (track disconnected state by listening for `reconnect` events)
 *  - builtin mutation event ordering (they might arrive out of order), lost events detection (/listen endpoint doesn't guarantee delivery) and recovery
 *  - discards already-applied mutation events received while fetching the initial document snapshot
 *
 * Operational failures (fetch errors, permission denied, the @sanity/client `ClientError`,
 * and the out-of-sync errors from the sequencer) are emitted as tagged-error values on `next`.
 * The Observable's `error` channel is reserved for panics.
 *
 * @param options
 */
export function createDocumentEventListener(options: {
  loadDocument: DocumentLoader
  listenerEvents: Observable<
    | WelcomeEvent
    | ListenerMutationEvent
    | ReconnectEvent
    | ChannelError
    | DisconnectError
  >
}) {
  const {listenerEvents, loadDocument} = options

  return function listen<Doc extends SanityDocumentBase>(documentId: string) {
    return listenerEvents.pipe(
      concatMap(event => {
        // Pass through tagged-error values from upstream (ChannelError, DisconnectError, …).
        if (event instanceof Error) {
          return of(event)
        }
        if (event.type === 'mutation') {
          return event.documentId === documentId ? of(event) : EMPTY
        }

        if (event.type === 'reconnect') {
          return of(event)
        }

        if (event.type === 'welcome') {
          return loadDocument(documentId).pipe(
            catchError(
              (
                err: unknown,
              ): Observable<
                | {accessible: false; reason?: string}
                | FetchError
                | SanityClientError
              > => {
                const error = toError(err)
                if (isClientError(error)) {
                  return of(error)
                }
                return of(
                  new FetchError({
                    reason: error?.message ?? String(err),
                    cause: error,
                  }),
                )
              },
            ),
            map(
              (
                result,
              ):
                | Doc
                | undefined
                | FetchError
                | PermissionDeniedError
                | SanityClientError => {
                if (result instanceof Error) {
                  return result
                }
                if (result.accessible) {
                  return result.document as Doc
                }
                if (result.reason === 'permission') {
                  return new PermissionDeniedError({documentId})
                }
                return undefined
              },
            ),
            map(
              (
                doc,
              ):
                | ListenerSyncEvent<Doc>
                | FetchError
                | PermissionDeniedError
                | SanityClientError => {
                if (doc instanceof Error) return doc
                return {type: 'sync', document: doc}
              },
            ),
          )
        }
        // ignore unknown events
        return EMPTY
      }),
      // dedupe and sequentialize operate on the success-event union; the tagged-error
      // values pass through these operators as opaque emissions (they don't match
      // event.type === 'mutation' / 'sync', so they're treated like any other event).
      dedupeListenerEvents(),
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
