import {of} from 'rxjs'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

import {createOptimisticStore} from '../optimistic/createOptimisticStore'
import {sleep} from './helpers'

/**
 * Contract tests for `OptimisticStore` documenting the subscription
 * requirement: `submit()` only flushes pending mutations when at least one
 * `listen(id)` subscriber is keeping the rebase pipeline alive. Without one,
 * the call is a no-op and a dev-mode warning is emitted.
 */
describe('OptimisticStore: submit requires an active listen() subscriber', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warn.mockRestore()
  })

  test('submit() with no subscriber is a no-op and warns', async () => {
    const submit = vi.fn().mockReturnValue(of({}))
    const store = createOptimisticStore({
      listen: id =>
        of({type: 'sync', id, document: {_id: id, _type: 'test'}} as const),
      submit,
    })

    store.mutate([
      {
        type: 'patch',
        id: 'doc1',
        patches: [{path: ['title'], op: {type: 'set', value: 'hello'}}],
      },
    ])
    store.submit()
    await sleep(50)

    expect(submit).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(
      /submit\(\) was called without an active listen\(\) subscriber/,
    )
  })

  test('listenEvents() alone does NOT activate the submit pipeline', async () => {
    const submit = vi.fn().mockReturnValue(of({}))
    const store = createOptimisticStore({
      listen: id =>
        of({type: 'sync', id, document: {_id: id, _type: 'test'}} as const),
      submit,
    })

    const sub = store.listenEvents('doc1').subscribe()
    await sleep(10)

    store.mutate([
      {
        type: 'patch',
        id: 'doc1',
        patches: [{path: ['title'], op: {type: 'set', value: 'hello'}}],
      },
    ])
    store.submit()
    await sleep(50)

    expect(submit).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)

    sub.unsubscribe()
  })

  test('submit() flushes once a listen() subscriber is active', async () => {
    const submit = vi.fn().mockReturnValue(of({}))
    const store = createOptimisticStore({
      listen: id =>
        of({type: 'sync', id, document: {_id: id, _type: 'test'}} as const),
      submit,
    })

    const sub = store.listen('doc1').subscribe()
    await sleep(10)

    store.mutate([
      {
        type: 'patch',
        id: 'doc1',
        patches: [{path: ['title'], op: {type: 'set', value: 'hello'}}],
      },
    ])
    store.submit()
    await sleep(50)

    expect(submit).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()

    sub.unsubscribe()
  })

  test('after the last listen() subscriber unsubscribes, submit() is dropped again', async () => {
    const submit = vi.fn().mockReturnValue(of({}))
    const store = createOptimisticStore({
      listen: id =>
        of({type: 'sync', id, document: {_id: id, _type: 'test'}} as const),
      submit,
    })

    const sub = store.listen('doc1').subscribe()
    await sleep(10)
    sub.unsubscribe()

    store.mutate([
      {
        type: 'patch',
        id: 'doc1',
        patches: [{path: ['title'], op: {type: 'set', value: 'hello'}}],
      },
    ])
    store.submit()
    await sleep(50)

    expect(submit).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('a remaining listen() subscriber keeps submit() alive after another unsubscribes', async () => {
    const submit = vi.fn().mockReturnValue(of({}))
    const store = createOptimisticStore({
      listen: id =>
        of({type: 'sync', id, document: {_id: id, _type: 'test'}} as const),
      submit,
    })

    const sub1 = store.listen('doc1').subscribe()
    const sub2 = store.listen('doc1').subscribe()
    await sleep(10)
    sub1.unsubscribe()

    store.mutate([
      {
        type: 'patch',
        id: 'doc1',
        patches: [{path: ['title'], op: {type: 'set', value: 'hello'}}],
      },
    ])
    store.submit()
    await sleep(50)

    expect(submit).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()

    sub2.unsubscribe()
  })
})
