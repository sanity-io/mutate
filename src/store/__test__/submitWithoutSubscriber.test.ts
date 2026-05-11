import {of} from 'rxjs'
import {describe, expect, test, vi} from 'vitest'

import {createOptimisticStore} from '../optimistic/createOptimisticStore'
import {sleep} from './helpers'

describe('regression: submit() without an active listen() subscriber', () => {
  /**
   * Bug: `createOptimisticStoreInternal` wires the backend submit pipeline
   * inside the `listen(id)` observable. The `submitRequests` stream is
   * declared at module-scope, but it is multicast with a plain `share()` and
   * is only kept alive by an active subscriber to `listen(id)` (or transitively
   * via `submitRequests` itself, which has no external subscribers).
   *
   * Result: if a caller does `store.mutate([...])` then `store.submit()` and
   * has not subscribed to `store.listen(...)` (or has unsubscribed before the
   * submit), the call to `backend.submit` is silently dropped. The mutations
   * stay in the local pending buffer forever.
   *
   * The expected behaviour is that calling `submit()` always flushes pending
   * mutations to the backend, regardless of who is listening.
   *
   * Marked .fails so the suite stays green until this is addressed; flip back
   * to a normal `test(...)` once the bug is fixed.
   */
  test.fails(
    'mutations are sent to backend.submit even when nothing is subscribed to listen()',
    async () => {
      const submit = vi.fn().mockReturnValue(of({}))
      const store = createOptimisticStore({
        listen: id =>
          of({type: 'sync', id, document: {_id: id, _type: 'test'}} as const),
        submit,
      })

      // Note: deliberately NOT subscribing to store.listen(...) or
      // store.listenEvents(...) before calling submit().
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
    },
  )

  /**
   * Variant: even subscribing to `listenEvents()` (which most consumers think
   * of as the "richer" subscription) is not enough — only `listen()` activates
   * the submit pipeline. This is surprising and should be documented or fixed.
   */
  test.fails(
    'listenEvents() subscriber alone is enough to keep the submit pipeline alive',
    async () => {
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

      expect(submit).toHaveBeenCalledTimes(1)
      sub.unsubscribe()
    },
  )

  /**
   * Variant: unsubscribing before submit() also drops the submission, because
   * the share() ref-count drops to zero and the pipeline tears down.
   */
  test.fails(
    'mutations submitted after the last listen() subscriber unsubscribes are still sent',
    async () => {
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

      expect(submit).toHaveBeenCalledTimes(1)
    },
  )
})
