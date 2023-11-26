import {type RawPatch} from 'mendoza'
import {type Observable} from 'rxjs'

import {type Mutation, type SanityDocumentBase} from '../mutations/types'

export interface ListenerSyncEvent {
  type: 'sync'
  transactionId?: string
  document: SanityDocumentBase | undefined
}

export interface ListenerMutationEvent {
  type: 'mutation'
  transactionId: string
  effects: Required<MutationEvent>['effects']['apply']
  mutations: Required<MutationEvent>['mutations']
}
export interface ListenerErrorEvent {
  type: 'error'
  error: Error
}

export type RemoteListenerEvent =
  | ListenerSyncEvent
  | ListenerMutationEvent
  | ListenerErrorEvent

export interface OptimisticDocumentEvent {
  type: 'optimistic'
  id: string
  before: SanityDocumentBase | undefined
  after: SanityDocumentBase | undefined
  mutations: Mutation[]
}

export interface RemoteSyncEvent {
  type: 'sync'
  id: string
  before: {
    local: SanityDocumentBase | undefined
    remote: SanityDocumentBase | undefined
  }
  after: {
    local: SanityDocumentBase | undefined
    remote: SanityDocumentBase | undefined
  }
  rebasedStage: StagedMutations[]
}
export interface RemoteMutationEvent {
  type: 'mutation'
  id: string
  before: {
    local: SanityDocumentBase | undefined
    remote: SanityDocumentBase | undefined
  }
  after: {
    local: SanityDocumentBase | undefined
    remote: SanityDocumentBase | undefined
  }
  effects: RawPatch
  mutations: Mutation[]
  rebasedStage: StagedMutations[]
}
export type RemoteDocumentEvent = RemoteSyncEvent | RemoteMutationEvent

export type Dataset<Doc extends SanityDocumentBase> = {
  get(id: string): Doc | undefined
  set(id: string, doc: Doc | undefined): void
  delete(id: string): void
}

export interface MutationResult {}

export interface SubmitResult {}

export interface NonTransactionalMutations {
  transaction: false
  mutations: Mutation[]
}
export interface TransactionalMutations {
  transaction: true
  id?: string
  mutations: Mutation[]
}

export type StagedMutations = NonTransactionalMutations | TransactionalMutations

export type DataStoreLogEvent = StagedMutations // (for now)

export interface ContentLakeStore {
  /**
   * A stream of events for anything that happens in the store
   */
  // localLog: Observable<DataStoreLogEvent>
  // remoteLog: Observable<RemoteDocumentEvent>

  /**
   * Applies the given mutations. Mutations are not guaranteed to be submitted in the same transaction
   * Can this mutate both local and remote documents at the same time
   */
  mutate(mutation: Mutation[]): MutationResult

  /**
   * Makes sure the given mutations are posted in a single transaction
   */
  transaction(
    transaction: {id?: string; mutations: Mutation[]} | Mutation[],
  ): MutationResult

  /**
   * Checkout a document for editing. This is required to be able to see optimistic changes
   */
  observe(id: string): Observable<SanityDocumentBase | undefined>

  /**
   * Observe events for a given document id
   */
  observeEvents(
    id: string,
  ): Observable<RemoteDocumentEvent | OptimisticDocumentEvent>

  /**
   * Optimize list of pending mutations
   */
  optimize(): void

  /**
   * Submit pending mutations
   */
  submit(): Promise<SubmitResult[]>
}
