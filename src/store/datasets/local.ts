import {type Mutation, type SanityDocumentBase} from '../../mutations/types'
import {type Dataset} from '../types'
import {getMutationDocumentId} from '../utils/getMutationDocumentId'

interface UpdateResult<T extends SanityDocumentBase> {
  id: string
  status: 'created' | 'updated' | 'deleted'
  before?: T
  after?: T
}

/**
 * The in-memory local dataset that holds all currently active documents
 */
export function createLocalDataset() {
  const documents: Dataset<SanityDocumentBase> = new Map()

  function commit(results: UpdateResult<SanityDocumentBase>[]) {
    results.forEach(result => {
      if (result.status === 'created' || result.status === 'updated') {
        documents.set(result.id, result.after)
      }
      if (result.status === 'deleted') {
        documents.delete(result.id)
      }
    })
  }

  function applyOptimistically(mutations: Mutation[]) {
    const results = applyInStore(documents, mutations)
    commit(results)
    return results
  }
  return {
    set: (id: string, doc: SanityDocumentBase | undefined) =>
      void documents.set(id, doc),
    get: (id: string) => documents.get(id),
    has: (id: string) => documents.has(id),
    apply: applyOptimistically,
  }
}

function applyInStore<T extends SanityDocumentBase>(
  store: Dataset<T>,
  mutations: Mutation[],
): UpdateResult<T>[] {
  const updatedDocs: Record<
    string,
    {
      before: T | undefined
      current: T | undefined
    }
  > = Object.create(null)

  mutations.forEach(mutation => {
    const documentId = getMutationDocumentId(mutation)
    if (!documentId) {
      throw new Error('Unable to get document id from mutation')
    }

    const before = updatedDocs[documentId]?.current || store.get(documentId)
    const res = applyMutiny(before, mutation)
    if (res.status === 'error') {
      throw new Error(res.message)
    }
    if (res.status === 'noop') {
      return
    }
    if (
      res.status === 'updated' ||
      res.status === 'created' ||
      res.status === 'deleted'
    ) {
      if (!(documentId in updatedDocs)) {
        updatedDocs[documentId] = {before, current: undefined}
      }
      updatedDocs[documentId].current = res.after
    }
  })

  return Object.entries(updatedDocs).map(([id, {before, current}]) => {
    return {
      id,
      status: current ? (before ? 'updated' : 'created') : 'deleted',
      before: before,
      after: current,
    }
  })
}
