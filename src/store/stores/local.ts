import {type Mutation, type SanityDocumentBase} from '../../mutations/types'
import {apply} from '../apply'
import {type Dataset} from '../types'
import {getMutationDocumentId} from '../utils/getMutationDocumentId'

/**
 * A data store is a collection of documents that can be queried and mutated.
 */
export function createLocalDataStore() {
  const records: Dataset<SanityDocumentBase> = Object.create(null)

  function commit(results: UpdateResult<SanityDocumentBase>[]) {
    results.forEach(result => {
      if (result.status === 'created' || result.status === 'updated') {
        records[result.id] = result.after
      }
      if (result.status === 'deleted') {
        records[result.id] = undefined
      }
    })
  }

  function applyOptimistically(mutations: Mutation[]) {
    const results = applyInStore(records, mutations)
    commit(results)
    return results
  }
  return {
    set: (id: string, doc: SanityDocumentBase | undefined) => {
      records[id] = doc
    },
    getAll: () => records,
    get: (id: string) => records[id],
    has: (id: string) => id in records,
    apply: applyOptimistically,
  }
}
interface UpdateResult<T extends SanityDocumentBase> {
  id: string
  status: 'created' | 'updated' | 'deleted'
  before?: T
  after?: T
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
  > = {}

  mutations.forEach(mutation => {
    const documentId = getMutationDocumentId(mutation)
    if (!documentId) {
      throw new Error('Unable to get document id from mutation')
    }

    if (!(documentId in store)) {
      return
    }
    const before = updatedDocs[documentId]?.current || store[documentId]
    const res = apply(before, mutation)
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
