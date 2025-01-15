import {filter, type Observable} from 'rxjs'
import {scan} from 'rxjs/operators'

import {type SanityDocumentBase} from '../../mutations/types'
import {applyMutationEventEffects} from '../documentMap/applyMendoza'
import {
  type ListenerEvent,
  type ListenerMutationEvent,
  type ListenerReconnectEvent,
  type ListenerSyncEvent,
} from '../types'

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
  listenDocumentEvents: (documentId: string) => Observable<ListenerEvent>
}) {
  const {listenDocumentEvents} = options

  return function listen<Doc extends SanityDocumentBase>(documentId: string) {
    return listenDocumentEvents(documentId).pipe(
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
            if (!event.effects.apply) {
              throw new Error(
                'No effects found on listener event. The listener must be set up to use effectFormat=mendoza.',
              )
            }
            return {
              event,
              documentId,
              snapshot: applyMutationEventEffects(prev.snapshot, event) as Doc,
            }
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
