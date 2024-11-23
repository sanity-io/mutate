import {type Observable} from 'rxjs'
import {scan} from 'rxjs/operators'

import {type SanityDocumentBase} from '../../mutations/types'
import {applyMutationEventEffects} from '../documentMap/applyMendoza'
import {type ListenerEvent} from '../types'

export interface DocumentUpdate<Doc extends SanityDocumentBase> {
  snapshot: Doc | undefined
  event: ListenerEvent<Doc> | undefined
}

export type DocumentUpdateListener<Doc extends SanityDocumentBase> = (
  id: string,
) => Observable<DocumentUpdate<Doc>>

/**
 * Creates a function that can be used to listen for document snapshots
 * Emits the latest snapshot of the document along with the latest event
 * @param options
 */
export function createDocumentSnapshotListener(options: {
  documentEventListener: (id: string) => Observable<ListenerEvent>
}) {
  const {documentEventListener} = options

  return function listen<Doc extends SanityDocumentBase>(documentId: string) {
    return documentEventListener(documentId).pipe(
      scan(
        (prev: DocumentUpdate<Doc>, event: ListenerEvent) => {
          if (event.type === 'sync') {
            return {event, snapshot: event.document} as DocumentUpdate<Doc>
          }
          if (event.type === 'mutation') {
            if (prev.event === undefined) {
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
              snapshot: applyMutationEventEffects(prev.snapshot, event) as Doc,
            }
          }
          return {snapshot: prev.snapshot, event: event}
        },
        {snapshot: undefined, event: undefined},
      ),
    )
  }
}
