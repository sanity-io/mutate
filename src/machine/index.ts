export {
  applyMutations,
  type UpdateResult,
} from '../store/documentMap/applyMutations'
export {commit} from '../store/documentMap/commit'
export {type DataStore} from '../store/optimistic/optimizations/squashDMPStrings'
export {squashDMPStrings} from '../store/optimistic/optimizations/squashDMPStrings'
export {squashMutationGroups} from '../store/optimistic/optimizations/squashMutations'
export {rebase} from '../store/optimistic/rebase'
export {toTransactions} from '../store/optimistic/createOptimisticStore'
export type {
  Conflict,
  DocumentMap,
  MutationGroup,
  MutationResult,
  NonTransactionalMutationGroup,
  OptimisticDocumentEvent,
  RemoteDocumentEvent,
  RemoteMutationEvent,
  RemoteSyncEvent,
  SubmitResult,
  TransactionalMutationGroup,
} from '../store/types'
export * from './documentMutatorMachine'

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
