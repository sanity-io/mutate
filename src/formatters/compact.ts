// An example of a compact formatter

import {
  type Mutation,
  type NodePatch,
  type SanityDocumentBase,
} from '../mutations/types'
import {type Index, type KeyedPathElement, stringify} from '../path'
import {
  UnsupportedFormatMutationError,
  UnsupportedFormatOperationError,
} from './errors'

export type ItemRef = string | number

export type FormatError =
  | UnsupportedFormatMutationError
  | UnsupportedFormatOperationError

export function format<Doc extends SanityDocumentBase>(
  mutations: Mutation[],
): string | FormatError {
  const lines: string[] = []
  for (const m of mutations) {
    const encoded = encodeMutation<Doc>(m)
    if (encoded instanceof Error) return encoded
    lines.push(encoded)
  }
  return lines.join('\n')
}

function encodeItemRef(ref: Index | KeyedPathElement): ItemRef {
  return typeof ref === 'number' ? ref : ref._key
}

function encodeMutation<Doc extends SanityDocumentBase>(
  mutation: Mutation,
): string | FormatError {
  if (
    mutation.type === 'create' ||
    mutation.type === 'createIfNotExists' ||
    mutation.type === 'createOrReplace'
  ) {
    return [mutation.type, ': ', JSON.stringify(mutation.document)].join('')
  }
  if (mutation.type === 'delete') {
    return ['delete ', mutation.id].join(': ')
  }
  if (mutation.type === 'patch') {
    const ifRevision = mutation.options?.ifRevision
    const patchLines: string[] = []
    for (const nodePatch of mutation.patches) {
      const encoded = formatPatchMutation(nodePatch)
      if (encoded instanceof Error) return encoded
      patchLines.push(`  ${encoded}`)
    }
    return [
      'patch',
      ' ',
      `id=${mutation.id}`,
      ifRevision ? ` (if revision==${ifRevision})` : '',
      ':\n',
      patchLines.join('\n'),
    ].join('')
  }

  return new UnsupportedFormatMutationError({
    //@ts-expect-error - all cases are covered
    type: mutation.type,
  })
}

function formatPatchMutation(
  patch: NodePatch<any>,
): string | UnsupportedFormatOperationError {
  const {op} = patch
  const path = stringify(patch.path)
  if (op.type === 'unset') {
    return [path, 'unset()'].join(': ')
  }
  if (op.type === 'diffMatchPatch') {
    return [path, `diffMatchPatch(${op.value})`].join(': ')
  }
  if (op.type === 'inc' || op.type === 'dec') {
    return [path, `${op.type}(${op.amount})`].join(': ')
  }
  if (op.type === 'set' || op.type === 'setIfMissing') {
    return [path, `${op.type}(${JSON.stringify(op.value)})`].join(': ')
  }
  if (op.type === 'assign') {
    return [path, `${op.type}(${JSON.stringify(op.value)})`].join(': ')
  }
  if (op.type === 'unassign') {
    return [path, `${op.type}(${JSON.stringify(op.keys)})`].join(': ')
  }
  if (
    op.type === 'insert' ||
    op.type === 'upsert' ||
    op.type === 'insertIfMissing'
  ) {
    return [
      path,
      `${op.type}(${op.position}, ${encodeItemRef(
        op.referenceItem,
      )}, ${JSON.stringify(op.items)})`,
    ].join(': ')
  }
  if (op.type === 'replace') {
    return [
      path,
      `replace(${encodeItemRef(op.referenceItem)}, ${JSON.stringify(
        op.items,
      )})`,
    ].join(': ')
  }
  if (op.type === 'truncate') {
    return [path, `truncate(${op.startIndex}, ${op.endIndex}`].join(': ')
  }
  if (op.type === 'remove') {
    return [path, `remove(${encodeItemRef(op.referenceItem)})`].join(': ')
  }
  return new UnsupportedFormatOperationError({
    // @ts-expect-error all cases are covered
    type: op.type,
  })
}
