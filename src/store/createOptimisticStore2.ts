import {
  bufferWhen,
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
  tap,
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
import {
  type ListenerEvent,
  type MutationGroup,
  type OptimisticStore2,
  type SubmitResult,
  type TransactionalMutationGroup,
} from './types'
import {createTransactionId} from './utils/createTransactionId'
import {filterDocumentTransactions} from './utils/filterDocumentTransactions'
import {mergeMutationGroups} from './utils/mergeMutationGroups'
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
 * Creates a local dataset that allows subscribing to documents by id and submitting mutations to be optimistically applied
 * @param backend
 */
export function createOptimisticStore2(
  backend: OptimisticStoreBackend,
): OptimisticStore2 {
  const remote = createDocumentMap()

  const submitRequests$ = new Subject<void>()
  const localMutations$ = new Subject<MutationGroup>()

  function listenDocumentUpdates<Doc extends SanityDocumentBase>(
    documentId: string,
  ) {
    return backend.listen(documentId).pipe(
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

  const submitRequests = localMutations$.pipe(
    bufferWhen(() => submitRequests$),
    mergeMap(mutationGroups => {
      return concat(
        of({
          type: 'submit' as const,
          transaction: toTransactions(mergeMutationGroups(mutationGroups)),
        }),
      )
    }),
    share(),
  )

  return {
    listen(id: string): Observable<SanityDocumentBase | undefined> {
      const remoteUpdates = listenDocumentUpdates(id).pipe(
        share(),
        tap(update => {
          remote.set(update.documentId, update.snapshot)
        }),
      )

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
              concatMap(transaction => backend.submit(transaction)),
              mergeMap(() => EMPTY),
            ),
          ),
        ),
        submitRequests,
        localMutations$.pipe(
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
              return {
                base: ev.base,
                inflight: inflight.filter(
                  transaction => transaction.id !== ev.transactionId,
                ),
                local,
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
        // eslint-disable-next-line no-console
        tap(s => console.log(s)),
        map(state => {
          // whenever state changes
          // apply inflight + local on base
          return applyAll(
            state.base,
            filterDocumentTransactions(state.inflight, id).concat(
              filterDocumentTransactions(state.local, id),
            ),
          )
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
    optimize() {},
    submit() {
      submitRequests$.next()
      return Promise.resolve([])
    },
  }
}

/**
 * Takes three streams, baseDocument$, inFlightTransactions$ and localMutations$ and returns a stream of the current document
 * @param id document id
 * @param localState$ - The local mutations, not yet submitted
 */
export function reconcile(
  id: string,
  localState$: Observable<LocalState>,
): Observable<SanityDocumentBase> {
  return localState$.pipe(
    map(({base, inflight, local}) => {
      return applyAll(
        base,
        filterDocumentTransactions(inflight, id).concat(
          filterDocumentTransactions(local, id),
        ),
      )
    }),
  )
}

export function _arriveRemote(
  state: LocalState,
  base: SanityDocumentBase | undefined,
  transactionId: string,
) {}

export function createTransaction(groups: MutationGroup[]): Transaction[] {
  return groups.map(group => {
    if (group.transaction && group.id !== undefined) {
      return {id: group.id!, mutations: group.mutations}
    }
    return {id: createTransactionId(), mutations: group.mutations}
  })
}
