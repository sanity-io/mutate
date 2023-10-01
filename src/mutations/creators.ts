import {arrify} from '../utils/arrify'
import {type StringToPath, parse} from '../path'
import {type Operation} from './operations/types'
import {type PatchMutation, type PatchOptions} from './types'
import type {
  CreateIfNotExistsMutation,
  CreateMutation,
  CreateOrReplaceMutation,
  DeleteMutation,
  NodePatch,
  NodePatchList,
  SanityDocumentBase,
} from './types'
import type {Path} from '../path'
import type {
  NormalizeReadOnlyArray,
  Optional,
  Tuplify,
} from '../utils/typeUtils'

export function create<Doc extends Optional<SanityDocumentBase, '_id'>>(
  document: Doc,
): CreateMutation<Doc> {
  return {type: 'create', document}
}

export function patch<P extends NodePatchList | NodePatch>(
  id: string,
  patches: P,
  options?: PatchOptions,
): PatchMutation<NormalizeReadOnlyArray<Tuplify<P>>> {
  return {
    type: 'patch',
    id,
    patches: arrify(patches) as any,
    ...(options ? {options} : {}),
  }
}

export function at<const P extends Path, O extends Operation>(
  path: P,
  operation: O,
): NodePatch<NormalizeReadOnlyArray<P>, O>

export function at<const P extends string, O extends Operation>(
  path: P,
  operation: O,
): NodePatch<StringToPath<P>, O>

export function at<O extends Operation>(
  path: Path | string,
  operation: O,
): NodePatch<Path, O> {
  return {
    path: typeof path === 'string' ? parse(path) : path,
    op: operation,
  }
}

export function createIfNotExists<Doc extends SanityDocumentBase>(
  document: Doc,
): CreateIfNotExistsMutation<Doc> {
  return {type: 'createIfNotExists', document}
}

export function createOrReplace<Doc extends SanityDocumentBase>(
  document: Doc,
): CreateOrReplaceMutation<Doc> {
  return {type: 'createOrReplace', document}
}

export function delete_(id: string): DeleteMutation {
  return {type: 'delete', id}
}

export const del = delete_
export const destroy = delete_
