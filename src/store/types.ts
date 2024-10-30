import {type RawPatch} from 'mendoza'
import {type Observable} from 'rxjs'

import {type Mutation, type SanityDocumentBase} from '../mutations/types'
import {type Path} from '../path'
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
  resultRev: string
  previousRev: string
  effects: {apply: RawPatch}
  mutations: SanityMutation[]
  transition: 'update' | 'appear' | 'disappear'
}

export interface ListenerReconnectEvent {
  type: 'reconnect'
}

export type ListenerEvent<Doc extends SanityDocumentBase = SanityDocumentBase> =
  ListenerSyncEvent<Doc> | ListenerMutationEvent | ListenerReconnectEvent

export interface OptimisticDocumentEvent {
  type: 'optimistic'
  id: string
  before: SanityDocumentBase | undefined
  after: SanityDocumentBase | undefined
  mutations: Mutation[]
  stagedChanges: Mutation[]
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
  effects: {apply: RawPatch}
  previousRev: string
  resultRev: string
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

export type MutationGroup =
  | NonTransactionalMutationGroup
  | TransactionalMutationGroup

// todo: needs more work
export type Conflict = {
  path: Path
  error: Error
  base: SanityDocumentBase | undefined
  local: SanityDocumentBase | undefined
}

export interface LocalDataset {
  meta: {
    // just some ideas…
    /**
     * A stream of events for anything that happens in the store
     */
    events: Observable<OptimisticDocumentEvent | RemoteDocumentEvent>

    /**
     * A stream of current staged changes
     */
    stage: Observable<MutationGroup[]>

    /**
     * A stream of current conflicts. TODO: Needs more work
     */
    conflicts: Observable<Conflict[]>
  }

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
  listen(id: string): Observable<SanityDocumentBase | undefined>

  /**
   * Listen for events for a given document id
   */
  listenEvents(
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
