import {
  concat,
  concatMap,
  defer,
  EMPTY,
  filter,
  finalize,
  from,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  share,
  startWith,
  Subject,
  takeWhile,
  withLatestFrom,
} from 'rxjs'
import {scan} from 'rxjs/operators'

import {decodeAll} from '../../encoders/sanity/decode'
import {
  type Mutation,
  type SanityDocumentBase,
  type Transaction,
} from '../../mutations/types'
import {applyAll} from '../documentMap/applyDocumentMutation'
import {applyMutationEventEffects} from '../documentMap/applyMendoza'
import {createDocumentMap} from '../documentMap/createDocumentMap'
import {MendozaMissingEffectsError, type StoreError} from '../errors'
import {
  type DocumentMutationUpdate,
  type DocumentUpdate,
} from '../listeners/createDocumentUpdateListener'
import {
  type ListenerEvent,
  type MutationGroup,
  type OptimisticDocumentEvent,
  type OptimisticStore,
  type RemoteDocumentEvent,
  type SubmitResult,
  type TransactionalMutationGroup,
} from '../types'
import {filterDocumentTransactions} from '../utils/filterDocumentTransactions'
import {hasProperty} from '../utils/isEffectEvent'
import {toTransactions} from '../utils/toTransactions'
import {squashDMPStrings} from './optimizations/squashDMPStrings'
import {squashMutationGroups} from './optimizations/squashMutations'
import {rebase} from './rebase'

export interface OptimisticStoreBackend {
  /**
   * Sets up a subscription to a document
   * The first event should either be a sync event or an error event.
   * After that, it should emit mutation events, error events or sync events.
   * Per the @sanity/mutate RxJS convention, operational errors are emitted as
   * tagged-error values on `next`; the Observable's `error` channel is reserved
   * for panics.
   * @param id
   */
  listen: (id: string) => Observable<ListenerEvent | Error>
  submit: (mutationGroups: Transaction) => Observable<SubmitResult | StoreError>
}

/**
 * Local state for a document. Tracks inflight mutations and local mutations
 * They change at the same time – local always comes after innflight in time
 */
export type LocalState = {
  readonly base: SanityDocumentBase | undefined
  readonly inflight: readonly Transaction[]
  readonly local: readonly MutationGroup[]
  /**
   * When set, the stream is terminating with this error value. The scan
   * reducer no longer mutates other fields; the downstream map surfaces the
   * error and takeWhile completes the observable.
   */
  readonly terminalError?: StoreError
}

/**
 * Models a document as it is changed by our own local patches and remote patches coming in from
 * the server. Consolidates incoming patches with our own submitted patches and maintains two
 * versions of the document.
 *
 *  ## Terminology:
 *
 *  ### Mutation buffers
 * - *Local*: - an array of mutations only applied locally, waiting to be submitted to the server
 * - *In-flight*: - an array of mutation on its way to the server, waiting to be received over the listener
 *
 *  ### Snapshots:
 * – *Base*: - a snapshot of the document consistent with the mutations we have received from the server.
 * - *Edge*: - The base snapshot with in-flight mutations applied to it - presumably what will soon become the next base
 * - *Local*: - the optimistic document that the user sees that will always immediately reflect whatever they are doing to it
 *
 *
 * Creates a local dataset that allows subscribing to documents by id and submitting mutations to be optimistically applied
 * @param backend
 */
