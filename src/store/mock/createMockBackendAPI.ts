import {partition} from 'lodash'
import {concat, filter, merge, NEVER, type Observable, of, Subject} from 'rxjs'
import {map} from 'rxjs/operators'

import {SanityEncoder} from '../../index'
import {type Transaction} from '../../mutations/types'
import {applyMutations} from '../documentMap/applyMutations'
import {createDocumentMap} from '../documentMap/createDocumentMap'
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
    listenerName: 'mock' + Math.random().toString(32).substring(2),
  }
}

/**
 * This is the interface that a mock backend instance needs to implement
 */
export interface MockBackendAPI {
  listen(query: string): Observable<ListenerEndpointEvent>
  getDocuments(ids: string[]): Observable<DocEndpointResponse>
  submit(transaction: Transaction): Observable<SubmitResult>
}
export function createMockBackendAPI(): MockBackendAPI {
  const documentMap = createDocumentMap()
  const listenerEvents = new Subject<ListenerEndpointEvent>()
  return {
    listen: (query: string) => {
      return concat(
        of(createWelcomeEvent()),
        merge(NEVER, listenerEvents).pipe(
          filter(m => m.type === 'mutation'),
          map(ev => structuredClone(ev)),
        ),
      )
    },
    getDocuments(ids: string[]): Observable<DocEndpointResponse> {
      const docs = ids.map(id => ({id, document: documentMap.get(id)}))
      const [existing, omitted] = partition(docs, entry => entry.document)
      return of(
        structuredClone({
          documents: existing.map(entry => entry.document!),
          omitted: omitted.map(entry => ({id: entry.id, reason: 'existence'})),
        } satisfies DocEndpointResponse),
      )
    },
    submit: (_transaction: Transaction) => {
      const transaction = structuredClone(_transaction)
      const result = applyMutations(
        transaction.mutations,
        documentMap,
        transaction.id as never,
      )

      result.forEach(res => {
        listenerEvents.next({
          type: 'mutation',
          documentId: res.id,
          mutations: SanityEncoder.encodeAll(res.mutations),
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
      })
      return of({} satisfies SubmitResult)
    },
  }
}
