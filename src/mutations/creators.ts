import {parse} from '../path'
import {type StringToPath} from '../path'
import {type Arrify, arrify} from '../utils/arrify'
import {type Operation} from './operations/types'
import {type PatchMutation, type PatchOptions} from './types'
import type {Optional} from '../utils/typeUtils'
import type {
  CreateIfNotExistsMutation,
  CreateMutation,
  CreateOrReplaceMutation,
  DeleteMutation,
  NodePatch,
  SanityDocumentBase,
} from './types'
import type {Path} from '../path'

export function create<Doc extends Optional<SanityDocumentBase, '_id'>>(
  document: Doc,
): CreateMutation<Doc> {
  return {type: 'create', document}
}

export function patch<P extends NodePatch<any, any> | NodePatch<any, any>[]>(
  id: string,
  patches: P,
  options?: PatchOptions,
): PatchMutation<Arrify<P>> {
  return {
    type: 'patch',
    id,
    patches: arrify(patches),
    ...(options ? {options} : {}),
  }
}

export function at<const P extends Path, O extends Operation>(
  path: P,
  operation: O,
): NodePatch<P, O>

export function at<P extends string, O extends Operation>(
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
