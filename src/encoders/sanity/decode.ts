import {type PatchOperations} from '@sanity/client'

import {type SetIfMissingOp, type SetOp} from '../../mutations/operations/types'
import {
  type IdentifiedSanityDocument,
  type Mutation,
  type NodePatch,
  type SanityDocumentBase,
} from '../../mutations/types'
import {type PathParseError} from '../../path/errors'
import {parse as parsePath} from '../../path/parser/parse'
import {
  AmbiguousInsertPositionError,
  MissingInsertPositionError,
  UnsupportedDecodeMutationError,
} from '../errors'
import {
  type Insert,
  type SanityCreateIfNotExistsMutation,
  type SanityCreateMutation,
  type SanityCreateOrReplaceMutation,
  type SanityDecPatch,
  type SanityDeleteMutation,
  type SanityDiffMatchPatch,
  type SanityIncPatch,
  type SanityInsertPatch,
  type SanityMutation,
  type SanityPatch,
  type SanitySetIfMissingPatch,
  type SanitySetPatch,
  type SanityUnsetPatch,
} from './types'

export type {Mutation, SanityDocumentBase}

function isCreateIfNotExistsMutation(
  sanityMutation: SanityMutation,
): sanityMutation is SanityCreateIfNotExistsMutation {
  return 'createIfNotExists' in sanityMutation
}

function isCreateOrReplaceMutation<Doc extends IdentifiedSanityDocument>(
  sanityMutation: SanityMutation,
): sanityMutation is SanityCreateOrReplaceMutation<Doc> {
  return 'createOrReplace' in sanityMutation
}

function isCreateMutation<Doc extends SanityDocumentBase>(
  sanityMutation: SanityMutation<Doc>,
): sanityMutation is SanityCreateMutation<Doc> {
  return 'create' in sanityMutation
}

function isDeleteMutation(
  sanityMutation: SanityMutation<any>,
): sanityMutation is SanityDeleteMutation {
  return 'delete' in sanityMutation
}

function isPatchMutation(sanityMutation: SanityMutation): sanityMutation is {
  patch: SanityPatch
} {
  return 'patch' in sanityMutation
}

function isSetPatch(
  sanityPatch: PatchOperations,
): sanityPatch is SanitySetPatch {
  return 'set' in sanityPatch
}

function isSetIfMissingPatch(
  sanityPatch: SanityPatch,
): sanityPatch is SanitySetIfMissingPatch {
  return 'setIfMissing' in sanityPatch
}

function isDiffMatchPatch(
  sanityPatch: SanityPatch,
): sanityPatch is SanityDiffMatchPatch {
  return 'diffMatchPatch' in sanityPatch
}

function isUnsetPatch(
  sanityPatch: SanityPatch,
): sanityPatch is SanityUnsetPatch {
  return 'unset' in sanityPatch
}

function isIncPatch(sanityPatch: SanityPatch): sanityPatch is SanityIncPatch {
  return 'inc' in sanityPatch
}

function isDecPatch(sanityPatch: SanityPatch): sanityPatch is SanityDecPatch {
  return 'inc' in sanityPatch
}

function isInsertPatch(
  sanityPatch: SanityPatch,
): sanityPatch is SanityInsertPatch {
  return 'insert' in sanityPatch
}

export type SanityDecodeError =
  | PathParseError
  | UnsupportedDecodeMutationError
  | MissingInsertPositionError
  | AmbiguousInsertPositionError

export function decodeAll<Doc extends SanityDocumentBase>(
  sanityMutations: SanityMutation<Doc>[],
): Mutation[] | SanityDecodeError {
  const result: Mutation[] = []
  for (const m of sanityMutations) {
    const decoded = decodeMutation(m)
    if (decoded instanceof Error) return decoded
    result.push(decoded)
  }
  return result
}

export function decode<Doc extends SanityDocumentBase>(
  encodedMutation: SanityMutation<Doc>,
) {
  return decodeMutation(encodedMutation)
}

function decodeMutation<Doc extends SanityDocumentBase>(
  encodedMutation: SanityMutation<Doc>,
): Mutation | SanityDecodeError {
  if (isCreateIfNotExistsMutation(encodedMutation)) {
    return {
      type: 'createIfNotExists',
      document: encodedMutation.createIfNotExists,
    }
  }
  if (isCreateOrReplaceMutation(encodedMutation)) {
    return {
      type: 'createOrReplace',
      document: encodedMutation.createOrReplace,
    }
  }
  if (isCreateMutation(encodedMutation)) {
    return {type: 'create', document: encodedMutation.create}
  }
  if (isDeleteMutation(encodedMutation)) {
    return {id: encodedMutation.delete.id, type: 'delete'}
  }
  if (isPatchMutation(encodedMutation)) {
    const patches = decodeNodePatches(encodedMutation.patch)
    if (patches instanceof Error) return patches
    return {
      type: 'patch',
      id: encodedMutation.patch.id,
      patches,
    }
  }
  return new UnsupportedDecodeMutationError({
    reason: `unknown mutation: ${JSON.stringify(encodedMutation)}`,
  })
}

