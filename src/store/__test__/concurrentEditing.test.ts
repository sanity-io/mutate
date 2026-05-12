import {describe, expect, test} from 'vitest'

import {at, patch} from '../../mutations/creators'
import {insert, set, setIfMissing} from '../../mutations/operations/creators'
import {createOptimisticStoreInMemoryBackend} from '../optimistic/backend/createOptimisticStoreInMemoryBackend'
import {createOptimisticStore} from '../optimistic/createOptimisticStore'
import {type OptimisticStore} from '../types'
import {collectNotifications, sleep} from './helpers'

const SETTLE_MS = 60

function lastValue<T>(
  notifications: ReturnType<typeof collectNotifications<T>>['notifications'],
): T | undefined {
  for (let i = notifications.length - 1; i >= 0; i--) {
    const n = notifications[i]
    if (n?.kind === 'NEXT') return n.value
  }
  return undefined
}

/**
 * Helper: subscribe to listen(id) and return a cleanup function and the notifications array.
 * Important: A subscription to listen(id) is what activates the store's submit pipeline,
 * so callers should subscribe BEFORE submitting.
 */
function subscribe(store: OptimisticStore, id: string) {
  return collectNotifications(store.listen(id))
}

/**
 * Seed a backend with an initial document. Subscribes on the seeding store so that submit() fires.
 */
async function bootstrap(
  initial: Record<string, unknown> & {_id: string; _type: string},
) {
  const backend = createOptimisticStoreInMemoryBackend()
  const seed = createOptimisticStore(backend)
  const seedObs = subscribe(seed, initial._id)
  seed.mutate([{type: 'createIfNotExists', document: initial}])
  seed.submit()
  // wait for the listener to propagate the created document
  await sleep(SETTLE_MS)
  seedObs.unsubscribe()
  return backend
}

describe('concurrent edits on disjoint fields', () => {
  test('two clients editing different fields converge to the union', async () => {
    const id = 'doc-disjoint'
    const backend = await bootstrap({_id: id, _type: 'demo', title: 'base'})

    const a = createOptimisticStore(backend)
    const b = createOptimisticStore(backend)

    const aObs = subscribe(a, id)
    const bObs = subscribe(b, id)
    await sleep(SETTLE_MS)

    a.mutate([patch(id, at('title', set('from-a')))])
    b.mutate([patch(id, at('subtitle', set('from-b')))])

    a.submit()
    b.submit()

    await sleep(SETTLE_MS)

    expect(lastValue(aObs.notifications)).toMatchObject({
      _id: id,
      title: 'from-a',
      subtitle: 'from-b',
    })
    expect(lastValue(bObs.notifications)).toMatchObject({
      _id: id,
      title: 'from-a',
      subtitle: 'from-b',
    })

    aObs.unsubscribe()
    bObs.unsubscribe()
  })

  test('three clients each editing a separate field all converge', async () => {
    const id = 'doc-three-way'
    const backend = await bootstrap({_id: id, _type: 'demo'})

    const a = createOptimisticStore(backend)
    const b = createOptimisticStore(backend)
    const c = createOptimisticStore(backend)

    const aObs = subscribe(a, id)
    const bObs = subscribe(b, id)
    const cObs = subscribe(c, id)
    await sleep(SETTLE_MS)

    a.mutate([patch(id, at('a', set('A')))])
    b.mutate([patch(id, at('b', set('B')))])
    c.mutate([patch(id, at('c', set('C')))])

    // submit in arbitrary, partially-overlapping order
    b.submit()
    a.submit()
    c.submit()

    await sleep(SETTLE_MS * 2)

    const expected = {_id: id, _type: 'demo', a: 'A', b: 'B', c: 'C'}
    expect(lastValue(aObs.notifications)).toMatchObject(expected)
    expect(lastValue(bObs.notifications)).toMatchObject(expected)
    expect(lastValue(cObs.notifications)).toMatchObject(expected)

    aObs.unsubscribe()
    bObs.unsubscribe()
    cObs.unsubscribe()
  })
})

