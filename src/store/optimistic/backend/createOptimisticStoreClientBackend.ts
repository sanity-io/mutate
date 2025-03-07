import {type SanityClient} from '@sanity/client'
import {from} from 'rxjs'

import {SanityEncoder} from '../../../index'
import {type Transaction} from '../../../mutations/types'
import {createDocumentEventListener} from '../../listeners/createDocumentEventListener'
import {createDocumentLoaderFromClient} from '../../listeners/createDocumentLoader'
import {createSharedListenerFromClient} from '../../listeners/createSharedListener'
import {type OptimisticStoreBackend} from '../createOptimisticStore'

export function createOptimisticStoreClientBackend(
  client: SanityClient,
): OptimisticStoreBackend {
  const listenDocument = createDocumentEventListener({
    loadDocument: createDocumentLoaderFromClient(client),
    listenerEvents: createSharedListenerFromClient(client),
  })
  return {
    listen: listenDocument,
    submit: (transaction: Transaction) =>
      from(
        client.dataRequest(
          'mutate',
          SanityEncoder.encodeTransaction(transaction),
          {visibility: 'async', returnDocuments: false},
        ),
      ),
  }
}
