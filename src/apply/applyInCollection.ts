import {
  type CreateIfNotExistsMutation,
  type CreateMutation,
  type CreateOrReplaceMutation,
  type DeleteMutation,
  type Mutation,
  type PatchMutation,
  type SanityDocumentBase,
} from '../mutations/types'
import {arrify} from '../utils/arrify'
import {applyPatchMutation} from './applyPatchMutation'
import {splice} from './utils/array'

/**
 * Extracts the document shape an "add"-flavored mutation contributes.
 * `delete` and `patch` don't introduce new shapes.
 */
type AddedDocument<M> =
  M extends CreateMutation<infer D>
    ? D
    : M extends CreateIfNotExistsMutation<infer D>
      ? D
      : M extends CreateOrReplaceMutation<infer D>
        ? D
        : never

/**
 * Extracts the literal `_id` of any delete mutation in the union.
 * `DeleteMutation<string>` (non-literal id) extracts to `string`, which
 * makes Exclude<…> a no-op — so non-literal deletes leave the result
 * type alone, which is the right behaviour.
 */
type DeletedId<M> = M extends DeleteMutation<infer Id> ? Id : never

type MutationOf<Muts> = Muts extends readonly Mutation[] ? Muts[number] : Muts

export function applyInCollection<
  const Doc extends SanityDocumentBase,
  const Muts extends Mutation | readonly Mutation[],
>(
  collection: readonly Doc[],
  mutations: Muts,
): readonly Exclude<
  Doc | AddedDocument<MutationOf<Muts>>,
  {_id: DeletedId<MutationOf<Muts>>}
>[] {
  const a = arrify(mutations as Mutation | Mutation[]) as Mutation[]
  return a.reduce((prev: readonly SanityDocumentBase[], mutation) => {
    if (mutation.type === 'create') {
      return createIn(prev, mutation)
    }
    if (mutation.type === 'createIfNotExists') {
      return createIfNotExistsIn(prev, mutation)
    }
    if (mutation.type === 'delete') {
      return deleteIn(prev, mutation)
    }
    if (mutation.type === 'createOrReplace') {
      return createOrReplaceIn(prev, mutation)
    }
    if (mutation.type === 'patch') {
      return patchIn(prev, mutation)
    }
    // @ts-expect-error all cases should be covered
    throw new Error(`Invalid mutation type: ${mutation.type}`)
  }, collection) as readonly Exclude<
    Doc | AddedDocument<MutationOf<Muts>>,
    {_id: DeletedId<MutationOf<Muts>>}
  >[]
}

function createIn<Doc extends SanityDocumentBase>(
  collection: readonly Doc[],
  mutation: CreateMutation<Doc>,
) {
  const currentIdx = collection.findIndex(
    doc => doc._id === mutation.document._id,
  )
  if (currentIdx !== -1) {
    throw new Error('Document already exist')
  }
  return collection.concat(mutation.document)
}

function createIfNotExistsIn<Doc extends SanityDocumentBase>(
  collection: readonly Doc[],
  mutation: CreateIfNotExistsMutation<Doc>,
) {
  const currentIdx = collection.findIndex(
    doc => doc._id === mutation.document._id,
  )
  return currentIdx === -1 ? collection.concat(mutation.document) : collection
}

function createOrReplaceIn<Doc extends SanityDocumentBase>(
  collection: readonly Doc[],
  mutation: CreateOrReplaceMutation<Doc>,
) {
  const currentIdx = collection.findIndex(
    doc => doc._id === mutation.document._id,
  )
  return currentIdx === -1
    ? collection.concat(mutation.document)
    : splice(collection, currentIdx, 1, [mutation.document])
}

function deleteIn<Doc extends SanityDocumentBase>(
  collection: readonly Doc[],
  mutation: DeleteMutation,
) {
  const currentIdx = collection.findIndex(doc => doc._id === mutation.id)
  return currentIdx === -1 ? collection : splice(collection, currentIdx, 1)
}

function patchIn<Doc extends SanityDocumentBase>(
  collection: readonly Doc[],
  mutation: PatchMutation,
): readonly Doc[] {
  const currentIdx = collection.findIndex(doc => doc._id === mutation.id)
  if (currentIdx === -1) {
    throw new Error('Cannot apply patch on nonexistent document')
  }
  const current = collection[currentIdx]!

  const next = applyPatchMutation(mutation, current)

  return next === current
    ? collection
    : splice(collection, currentIdx, 1, [next])
}
