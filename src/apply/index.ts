export * from './patch/applyNodePatch'
export * from './applyPatchMutation'
export * from './applyInCollection'
export * from './applyInIndex'
export * from './patch/applyOp'
export * from './store'

/** Required support types */
export type {NodePatch, PatchOptions} from '../mutations/types'
export type * from '../path'
export type * from '../mutations/operations/types'
export type * from './patch/typings/applyNodePatch'
export type * from './patch/typings/applyOp'
export type {
  CreateIfNotExistsMutation,
  CreateMutation,
  CreateOrReplaceMutation,
  DeleteMutation,
  NodePatchList,
  Mutation,
  PatchMutation,
  SanityDocumentBase,
} from '../mutations/types'
export type {
  Optional,
  Format,
  ArrayElement,
  AnyArray,
  ArrayLength,
  EmptyArray,
  NormalizeReadOnlyArray,
} from '../utils/typeUtils'
