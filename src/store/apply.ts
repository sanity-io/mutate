import {nanoid} from 'nanoid'

import {applyPatchMutation, assignId, hasId} from '../apply'
import type {
  CreateIfNotExistsMutation,
  CreateMutation,
  CreateOrReplaceMutation,
  DeleteMutation,
  Mutation,
  PatchMutation,
  SanityDocumentBase,
} from '../mutations/types'

export type MutationResult<Doc extends SanityDocumentBase> =
  | {
      id: string
      status: 'created'
      after: Doc
    }
  | {
      id: string
      status: 'updated'
      before: Doc
      after: Doc
    }
  | {
      id: string
      status: 'deleted'
      before: Doc | undefined
      after: undefined
    }
  | {
      status: 'error'
      message: string
    }
  | {
      status: 'noop'
    }

export function applyAll<Doc extends SanityDocumentBase>(
  current: Doc | undefined,
  mutation: Mutation<Doc>[],
): Doc | undefined {
  return mutation.reduce((doc, m) => {
    const res = apply(doc, m)
    if (res.status === 'error') {
      throw new Error(res.message)
    }
    return res.status === 'noop' ? doc : res.after
  }, current)
}

export function apply<Doc extends SanityDocumentBase>(
  current: Doc | undefined,
  mutation: Mutation<Doc>,
): MutationResult<Doc> {
  if (mutation.type === 'create') {
    return create(current, mutation)
  }
  if (mutation.type === 'createIfNotExists') {
    return createIfNotExists(current, mutation)
  }
  if (mutation.type === 'delete') {
    return del(current, mutation)
  }
  if (mutation.type === 'createOrReplace') {
    return createOrReplace(current, mutation)
  }
  if (mutation.type === 'patch') {
    return patch(current, mutation)
  }
  // @ts-expect-error all cases should be covered
  throw new Error(`Invalid mutation type: ${mutation.type}`)
}

function create<Doc extends SanityDocumentBase>(
  current: Doc | undefined,
  mutation: CreateMutation<Doc>,
): MutationResult<Doc> {
  if (current) {
    return {status: 'error', message: 'Document already exist'}
  }
  const document = assignId(mutation.document, nanoid)
  return {status: 'created', id: document._id, after: document}
}

function createIfNotExists<Doc extends SanityDocumentBase>(
  current: Doc | undefined,
  mutation: CreateIfNotExistsMutation<Doc>,
): MutationResult<Doc> {
  if (!hasId(mutation.document)) {
    return {
      status: 'error',
      message: 'Cannot createIfNotExists on document without _id',
    }
  }
  return current
    ? {status: 'noop'}
    : {status: 'created', id: mutation.document._id, after: mutation.document}
}

function createOrReplace<Doc extends SanityDocumentBase>(
  current: Doc | undefined,
  mutation: CreateOrReplaceMutation<Doc>,
): MutationResult<Doc> {
  if (!hasId(mutation.document)) {
    return {
      status: 'error',
      message: 'Cannot createIfNotExists on document without _id',
    }
  }

  return current
    ? {
        status: 'updated',
        id: mutation.document._id,
        before: current,
        after: mutation.document,
      }
    : {status: 'created', id: mutation.document._id, after: mutation.document}
}

function del<Doc extends SanityDocumentBase>(
  current: Doc | undefined,
  mutation: DeleteMutation,
): MutationResult<Doc> {
  if (!current) {
    return {status: 'noop'}
  }
  if (mutation.id !== current._id) {
    return {status: 'error', message: 'Delete mutation targeted wrong document'}
  }
  return {status: 'deleted', id: mutation.id, before: current, after: undefined}
}

function patch<Doc extends SanityDocumentBase>(
  current: Doc | undefined,
  mutation: PatchMutation,
): MutationResult<Doc> {
  if (!current) {
    return {
      status: 'error',
      message: 'Cannot apply patch on nonexistent document',
    }
  }
  const next = applyPatchMutation(mutation, current)
  return current === next
    ? {status: 'noop'}
    : {status: 'updated', id: mutation.id, before: current, after: next}
}
