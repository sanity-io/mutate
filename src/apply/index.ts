export * from './patch/applyPatch'
export * from './applyPatchMutation'
export * from './applyInCollection'
export * from './applyInIndex'
export * from './patch/applyOp'
export * from './store'

/** Required support types */
export type {NodePatch, PatchOptions} from '../mutations/types'
export type * from '../path'
export type * from '../mutations/operations/types'
export type * from './patch/typings/applyPatch'
export type * from './patch/typings/applyOp'
export type {
  CreateIfNotExistsMutation,
  CreateMutation,
  CreateOrReplaceMutation,
  DeleteMutation,
  Mutation,
  PatchMutation,
  SanityDocumentBase,
} from '../mutations/types'
export type {Optional, MergeObject, ArrayElement} from '../utils/typeUtils'
