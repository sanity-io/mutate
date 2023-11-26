import {groupBy} from 'lodash'
import {
  defer,
  EMPTY,
  filter,
  map,
  merge,
  mergeMap,
  type Observable,
  of,
  Subject,
  tap,
} from 'rxjs'

import {decodeAll, type SanityMutation} from '../encoders/sanity'
import {type Transaction} from '../mutations/types'
import {applyMendozaPatch} from './datasets/applyMendoza'
import {applyMutations} from './datasets/applyMutations'
import {commit} from './datasets/commit'
import {createDataset} from './datasets/createDataset'
import {squashDMPStrings} from './optimizations/squashDMPStrings'
import {squashTransactions} from './optimizations/squashMutations'
import {rebase} from './rebase'
import {
  type ContentLakeStore,
  type DataStoreLogEvent,
  type OptimisticDocumentEvent,
  type PendingTransaction,
  type RemoteDocumentEvent,
  type RemoteListenerEvent,
  type SubmitResult,
} from './types'
import {getMutationDocumentId} from './utils/getMutationDocumentId'
import {createMemoizer} from './utils/memoize'

export interface StoreBackend {
  /**
   * Sets up a subscription to a document
   * The first event should either be a sync event or an error event.
   * After that, it should emit mutation events, error events or sync events
   * @param id
   */
  observe: (id: string) => Observable<RemoteListenerEvent>
  submit: (transactions: PendingTransaction[]) => Observable<SubmitResult>
}

export function createContentLakeStore(
  backend: StoreBackend,
): ContentLakeStore {
  const local = createLocalDataset()
  const remote = createRemoteDataset()
  const memoize = createMemoizer()
  let outbox: PendingTransaction[] = []

  const localMutations$ = new Subject<OptimisticDocumentEvent>()
  const localLog$ = new Subject<DataStoreLogEvent>()
  const outbox$ = new Subject<void>()
  const remoteLog$ = new Subject<RemoteDocumentEvent>()

  function setOutBox(nextOutBox: PendingTransaction[]) {
    outbox = nextOutBox
    outbox$.next()
  }

  function getEvents(id: string) {
    const local$ = localMutations$.pipe(filter(event => event.id === id))
    const remote$ = backend.observe(id).pipe(
      mergeMap((event): Observable<RemoteDocumentEvent> => {
        const oldRemote = remote.get(id)
        if (event.type === 'sync') {
          const newRemote = event.document
          const [newOutbox, newLocal] = rebase(id, oldRemote, newRemote, outbox)
          setOutBox(newOutbox)
          remote.set(id, newRemote)
          local.set(id, newLocal)
          return of({type: 'sync', document: event.document, id})
        } else if (event.type === 'mutation') {
          // we have already seen this mutation
          if (event.transactionId === oldRemote?._rev) {
            return EMPTY
          }

          const newRemote = applyMendozaPatch(oldRemote, event.effects)
          if (newRemote) {
            newRemote._rev = event.transactionId
          }

          const [newOutbox, newLocal] = rebase(id, oldRemote, newRemote, outbox)

          if (newLocal) {
            newLocal._rev = event.transactionId
          }

          remote.set(id, newRemote)
          local.set(id, newLocal)
          setOutBox(newOutbox)

          return of({
            type: 'mutation',
            id,
            effects: event.effects,
            mutations: decode(event.mutations as SanityMutation[]),
          })
        } else {
          throw new Error('Invalid event type')
        }
      }),
      tap(event => remoteLog$.next(event)),
    )
    return defer(() => memoize(id, merge(local$, remote$)))
  }

  return {
    outbox: outbox$.asObservable().pipe(map(() => outbox)),
    mutate: mutations => {
      outbox.push({mutations})
      const res = local.apply(mutations)
      const grouped = groupBy(mutations, r => getMutationDocumentId(r))
      Object.entries(grouped).forEach(([id, muts]) => {
        localMutations$.next({type: 'optimistic', id, mutations: muts})
      })
      localLog$.next({mutations})
      outbox$.next()
      return res
    },
    transaction: mutationsOrTransaction => {
      const transaction = Array.isArray(mutationsOrTransaction)
        ? {mutations: mutationsOrTransaction}
        : mutationsOrTransaction

      outbox.push(transaction)
      const res = local.apply(transaction.mutations)
      localLog$.next(transaction)
      outbox$.next()
      return res
    },
    observeEvents: getEvents,
    observe: id =>
      getEvents(id).pipe(
        map(() => ({local: local.get(id), remote: remote.get(id)})),
      ),
    optimize: () => {
      setOutBox(squashTransactions(outbox))
    },
    submit: () => {
      const pending = outbox
      setOutBox([])
      return backend.submit(
        // Squashing DMP strings is the last thing we do before submitting
        squashDMPStrings(remote, squashTransactions(pending)),
      )
    },
  }
}
