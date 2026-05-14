import {filter, type Observable, takeWhile} from 'rxjs'
import {scan} from 'rxjs/operators'

import {decodeAll} from '../../encoders/sanity/decode'
import {type SanityDocumentBase} from '../../mutations/types'
import {applyAll} from '../documentMap/applyDocumentMutation'
import {applyMutationEventEffects} from '../documentMap/applyMendoza'
import {MendozaMissingEffectsError, type StoreError} from '../errors'
import {
  type ListenerEvent,
  type ListenerMutationEvent,
  type ListenerReconnectEvent,
  type ListenerSyncEvent,
} from '../types'
import {hasProperty} from '../utils/isEffectEvent'

export interface DocumentSyncUpdate<Doc extends SanityDocumentBase> {
  documentId: string
  snapshot: Doc | undefined
  event: ListenerSyncEvent<Doc>
}
export interface DocumentMutationUpdate<Doc extends SanityDocumentBase> {
  documentId: string
  snapshot: Doc | undefined
  event: ListenerMutationEvent
}

export interface DocumentReconnectUpdate<Doc extends SanityDocumentBase> {
  documentId: string
  snapshot: Doc | undefined
  event: ListenerReconnectEvent
}

export type DocumentUpdate<Doc extends SanityDocumentBase> =
  | DocumentSyncUpdate<Doc>
  | DocumentMutationUpdate<Doc>
  | DocumentReconnectUpdate<any>

export type DocumentUpdateListener<Doc extends SanityDocumentBase> = (
  id: string,
) => Observable<DocumentUpdate<Doc> | StoreError>

/**
 * Creates a function that can be used to listen for document updates.
 * Emits the latest snapshot of the document along with the latest event.
 *
 * Per the @sanity/mutate RxJS convention the output Observable surfaces
 * operational failures as tagged-error values on `next`, and completes after
 * the first error emission (via `takeWhile`). Callers narrow with
 * `instanceof Error` and may resubscribe to recover.
 *
 * @param options
 */
export function createDocumentUpdateListener(options: {
  listenDocumentEvents: (
    documentId: string,
  ) => Observable<ListenerEvent | Error>
}) {
  const {listenDocumentEvents} = options

  return function listen<Doc extends SanityDocumentBase>(
    documentId: string,
  ): Observable<DocumentUpdate<Doc> | StoreError> {
    return listenDocumentEvents(documentId).pipe(
      scan(
        (
          prev: DocumentUpdate<Doc> | StoreError | undefined,
          event: ListenerEvent | Error,
        ): DocumentUpdate<Doc> | StoreError => {
          if (event instanceof Error) {
            return event as StoreError
          }
          if (event.type === 'sync') {
            return {
              event,
              documentId,
              snapshot: event.document,
            } as DocumentUpdate<Doc>
          }
          if (event.type === 'mutation') {
            if (prev === undefined || prev instanceof Error) {
              // Invariant: mutation cannot arrive before sync. Panic.
              throw new Error(
                'Received a mutation event before sync event. Something is wrong',
              )
            }
            if (hasProperty(event, 'effects')) {
              const applied = applyMutationEventEffects(prev.snapshot, event)
              if (applied instanceof Error) return applied
              return {
                event,
                documentId,
                snapshot: applied as Doc,
              }
            }
            if (hasProperty(event, 'mutations')) {
              const decoded = decodeAll(event.mutations)
              if (decoded instanceof Error) return decoded
              const applied = applyAll(prev.snapshot, decoded)
              if (applied instanceof Error) return applied as StoreError
              return {
                event,
                documentId,
                snapshot: applied as Doc,
              }
            }
            return new MendozaMissingEffectsError()
          }
          return {
            documentId,
            snapshot: (prev as DocumentUpdate<Doc> | undefined)?.snapshot,
            event,
          }
        },
        undefined,
      ),
      // ignore seed value
      filter(
        (update): update is DocumentUpdate<Doc> | StoreError =>
          update !== undefined,
      ),
      // Terminate the stream after the first error emission; consumers receive
      // the error as a value and should resubscribe if they want to recover.
      takeWhile(
        (update): boolean => !(update instanceof Error),
        /* inclusive */ true,
      ),
    )
  }
}
