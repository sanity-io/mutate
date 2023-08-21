import {type Operation} from './operations/types'
import type {Optional} from '../utils/typeUtils'
import type {Path} from '../path'

export type SanityDocument = {
  _id: string
  _type: string
  _rev?: string
  [key: string]: unknown
}

export type CreateMutation<Doc extends Optional<SanityDocument, '_id'>> = {
  type: 'create'
  document: Doc
}

export type CreateIfNotExistsMutation<Doc extends SanityDocument> = {
  type: 'createIfNotExists'
  document: Doc
}

export type CreateOrReplaceMutation<Doc extends SanityDocument> = {
  type: 'createOrReplace'
  document: Doc
}

export type DeleteMutation = {
  type: 'delete'
  id: string
}

export type PatchMutation<Patches extends NodePatch[] = NodePatch[]> = {
  type: 'patch'
  id: string
  patches: Patches
  options?: PatchOptions
}

export type Mutation<Doc extends SanityDocument = any> =
  | CreateMutation<Doc>
  | CreateIfNotExistsMutation<Doc>
  | CreateOrReplaceMutation<Doc>
  | DeleteMutation
  | PatchMutation<NodePatch[]>

export type NodePatch<
  P extends Path | Readonly<Path> = Path,
  O extends Operation = Operation,
> = {
  readonly path: P
  readonly op: O
}

export type PatchOptions = {
  ifRevision?: string
}
