import {type PatchOperations} from '@sanity/client'

import {type SetIfMissingOp, type SetOp} from '../../mutations/operations/types'
import {
  type IdentifiedSanityDocument,
  type Mutation,
  type NodePatch,
  type SanityDocumentBase,
} from '../../mutations/types'
import {parse as parsePath} from '../../path/parser/parse'
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

export function decodeAll<Doc extends SanityDocumentBase>(
  sanityMutations: SanityMutation<Doc>[],
) {
  return sanityMutations.map(decodeMutation)
}

export function decode<Doc extends SanityDocumentBase>(
  encodedMutation: SanityMutation<Doc>,
) {
  return decodeMutation(encodedMutation)
}

function decodeMutation<Doc extends SanityDocumentBase>(
  encodedMutation: SanityMutation<Doc>,
): Mutation {
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
    return {
      type: 'patch',
      id: encodedMutation.patch.id,
      patches: decodeNodePatches(encodedMutation.patch),
    }
  }
  throw new Error(`Unknown mutation: ${JSON.stringify(encodedMutation)}`)
}

const POSITION_KEYS = ['before', 'replace', 'after'] as const

function getInsertPosition(insert: Insert) {
  const positions = POSITION_KEYS.filter(k => k in insert)
  if (positions.length > 1) {
    throw new Error(
      `Insert patch is ambiguous. Should only contain one of: ${POSITION_KEYS.join(
        ', ',
      )}, instead found ${positions.join(', ')}`,
    )
  }
  return positions[0]
}

function decodeNodePatches<T>(patch: SanityPatch): NodePatch<any, any>[] {
  // If multiple patches are included, then the order of execution is as follows
  // set, setIfMissing, unset, inc, dec, insert.
  // order is defined here: https://www.sanity.io/docs/http-mutations#2f480b2baca5
  return [
    ...getSetPatches(patch),
    ...getSetIfMissingPatches(patch),
    ...getUnsetPatches(patch),
    ...getIncPatches(patch),
    ...getDecPatches(patch),
    ...getInsertPatches(patch),
    ...getDiffMatchPatchPatches(patch),
  ]
}

function getSetPatches(patch: PatchOperations): NodePatch<any[], SetOp<any>>[] {
  return isSetPatch(patch)
    ? Object.keys(patch.set).map(path => ({
        path: parsePath(path),
        op: {type: 'set', value: patch.set[path]},
      }))
    : []
}

function getSetIfMissingPatches(
  patch: SanityPatch,
): NodePatch<any[], SetIfMissingOp<any>>[] {
  return isSetIfMissingPatch(patch)
    ? Object.keys(patch.setIfMissing).map(path => ({
        path: parsePath(path),
        op: {type: 'setIfMissing', value: patch.setIfMissing[path]},
      }))
    : []
}

function getDiffMatchPatchPatches(patch: SanityPatch) {
  return isDiffMatchPatch(patch)
    ? Object.keys(patch.diffMatchPatch).map(path => ({
        path: parsePath(path),
        op: {type: 'diffMatchPatch', value: patch.diffMatchPatch[path]},
      }))
    : []
}

function getUnsetPatches(patch: SanityPatch) {
  return isUnsetPatch(patch)
    ? patch.unset.map(path => ({
        path: parsePath(path),
        op: {type: 'unset'},
      }))
    : []
}

function getIncPatches(patch: SanityPatch) {
  return isIncPatch(patch)
    ? Object.keys(patch.inc).map(path => ({
        path: parsePath(path),
        op: {type: 'inc', amount: patch.inc[path]},
      }))
    : []
}

function getDecPatches(patch: SanityPatch) {
  return isDecPatch(patch)
    ? Object.keys(patch.dec).map(path => ({
        path: parsePath(path),
        op: {type: 'dec', amount: patch.dec[path]},
      }))
    : []
}

function getInsertPatches(patch: SanityPatch) {
  if (!isInsertPatch(patch)) {
    return []
  }
  const position = getInsertPosition(patch.insert)
  if (!position) {
    throw new Error('Insert patch missing position')
  }

  const path: string[] = parsePath((patch.insert as any)[position]!)
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