describe('concurrent edits on the same field', () => {
  test("when client B's edit lands after client A's, the local value is rebased to A's value", async () => {
    const id = 'doc-same-field'
    const backend = await bootstrap({_id: id, _type: 'demo', title: 'base'})

    const a = createOptimisticStore(backend)
    const b = createOptimisticStore(backend)

    const aObs = subscribe(a, id)
    const bObs = subscribe(b, id)
    await sleep(SETTLE_MS)

    // A submits first
    a.mutate([patch(id, at('title', set('A wins')))])
    a.submit()

    await sleep(SETTLE_MS)

    expect(lastValue(aObs.notifications)).toMatchObject({title: 'A wins'})
    expect(lastValue(bObs.notifications)).toMatchObject({title: 'A wins'})

    // B mutates after seeing A's value — setting the same field overwrites
    b.mutate([patch(id, at('title', set('B then')))])
    b.submit()

    await sleep(SETTLE_MS)

    expect(lastValue(aObs.notifications)).toMatchObject({title: 'B then'})
    expect(lastValue(bObs.notifications)).toMatchObject({title: 'B then'})

    aObs.unsubscribe()
    bObs.unsubscribe()
  })

  test('concurrent string edits at non-overlapping positions merge via DMP', async () => {
    // A prepends, B appends. With diff-match-patch string rebasing both edits
    // should survive even though they target the same `text` field.
    const id = 'doc-dmp'
    const backend = await bootstrap({
      _id: id,
      _type: 'demo',
      text: 'hello world',
    })

    const a = createOptimisticStore(backend)
    const b = createOptimisticStore(backend)

    const aObs = subscribe(a, id)
    const bObs = subscribe(b, id)
    await sleep(SETTLE_MS)

    a.mutate([patch(id, at('text', set('A: hello world')))])
    b.mutate([patch(id, at('text', set('hello world!')))])

    a.submit()
    b.submit()

    await sleep(SETTLE_MS * 2)

    expect(lastValue(aObs.notifications)).toMatchObject({
      text: 'A: hello world!',
    })
    expect(lastValue(bObs.notifications)).toMatchObject({
      text: 'A: hello world!',
    })

    aObs.unsubscribe()
    bObs.unsubscribe()
  })
})

describe('concurrent array operations', () => {
  test('two clients appending to the same array preserve both items', async () => {
    const id = 'doc-array'
    const backend = await bootstrap({
      _id: id,
      _type: 'demo',
      items: [{_key: 'k0', value: 'seed'}],
    })

    const a = createOptimisticStore(backend)
    const b = createOptimisticStore(backend)

    const aObs = subscribe(a, id)
    const bObs = subscribe(b, id)
    await sleep(SETTLE_MS)

    a.mutate([
      patch(id, [
        at('items', setIfMissing([])),
        at('items', insert([{_key: 'ka', value: 'from-a'}], 'after', -1)),
      ]),
    ])
    b.mutate([
      patch(id, [
        at('items', setIfMissing([])),
        at('items', insert([{_key: 'kb', value: 'from-b'}], 'after', -1)),
      ]),
    ])

    a.submit()
    b.submit()

    await sleep(SETTLE_MS * 2)

    // Both items should be present along with the seed item, in any order
    expect(lastValue(aObs.notifications)).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({_key: 'k0'}),
        expect.objectContaining({_key: 'ka'}),
        expect.objectContaining({_key: 'kb'}),
      ]),
    })

    aObs.unsubscribe()
    bObs.unsubscribe()
  })
})

