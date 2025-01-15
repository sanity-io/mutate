import {
  bufferWhen,
  concat,
  concatMap,
  EMPTY,
  filter,
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
import {
  type DocumentMutationUpdate,
  type DocumentUpdate,
} from './listeners/createDocumentUpdateListener'
import {
  type ListenerEvent,
  type MutationGroup,
  type OptimisticStore2,
  type SubmitResult,
} from './types'
import {createTransactionId} from './utils/createTransactionId'
import {filterDocumentTransactions} from './utils/filterDocumentTransactions'

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
  const submit$ = new Subject<void>()
  const localMutations$ = new Subject<Mutation[]>()

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

  const submissions = localMutations$.pipe(
    bufferWhen(() => submit$),
    mergeMap(mutations => {
      return createTransaction([
        {transaction: false, mutations: mutations.flat()},
      ])
    }),
    mergeMap(transaction => {
      return concat(of({type: 'submit' as const, transaction}))
    }),
    share(),
  )

  return {
    listen(id: string): Observable<SanityDocumentBase | undefined> {
      const remoteUpdates = listenDocumentUpdates(id).pipe(share())
      const base = remoteUpdates.pipe(filter(u => u?.event.type === 'sync'))

      const remoteVersions = remoteUpdates.pipe(
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

      return merge(
        // subscribing for the side effect
        submissions.pipe(
          concatMap(s =>
            backend.submit(s.transaction).pipe(mergeMap(() => EMPTY)),
          ),
        ),
        submissions,
        localMutations$.pipe(
          map(m => ({type: 'localMutation' as const, mutations: m})),
        ),
        base.pipe(
          filter(update => update.event.type === 'sync'),
          map(update => ({type: 'sync' as const, snapshot: update.snapshot})),
        ),
        remoteVersions,
      ).pipe(
        scan(
          (state: LocalState, ev) => {
            if (ev.type === 'sync') {
              return {...state, base: ev.snapshot}
            }
            if (ev.type === 'localMutation') {
              return _mutateLocal(state, ev.mutations)
            }
            if (ev.type === 'arrive') {
              return _arriveRemote(state, ev.base, ev.transactionId)
            }
            if (ev.type === 'submit') {
              return _submit(state, ev.transaction)
            }
            return state
          },
          {inflight: [], local: [], base: undefined},
        ),
        startWith({inflight: [], local: [], base: undefined}),
        // eslint-disable-next-line no-console
        tap(s => console.log(s)),
        map(state => {
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
      localMutations$.next(mutations)
      // Todo: resolve this when mutation request is submitted sucessfully
      return Promise.resolve()
    },
    optimize() {},
    submit() {
      submit$.next()
      // todo
      return Promise.resolve([])
    },
  }
}

function toTransactions(groups: MutationGroup[]): Transaction[] {
  return groups.map(group => {
    if (group.transaction && group.id !== undefined) {
      return {id: group.id!, mutations: group.mutations}
    }
    return {mutations: group.mutations}
  })
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

export function _submit(state: LocalState, transaction: Transaction) {
  const {inflight, base} = state
  return {
    base,
    inflight: inflight.concat(transaction),
    local: [],
  }
}

export function _arriveRemote(
  state: LocalState,
  base: SanityDocumentBase | undefined,
  transactionId: string,
) {
  const {inflight, local} = state
  if (inflight.length === 0) {
    return {...state, base}
  }
  return {
    base,
    inflight: inflight.filter(transaction => transaction.id !== transactionId),
    local,
  }
}

export function _mutateLocal(state: LocalState, mutations: Mutation[]) {
  const {inflight, local, base} = state
  return {
    base,
    inflight,
    local: local.concat({transaction: false, mutations}),
  }
}

export function createTransaction(groups: MutationGroup[]): Transaction[] {
  return groups.map(group => {
    if (group.transaction && group.id !== undefined) {
      return {id: group.id!, mutations: group.mutations}
    }
    return {id: createTransactionId(), mutations: group.mutations}
  })
}
