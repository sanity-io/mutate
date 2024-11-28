export {type UpdateResult} from '../store/documentMap/applyMutations'
export {type DataStore} from '../store/optimizations/squashDMPStrings'
export type {
  Conflict,
  DocumentMap,
  LocalDataset,
  MutationGroup,
  MutationResult,
  NonTransactionalMutationGroup,
  OptimisticDocumentEvent,
  RawOperation,
  RawPatch,
  RemoteDocumentEvent,
  RemoteMutationEvent,
  RemoteSyncEvent,
  SubmitResult,
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
