import {type RawPatch} from 'mendoza'
import {type Observable} from 'rxjs'

import {type Mutation, type SanityDocumentBase} from '../mutations/types'
import {type SanityMutation} from './sanityMutationTypes'

export interface ListenerSyncEvent<
  Doc extends SanityDocumentBase = SanityDocumentBase,
> {
  type: 'sync'
  document: Doc | undefined
}

export interface ListenerMutationEvent {
  type: 'mutation'
  documentId: string
  transactionId: string
  resultRev?: string
  previousRev?: string
  effects?: {apply: RawPatch}
  mutations: SanityMutation[]
  transition: 'update' | 'appear' | 'disappear'
}

export interface ListenerReconnectEvent {
  type: 'reconnect'
}

export type ListenerChannelErrorEvent = {
  type: 'channelError'
  message: string
}

export type ListenerWelcomeEvent = {
  type: 'welcome'
  listenerName: string
}

export type ListenerDisconnectEvent = {
  type: 'disconnect'
  reason: string
}
export type ListenerEndpointEvent =
  | ListenerWelcomeEvent
  | ListenerMutationEvent
  | ListenerReconnectEvent
  | ListenerChannelErrorEvent
  | ListenerDisconnectEvent

export type ListenerEvent<Doc extends SanityDocumentBase = SanityDocumentBase> =
  | ListenerSyncEvent<Doc>
  | ListenerMutationEvent
  | ListenerReconnectEvent

export interface OptimisticDocumentEvent {
  type: 'optimistic'
  id: string
  before: SanityDocumentBase | undefined
  after: SanityDocumentBase | undefined
  mutations: Mutation[]
  stagedChanges: Mutation[]
}

export type QueryParams = Record<
  string,
  string | number | boolean | (string | number | boolean)[]
>
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
  rebasedStage: MutationGroup[]
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
  effects?: {apply: RawPatch}
  previousRev?: string
  resultRev?: string
  mutations: Mutation[]
  rebasedStage: MutationGroup[]
}
export type RemoteDocumentEvent = RemoteSyncEvent | RemoteMutationEvent

export type DocumentMap<Doc extends SanityDocumentBase> = {
  get(id: string): Doc | undefined
  set(id: string, doc: Doc | undefined): void
  delete(id: string): void
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MutationResult {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SubmitResult {}

export interface NonTransactionalMutationGroup {
  transaction: false
  mutations: Mutation[]
}
export interface TransactionalMutationGroup {
  transaction: true
  id?: string
  mutations: Mutation[]
}

/**
 * A mutation group represents an incoming, locally added group of mutations
 * They can either be transactional or non-transactional
 * - Transactional means that they must be submitted as a separate transaction (with an optional id) and no other mutations can be mixed with it
 * – Non-transactional means that they can be combined with other mutations
 */
export type MutationGroup =
  | NonTransactionalMutationGroup
  | TransactionalMutationGroup

/**
 * # Subscription requirement
 *
 * `mutate`, `transaction` and `submit` only do useful work while at least one
 * subscriber to `listen(id)` is active. `listen(id)` is what wires the rebase
 * pipeline (remote events ↔ inflight ↔ local mutations) for a document; with
 * no subscriber, the pipeline is torn down and calls to `submit()` are
 * silently dropped.
 *
 * In practice this means: keep a `listen(id)` subscription open for every
 * document you intend to read or write. `listenEvents(id)` alone is not
 * enough — it provides a richer event stream but does not activate the submit
 * pipeline.
 *
 * In development builds the store will emit a `console.warn` if `submit()` is
 * called without an active `listen()` subscriber, to make this contract
 * observable.
 */
export interface OptimisticStore {
  /**
   * Subscribe to a stream of rich events for a document (sync, optimistic,
   * remote mutation). Useful for inspecting rebase behaviour and staged
   * changes.
   *
   * Note: subscribing to `listenEvents` alone is not sufficient to activate
   * the submit pipeline. Use `listen(id)` for that.
   */
  listenEvents: (
    id: string,
  ) => Observable<RemoteDocumentEvent | OptimisticDocumentEvent>

  /**
   * Stages mutations to be applied optimistically and later submitted to the
   * backend. Mutations are not guaranteed to be submitted in the same
   * transaction.
   *
   * Requires at least one active `listen(id)` subscriber covering the
   * affected document(s) before `submit()` is called; otherwise the staged
   * mutations are dropped when the pipeline tears down.
   */
  mutate(mutation: Mutation[]): void

  /**
   * Stages mutations to be applied optimistically and submitted as a single
   * transaction.
   *
   * Requires at least one active `listen(id)` subscriber covering the
   * affected document(s) before `submit()` is called; otherwise the staged
   * mutations are dropped when the pipeline tears down.
   */
  transaction(
    transaction: {id?: string; mutations: Mutation[]} | Mutation[],
  ): void

  /**
   * Checkout a document for editing. This is required to be able to see
   * optimistic changes and to flush mutations with `submit()`. Subscribing
   * keeps the store's rebase pipeline alive for `id`; unsubscribing releases
   * it.
   */
  listen(id: string): Observable<SanityDocumentBase | undefined>

  /**
   * Submit pending mutations to the backend.
   *
   * Only takes effect while at least one `listen(id)` subscriber is active
   * for an affected document. If called with no active subscriber, the
   * pending mutations remain staged (and a `console.warn` is emitted in
   * development).
   */
  submit(): void
}
