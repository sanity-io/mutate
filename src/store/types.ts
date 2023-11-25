import type {Mutation, SanityDocumentBase} from '../mutations/types'
import type {Value} from 'groq-js'

import type {Observable} from 'rxjs'
import type {RawPatch} from 'mendoza'

export interface ListenerSyncEvent {
  type: 'sync'
  transactionId?: string
  document: SanityDocumentBase | undefined
}

export interface ListenerMendozaPatchEvent {
  type: 'mutation'
  transactionId: string
  effects: RawPatch
}
export interface ListenerErrorEvent {
  type: 'error'
  error: Error
}

export type RemoteListenerEvent =
  | ListenerSyncEvent
  | ListenerMendozaPatchEvent
  | ListenerErrorEvent

export interface OptimisticDocumentEvent {
  type: 'optimistic'
  id: string
  mutations: Mutation[]
}

export interface RemoteSyncEvent {
  type: 'sync'
  id: string
  document: SanityDocumentBase | undefined
}
export interface RemoteMutationEvent {
  type: 'mutation'
  id: string
  effects: RawPatch
}
export type RemoteDocumentEvent = RemoteSyncEvent | RemoteMutationEvent

export type Dataset<Doc extends SanityDocumentBase> = Map<
  string,
  Doc | undefined
>

export interface MutationResult {}
export interface QueryResult {
  ms: number
  result: Value
}

export interface SubmitResult {}

export interface PendingTransaction {
  id?: string
  mutations: Mutation[]
}

export type DataStoreLogEvent = PendingTransaction // (for now)

export interface ContentLakeStore {
  /**
   * A stream of events for anything that happens in the store
   */
  localLog: Observable<DataStoreLogEvent>
  remoteLog: Observable<RemoteDocumentEvent>

  outbox: Observable<PendingTransaction[]>

  /**
   * Applies the given mutations. Mutations are not guaranteed to be submitted in the same transaction
   * Can this mutate both local and remote documents at the same time
   */
  mutate(mutation: Mutation[]): MutationResult

  /**
   * Makes sure the given mutations are posted in a single transaction
   */
  transaction(
    transaction: {id: string; mutations: Mutation[]} | Mutation[],
  ): MutationResult

  /**
   * Checkout a document for editing. This is required to be able to see optimistic changes
   */
  observe(id: string): Observable<{
    remote: SanityDocumentBase | undefined
    local: SanityDocumentBase | undefined
  }>

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
  submit(): Observable<SubmitResult>
}
