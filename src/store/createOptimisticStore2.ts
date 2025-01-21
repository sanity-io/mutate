import {
  concat,
  concatMap,
  EMPTY,
  filter,
  from,
  map,
  merge,
  mergeMap,
  NEVER,
  type Observable,
  of,
  share,
  startWith,
  Subject,
  withLatestFrom,
} from 'rxjs'
import {scan} from 'rxjs/operators'

import {
  type Mutation,
  type SanityDocumentBase,
  type Transaction,
} from '../mutations/types'
import {applyAll} from './documentMap/applyDocumentMutation'
import {applyMutationEventEffects} from './documentMap/applyMendoza'
import {createDocumentMap} from './documentMap/createDocumentMap'
import {
  type DocumentMutationUpdate,
  type DocumentUpdate,
} from './listeners/createDocumentUpdateListener'
import {squashDMPStrings} from './optimizations/squashDMPStrings'
import {squashMutationGroups} from './optimizations/squashMutations'
import {rebase} from './rebase'
import {
  type ListenerEvent,
  type MutationGroup,
  type OptimisticDocumentEvent,
  type OptimisticStore2,
  type RemoteDocumentEvent,
  type SubmitResult,
  type TransactionalMutationGroup,
} from './types'
import {filterDocumentTransactions} from './utils/filterDocumentTransactions'
import {toTransactions} from './utils/toTransactions'

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
  base: SanityDocumentBase | undefined
  inflight: Transaction[]
  local: MutationGroup[]
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
export function createOptimisticStore2(
  backend: OptimisticStoreBackend,
): OptimisticStore2 {
  const localMutations$ = new Subject<MutationGroup>()
  const submitLocal$ = new Subject<void>()
  const store = createOptimisticStoreInternal({
    localMutations: localMutations$,
    submitLocal: submitLocal$,
    listen: backend.listen,
    submitTransactions: backend.submit,
  })
  return {
    listenEvents(
      id: string,
    ): Observable<RemoteDocumentEvent | OptimisticDocumentEvent> {
      return NEVER
    },
    submit: () => {
      submitLocal$.next()
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

type OptimisticStoreInternalConfig = {
  /**
   * Stream of local mutations that should be applied optimistically and be scheduled for later submission
   */
  localMutations: Observable<MutationGroup>

  /**
   * Stream of requests to submit local changes
   */
  submitLocal: Observable<void>

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

  const {submitLocal, localMutations, listen, submitTransactions} = config

  const rewriteMutations$ = new Subject<MutationGroup[]>()

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
            if (!event.effects.apply) {
              throw new Error(
                'No effects found on listener event. The listener must be set up to use effectFormat=mendoza.',
              )
            }
            return {
              event,
              documentId,
              snapshot: applyMutationEventEffects(prev.snapshot, event) as Doc,
            }
          }
          return {documentId, snapshot: prev?.snapshot, event}
        },
        undefined,
      ),
      // ignore seed value
      filter(update => update !== undefined),
    )
  }

  const ready = merge(
    localMutations.pipe(
      map(local => ({type: 'add' as const, mutations: local})),
    ),
    rewriteMutations$.pipe(
      map(mutations => ({type: 'replace' as const, mutations})),
    ),
  ).pipe(
    scan((current: MutationGroup[], action) => {
      if (action.type === 'replace') {
        return action.mutations
      }
      if (action.type === 'add') {
        return current.concat(action.mutations)
      }
      return current
    }, []),
  )
  const submitRequests = submitLocal.pipe(
    withLatestFrom(ready),
    mergeMap(([, mutationGroups]) => {
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
          type: 'arrive' as const,
          transactionId: update.event.transactionId,
        })),
      )

      const remoteSync = remoteUpdates.pipe(
        filter(update => update.event.type === 'sync'),
        map(update => ({type: 'sync' as const, snapshot: update.snapshot})),
      )

      return merge(
        remoteSync,
        // subscribing for the side effect
        submitRequests.pipe(
          concatMap(submitRequest =>
            from(submitRequest.transaction).pipe(
              concatMap(transaction => submitTransactions(transaction)),
              mergeMap(() => EMPTY),
            ),
          ),
        ),
        submitRequests,
        localMutations.pipe(
          map(m => ({type: 'localMutation' as const, mutations: m})),
        ),
        remoteMutations,
      ).pipe(
        scan(
          (state: LocalState, ev) => {
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

            if (ev.type === 'arrive') {
              const isPending = inflight[0]?.id === ev.transactionId
              const nextInflight = isPending ? inflight.slice(1) : inflight

              const newEdge = applyAll(
                ev.base,
                filterDocumentTransactions(nextInflight, id),
              )

              const oldEdge = edge.get(id)
              const [newLocalMutations] = rebase(id, oldEdge, newEdge, local)

              rewriteMutations$.next(newLocalMutations)

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
                inflight: nextInflight,
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
          },
          {inflight: [], local: [], base: undefined},
        ),
        startWith({inflight: [], local: [], base: undefined}),

        //tap(s => console.log(s)),
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
