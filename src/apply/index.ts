export * from './patch/applyPatch'
export * from './applyPatchMutation'
export * from './applyInCollection'
export * from './applyInIndex'

/** Required support types */
export type {NodePatch, PatchOptions} from '../mutations/types'
export type * from '../path'
export type * from '../mutations/operations/types'
export type {
  CreateIfNotExistsMutation,
  CreateMutation,
  CreateOrReplaceMutation,
  DeleteMutation,
  Mutation,
  PatchMutation,
  SanityDocument,
} from '../mutations/types'
export type {Optional} from '../utils/typeUtils'
