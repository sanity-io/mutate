import {filter, mergeMap, type Observable, of} from 'rxjs'
import {scan} from 'rxjs/operators'

import {decodeAll} from '../../encoders/sanity/decode'
import {type SanityDocumentBase} from '../../mutations/types'
import {applyAll} from '../documentMap/applyDocumentMutation'
import {applyMutationEventEffects} from '../documentMap/applyMendoza'
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
) => Observable<DocumentUpdate<Doc>>

/**
 * Creates a function that can be used to listen for document updates
 * Emits the latest snapshot of the document along with the latest event
 * @param options
 */
export function createDocumentUpdateListener(options: {
  listenDocumentEvents: (
    documentId: string,
  ) => Observable<ListenerEvent | Error>
}) {
  const {listenDocumentEvents} = options

  return function listen<Doc extends SanityDocumentBase>(documentId: string) {
    return listenDocumentEvents(documentId).pipe(
      // TODO Phase 4c: surface listener errors as value events on this stream
      mergeMap(event => {
        if (event instanceof Error) throw event
        return of(event)
      }),
      scan(
        (
          prev: DocumentUpdate<Doc> | undefined,
          event: ListenerEvent,
        ): DocumentUpdate<Doc> => {
          if (event.type === 'sync') {
            return {
              event,
              documentId,
              snapshot: event.document,
            } as DocumentUpdate<Doc>
          }
          if (event.type === 'mutation') {
            if (prev?.event === undefined) {
              throw new Error(
                'Received a mutation event before sync event. Something is wrong',
              )
            }
            if (hasProperty(event, 'effects')) {
              return {
                event,
                documentId,
                snapshot: applyMutationEventEffects(
                  prev.snapshot,
                  event,
                ) as Doc,
              }
            }
            if (hasProperty(event, 'mutations')) {
              // TODO Phase 4c: surface PathParseError as a value event on the document-update stream
              const decoded = decodeAll(event.mutations)
              if (decoded instanceof Error) throw decoded
              return {
                event,
                documentId,
                snapshot: applyAll(prev.snapshot, decoded) as Doc,
              }
            }
            throw new Error(
              'No effects found on listener event. The listener must be set up to use effectFormat=mendoza.',
            )
          }
          return {documentId, snapshot: prev?.snapshot, event}
        },
        undefined,
      ),
      // ignore seed value
      filter(update => update !== undefined),
    )
  }
}
