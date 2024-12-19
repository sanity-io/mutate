import {type ReconnectEvent} from '@sanity/client'
import {
  defer,
  EMPTY,
  filter,
  lastValueFrom,
  map,
  merge,
  mergeMap,
  type Observable,
  of,
  Subject,
  tap,
  toArray,
} from 'rxjs'

import {decodeAll, type SanityMutation} from '../encoders/sanity'
import {type Transaction} from '../mutations/types'
import {applyMutationEventEffects} from './documentMap/applyMendoza'
import {applyMutations} from './documentMap/applyMutations'
import {commit} from './documentMap/commit'
import {createDocumentMap} from './documentMap/createDocumentMap'
import {squashDMPStrings} from './optimizations/squashDMPStrings'
import {squashMutationGroups} from './optimizations/squashMutations'
import {rebase} from './rebase'
import {
  type ListenerEvent,
  type MutationGroup,
  type OptimisticDocumentEvent,
  type OptimisticStore,
  type RemoteDocumentEvent,
  type RemoteMutationEvent,
  type SubmitResult,
  type TransactionalMutationGroup,
} from './types'
import {createReplayMemoizer} from './utils/createReplayMemoizer'
import {filterMutationGroupsById} from './utils/filterMutationGroups'

export interface OptimisticStoreBackend {
  /**
   * Sets up a subscription to a document
   * The first event should either be a sync event or an error event.
   * After that, it should emit mutation events, error events or sync events
   * @param id
   */
  listen: (id: string) => Observable<ListenerEvent>
  submit: (mutationGroups: Transaction[]) => Observable<SubmitResult>
}

let didEmitMutationsAccessWarning = false
// certain components, like the portable text editor, rely on mutations to be present in the event
// i.e. it's not enough to just have the mendoza-patches.
// If the listener event did not include mutations (e.g. if excludeMutations was set to true),
// this warning will be issued if a downstream consumers attempts to access event.mutations
function warnNoMutationsReceived() {
  if (!didEmitMutationsAccessWarning) {
    // eslint-disable-next-line no-console
    console.warn(
      new Error(
        'No mutation received from backend. The listener is likely set up with `excludeMutations: true`. If your app need to know about mutations, make sure the listener is set up to include mutations',
      ),
    )
    didEmitMutationsAccessWarning = true
  }
}

const EMPTY_ARRAY: any[] = []

/**
 * Creates a local dataset that allows subscribing to documents by id and submitting mutations to be optimistically applied
 * @param backend
 */
