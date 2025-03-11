import {createDocumentEventListener} from '../../listeners/createDocumentEventListener'
import {createDocumentLoader} from '../../listeners/createDocumentLoader'
import {createSharedListener} from '../../listeners/createSharedListener'
import {type MockBackendAPI} from '../../mock/createMockBackendAPI'
import {type OptimisticStoreBackend} from '../createOptimisticStore'

export function createOptimisticStoreMockBackend(
  backendAPI: MockBackendAPI,
): OptimisticStoreBackend {
  const sharedListener = createSharedListener((query: string, options) =>
    backendAPI.listen(query),
  )
  const loadDocument = createDocumentLoader(ids => backendAPI.getDocuments(ids))
  const listenDocument = createDocumentEventListener({
    loadDocument,
    listenerEvents: sharedListener,
  })
  return {listen: listenDocument, submit: backendAPI.submit}
}
