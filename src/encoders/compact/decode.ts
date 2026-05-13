import {isObject} from 'lodash'

import {type UpsertOp} from '../../mutations/operations/types'
import {
  type Mutation,
  type PatchMutation,
  type SanityDocumentBase,
} from '../../mutations/types'
import {
  type Index,
  type KeyedPathElement,
  type PathParseError,
} from '../../path'
import {parse as parsePath} from '../../path/parser/parse'
import {
  MissingKeyError,
  UnsupportedDecodeMutationError,
  UnsupportedDecodeOperationError,
} from '../errors'
import {
  type CompactMutation,
  type CompactPatchMutation,
  type CreateIfNotExistsMutation,
  type CreateMutation,
  type CreateOrReplaceMutation,
  type DeleteMutation,
} from './types'

export type CompactDecodeError =
  | PathParseError
  | MissingKeyError
  | UnsupportedDecodeMutationError
  | UnsupportedDecodeOperationError

export {Mutation, SanityDocumentBase}

export function decode<Doc extends SanityDocumentBase>(
  mutations: CompactMutation<Doc>[],
): Mutation[] | CompactDecodeError {
  const result: Mutation[] = []
  for (const mutation of mutations) {
    const decoded = decodeMutation(mutation)
    if (decoded instanceof Error) return decoded
    result.push(decoded)
  }
  return result
}

export function decodeMutation<Doc extends SanityDocumentBase>(
  mutation: CompactMutation<Doc>,
): Mutation | CompactDecodeError {
  const [type] = mutation
  if (type === 'delete') {
    const [, id] = mutation as DeleteMutation
    return {id, type}
  } else if (type === 'create') {
    const [, document] = mutation as CreateMutation<Doc>
    return {type, document}
  } else if (type === 'createIfNotExists') {
    const [, document] = mutation as CreateIfNotExistsMutation<Doc>
    return {type, document}
  } else if (type === 'createOrReplace') {
    const [, document] = mutation as CreateOrReplaceMutation<Doc>
    return {type, document}
  } else if (type === 'patch') {
    return decodePatchMutation(mutation)
  }
  return new UnsupportedDecodeMutationError({
    reason: `unrecognized mutation: ${JSON.stringify(mutation)}`,
  })
}

function decodePatchMutation(
  mutation: CompactPatchMutation,
): PatchMutation | CompactDecodeError {
  const [, type, id, serializedPath, , revisionId] = mutation

  const path = parsePath(serializedPath)
  if (path instanceof Error) return path
  if (type === 'dec' || type === 'inc') {
    const [, , , , [amount]] = mutation
    return {
      type: 'patch',
      id,
      patches: [{path, op: {type: 'inc', amount}}],
      ...createOpts(revisionId),
    }
  }
  if (type === 'unset') {
    return {
      type: 'patch',
      id,
      patches: [{path, op: {type: 'unset'}}],
      ...createOpts(revisionId),
    }
  }
  if (type === 'insert') {
    const [, , , , [position, ref, items]] = mutation
    return {
      type: 'patch',
      id,
      patches: [
        {
          path,
          op: {
            type: 'insert',
            position,
            items,
            referenceItem: typeof ref === 'string' ? {_key: ref} : ref,
          },
        },
      ],
      ...createOpts(revisionId),
    }
  }
  if (type === 'set') {
    const [, , , , [value]] = mutation
    return {
      type: 'patch',
      id,
      patches: [{path, op: {type: 'set', value}}],
      ...createOpts(revisionId),
    }
  }
  if (type === 'setIfMissing') {
    const [, , , , [value]] = mutation
    return {
      type: 'patch',
      id,
      patches: [{path, op: {type: 'setIfMissing', value}}],
      ...createOpts(revisionId),
    }
  }
  if (type === 'diffMatchPatch') {
    const [, , , , [value]] = mutation
    return {
      type: 'patch',
      id,
      patches: [{path, op: {type: 'diffMatchPatch', value}}],
      ...createOpts(revisionId),
    }
  }
  if (type === 'truncate') {
    const [, , , , [startIndex, endIndex]] = mutation

    return {
      type: 'patch',
      id,
      patches: [{path, op: {type: 'truncate', startIndex, endIndex}}],
      ...createOpts(revisionId),
    }
  }
  if (type === 'assign') {
    const [, , , , [value]] = mutation
    return {
      type: 'patch',
      id,
      patches: [{path, op: {type: 'assign', value}}],
      ...createOpts(revisionId),
    }
  }
  if (type === 'replace') {
    const [, , , , [ref, items]] = mutation
    const refDecoded = decodeItemRef(ref)
    if (refDecoded instanceof Error) return refDecoded
    return {
      type: 'patch',
      id,
      patches: [
        {path, op: {type: 'replace', items, referenceItem: refDecoded}},
      ],
      ...createOpts(revisionId),
    }
  }
  if (type === 'upsert') {
    const [, , , , [position, referenceItem, items]] = mutation
    const decodedReferenceItem = decodeItemRef(referenceItem)
    if (decodedReferenceItem instanceof Error) return decodedReferenceItem
    return {
      type: 'patch',
      id,
      patches: [
        {
          path,
          op: {
            type: 'upsert',
            items,
            referenceItem: decodedReferenceItem,
            position,
          } as UpsertOp<typeof items, typeof position, any>,
        },
      ],
      ...createOpts(revisionId),
    }
  }
  return new UnsupportedDecodeOperationError({type: String(type)})
}

function decodeItemRef(
  ref: unknown,
): Index | KeyedPathElement | MissingKeyError {
  if (typeof ref === 'string') {
    return {_key: ref}
  }
  if (typeof ref === 'number') {
    return ref
  }
  if (!hasKey(ref)) {
    return new MissingKeyError()
  }
  return ref
}

function createOpts(revisionId: undefined | string) {
  return revisionId ? {options: {ifRevision: revisionId}} : null
}

function hasKey<T>(item: T): item is T & {_key: string} {
  return isObject(item) && '_key' in item
}
