import {nanoid} from 'nanoid'

import {applyPatchMutation, assignId, hasId} from '../../apply'
import {
  type CreateIfNotExistsMutation,
  type CreateMutation,
  type CreateOrReplaceMutation,
  type DeleteMutation,
  type Mutation,
  type PatchMutation,
  type SanityDocumentBase,
} from '../../mutations/types'
import {
  ApplyMutationFailedError,
  type UnknownMutationTypeError,
} from '../errors'

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

/**
 * Applies a set of mutations to the provided document
 * @param current
 * @param mutation
 */
export function applyAll<Doc extends SanityDocumentBase>(
  current: Doc | undefined,
  mutation: Mutation<Doc>[],
): Doc | undefined | ApplyMutationFailedError | UnknownMutationTypeError {
  let doc: Doc | undefined = current
  for (const m of mutation) {
    const res = applyDocumentMutation(doc, m)
    if (res.status === 'error') {
      return new ApplyMutationFailedError({reason: res.message})
    }
    if (res.status === 'noop') continue
    doc = res.after
  }
  return doc
}

/**
 * Applies a mutation to the provided document
 * @param document
 * @param mutation
 */
export function applyDocumentMutation<Doc extends SanityDocumentBase>(
  document: Doc | undefined,
  mutation: Mutation<Doc>,
): MutationResult<Doc> {
  if (mutation.type === 'create') {
    return create(document, mutation)
  }
  if (mutation.type === 'createIfNotExists') {
    return createIfNotExists(document, mutation)
  }
  if (mutation.type === 'delete') {
    return del(document, mutation)
  }
  if (mutation.type === 'createOrReplace') {
    return createOrReplace(document, mutation)
  }
  if (mutation.type === 'patch') {
    return patch(document, mutation)
  }
  return {
    status: 'error',
    // @ts-expect-error all cases should be covered
    message: `Invalid mutation type: ${mutation.type}`,
  }
}

function create<Doc extends SanityDocumentBase>(
  document: Doc | undefined,
  mutation: CreateMutation<Doc>,
): MutationResult<Doc> {
  if (document) {
    return {status: 'error', message: 'Document already exist'}
  }
  const result = assignId(mutation.document, nanoid)
  return {status: 'created', id: result._id, after: result}
}

function createIfNotExists<Doc extends SanityDocumentBase>(
  document: Doc | undefined,
  mutation: CreateIfNotExistsMutation<Doc>,
): MutationResult<Doc> {
  if (!hasId(mutation.document)) {
    return {
      status: 'error',
      message: 'Cannot createIfNotExists on document without _id',
    }
  }
  return document
    ? {status: 'noop'}
    : {status: 'created', id: mutation.document._id, after: mutation.document}
}

function createOrReplace<Doc extends SanityDocumentBase>(
  document: Doc | undefined,
  mutation: CreateOrReplaceMutation<Doc>,
): MutationResult<Doc> {
  if (!hasId(mutation.document)) {
    return {
      status: 'error',
      message: 'Cannot createIfNotExists on document without _id',
    }
  }

  return document
    ? {
        status: 'updated',
        id: mutation.document._id,
        before: document,
        after: mutation.document,
      }
    : {status: 'created', id: mutation.document._id, after: mutation.document}
}

function del<Doc extends SanityDocumentBase>(
  document: Doc | undefined,
  mutation: DeleteMutation,
): MutationResult<Doc> {
  if (!document) {
    return {status: 'noop'}
  }
  if (mutation.id !== document._id) {
    return {status: 'error', message: 'Delete mutation targeted wrong document'}
  }
  return {
    status: 'deleted',
    id: mutation.id,
    before: document,
    after: undefined,
  }
}

function patch<Doc extends SanityDocumentBase>(
  document: Doc | undefined,
  mutation: PatchMutation,
): MutationResult<Doc> {
  if (!document) {
    return {
      status: 'error',
      message: 'Cannot apply patch on nonexistent document',
    }
  }
  const next = applyPatchMutation(mutation, document)
  if (next instanceof Error) {
    return {status: 'error', message: next.message}
  }
  return document === next
    ? {status: 'noop'}
    : {status: 'updated', id: mutation.id, before: document, after: next as Doc}
}
