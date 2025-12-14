import {
  type BaseMutationOptions,
  type QueryParams,
  type RequestOptions,
} from '@sanity/client'
import {from, type Observable} from 'rxjs'

import {encodeTransaction} from '../../../encoders/sanity'
import {type Transaction} from '../../../mutations/types'
import {createDocumentEventListener} from '../../listeners/createDocumentEventListener'
import {createDocumentLoaderFromClient} from '../../listeners/createDocumentLoader'
import {createSharedListenerFromClient} from '../../listeners/createSharedListener'
import {type ListenerEndpointEvent, type SubmitResult} from '../../types'
import {type OptimisticStoreBackend} from '../createOptimisticStore'

export interface SanityClientLike {
  dataRequest(
    endpoint: string,
    body: unknown,
    options?: BaseMutationOptions,
  ): Promise<SubmitResult>
  getDataUrl(doc: string, s: string): string
  observable: {request<T>(options: RequestOptions): Observable<T>}
  listen(
    query: string,
    queryParams: QueryParams,
    request: RequestOptions,
  ): Observable<ListenerEndpointEvent>
}

export function createOptimisticStoreClientBackend(
  client: SanityClientLike,
): OptimisticStoreBackend {
  const listenDocument = createDocumentEventListener({
    loadDocument: createDocumentLoaderFromClient(client),
    listenerEvents: createSharedListenerFromClient(client),
  })
  return {
    listen: listenDocument,
    submit: (transaction: Transaction) =>
      from(
        client.dataRequest('mutate', encodeTransaction(transaction), {
          visibility: 'async',
          returnDocuments: false,
        }),
      ),
  }
}
