import {
  concat,
  concatMap,
  EMPTY,
  filter,
  from,
  map,
  merge,
  mergeMap,
  type Observable,
  of,
  share,
  startWith,
  Subject,
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
   * After that, it should emit mutation events, error events or sync events
   * @param id
   */
  listen: (id: string) => Observable<ListenerEvent>
  submit: (mutationGroups: Transaction) => Observable<SubmitResult>
}

/**
 * Local state for a document. Tracks inflight mutations and local mutations
 * They change at the same time – local always comes after innflight in time
 */
export type LocalState = {
  readonly base: SanityDocumentBase | undefined
  readonly inflight: readonly Transaction[]
  readonly local: readonly MutationGroup[]
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
  return {
    listenEvents(
      id: string,
    ): Observable<RemoteDocumentEvent | OptimisticDocumentEvent> {
      return EMPTY
    },
    submit: () => {
      onSubmitLocal.next()
    },
    listen: store.listen,
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
  listen: (id: string) => Observable<ListenerEvent>

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
          prev: DocumentUpdate<Doc> | undefined,
          event: ListenerEvent,
        ): DocumentUpdate<Doc> => {
          if (event.type === 'sync') {
            return {
              event,
              documentId,
              snapshot: event.document,
            } as DocumentUpdate<Doc>
          }
          if (event.type === 'mutation') {
            if (prev?.event === undefined) {
              throw new Error(
                'Received a mutation event before sync event. Something is wrong',
              )
            }
            if (hasProperty(event, 'effects')) {
              return {
                event,
                documentId,
                snapshot: applyMutationEventEffects(
                  prev.snapshot,
                  event,
                ) as Doc,
              }
            }
            if (hasProperty(event, 'mutations')) {
              return {
                event,
                documentId,
                snapshot: applyAll(
                  prev.snapshot,
                  decodeAll(event.mutations),
                ) as Doc,
              }
            }
            throw new Error(
              'No effects or mutations found on listener event. The listener must be set up to either use effectFormat=mendoza (recommended) or includeMutations=true.',
            )
          }
          return {documentId, snapshot: prev?.snapshot, event}
        },
        undefined,
      ),
      // ignore seed value
      filter(update => update !== undefined),
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

      const transactions = toTransactions(
        squashDMPStrings(edge, squashMutationGroups(mutationGroups)),
      )
      return concat(
        of({
          type: 'submit' as const,
          transaction: transactions,
        }),
      )
    }),
    concatMap(submitRequest =>
      merge(
        of(submitRequest),
        from(submitRequest.transaction).pipe(
          concatMap(transaction => submitTransactions(transaction)),
          mergeMap(() => EMPTY),
        ),
      ),
    ),
    share(),
  )

  return {
    listen(id: string): Observable<SanityDocumentBase | undefined> {
      const remoteUpdates = listenDocumentUpdates(id).pipe(share())

      const remoteMutations = remoteUpdates.pipe(
        filter(
          (update): update is DocumentMutationUpdate<SanityDocumentBase> =>
            update.event.type === 'mutation',
        ),
        map(update => ({
          base: update.snapshot,
          type: 'remoteMutation' as const,
          transactionId: update.event.transactionId,
        })),
      )

      const remoteSync = remoteUpdates.pipe(
        filter(update => update.event.type === 'sync'),
        map(update => ({type: 'sync' as const, snapshot: update.snapshot})),
      )

      return merge(
        remoteSync,
        submitRequests,
        localMutations.pipe(
          map(m => ({type: 'localMutation' as const, mutations: m})),
        ),
        remoteMutations,
      ).pipe(
        scan((state: LocalState, ev) => {
          const {base, inflight, local} = state
          if (ev.type === 'sync') {
            return {...state, base: ev.snapshot}
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
              //rebasedMutations.next(local)
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

            const oldEdge = edge.get(id)
            const [newLocalMutations] = rebase(id, oldEdge, newEdge, local)

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
        startWith({inflight: [], local: [], base: undefined}),
        map(state => {
          const nextEdge = applyAll(
            state.base,
            filterDocumentTransactions(state.inflight, id),
          )
          edge.set(id, nextEdge)
          // whenever state changes
          // apply inflight + local on base
          const nextLocalDocument = applyAll(
            nextEdge,
            filterDocumentTransactions(state.local, id),
          )
          return nextLocalDocument
        }),
      )
    },
  }
}
