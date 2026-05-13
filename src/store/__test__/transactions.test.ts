import {NEVER, type Observable, of} from 'rxjs'
import {describe, expect, test, vi} from 'vitest'

import {at, patch} from '../../mutations/creators'
import {set} from '../../mutations/operations/creators'
import {type Transaction} from '../../mutations/types'
import {createOptimisticStoreInMemoryBackend} from '../optimistic/backend/createOptimisticStoreInMemoryBackend'
import {createOptimisticStore} from '../optimistic/createOptimisticStore'
import {type SubmitResult} from '../types'
import {collectNotifications, sleep} from './helpers'

/**
 * Build a submit spy that captures each transaction it receives into a typed
 * array. Avoids cast-heavy use of `vi.fn().mock.calls[i][0]` for assertions.
 */
function createSubmitSpy(result: Observable<SubmitResult> = of({})): {
  fn: (tx: Transaction) => Observable<SubmitResult>
  transactions: Transaction[]
} {
  const transactions: Transaction[] = []
  return {
    transactions,
    fn: (tx: Transaction) => {
      transactions.push(tx)
      return result
    },
  }
}

describe('transaction()', () => {
  test('explicit transaction id is preserved when submitted', async () => {
    const spy = createSubmitSpy()
    const store = createOptimisticStore({
      listen: id =>
        of({type: 'sync', id, document: {_id: id, _type: 'demo'}} as const),
      submit: spy.fn,
    })

    const listener = collectNotifications(store.listen('doc1'))
    await sleep(10)

    store.transaction({
      id: 'my-tx-id',
      mutations: [patch('doc1', at('title', set('hi')))],
    })
    store.submit()
    await sleep(20)

    expect(spy.transactions).toHaveLength(1)
    expect(spy.transactions[0]?.id).toBe('my-tx-id')
    expect(spy.transactions[0]?.mutations).toHaveLength(1)

    listener.unsubscribe()
  })

  test('transaction(array) form is equivalent to {mutations: array} with generated id', async () => {
    const spy = createSubmitSpy()
    const store = createOptimisticStore({
      listen: id =>
        of({type: 'sync', id, document: {_id: id, _type: 'demo'}} as const),
      submit: spy.fn,
    })

    const listener = collectNotifications(store.listen('doc1'))
    await sleep(10)

    store.transaction([
      patch('doc1', at('a', set(1))),
      patch('doc1', at('b', set(2))),
    ])
    store.submit()
    await sleep(20)

    expect(spy.transactions).toHaveLength(1)
    const tx = spy.transactions[0]
    // generated id is a non-empty string
    expect(typeof tx?.id).toBe('string')
    expect(tx?.id?.length).toBeGreaterThan(0)
    expect(tx?.mutations).toHaveLength(1) // squashed adjacent patches
    const firstMutation = tx?.mutations[0]
    if (firstMutation?.type !== 'patch') {
      throw new Error('expected a patch mutation')
    }
    expect(firstMutation.patches).toHaveLength(2)

    listener.unsubscribe()
  })

  test('transactional groups are NOT merged with adjacent non-transactional mutations', async () => {
    const spy = createSubmitSpy()
    const store = createOptimisticStore({
      listen: id =>
        of({type: 'sync', id, document: {_id: id, _type: 'demo'}} as const),
      submit: spy.fn,
    })

    const listener = collectNotifications(store.listen('doc1'))
    await sleep(10)

    store.mutate([patch('doc1', at('a', set('mutate-1')))])
    store.transaction({
      id: 'tx-mid',
      mutations: [patch('doc1', at('b', set('tx-2')))],
    })
    store.mutate([patch('doc1', at('c', set('mutate-3')))])
    store.submit()
    await sleep(20)

    // Expect three separate submit calls (mutate, transaction, mutate)
    expect(spy.transactions).toHaveLength(3)
    expect(spy.transactions[1]?.id).toBe('tx-mid')
    // first and last get auto-generated ids that differ from the middle one
    expect(spy.transactions[0]?.id).not.toBe('tx-mid')
    expect(spy.transactions[2]?.id).not.toBe('tx-mid')

    listener.unsubscribe()
  })

  test('consecutive non-transactional mutate() calls are squashed into a single transaction', async () => {
    const spy = createSubmitSpy()
    const store = createOptimisticStore({
      listen: id =>
        of({type: 'sync', id, document: {_id: id, _type: 'demo'}} as const),
      submit: spy.fn,
    })

    const listener = collectNotifications(store.listen('doc1'))
    await sleep(10)

    store.mutate([patch('doc1', at('a', set(1)))])
    store.mutate([patch('doc1', at('b', set(2)))])
    store.mutate([patch('doc1', at('c', set(3)))])
    store.submit()
    await sleep(20)

    expect(spy.transactions).toHaveLength(1)
    const tx = spy.transactions[0]
    expect(tx?.mutations).toHaveLength(1)
    const merged = tx?.mutations[0]
    if (merged?.type !== 'patch') {
      throw new Error('expected a patch mutation')
    }
    expect(merged.patches.map(p => p.path[0])).toEqual(['a', 'b', 'c'])

    listener.unsubscribe()
  })

  test('transactional mutations across two documents within one submit yield one transaction', async () => {
    const backend = createOptimisticStoreInMemoryBackend()
    const spy = createSubmitSpy()
    const store = createOptimisticStore({
      listen: backend.listen,
      submit: (tx: Transaction) => {
        spy.fn(tx)
        return backend.submit(tx)
      },
    })

    const aObs = collectNotifications(store.listen('tx-doc-a'))
    const bObs = collectNotifications(store.listen('tx-doc-b'))
    await sleep(20)

    store.transaction({
      id: 'multi-doc-tx',
      mutations: [
        {
          type: 'createIfNotExists',
          document: {_id: 'tx-doc-a', _type: 'demo', n: 1},
        },
        {
          type: 'createIfNotExists',
          document: {_id: 'tx-doc-b', _type: 'demo', n: 2},
        },
      ],
    })
    store.submit()
    await sleep(60)

    expect(spy.transactions).toHaveLength(1)
    expect(spy.transactions[0]?.id).toBe('multi-doc-tx')
    expect(spy.transactions[0]?.mutations).toHaveLength(2)

    aObs.unsubscribe()
    bObs.unsubscribe()
  })
})