export function createOptimisticStore(
  backend: OptimisticStoreBackend,
): OptimisticStore {
  const local = createDocumentMap()
  const remote = createDocumentMap()
  const memoize = createReplayMemoizer(1000)
  let stagedChanges: MutationGroup[] = []

  const remoteEvents$ = new Subject<RemoteDocumentEvent>()
  const localMutations$ = new Subject<OptimisticDocumentEvent>()

  const stage$ = new Subject<void>()

  function stage(nextPending: MutationGroup[]) {
    stagedChanges = nextPending
    stage$.next()
  }

  function getLocalEvents(id: string) {
    return localMutations$.pipe(filter(event => event.id === id))
  }

  function getRemoteEvents(id: string) {
    return backend.listen(id).pipe(
      filter(
        (event): event is Exclude<ListenerEvent, ReconnectEvent> =>
          event.type !== 'reconnect',
      ),
      mergeMap((event): Observable<RemoteDocumentEvent> => {
        const oldLocal = local.get(id)
        const oldRemote = remote.get(id)
        if (event.type === 'sync') {
          const newRemote = event.document
          const [rebasedStage, newLocal] = rebase(
            id,
            oldRemote,
            newRemote,
            stagedChanges,
          )
          return of({
            type: 'sync',
            id,
            before: {remote: oldRemote, local: oldLocal},
            after: {remote: newRemote, local: newLocal},
            rebasedStage,
          })
        } else if (event.type === 'mutation') {
          // we have already seen this mutation
          if (event.transactionId === oldRemote?._rev) {
            return EMPTY
          }

          const newRemote = applyMutationEventEffects(oldRemote, event)

          const [rebasedStage, newLocal] = rebase(
            id,
            oldRemote,
            newRemote,
            stagedChanges,
          )

          if (newLocal) {
            newLocal._rev = event.transactionId
          }
          const emittedEvent: RemoteMutationEvent = {
            type: 'mutation',
            id,
            rebasedStage,
            before: {remote: oldRemote, local: oldLocal},
            after: {remote: newRemote, local: newLocal},
            effects: event.effects,
            previousRev: event.previousRev,
            resultRev: event.resultRev,
            // overwritten below
            mutations: EMPTY_ARRAY,
          }
          if (event.mutations) {
            emittedEvent.mutations = decodeAll(
              event.mutations as SanityMutation[],
            )
          } else {
            Object.defineProperty(
              emittedEvent,
              'mutations',
              warnNoMutationsReceived,
            )
          }
          return of(emittedEvent)
        } else {
          // @ts-expect-error should have covered all cases
          throw new Error(`Unknown event type: ${event.type}`)
        }
      }),
      tap(event => {
        local.set(event.id, event.after.local)
        remote.set(event.id, event.after.remote)
        stage(event.rebasedStage)
      }),
      tap({
        next: event => remoteEvents$.next(event),
        error: err => {
          // todo: how to propagate errors?
          // remoteEvents$.next()
        },
      }),
    )
  }

  function listenEvents(id: string) {
    return defer(() =>
      memoize(id, merge(getLocalEvents(id), getRemoteEvents(id))),
    )
  }

  const metaEvents$ = merge(localMutations$, remoteEvents$)

  return {
    meta: {
      events: metaEvents$,
      stage: stage$.pipe(
        map(
          () =>
            // note: this should not be tampered with by consumers. We might want to do a deep-freeze during dev to avoid accidental mutations
            stagedChanges,
        ),
      ),
      conflicts: EMPTY, // does nothing for now
    },
    mutate: mutations => {
      // add mutations to list of pending changes
      stagedChanges.push({transaction: false, mutations})
      // Apply mutations to local dataset (note: this is immutable, and doesn't change the dataset)
      const results = applyMutations(mutations, local)
      // Write the updated results back to the "local" dataset
      commit(results, local)
      results.forEach(result => {
        localMutations$.next({
          type: 'optimistic',
          before: result.before,
          after: result.after,
          mutations: result.mutations,
          id: result.id,
          stagedChanges: filterMutationGroupsById(stagedChanges, result.id),
        })
      })
      return results
    },
    transaction: mutationsOrTransaction => {
      const transaction: TransactionalMutationGroup = Array.isArray(
        mutationsOrTransaction,
      )
        ? {mutations: mutationsOrTransaction, transaction: true}
        : {...mutationsOrTransaction, transaction: true}

      stagedChanges.push(transaction)
      const results = applyMutations(transaction.mutations, local)
      commit(results, local)
      results.forEach(result => {
        localMutations$.next({
          type: 'optimistic',
          mutations: result.mutations,
          id: result.id,
          before: result.before,
          after: result.after,
          stagedChanges: filterMutationGroupsById(stagedChanges, result.id),
        })
      })
      return results
    },
    listenEvents: listenEvents,
    listen: id =>
      listenEvents(id).pipe(
        map(event =>
          event.type === 'optimistic' ? event.after : event.after.local,
        ),
      ),
    optimize: () => {
      stage(squashMutationGroups(stagedChanges))
    },
    submit: () => {
      const pending = stagedChanges
      stage([])
      return lastValueFrom(
        backend
          .submit(
            toTransactions(
              // Squashing DMP strings is the last thing we do before submitting
              squashDMPStrings(remote, squashMutationGroups(pending)),
            ),
          )
          .pipe(toArray()),
      )
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
