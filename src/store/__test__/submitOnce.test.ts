import {NEVER, of} from 'rxjs'
import {describe, expect, test, vi} from 'vitest'

import {createOptimisticStore} from '../optimistic/createOptimisticStore'
import {collectNotifications, sleep} from './helpers'

describe('submit callback deduplication', () => {
  test('submit callback is called once per submit, regardless of number of listeners', async () => {
    const submitCallback = vi.fn().mockReturnValue(of({}))

    const store = createOptimisticStore({
      listen: id => of({type: 'sync', id, document: {_id: id, _type: 'test'}}),
      submit: submitCallback,
    })

    // Subscribe to multiple documents
    const listener1 = collectNotifications(store.listen('doc1'))
    const listener2 = collectNotifications(store.listen('doc2'))
    const listener3 = collectNotifications(store.listen('doc3'))

    // Wait for initial sync
    await sleep(10)

    // Add some mutations
    store.mutate([{type: 'patch', id: 'doc1', patches: []}])
    store.mutate([{type: 'patch', id: 'doc2', patches: []}])

    // Submit once
    store.submit()

    // Wait for async operations
    await sleep(50)

    // Submit callback should be called exactly once (with one transaction)
    expect(submitCallback).toHaveBeenCalledTimes(1)

    // Cleanup
    listener1.unsubscribe()
    listener2.unsubscribe()
    listener3.unsubscribe()
  })

  test('submit callback is called once even with many listeners', async () => {
    const submitCallback = vi.fn().mockReturnValue(of({}))

    const store = createOptimisticStore({
      listen: id => of({type: 'sync', id, document: {_id: id, _type: 'test'}}),
      submit: submitCallback,
    })

    // Subscribe to 10 documents
    const listeners = Array.from({length: 10}, (_, i) =>
      collectNotifications(store.listen(`doc${i}`)),
    )

    // Wait for initial sync
    await sleep(10)

    // Add a mutation
    store.mutate([{type: 'patch', id: 'doc0', patches: []}])

    // Submit once
    store.submit()

    // Wait for async operations
    await sleep(50)

    // Submit callback should be called exactly once
    expect(submitCallback).toHaveBeenCalledTimes(1)

    // Cleanup
    listeners.forEach(l => l.unsubscribe())
  })

  test('multiple submits call submit callback once per submit', async () => {
    const submitCallback = vi.fn().mockReturnValue(of({}))

    const store = createOptimisticStore({
      listen: id => of({type: 'sync', id, document: {_id: id, _type: 'test'}}),
      submit: submitCallback,
    })

    // Subscribe to multiple documents
    const listener1 = collectNotifications(store.listen('doc1'))
    const listener2 = collectNotifications(store.listen('doc2'))

    // Wait for initial sync
    await sleep(10)

    // First batch of mutations
    store.mutate([{type: 'patch', id: 'doc1', patches: []}])
    store.submit()

    await sleep(10)

    // Second batch of mutations
    store.mutate([{type: 'patch', id: 'doc2', patches: []}])
    store.submit()

    await sleep(50)

    // Submit callback should be called exactly twice (once per submit)
    expect(submitCallback).toHaveBeenCalledTimes(2)

    // Cleanup
    listener1.unsubscribe()
    listener2.unsubscribe()
  })
})
