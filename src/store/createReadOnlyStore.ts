import {
  combineLatest,
  finalize,
  type Observable,
  ReplaySubject,
  share,
  timer,
} from 'rxjs'

import {type SanityDocumentBase} from '../mutations/types'
import {
  type DocumentUpdate,
  type DocumentUpdateListener,
} from './listeners/createSnapshotListener'

export type MapTuple<T, U> = {[K in keyof T]: U}

export interface ReadOnlyDocumentStore {
  listenDocument: <Doc extends SanityDocumentBase>(
    id: string,
  ) => Observable<DocumentUpdate<Doc>>
  listenDocuments: <
    Doc extends SanityDocumentBase,
    const IdTuple extends string[],
  >(
    id: IdTuple,
  ) => Observable<MapTuple<IdTuple, DocumentUpdate<Doc>>>
}

/**
 * @param listenDocumentUpdates – a function that takes a document id and returns  an observable of document snapshots
 * @param options
 */
export function createReadOnlyStore(
  listenDocumentUpdates: DocumentUpdateListener<SanityDocumentBase>,
  options: {shutdownDelay?: number} = {},
): ReadOnlyDocumentStore {
  const cache = new Map<
    string,
    Observable<DocumentUpdate<SanityDocumentBase>>
  >()

  const {shutdownDelay} = options

  function listenDocument<Doc extends SanityDocumentBase>(id: string) {
    if (cache.has(id)) {
      return cache.get(id)! as Observable<DocumentUpdate<Doc>>
    }
    const cached = listenDocumentUpdates(id).pipe(
      finalize(() => cache.delete(id)),
      share({
        resetOnRefCountZero:
          typeof shutdownDelay === 'number' ? () => timer(shutdownDelay) : true,
        connector: () => new ReplaySubject(1),
      }),
    )
    cache.set(id, cached)
    return cached as Observable<DocumentUpdate<Doc>>
  }
  return {
    listenDocument,
    listenDocuments<Doc extends SanityDocumentBase, IdTuple extends string[]>(
      ids: IdTuple,
    ) {
      return combineLatest(
        ids.map(id => listenDocument<Doc>(id)),
      ) as Observable<MapTuple<IdTuple, DocumentUpdate<Doc>>>
    },
  }
}
