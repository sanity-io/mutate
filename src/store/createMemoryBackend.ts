import {concat, filter, map, type Observable, of, Subject} from 'rxjs'

import {type Transaction} from '../mutations/types'
import {type LocalDatasetBackend} from './createOptimisticStore'
import {applyMutations} from './documentMap/applyMutations'
import {createDocumentMap} from './documentMap/createDocumentMap'
import {type ListenerEvent, type SubmitResult} from './types'

export function createMemoryBackend(): LocalDatasetBackend {
  const documentMap = createDocumentMap()
  const updates$ = new Subject<{id: string}>()
  return {
    listen(documentId: string): Observable<ListenerEvent> {
      return concat(
        of(0),
        updates$.pipe(filter(update => update.id === documentId)),
      ).pipe(
        map(() => ({
          type: 'sync' as const,
          document: documentMap.get(documentId),
        })),
      )
    },
    submit(mutationGroups: Transaction[]): Observable<SubmitResult> {
      const results = mutationGroups.map(group =>
        applyMutations(group.mutations, documentMap),
      )
      // Notify about affected documents
      for (const id of new Set(results.flat().map(res => res.id))) {
        updates$.next({id})
      }
      return of()
    },
  }
}
