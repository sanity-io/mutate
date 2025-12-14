import {type Mutation, type SanityDocumentBase} from '../../mutations/types'
import {type DocumentMap} from '../types'
import {getMutationDocumentId} from '../utils/getMutationDocumentId'
import {applyDocumentMutation} from './applyDocumentMutation'

export interface UpdateResult<T extends SanityDocumentBase> {
  id: string
  status: 'created' | 'updated' | 'deleted'
  before?: T
  after?: T
  mutations: Mutation[]
}

/**
 * Takes a list of mutations and applies them to documents in a documentMap
 */
export function applyMutations<T extends SanityDocumentBase>(
  mutations: Mutation[],
  documentMap: DocumentMap<T>,
  /**
   * note: should never be set client side – only for test purposes
   */
  transactionId?: never,
): UpdateResult<T>[] {
  const updatedDocs: Record<
    string,
    {
      before: T | undefined
      after: T | undefined
      muts: Mutation[]
    }
  > = Object.create(null)

  for (const mutation of mutations) {
    const documentId = getMutationDocumentId(mutation)
    if (!documentId) {
      throw new Error('Unable to get document id from mutation')
    }

    const before = updatedDocs[documentId]?.after || documentMap.get(documentId)
    const res = applyDocumentMutation(before, mutation)
    if (res.status === 'error') {
      throw new Error(res.message)
    }
    if (res.status === 'noop') {
      continue
    }
    if (
      res.status === 'updated' ||
      res.status === 'created' ||
      res.status === 'deleted'
    ) {
      if (!(documentId in updatedDocs)) {
        updatedDocs[documentId] = {before, after: undefined, muts: []}
      }
      if (transactionId) {
        // Note: should never be set client side. Only for test purposes
        res.after._rev = transactionId
      }
      documentMap.set(documentId, res.after)

      updatedDocs[documentId]!.after = res.after
    }
  }

  return Object.entries(updatedDocs).map(([id, {before, after, muts}]) => {
    return {
      id,
      status: after ? (before ? 'updated' : 'created') : 'deleted',
      mutations: muts,
      before,
      after,
    }
  })
}
