import {parse, type Path, type PathParseError, type SafePath} from '../path'
import {type ParseError, type StringToPath} from '../path/parser/types'
import {arrify} from '../utils/arrify'
import {
  type NormalizeReadOnlyArray,
  type Optional,
  type Tuplify,
} from '../utils/typeUtils'
import {type Operation} from './operations/types'
import {
  type CreateIfNotExistsMutation,
  type CreateMutation,
  type CreateOrReplaceMutation,
  type DeleteMutation,
  type NodePatch,
  type NodePatchList,
  type PatchMutation,
  type PatchOptions,
  type SanityDocumentBase,
} from './types'

export function create<const Doc extends Optional<SanityDocumentBase, '_id'>>(
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
): StringToPath<P> extends ParseError<string>
  ? PathParseError
  : NodePatch<SafePath<P>, O>

export function at<O extends Operation>(
  path: Path | string,
  operation: O,
): NodePatch<Path, O> | PathParseError {
  if (typeof path === 'string') {
    const parsed = parse(path)
    if (parsed instanceof Error) return parsed
    return {path: parsed as Path, op: operation}
  }
  return {path, op: operation}
}

export function createIfNotExists<const Doc extends SanityDocumentBase>(
  document: Doc,
): CreateIfNotExistsMutation<Doc> {
  return {type: 'createIfNotExists', document}
}

export function createOrReplace<const Doc extends SanityDocumentBase>(
  document: Doc,
): CreateOrReplaceMutation<Doc> {
  return {type: 'createOrReplace', document}
}

export function delete_<const Id extends string>(id: Id): DeleteMutation<Id> {
  return {type: 'delete', id}
}

export const del = delete_
export const destroy = delete_