export function createOptimisticStore(
  backend: OptimisticStoreBackend,
): OptimisticStore {
  const localMutations$ = new Subject<MutationGroup>()
  const onSubmitLocal = new Subject<void>()
  const store = createOptimisticStoreInternal({
    localMutations: localMutations$,
    listen: backend.listen,
    onSubmitLocal,
    submitTransactions: backend.submit,
  })
  // Tracks the number of currently-active subscriptions to listen(id), used
  // to detect submit() calls that would be silently dropped because no
  // subscriber is keeping the rebase pipeline alive.
  let activeListenSubscribers = 0
  return {
    listenEvents(
      id: string,
    ): Observable<RemoteDocumentEvent | OptimisticDocumentEvent | StoreError> {
      return new Observable<
        RemoteDocumentEvent | OptimisticDocumentEvent | StoreError
      >(subscriber => {
        // State that tracks both remote and local document versions
        type ListenEventsState = {
          remote: SanityDocumentBase | undefined
          local: SanityDocumentBase | undefined
          stagedChanges: MutationGroup[]
          hasSynced: boolean
          pendingSyncEmit: boolean
          prevLocal: SanityDocumentBase | undefined
          prevRemote: SanityDocumentBase | undefined
        }

        let state: ListenEventsState = {
          remote: undefined,
          local: undefined,
          stagedChanges: [],
          hasSynced: false,
          pendingSyncEmit: false,
          prevLocal: undefined,
          prevRemote: undefined,
        }

        let syncEmitScheduled = false

        const emitSyncEvent = (isFromMutation = false) => {
          if (state.pendingSyncEmit && state.hasSynced) {
            // For sync events:
            // - If emitted together with a mutation, after.local = remote (base state before mutations)
            // - If emitted after mutations were already applied, after.local = local (with mutations)
            const afterLocal = isFromMutation ? state.remote : state.local
            const syncEvent: RemoteDocumentEvent = {
              type: 'sync',
              id,
              before: {
                local: state.prevLocal,
                remote: state.prevRemote,
              },
              after: {
                local: afterLocal,
                remote: state.remote,
              },
              rebasedStage: state.stagedChanges,
            }
            state = {...state, pendingSyncEmit: false}
            subscriber.next(syncEvent)
          }
        }

        const scheduleSyncEmit = () => {
          if (!syncEmitScheduled) {
            syncEmitScheduled = true
            Promise.resolve().then(() => {
              syncEmitScheduled = false
              emitSyncEvent()
            })
          }
        }

        // Listen to remote events from the backend
        const remoteEvents$ = backend.listen(id).pipe(share())

        const subscription = merge(
          remoteEvents$.pipe(
            map(event => ({source: 'remote' as const, event})),
          ),
          localMutations$.pipe(
            map(group => ({source: 'local' as const, group})),
          ),
        ).subscribe({
          next: action => {
            if (action.source === 'remote') {
              const event = action.event
              // Listener errors flow as values; listenEvents stays open so the
              // caller can continue observing local mutations or future reconnects.
              if (event instanceof Error) {
                subscriber.next(event as StoreError)
                return
              }
              if (event.type === 'sync') {
                const newRemote = event.document
                // When we get a sync, rebase local mutations on top of new remote state.
                // Rebase / apply failures are surfaced as value emissions.
                const rebased = rebase(
                  id,
                  state.remote,
                  newRemote,
                  state.stagedChanges,
                )
                if (rebased instanceof Error) {
                  subscriber.next(rebased)
                  return
                }
                const [rebasedMutations] = rebased
                // Apply rebased mutations to get local state
                const newLocal = applyAll(
                  newRemote,
                  filterDocumentTransactions(rebasedMutations, id),
                )
                if (newLocal instanceof Error) {
                  subscriber.next(newLocal as StoreError)
                  return
                }
                state = {
                  remote: newRemote,
                  local: newLocal,
                  stagedChanges: rebasedMutations,
                  hasSynced: true,
                  pendingSyncEmit: true,
                  prevLocal: state.local,
                  prevRemote: state.remote,
                }

                // If there are already staged mutations, emit immediately
                // Otherwise, schedule for next microtask to allow batching with synchronous mutations
                if (rebasedMutations.length > 0) {
                  emitSyncEvent(false)
                } else {
                  scheduleSyncEmit()
                }
              }
            } else {
              // Local mutation
              const newStagedChanges = [...state.stagedChanges, action.group]
              const newLocal = applyAll(
                state.remote,
                filterDocumentTransactions(newStagedChanges, id),
              )
              if (newLocal instanceof Error) {
                subscriber.next(newLocal as StoreError)
                return
              }

              // Capture beforeLocal BEFORE we potentially emit sync event
              // If there's a pending sync, before should be the remote state (base state before any mutations)
              const wasPendingSync = state.pendingSyncEmit
              const beforeLocal = wasPendingSync ? state.remote : state.local

              // If there's a pending sync emit, update state and emit now
              if (wasPendingSync) {
                state = {
                  ...state,
                  stagedChanges: newStagedChanges,
                  local: newLocal,
                }
                // Emit the sync event immediately with the mutation included
                // Pass true to indicate this is from a mutation (so after.local = base state)
                emitSyncEvent(true)
              } else if (state.hasSynced) {
                // Emit a sync event with updated rebasedStage
                // after.local should be the result of applying mutations (newLocal),
                // not the old local state
                const syncEvent: RemoteDocumentEvent = {
                  type: 'sync',
                  id,
                  before: {
                    local: state.local,
                    remote: state.remote,
                  },
                  after: {
                    local: newLocal,
                    remote: state.remote,
                  },
                  rebasedStage: newStagedChanges,
                }
                subscriber.next(syncEvent)
              }

              // Emit the optimistic event
              const optimisticEvent: OptimisticDocumentEvent = {
                type: 'optimistic',
                id,
                before: beforeLocal,
                after: newLocal,
                mutations: [],
                stagedChanges: action.group.mutations,
              }

              state = {
                ...state,
                local: newLocal,
                stagedChanges: newStagedChanges,
                pendingSyncEmit: false,
                prevLocal: beforeLocal,
                prevRemote: state.remote,
              }

              subscriber.next(optimisticEvent)
            }
          },
          error: err => subscriber.error(err),
          complete: () => subscriber.complete(),
        })

        return () => subscription.unsubscribe()
      })
    },
    submit: () => {
      if (activeListenSubscribers === 0) {
        // eslint-disable-next-line no-console
        console.warn(
          '[@sanity/mutate] submit() was called without an active listen() subscriber. ' +
            'Pending mutations will not be sent to the backend until at least one ' +
            'listen(id) subscription exists and submit() is called again. ' +
            'See the OptimisticStore docs for details.',
        )
        return
      }
      onSubmitLocal.next()
    },
    listen(id: string) {
      return defer(() => {
        activeListenSubscribers++
        return store.listen(id)
      }).pipe(
        finalize(() => {
          activeListenSubscribers--
        }),
      )
    },
    mutate(mutations: Mutation[]) {
      localMutations$.next({transaction: false, mutations})
    },
    transaction(
      mutationsOrTransaction: {id?: string; mutations: Mutation[]} | Mutation[],
    ) {
      const transaction: TransactionalMutationGroup = Array.isArray(
        mutationsOrTransaction,
      )
        ? {mutations: mutationsOrTransaction, transaction: true}
        : {...mutationsOrTransaction, transaction: true}

      localMutations$.next(transaction)
    },
  }
}

