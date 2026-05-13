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
import {
  applyPatchMutation,
  type ApplyPatchMutationError,
} from './applyPatchMutation'
import {
  type ApplyMutationError,
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  UnsupportedMutationTypeError,
} from './errors'
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
):
  | readonly Exclude<
      Doc | AddedDocument<MutationOf<Muts>>,
      {_id: DeletedId<MutationOf<Muts>>}
    >[]
  | ApplyMutationError {
  const a = arrify(mutations as Mutation | Mutation[]) as Mutation[]
  let current: readonly SanityDocumentBase[] = collection
  for (const mutation of a) {
    const next: readonly SanityDocumentBase[] | ApplyMutationError = (() => {
      if (mutation.type === 'create') return createIn(current, mutation)
      if (mutation.type === 'createIfNotExists')
        return createIfNotExistsIn(current, mutation)
      if (mutation.type === 'delete') return deleteIn(current, mutation)
      if (mutation.type === 'createOrReplace')
        return createOrReplaceIn(current, mutation)
      if (mutation.type === 'patch') return patchIn(current, mutation)
      // @ts-expect-error all cases should be covered
      return new UnsupportedMutationTypeError({type: mutation.type})
    })()
    if (next instanceof Error) return next
    current = next
  }
  return current as readonly Exclude<
    Doc | AddedDocument<MutationOf<Muts>>,
    {_id: DeletedId<MutationOf<Muts>>}
  >[]
}

function createIn<Doc extends SanityDocumentBase>(
  collection: readonly Doc[],
  mutation: CreateMutation<Doc>,
): readonly Doc[] | DocumentAlreadyExistsError {
  const currentIdx = collection.findIndex(
    doc => doc._id === mutation.document._id,
  )
  if (currentIdx !== -1) {
    return new DocumentAlreadyExistsError({
      id: mutation.document._id ?? 'undefined',
    })
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
): readonly Doc[] | DocumentNotFoundError | ApplyPatchMutationError {
  const currentIdx = collection.findIndex(doc => doc._id === mutation.id)
  if (currentIdx === -1) {
    return new DocumentNotFoundError({operation: 'patch'})
  }
  const current = collection[currentIdx]!

  const next = applyPatchMutation(mutation, current)
  if (next instanceof Error) return next

  return next === current
    ? collection
    : splice(collection, currentIdx, 1, [next])
}
