import {type Operation} from './operations/types'
import type {Optional} from '../utils/typeUtils'
import type {Path} from '../path'

export type SanityDocumentBase = {
  _id?: string
  _type: string
  _createdAt?: string
  _updatedAt?: string
  _rev?: string
}

export type CreateMutation<Doc extends Optional<SanityDocumentBase, '_id'>> = {
  type: 'create'
  document: Doc
}

export type CreateIfNotExistsMutation<Doc extends SanityDocumentBase> = {
  type: 'createIfNotExists'
  document: Doc
}

export type CreateOrReplaceMutation<Doc extends SanityDocumentBase> = {
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

export type Mutation<Doc extends SanityDocumentBase = any> =
  | CreateMutation<Doc>
  | CreateIfNotExistsMutation<Doc>
  | CreateOrReplaceMutation<Doc>
  | DeleteMutation
  | PatchMutation

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
