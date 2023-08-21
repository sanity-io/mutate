import {applyPatchMutation} from './applyPatchMutation'
import type {
  CreateIfNotExistsMutation,
  CreateMutation,
  CreateOrReplaceMutation,
  DeleteMutation,
  Mutation,
  PatchMutation,
  SanityDocument,
} from '../mutations/types'

export type DocumentIndex<Doc> = {[id: string]: Doc}

export function applyInIndex<Doc extends SanityDocument>(
  index: DocumentIndex<SanityDocument>,
  mutations: Mutation<Doc>[],
) {
  return mutations.reduce((prev, mutation) => {
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
  }, index)
}

function createIn<Doc extends SanityDocument>(
  collection: DocumentIndex<SanityDocument>,
  mutation: CreateMutation<Doc>,
) {
  if (mutation.document._id in collection) {
    throw new Error('Document already exist')
  }
  return {...collection, [mutation.document._id]: mutation.document}
}

function createIfNotExistsIn<Doc extends SanityDocument>(
  collection: DocumentIndex<SanityDocument>,
  mutation: CreateIfNotExistsMutation<Doc>,
) {
  return mutation.document._id in collection
    ? collection
    : {...collection, [mutation.document._id]: mutation.document}
}

function createOrReplaceIn<Doc extends SanityDocument>(
  collection: DocumentIndex<SanityDocument>,
  mutation: CreateOrReplaceMutation<Doc>,
) {
  return {...collection, [mutation.document._id]: mutation.document}
}

function deleteIn(
  collection: DocumentIndex<SanityDocument>,
  mutation: DeleteMutation,
) {
  if (mutation.id in collection) {
    const copy = {...collection}
    delete copy[mutation.id]
    return copy
  } else {
    return collection
  }
}

function patchIn<Doc extends SanityDocument>(
  collection: DocumentIndex<Doc>,
  mutation: PatchMutation,
): DocumentIndex<Doc> {
  if (!(mutation.id in collection)) {
    throw new Error('Cannot apply patch on nonexistent document')
  }
  const current = collection[mutation.id]!
  const next = applyPatchMutation(current, mutation)

  return next === current ? collection : {...collection, [mutation.id]: next}
}