const EMPTY_ARRAY = Object.freeze([])

const SEED_STATE = Object.freeze({
  inflight: EMPTY_ARRAY,
  local: EMPTY_ARRAY,
  base: undefined,
})

type OptimisticStoreInternalConfig = {
  /**
   * Stream of local mutations that should be applied optimistically and be scheduled for later submission
   */
  localMutations: Observable<MutationGroup>

  /**
   * Stream of requests to submit local changes
   */
  onSubmitLocal: Observable<void>

  /**
   * A function that when called with an id must return a stream of listener events
   * @param id
   */
  listen: (id: string) => Observable<ListenerEvent | Error>

  /**
   * A function that, when called, must submit the given mutation groups to the backend
   * @param mutationGroups
   */
  submitTransactions: (mutationGroups: Transaction) => Observable<SubmitResult>
}

export function createOptimisticStoreInternal(
  config: OptimisticStoreInternalConfig,
) {
  const edge = createDocumentMap()

  const {onSubmitLocal, localMutations, listen, submitTransactions} = config

  // this emits whenever we receive a remote mutation that causes local mutations to be rebased
  // this causes pending, unsubmitted mutations to be replaced with rebased mutations
  const rebasedMutations = new Subject<readonly MutationGroup[]>()

  // Signals that pending mutations should be cleared after they've been captured for submit
  const clearPendingMutations = new Subject<void>()

  function listenDocumentUpdates<Doc extends SanityDocumentBase>(
    documentId: string,
  ) {
    return listen(documentId).pipe(
      scan(
        (
          prev: DocumentUpdate<Doc> | StoreError | undefined,
          event: ListenerEvent | Error,
        ): DocumentUpdate<Doc> | StoreError => {
          // Pass listener-layer errors through as value emissions.
          if (event instanceof Error) {
            return event as StoreError
          }
          if (event.type === 'sync') {
            return {
              event,
              documentId,
              snapshot: event.document,
            } as DocumentUpdate<Doc>
          }
          if (event.type === 'mutation') {
            // prev should be a non-error DocumentUpdate by the time a mutation
            // arrives (sync comes first). An error in prev means the stream
            // would already have terminated via the takeWhile below, but guard
            // defensively against the seed (undefined) and against any error
            // value that snuck through.
            if (prev === undefined || prev instanceof Error) {
              // Invariant: a mutation cannot arrive before sync. Panic.
              throw new Error(
                'Received a mutation event before sync event. Something is wrong',
              )
            }
            if (hasProperty(event, 'effects')) {
              const applied = applyMutationEventEffects(prev.snapshot, event)
              if (applied instanceof Error) return applied
              return {
                event,
                documentId,
                snapshot: applied as Doc,
              }
            }
            if (hasProperty(event, 'mutations')) {
              const decoded = decodeAll(event.mutations)
              if (decoded instanceof Error) return decoded
              const applied = applyAll(prev.snapshot, decoded)
              if (applied instanceof Error) return applied as StoreError
              return {
                event,
                documentId,
                snapshot: applied as Doc,
              }
            }
            return new MendozaMissingEffectsError()
          }
          return {
            documentId,
            snapshot: (prev as DocumentUpdate<Doc> | undefined)?.snapshot,
            event,
          }
        },
        undefined,
      ),
      // ignore seed value
      filter(
        (update): update is DocumentUpdate<Doc> | StoreError =>
          update !== undefined,
      ),
      // Terminate the stream after the first error emission; consumers receive
      // the error as a value and should resubscribe if they want to recover.
      takeWhile(
        (update): boolean => !(update instanceof Error),
        /* inclusive */ true,
      ),
    )
  }

  const pendingMutations = merge(
    localMutations.pipe(
      map(local => ({type: 'add' as const, mutations: local})),
    ),
    rebasedMutations.pipe(
      // if pending mutations are rebased
      map(mutations => ({type: 'rebase' as const, mutations})),
    ),
    clearPendingMutations.pipe(
      // clear pending mutations after they've been captured for submit
      map(() => ({type: 'clear' as const})),
    ),
  ).pipe(
    scan((current: readonly MutationGroup[], action) => {
      if (action.type === 'rebase') {
        // replace current pending mutations with rebased ones
        return action.mutations
      }
      if (action.type === 'add') {
        return current.concat(action.mutations)
      }
      if (action.type === 'clear') {
        return []
      }
      return current
    }, []),
  )
  // Create the submit requests observable with share() to multicast to listeners
  const submitRequests = onSubmitLocal.pipe(
    withLatestFrom(pendingMutations),
    mergeMap(([, mutationGroups]) => {
      // Clear pending mutations now that we've captured them for this submit
      clearPendingMutations.next()

      const squashed = squashDMPStrings(
        edge,
        squashMutationGroups(mutationGroups),
      )
      if (squashed instanceof Error) {
        return of({type: 'error' as const, error: squashed as StoreError})
      }
      const transactions = toTransactions(squashed)
      return concat(
        of({
          type: 'submit' as const,
          transaction: transactions,
        }),
      )
    }),
    concatMap(submitRequest => {
      if (submitRequest.type === 'error') {
        // The squashDMPStrings step produced an error during submit-prep.
        // Forward the request through scan (which sets terminalError) so the
        // listen() output emits it and completes.
        return of(submitRequest)
      }
      return merge(
        of(submitRequest),
        from(submitRequest.transaction).pipe(
          concatMap(transaction => submitTransactions(transaction)),
          mergeMap(() => EMPTY),
        ),
      )
    }),
    share(),
  )

  return {
    listen(
      id: string,
    ): Observable<SanityDocumentBase | undefined | StoreError> {
      const remoteUpdates = listenDocumentUpdates(id).pipe(share())

      // Route any error values from listenDocumentUpdates onto a dedicated
      // stream that will be merged in at the end and terminate the output.
      const remoteErrors = remoteUpdates.pipe(
        filter((update): update is StoreError => update instanceof Error),
        map(error => ({type: 'error' as const, error})),
      )

      const remoteMutations = remoteUpdates.pipe(
        filter(
          (update): update is DocumentMutationUpdate<SanityDocumentBase> =>
            !(update instanceof Error) && update.event.type === 'mutation',
        ),
        map(update => ({
          base: update.snapshot,
          type: 'remoteMutation' as const,
          transactionId: update.event.transactionId,
        })),
      )

      const remoteSync = remoteUpdates.pipe(
        filter(
          (update): update is DocumentUpdate<SanityDocumentBase> =>
            !(update instanceof Error) && update.event.type === 'sync',
        ),
        map(update => ({type: 'sync' as const, snapshot: update.snapshot})),
      )

      return merge(
        remoteSync,
        remoteErrors,
        submitRequests,
        localMutations.pipe(
          map(m => ({type: 'localMutation' as const, mutations: m})),
        ),
        remoteMutations,
      ).pipe(
        scan((state: LocalState, ev) => {
          const {base, inflight, local} = state
          if (ev.type === 'error') {
            // Carry the error through scan unchanged; it will be surfaced as a
            // value emission and terminate the stream via takeWhile below.
            return {...state, terminalError: ev.error}
          }
          if (ev.type === 'sync') {
            // When a sync event arrives, the document might already include effects of
            // inflight transactions (if they were applied before the sync event was received).
            // Remove any inflight transactions that match the document's revision.
            const docRev = ev.snapshot?._rev
            const newInflight = docRev
              ? inflight.filter(tx => tx.id !== docRev)
              : inflight
            return {...state, base: ev.snapshot, inflight: newInflight}
          }
          if (ev.type === 'localMutation') {
            return {
              base,
              inflight,
              local: local.concat(ev.mutations),
            }
          }

          if (ev.type === 'remoteMutation') {
            const isHeadInflight = inflight[0]?.id === ev.transactionId
            if (isHeadInflight) {
              // we received the first inflight transaction we submitted
              // no rebase needed
              return {
                base: ev.base,
                inflight: inflight.slice(1),
                local,
              }
            }

            const newEdge = applyAll(
              ev.base,
              filterDocumentTransactions(inflight, id),
            )
            if (newEdge instanceof Error) {
              return {...state, terminalError: newEdge as StoreError}
            }

            const oldEdge = edge.get(id)
            const rebased = rebase(id, oldEdge, newEdge, local)
            if (rebased instanceof Error) {
              return {...state, terminalError: rebased as StoreError}
            }
            const [newLocalMutations] = rebased

            // todo – is there a cleaner way to do this?
            rebasedMutations.next(newLocalMutations)

            // now calculate dmps for each of them against current edge
            // We received a mutation from the listener that came before any of the ones in-flight
            // Now, assuming our in-flight patch comes in next, our document will likely be a product of:
            // new base + inflight applied on top + local changes
            // In order to capture user intention on diffMatchPatch We now want to rewrite our local patches by
            // 1. compacting them, so that multiple set patches on the same string becomes distilled to the last one
            // 2. generate diffmatchpatch between the old edge and current local. these should reflect what the user wanted to do
            // 3. apply these diffmatchpatch patches on top of the new base + inflight
            // 4. calculate set patches from the results and use as new `local`
            return {
              base: ev.base,
              inflight: inflight,
              local: newLocalMutations,
            }
          }
          if (ev.type === 'submit') {
            return {
              base,
              inflight: inflight.concat(ev.transaction),
              local: [],
            }
          }
          // @ts-expect-error - should cover all cases
          // eslint-disable-next-line no-console
          console.warn('Unhandled "%s" event', ev.type)
          return state
        }, SEED_STATE),
        startWith({inflight: [], local: [], base: undefined} as LocalState),
        map((state): SanityDocumentBase | undefined | StoreError => {
          if (state.terminalError) return state.terminalError
          const nextEdge = applyAll(
            state.base,
            filterDocumentTransactions(state.inflight, id),
          )
          if (nextEdge instanceof Error) return nextEdge as StoreError
          edge.set(id, nextEdge)
          // whenever state changes
          // apply inflight + local on base
          const nextLocalDocument = applyAll(
            nextEdge,
            filterDocumentTransactions(state.local, id),
          )
          if (nextLocalDocument instanceof Error) {
            return nextLocalDocument as StoreError
          }
          return nextLocalDocument
        }),
        takeWhile(
          (value): boolean => !(value instanceof Error),
          /* inclusive */ true,
        ),
      )
    },
  }
}
