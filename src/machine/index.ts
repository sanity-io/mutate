export {
  applyMutations,
  type UpdateResult,
} from '../store/datasets/applyMutations'
export {commit} from '../store/datasets/commit'
export {
  type DataStore,
  squashDMPStrings,
} from '../store/optimizations/squashDMPStrings'
export {squashMutationGroups} from '../store/optimizations/squashMutations'
export {rebase} from '../store/rebase'
export {toTransactions} from '../store/toTransactions'
export type {
  Dataset,
  MutationGroup,
  NonTransactionalMutationGroup,
  TransactionalMutationGroup,
} from '../store/types'
export * from './documentMutatorMachine'
export * from './listener'

/** Required support types */
export type * from '../mutations/operations/types'
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
  Transaction,
} from '../mutations/types'
export type * from '../path'
export type {Optional} from '../utils/typeUtils'
