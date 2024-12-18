export * from './applyInCollection'
export * from './applyInIndex'
export * from './applyPatchMutation'
export * from './patch/applyNodePatch'
export * from './patch/applyOp'
export * from './store'

/** Required support types */

// eslint-disable-next-line import/export
export type * from '../mutations/operations/types' // todo: fix duplicate exports
export type {NodePatch, PatchOptions} from '../mutations/types'
export type {
  CreateIfNotExistsMutation,
  CreateMutation,
  CreateOrReplaceMutation,
  DeleteMutation,
  Mutation,
  NodePatchList,
  PatchMutation,
  SanityDocumentBase,
} from '../mutations/types'
// eslint-disable-next-line import/export
export type * from '../path' // todo: fix duplicate exports
export type {
  // eslint-disable-next-line import/export
  AnyArray, // todo: fix duplicate exports
  ArrayElement,
  ArrayLength,
  EmptyArray,
  Format,
  NormalizeReadOnlyArray,
  Optional,
} from '../utils/typeUtils'
export type * from './patch/typings/applyNodePatch'
export type * from './patch/typings/applyOp'
