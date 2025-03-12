import {type SanityClient} from '@sanity/client'
import {from} from 'rxjs'

import {encodeTransaction} from '../../../encoders/sanity'
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
        client.dataRequest('mutate', encodeTransaction(transaction), {
          visibility: 'async',
          returnDocuments: false,
        }),
      ),
  }
}
