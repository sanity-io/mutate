// An example of a compact transport/serialization format
import {
  type Mutation,
  type NodePatch,
  type SanityDocumentBase,
} from '../../mutations/types'
import {type Index, type KeyedPathElement} from '../../path'
import {stringify as stringifyPath} from '../../path/parser/stringify'
import {
  UnsupportedEncodeMutationError,
  UnsupportedEncodeOperationError,
} from '../errors'
import {
  type CompactMutation,
  type CompactPatchMutation,
  type ItemRef,
} from './types'

export type CompactEncodeError =
  | UnsupportedEncodeMutationError
  | UnsupportedEncodeOperationError

export function encode<Doc extends SanityDocumentBase>(
  mutations: Mutation[],
): CompactMutation<Doc>[] | CompactEncodeError {
  const result: CompactMutation<Doc>[] = []
  for (const m of mutations) {
    const encoded = encodeMutation<Doc>(m)
    if (encoded instanceof Error) return encoded
    result.push(...encoded)
  }
  return result
}

function encodeItemRef(ref: Index | KeyedPathElement): ItemRef {
  return typeof ref === 'number' ? ref : ref._key
}

function encodeMutation<Doc extends SanityDocumentBase>(
  mutation: Mutation,
): CompactMutation<Doc>[] | CompactEncodeError {
  if (
    mutation.type === 'create' ||
    mutation.type === 'createIfNotExists' ||
    mutation.type === 'createOrReplace'
  ) {
    return [[mutation.type, mutation.document]]
  }
  if (mutation.type === 'delete') {
    return [['delete', mutation.id]]
  }
  if (mutation.type === 'patch') {
    const result: CompactMutation<Doc>[] = []
    for (const patch of mutation.patches) {
      const encoded = encodePatchMutation(mutation.id, patch)
      if (encoded instanceof Error) return encoded
      result.push(maybeAddRevision(mutation.options?.ifRevision, encoded))
    }
    return result
  }

  return new UnsupportedEncodeMutationError({
    //@ts-expect-error - all cases are covered
    type: mutation.type,
  })
}

function encodePatchMutation(
  id: string,
  patch: NodePatch<any>,
): CompactPatchMutation | UnsupportedEncodeOperationError {
  const {op} = patch
  const path = stringifyPath(patch.path)
  if (op.type === 'unset') {
    return ['patch', 'unset', id, path, []]
  }
  if (op.type === 'diffMatchPatch') {
    return ['patch', 'diffMatchPatch', id, path, [op.value]]
  }
  if (op.type === 'inc' || op.type === 'dec') {
    return ['patch', op.type, id, path, [op.amount]]
  }
  if (op.type === 'set') {
    return ['patch', op.type, id, path, [op.value]]
  }
  if (op.type === 'setIfMissing') {
    return ['patch', op.type, id, path, [op.value]]
  }
  if (op.type === 'insert') {
    return [
      'patch',
      'insert',
      id,
      path,
      [op.position, encodeItemRef(op.referenceItem), op.items],
    ]
  }
  if (op.type === 'upsert') {
    return [
      'patch',
      'upsert',
      id,
      path,
      [op.position, encodeItemRef(op.referenceItem), op.items],
    ]
  }
  if (op.type === 'insertIfMissing') {
    return [
      'patch',
      'insertIfMissing',
      id,
      path,
      [op.position, encodeItemRef(op.referenceItem), op.items],
    ]
  }
  if (op.type === 'assign') {
    return ['patch', 'assign', id, path, [op.value]]
  }
  if (op.type === 'unassign') {
    return ['patch', 'assign', id, path, [op.keys]]
  }
  if (op.type === 'replace') {
    return [
      'patch',
      'replace',
      id,
      path,
      [encodeItemRef(op.referenceItem), op.items],
    ]
  }
  if (op.type === 'truncate') {
    return ['patch', 'truncate', id, path, [op.startIndex, op.endIndex]]
  }
  if (op.type === 'remove') {
    return ['patch', 'remove', id, path, [encodeItemRef(op.referenceItem)]]
  }
  return new UnsupportedEncodeOperationError({
    // @ts-expect-error all cases are covered
    type: op.type,
  })
}

function maybeAddRevision<T extends CompactPatchMutation>(
  revision: string | undefined,
  mut: T,
): T {
  const [mutType, patchType, id, path, args] = mut
  return (revision ? [mutType, patchType, id, path, args, revision] : mut) as T
}
