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
      mutations: Mutation[]
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

    let entry = updatedDocs[documentId]
    if (!entry) {
      entry = {before, after: before, mutations: []}
      updatedDocs[documentId] = entry
    }

    // Note: transactionId should never be set client side. Only for test purposes
    // if a transaction id is passed, set it as a new _rev
    const after = transactionId
      ? {...(res.status === 'noop' ? before : res.after), _rev: transactionId}
      : res.status === 'noop'
        ? before
        : res.after

    documentMap.set(documentId, after)
    entry.after = after
    entry.mutations.push(mutation)
  }

  return Object.entries(updatedDocs).map(
    ([id, {before, after, mutations: muts}]) => {
      return {
        id,
        status: after ? (before ? 'updated' : 'created') : 'deleted',
        mutations: muts,
        before,
        after,
      }
    },
  )
}