describe('multi-document submits', () => {
  test('a single submit covering two documents propagates to both', async () => {
    const backend = createOptimisticStoreInMemoryBackend()
    const store = createOptimisticStore(backend)

    const aObs = subscribe(store, 'multi-a')
    const bObs = subscribe(store, 'multi-b')
    await sleep(SETTLE_MS)

    store.mutate([
      {
        type: 'createIfNotExists',
        document: {_id: 'multi-a', _type: 'demo', n: 1},
      },
      {
        type: 'createIfNotExists',
        document: {_id: 'multi-b', _type: 'demo', n: 2},
      },
    ])
    store.submit()

    await sleep(SETTLE_MS)

    expect(lastValue(aObs.notifications)).toMatchObject({_id: 'multi-a', n: 1})
    expect(lastValue(bObs.notifications)).toMatchObject({_id: 'multi-b', n: 2})

    aObs.unsubscribe()
    bObs.unsubscribe()
  })

  test('mutations to one document do not leak into another document feed', async () => {
    const backend = await bootstrap({_id: 'iso-a', _type: 'demo', val: 'a'})
    // seed iso-b
    {
      const seed = createOptimisticStore(backend)
      const sObs = subscribe(seed, 'iso-b')
      seed.mutate([
        {
          type: 'createIfNotExists',
          document: {_id: 'iso-b', _type: 'demo', val: 'b'},
        },
      ])
      seed.submit()
      await sleep(SETTLE_MS)
      sObs.unsubscribe()
    }

    const store = createOptimisticStore(backend)
    const aObs = subscribe(store, 'iso-a')
    const bObs = subscribe(store, 'iso-b')
    await sleep(SETTLE_MS)

    store.mutate([patch('iso-a', at('val', set('a2')))])
    store.submit()

    await sleep(SETTLE_MS)

    expect(lastValue(aObs.notifications)).toMatchObject({val: 'a2'})
    // iso-b must remain unchanged
    expect(lastValue(bObs.notifications)).toMatchObject({val: 'b'})

    aObs.unsubscribe()
    bObs.unsubscribe()
  })
})

describe('pending mutations rebased while inflight', () => {
  test("a remote mutation arriving while a local mutation is pending rebases the client's local view", async () => {
    const id = 'doc-rebase'
    const backend = await bootstrap({
      _id: id,
      _type: 'demo',
      title: 'base',
      counter: 0,
    })

    const a = createOptimisticStore(backend)
    const b = createOptimisticStore(backend)

    const aObs = subscribe(a, id)
    const bObs = subscribe(b, id)
    await sleep(SETTLE_MS)

    // A has an unsubmitted edit
    a.mutate([patch(id, at('title', set('A-title')))])

    // B submits a concurrent edit on a different field — A's pending mutation
    // should get rebased on top of B's new remote
    b.mutate([patch(id, at('counter', set(42)))])
    b.submit()

    await sleep(SETTLE_MS)

    // A's local view should now show both: its own pending title change and
    // B's already-committed counter
    expect(lastValue(aObs.notifications)).toMatchObject({
      title: 'A-title',
      counter: 42,
    })

    // Now A submits — both clients should converge
    a.submit()
    await sleep(SETTLE_MS)

    expect(lastValue(aObs.notifications)).toMatchObject({
      title: 'A-title',
      counter: 42,
    })
    expect(lastValue(bObs.notifications)).toMatchObject({
      title: 'A-title',
      counter: 42,
    })

    aObs.unsubscribe()
    bObs.unsubscribe()
  })

  test('rapid back-and-forth edits on different fields converge', async () => {
    const id = 'doc-pingpong'
    const backend = await bootstrap({_id: id, _type: 'demo'})

    const a = createOptimisticStore(backend)
    const b = createOptimisticStore(backend)

    const aObs = subscribe(a, id)
    const bObs = subscribe(b, id)
    await sleep(SETTLE_MS)

    for (let i = 0; i < 5; i++) {
      a.mutate([patch(id, at(`a${i}`, set(i)))])
      a.submit()
      await sleep(10)
      b.mutate([patch(id, at(`b${i}`, set(i)))])
      b.submit()
      await sleep(10)
    }

    await sleep(SETTLE_MS * 2)

    const finalA = lastValue(aObs.notifications)
    const finalB = lastValue(bObs.notifications)
    for (let i = 0; i < 5; i++) {
      expect(finalA).toMatchObject({[`a${i}`]: i, [`b${i}`]: i})
      expect(finalB).toMatchObject({[`a${i}`]: i, [`b${i}`]: i})
    }

    aObs.unsubscribe()
    bObs.unsubscribe()
  })
})
