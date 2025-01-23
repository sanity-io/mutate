import {createDocumentEventListener} from '../../listeners/createDocumentEventListener'
import {createDocumentLoader} from '../../listeners/createDocumentLoader'
import {createSharedListener} from '../../listeners/createSharedListener'
import {createMockBackend} from '../../mock/createMockBackend'
import {type OptimisticStoreBackend2} from '../createOptimisticStore2'

export function createOptimisticStoreMockBackend(): OptimisticStoreBackend2 {
  const mockBackend = createMockBackend()

  const sharedListener = createSharedListener((query: string, options) =>
    mockBackend.listen(query),
  )
  const loadDocument = createDocumentLoader(ids =>
    mockBackend.getDocuments(ids),
  )
  const listenDocument = createDocumentEventListener({
    loadDocument,
    listenerEvents: sharedListener,
  })
  return {listen: listenDocument, submit: mockBackend.submit}
}
