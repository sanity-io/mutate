import {partition} from 'lodash'
import {concat, filter, type Observable, of, Subject} from 'rxjs'

import {encodeAll} from '../../encoders/sanity'
import {type Transaction} from '../../mutations/types'
import {applyMutations} from '../documentMap/applyMutations'
import {createDocumentMap} from '../documentMap/createDocumentMap'
import {type StoreError} from '../errors'
import {type DocEndpointResponse} from '../listeners/createDocumentLoader'
import {
  type ListenerEndpointEvent,
  type ListenerWelcomeEvent,
  type SubmitResult,
} from '../types'
import {createTransactionId} from '../utils/createTransactionId'

function createWelcomeEvent(): ListenerWelcomeEvent {
  return {
    type: 'welcome',
    listenerName: 'in-memory-' + Math.random().toString(32).substring(2),
  }
}

export function createInMemoryBackend() {
  const store = createDocumentMap()
  const listenerEvents = new Subject<ListenerEndpointEvent>()
  return {
    listen: (query: string) => {
      return concat(
        of(createWelcomeEvent()),
        listenerEvents.pipe(filter(m => m.type === 'mutation')),
      )
    },
    getDocuments(ids: string[]): Observable<DocEndpointResponse> {
      const docs = ids.map(id => ({id, document: store.get(id)}))
      const [existing, omitted] = partition(docs, entry => entry.document)
      return of({
        documents: existing.map(entry => entry.document!),
        omitted: omitted.map(entry => ({id: entry.id, reason: 'existence'})),
      } satisfies DocEndpointResponse)
    },
    submit: (
      transaction: Transaction,
    ): Observable<SubmitResult | StoreError> => {
      const result = applyMutations(
        transaction.mutations,
        store,
        transaction.id as never,
      )
      if (result instanceof Error) {
        return of(result as StoreError)
      }
      for (const res of result) {
        const encodedMutations = encodeAll(res.mutations)
        if (encodedMutations instanceof Error) {
          return of(encodedMutations as StoreError)
        }
        listenerEvents.next({
          type: 'mutation',
          documentId: res.id,
          mutations: encodedMutations,
          transactionId: transaction.id || createTransactionId(),
          previousRev: res.before?._rev,
          resultRev: res.after?._rev,
          transition:
            res.after === undefined
              ? 'disappear'
              : res.before === undefined
                ? 'appear'
                : 'update',
        })
      }
      return of({} satisfies SubmitResult)
    },
  }
}