const POSITION_KEYS = ['before', 'replace', 'after'] as const

function getInsertPosition(
  insert: Insert,
): (typeof POSITION_KEYS)[number] | AmbiguousInsertPositionError | undefined {
  const positions = POSITION_KEYS.filter(k => k in insert)
  if (positions.length > 1) {
    return new AmbiguousInsertPositionError({found: positions.join(', ')})
  }
  return positions[0]
}

function decodeNodePatches<T>(
  patch: SanityPatch,
): NodePatch<any, any>[] | SanityDecodeError {
  // If multiple patches are included, then the order of execution is as follows
  // set, setIfMissing, unset, inc, dec, insert.
  // order is defined here: https://www.sanity.io/docs/http-mutations#2f480b2baca5
  const groups = [
    getSetPatches(patch),
    getSetIfMissingPatches(patch),
    getUnsetPatches(patch),
    getIncPatches(patch),
    getDecPatches(patch),
    getInsertPatches(patch),
    getDiffMatchPatchPatches(patch),
  ]
  const result: NodePatch<any, any>[] = []
  for (const group of groups) {
    if (group instanceof Error) return group
    result.push(...group)
  }
  return result
}

function getSetPatches(
  patch: PatchOperations,
): NodePatch<any[], SetOp<any>>[] | PathParseError {
  if (!isSetPatch(patch)) return []
  const result: NodePatch<any[], SetOp<any>>[] = []
  for (const path of Object.keys(patch.set)) {
    const parsed = parsePath(path)
    if (parsed instanceof Error) return parsed
    result.push({
      path: parsed as any[],
      op: {type: 'set', value: patch.set[path]},
    })
  }
  return result
}

function getSetIfMissingPatches(
  patch: SanityPatch,
): NodePatch<any[], SetIfMissingOp<any>>[] | PathParseError {
  if (!isSetIfMissingPatch(patch)) return []
  const result: NodePatch<any[], SetIfMissingOp<any>>[] = []
  for (const path of Object.keys(patch.setIfMissing)) {
    const parsed = parsePath(path)
    if (parsed instanceof Error) return parsed
    result.push({
      path: parsed as any[],
      op: {type: 'setIfMissing', value: patch.setIfMissing[path]},
    })
  }
  return result
}

function getDiffMatchPatchPatches(patch: SanityPatch) {
  if (!isDiffMatchPatch(patch)) return []
  const result: NodePatch<any, any>[] = []
  for (const path of Object.keys(patch.diffMatchPatch)) {
    const parsed = parsePath(path)
    if (parsed instanceof Error) return parsed
    result.push({
      path: parsed as any[],
      op: {type: 'diffMatchPatch', value: patch.diffMatchPatch[path]},
    })
  }
  return result
}

function getUnsetPatches(patch: SanityPatch) {
  if (!isUnsetPatch(patch)) return []
  const result: NodePatch<any, any>[] = []
  for (const path of patch.unset) {
    const parsed = parsePath(path)
    if (parsed instanceof Error) return parsed
    result.push({path: parsed as any[], op: {type: 'unset'}})
  }
  return result
}

function getIncPatches(patch: SanityPatch) {
  if (!isIncPatch(patch)) return []
  const result: NodePatch<any, any>[] = []
  for (const path of Object.keys(patch.inc)) {
    const parsed = parsePath(path)
    if (parsed instanceof Error) return parsed
    result.push({
      path: parsed as any[],
      op: {type: 'inc', amount: patch.inc[path]},
    })
  }
  return result
}

function getDecPatches(patch: SanityPatch) {
  if (!isDecPatch(patch)) return []
  const result: NodePatch<any, any>[] = []
  for (const path of Object.keys(patch.dec)) {
    const parsed = parsePath(path)
    if (parsed instanceof Error) return parsed
    result.push({
      path: parsed as any[],
      op: {type: 'dec', amount: patch.dec[path]},
    })
  }
  return result
}

function getInsertPatches(patch: SanityPatch) {
  if (!isInsertPatch(patch)) {
    return []
  }
  const position = getInsertPosition(patch.insert)
  if (position instanceof Error) return position
  if (!position) {
    return new MissingInsertPositionError()
  }

  const parsed = parsePath((patch.insert as any)[position]!)
  if (parsed instanceof Error) return parsed
  const path = parsed as string[]
  const referenceItem = path.pop()

  const op =
    position === 'replace'
      ? {
          type: 'insert',
          position: position,
          referenceItem,
          items: patch.insert.items,
        }
      : {
          type: 'insert',
          position: position,
          referenceItem,
          items: patch.insert.items,
        }

  return [{path, op}]
}
