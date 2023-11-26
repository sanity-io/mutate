import {
  EMPTY,
  Subject,
  defer,
  filter,
  lastValueFrom,
  map,
  merge,
  mergeMap,
  of,
  tap,
  toArray,
} from 'rxjs'

import {createClient} from '@sanity/client'
import {decode} from '../encoders/sanity'
import {createMemoizer} from './utils/memoize'
import {squashMutationGroups} from './optimizations/squashMutations'
import {rebase} from './rebase'
import {squashDMPStrings} from './optimizations/squashDMPStrings'

import {createDataset} from './datasets/createDataset'
import {applyMutations} from './datasets/applyMutations'
import {commit} from './datasets/commit'
import {applyMendozaPatch} from './datasets/applyMendoza'
import type {SanityMutation} from '../encoders/sanity'
import type {Observable} from 'rxjs'

import type {
  ContentLakeStore,
  MutationGroup,
  OptimisticDocumentEvent,
  RemoteDocumentEvent,
  RemoteListenerEvent,
  SubmitResult,
  TransactionalMutationGroup,
} from './types'

export interface StoreBackend {
  /**
   * Sets up a subscription to a document
   * The first event should either be a sync event or an error event.
   * After that, it should emit mutation events, error events or sync events
   * @param id
   */
  observe: (id: string) => Observable<RemoteListenerEvent>
  submit: (mutationGroups: MutationGroup[]) => Observable<SubmitResult>
}

export function createContentLakeStore(
  backend: StoreBackend,
): ContentLakeStore {
  const local = createDataset()
  const remote = createDataset()
  const memoize = createMemoizer()
  let stagedChanges: MutationGroup[] = []

  const localMutations$ = new Subject<OptimisticDocumentEvent>()
  const stage$ = new Subject<void>()
  const log$ = new Subject<RemoteDocumentEvent>()

  function stage(nextPending: MutationGroup[]) {
    stagedChanges = nextPending
    stage$.next()
  }

  function getLocalEvents(id: string) {
    return localMutations$.pipe(filter(event => event.id === id))
  }

  function getRemoteEvents(id: string) {
    return backend.observe(id).pipe(
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

          const newRemote = applyMendozaPatch(oldRemote, event.effects)
          if (newRemote) {
            newRemote._rev = event.transactionId
          }

          const [rebasedStage, newLocal] = rebase(
            id,
            oldRemote,
            newRemote,
            stagedChanges,
          )

          if (newLocal) {
            newLocal._rev = event.transactionId
          }

          return of({
            type: 'mutation',
            id,
            rebasedStage,
            before: {remote: oldRemote, local: oldLocal},
            after: {remote: newRemote, local: newLocal},
            effects: event.effects,
            mutations: decode(event.mutations as SanityMutation[]),
          })
        } else {
          throw new Error(`Unknown event type: ${event.type}`)
        }
      }),
      tap(event => {
        local.set(event.id, event.after.local)
        remote.set(event.id, event.after.remote)
        stage(event.rebasedStage)
      }),
      tap(event => log$.next(event)),
    )
  }

  function observeEvents(id: string) {
    return defer(() =>
      memoize(id, merge(getLocalEvents(id), getRemoteEvents(id))),
    )
  }

  return {
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
        })
      })
      return results
    },
    observeEvents,
    observe: id =>
      observeEvents(id).pipe(
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
            // Squashing DMP strings is the last thing we do before submitting
            squashDMPStrings(remote, squashMutationGroups(pending)),
          )
          .pipe(toArray()),
      )
    },
  }
}
