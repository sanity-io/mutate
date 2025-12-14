export {
  applyMutations,
  type UpdateResult,
} from '../store/documentMap/applyMutations'
export {commit} from '../store/documentMap/commit'
export {type DataStore} from '../store/optimistic/optimizations/squashDMPStrings'
export {squashDMPStrings} from '../store/optimistic/optimizations/squashDMPStrings'
export {squashMutationGroups} from '../store/optimistic/optimizations/squashMutations'
export {rebase} from '../store/optimistic/rebase'
export type {
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
export {toTransactions} from '../store/utils/toTransactions'
export * from './documentMutatorMachine'

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
  Transaction,
} from '../mutations/types'
// eslint-disable-next-line import/export
export type * from '../path' // todo: fix duplicate exports
export type {Optional} from '../utils/typeUtils'
