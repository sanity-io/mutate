import {createInMemoryBackend} from '../../in-memory/createInMemoryBackend'
import {createDocumentEventListener} from '../../listeners/createDocumentEventListener'
import {createDocumentLoader} from '../../listeners/createDocumentLoader'
import {createSharedListener} from '../../listeners/createSharedListener'
import {type OptimisticStoreBackend} from '../createOptimisticStore'

export function createOptimisticStoreInMemoryBackend(): OptimisticStoreBackend {
  const backend = createInMemoryBackend()

  const sharedListener = createSharedListener((query: string, options) =>
    backend.listen(query),
  )
  const loadDocument = createDocumentLoader(ids => backend.getDocuments(ids))
  const listenDocument = createDocumentEventListener({
    loadDocument,
    listenerEvents: sharedListener,
  })
  return {listen: listenDocument, submit: backend.submit}
}
