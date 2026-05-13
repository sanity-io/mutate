import {nanoid} from 'nanoid'

import {
  type CreateIfNotExistsMutation,
  type CreateMutation,
  type CreateOrReplaceMutation,
  type DeleteMutation,
  type Mutation,
  type PatchMutation,
  type SanityDocumentBase,
} from '../mutations/types'
import {
  applyPatchMutation,
  type ApplyPatchMutationError,
} from './applyPatchMutation'
import {
  type ApplyMutationError,
  DocumentAlreadyExistsError,
  DocumentIdMissingError,
  DocumentNotFoundError,
  UnsupportedMutationTypeError,
} from './errors'
import {assignId, hasId, type RequiredSelect} from './store'

export type DocumentIndex<Doc extends SanityDocumentBase> = {[id: string]: Doc}

export function applyInIndex<
  Doc extends SanityDocumentBase,
  Index extends DocumentIndex<ToStored<Doc>>,
>(index: Index, mutations: Mutation<Doc>[]): Index | ApplyMutationError {
  let current: Index = index
  for (const mutation of mutations) {
    const next: Index | ApplyMutationError = (() => {
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
  return current
}

export type ToStored<Doc extends SanityDocumentBase> = Doc &
  Required<SanityDocumentBase>

export type ToIdentified<Doc extends SanityDocumentBase> = RequiredSelect<
  Doc,
  '_id'
>

export type StoredDocument = ToStored<SanityDocumentBase>

function createIn<
  Index extends DocumentIndex<Doc>,
  Doc extends SanityDocumentBase,
>(
  index: Index,
  mutation: CreateMutation<Doc>,
): Index | DocumentAlreadyExistsError {
  const document = assignId(mutation.document, nanoid)

  if (document._id in index) {
    return new DocumentAlreadyExistsError({id: document._id})
  }
  return {...index, [document._id]: mutation.document}
}

function createIfNotExistsIn<
  Index extends DocumentIndex<Doc>,
  Doc extends SanityDocumentBase,
>(
  index: Index,
  mutation: CreateIfNotExistsMutation<Doc>,
): Index | DocumentIdMissingError {
  if (!hasId(mutation.document)) {
    return new DocumentIdMissingError({operation: 'createIfNotExists'})
  }
  return mutation.document._id in index
    ? index
    : {...index, [mutation.document._id]: mutation.document}
}

function createOrReplaceIn<
  Index extends DocumentIndex<Doc>,
  Doc extends SanityDocumentBase,
>(
  index: Index,
  mutation: CreateOrReplaceMutation<Doc>,
): Index | DocumentIdMissingError {
  if (!hasId(mutation.document)) {
    return new DocumentIdMissingError({operation: 'createOrReplace'})
  }

  return {...index, [mutation.document._id]: mutation.document}
}

function deleteIn<Index extends DocumentIndex<SanityDocumentBase>>(
  index: Index,
  mutation: DeleteMutation,
): Index {
  if (mutation.id in index) {
    const copy = {...index}
    delete copy[mutation.id]
    return copy
  } else {
    return index
  }
}

function patchIn<Index extends DocumentIndex<SanityDocumentBase>>(
  index: Index,
  mutation: PatchMutation,
): Index | DocumentNotFoundError | ApplyPatchMutationError {
  if (!(mutation.id in index)) {
    return new DocumentNotFoundError({operation: 'patch'})
  }
  const current = index[mutation.id]!
  const next = applyPatchMutation(mutation, current)
  if (next instanceof Error) return next

  return next === current ? index : {...index, [mutation.id]: next}
}