describe('inflight ordering', () => {
  test('after submit, the local snapshot is base+inflight until the listener acks the transaction', async () => {
    // Use a backend whose submit never resolves to simulate slow network
    const submit = vi.fn().mockReturnValue(NEVER)
    const doc = {_id: 'doc1', _type: 'demo', title: 'base'}
    const store = createOptimisticStore({
      listen: id => of({type: 'sync', id, document: doc} as const),
      submit,
    })

    const listener = collectNotifications(store.listen('doc1'))
    await sleep(10)

    store.mutate([patch('doc1', at('title', set('staged')))])
    // Before submit, the local should reflect "staged"
    const beforeSubmit = listener.notifications.at(-1)
    expect(beforeSubmit).toMatchObject({
      kind: 'NEXT',
      value: {title: 'staged'},
    })

    store.submit()
    await sleep(20)

    // After submit (but before listener mutation event acks the transaction),
    // local view continues to reflect 'staged' because inflight is applied
    const afterSubmit = listener.notifications.at(-1)
    expect(afterSubmit).toMatchObject({
      kind: 'NEXT',
      value: {title: 'staged'},
    })

    expect(submit).toHaveBeenCalledTimes(1)
    listener.unsubscribe()
  })
})

describe('submit with no pending mutations', () => {
  test("an empty submit doesn't call the backend at all", async () => {
    const submit = vi.fn().mockReturnValue(of({}))
    const store = createOptimisticStore({
      listen: id =>
        of({type: 'sync', id, document: {_id: id, _type: 'demo'}} as const),
      submit,
    })

    const listener = collectNotifications(store.listen('doc1'))
    await sleep(10)

    store.submit()
    await sleep(20)

    expect(submit).not.toHaveBeenCalled()
    listener.unsubscribe()
  })
})
