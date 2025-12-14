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

export interface OptimisticStore {
  /**
   * Applies the given mutations. Mutations are not guaranteed to be submitted in the same transaction
   */
  mutate(mutation: Mutation[]): void

  /**
   * Makes sure the given mutations are posted in a single transaction
   */
  transaction(
    transaction: {id?: string; mutations: Mutation[]} | Mutation[],
  ): void

  /**
   * Listen for events for a given document id
   */
  listenEvents(
    id: string,
  ): Observable<RemoteDocumentEvent | OptimisticDocumentEvent>

  /**
   * Checkout a document for editing. This is required to be able to see optimistic changes
   */
  listen(id: string): Observable<SanityDocumentBase | undefined>

  /**
   * Submit pending mutations
   */
  submit(): void
}
