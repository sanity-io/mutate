import {
  EMPTY,
  Subject,
  defer,
  filter,
  map,
  merge,
  mergeMap,
  of,
  tap,
} from 'rxjs'
import {groupBy} from 'lodash'
import {createLocalDataStore} from './stores/local'
import {createRemoteDataStore} from './stores/remote'
import {getMutationDocumentId} from './utils/getMutationDocumentId'
import {createMemoizer} from './utils/memoize'
import {squashTransactions} from './optimizations/squashMutations'
import {applyMendozaPatch} from './applyMendoza'
import {rebase} from './rebase'
import {squashDMPStrings} from './optimizations/squashDMPStrings'
import {createLoader, query} from './query'
import type {SanityDocumentBase} from '../mutations/types'
import type {Observable} from 'rxjs'

import type {
  ContentLakeStore,
  DataStoreLogEvent,
  OptimisticDocumentEvent,
  PendingTransaction,
  RemoteDocumentEvent,
  RemoteListenerEvent,
  SubmitResult,
} from './types'

export interface StoreBackend {
  fetchDocuments: (ids: string[]) => PromiseLike<SanityDocumentBase[]>
  sync: (id: string) => Observable<SanityDocumentBase | undefined>
  listen: (id: string) => Observable<RemoteListenerEvent>
  submit: (transactions: PendingTransaction[]) => Promise<SubmitResult>
}

export function createContentLakeStore(
  backend: StoreBackend,
): ContentLakeStore {
  const local = createLocalDataStore()
  const remote = createRemoteDataStore()
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
    const remote$ = backend.listen(id).pipe(
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
    localLog: localLog$.asObservable(),
    remoteLog: remoteLog$.asObservable(),
    outbox: outbox$.asObservable().pipe(map(() => outbox)),
    query: async (q: string, params?: Record<string, unknown>) => {
      const start = new Date()
      const dataset = local.getAll()
      const loader = createLoader(backend.fetchDocuments, dataset)
      const result = await query(dataset, loader, q, params)
      return {
        result,
        ms: new Date().getTime() - start.getTime(),
      }
    },
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
    observe: getEvents,
    get: id =>
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
