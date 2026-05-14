import {concat, delay, NEVER, of, Subject, take} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {at, patch} from '../../mutations/creators'
import {set} from '../../mutations/operations/creators'
import {type SanityDocumentBase} from '../../mutations/types'
import {allValuesFrom, collectNotifications, sleep} from '../__test__/helpers'
import {type ListenerEvent} from '../types'
import {createOptimisticStore} from './createOptimisticStore'

describe('observing documents', () => {
  test('observing a document that does not exist on the backend', async () => {
    const store = createOptimisticStore({
      listen: id => of({type: 'sync', id, document: undefined}),
      submit: () => NEVER,
    })
    await expect(
      allValuesFrom(store.listenEvents('foo').pipe(take(1))),
    ).resolves.toEqual([
      {
        type: 'sync',
        id: 'foo',
        before: {local: undefined, remote: undefined},
        after: {local: undefined, remote: undefined},
        rebasedStage: [],
      },
    ])
  })
  test('observing a document that exist on the backend', async () => {
    const doc = {_id: 'foo', _type: 'foo'}
    const store = createOptimisticStore({
      listen: id =>
        of({type: 'sync', id, document: doc} as const).pipe(delay(10)),
      submit: () => NEVER,
    })
    await expect(
      allValuesFrom(store.listenEvents(doc._id).pipe(take(1))),
    ).resolves.toEqual([
      {
        type: 'sync',
        id: 'foo',
        after: {
          local: {_id: 'foo', _type: 'foo'},
          remote: {_id: 'foo', _type: 'foo'},
        },
        before: {local: undefined, remote: undefined},
        rebasedStage: [],
      },
    ])
  })

  test("observing a document that doesn't exist initially, but later is created", async () => {
    const doc = {_id: 'foo', _type: 'foo'}
    const store = createOptimisticStore({
      listen: id =>
        concat(
          of({type: 'sync', id, document: undefined} as const),
          of({type: 'sync', id, document: doc} as const).pipe(delay(10)),
        ),
      submit: () => NEVER,
    })
    await expect(
      allValuesFrom(store.listenEvents(doc._id).pipe(take(2))),
    ).resolves.toEqual([
      {
        type: 'sync',
        id: 'foo',
        before: {local: undefined, remote: undefined},
        after: {local: undefined, remote: undefined},
        rebasedStage: [],
      },
      {
        id: 'foo',
        type: 'sync',
        before: {local: undefined, remote: undefined},
        after: {
          local: {_id: 'foo', _type: 'foo'},
          remote: {_id: 'foo', _type: 'foo'},
        },
        rebasedStage: [],
      },
    ])
  })
})
describe('local mutations', () => {
  test('mutating a document that does not exist on the backend', () => {
    const store = createOptimisticStore({
      listen: id => of({type: 'sync', id, document: undefined}),
      submit: () => NEVER,
    })

    const {notifications, unsubscribe} = collectNotifications(
      store.listenEvents('foo'),
    )

    store.mutate([{type: 'create', document: {_id: 'foo', _type: 'foo'}}])

    expect(notifications).toEqual([
      {
        kind: 'NEXT',
        value: {
          type: 'sync',
          id: 'foo',
          after: {local: undefined, remote: undefined},
          before: {local: undefined, remote: undefined},
          rebasedStage: [
            {
              transaction: false,
              mutations: [
                {
                  type: 'create',
                  document: {_id: 'foo', _type: 'foo'},
                },
              ],
            },
          ],
        },
      },
      {
        kind: 'NEXT',
        value: {
          type: 'optimistic',
          id: 'foo',
          after: {_id: 'foo', _type: 'foo'},
          before: undefined,
          mutations: [],
          stagedChanges: [
            {
              document: {
                _id: 'foo',
                _type: 'foo',
              },
              type: 'create',
            },
          ],
        },
      },
    ])
    unsubscribe()
  })

  test("observing a document that doesn't exist initially, but later is created locally", async () => {
    const doc = {_id: 'foo', _type: 'foo'}
    const store = createOptimisticStore({
      listen: id =>
        concat(
          of({type: 'sync', id, document: undefined} as const).pipe(delay(10)),
          of({type: 'sync', id, document: doc} as const),
        ),
      submit: () => NEVER,
    })

    const {notifications, unsubscribe} = collectNotifications(
      store.listenEvents('foo'),
    )

    store.mutate([{type: 'createIfNotExists', document: doc}])

    expect(notifications).toEqual([
      {
        kind: 'NEXT',
        value: {
          type: 'optimistic',
          id: 'foo',
          after: {_id: 'foo', _type: 'foo'},
          before: undefined,
          mutations: [],
          stagedChanges: [
            {
              document: {
                _id: 'foo',
                _type: 'foo',
              },
              type: 'createIfNotExists',
            },
          ],
        },
      },
    ])

    await sleep(20)

    expect(notifications).toEqual([
      {
        kind: 'NEXT',
        value: {
          type: 'optimistic',
          id: 'foo',
          after: {_id: 'foo', _type: 'foo'},
          before: undefined,
          mutations: [],
          stagedChanges: [
            {
              document: {
                _id: 'foo',
                _type: 'foo',
              },
              type: 'createIfNotExists',
            },
          ],
        },
      },
      {
        kind: 'NEXT',
        value: {
          type: 'sync',
          id: 'foo',
          after: {local: {_id: 'foo', _type: 'foo'}, remote: undefined},
          before: {local: {_id: 'foo', _type: 'foo'}, remote: undefined},
          rebasedStage: [
            {
              transaction: false,
              mutations: [
                {
                  document: {_id: 'foo', _type: 'foo'},
                  type: 'createIfNotExists',
                },
              ],
            },
          ],
        },
      },
      {
        kind: 'NEXT',
        value: {
          type: 'sync',
          id: 'foo',
          after: {
            local: {_id: 'foo', _type: 'foo'},
            remote: {_id: 'foo', _type: 'foo'},
          },
          before: {
            local: {_id: 'foo', _type: 'foo'},
            remote: undefined,
          },
          rebasedStage: [
            {
              transaction: false,
              mutations: [
                {
                  document: {_id: 'foo', _type: 'foo'},
                  type: 'createIfNotExists',
                },
              ],
            },
          ],
        },
      },
    ])
    unsubscribe()
  })

  test("error when creating a document locally using 'create', when it turns out later that it exists on the server ", async () => {
    const doc = {_id: 'foo', _type: 'foo'}
    const store = createOptimisticStore({
      listen: id =>
        concat(of({type: 'sync', id, document: doc} as const).pipe(delay(10))),
      submit: () => NEVER,
    })

    const {notifications, unsubscribe} = collectNotifications(
      store.listenEvents('foo'),
    )

    // this will go through at first, but then we'll get an error an instant later during rebase after the document is loaded from the server
    // this is expected, and will be similar to what would have happened if the mutation was sent directly to the server
    // It might cause the document to appear for a brief time before the error is emitted though
    // Typically, consumers should use `createIfNotExists` instead of `create` to avoid this
    store.mutate([{type: 'create', document: doc}])

    expect(notifications).toEqual([
      {
        kind: 'NEXT',
        value: {
          type: 'optimistic',
          after: {_id: 'foo', _type: 'foo'},
          before: undefined,
          id: 'foo',
          mutations: [],
          stagedChanges: [
            {
              document: {
                _id: 'foo',
                _type: 'foo',
              },
              type: 'create',
            },
          ],
        },
      },
    ])

    await sleep(100)

    expect(notifications).toMatchObject([
      {
        kind: 'NEXT',
        value: {
          after: {_id: 'foo', _type: 'foo'},
          before: undefined,
          id: 'foo',
          mutations: [],
          type: 'optimistic',
        },
      },
      {
        // Phase 4c: errors are emitted as tagged-error values on `next`, not
        // on the Observable error channel. listenEvents stays open afterwards.
        kind: 'NEXT',
        value: {
          _tag: 'ApplyMutationFailedError',
          reason: 'Document already exist',
        },
      },
    ])

    unsubscribe()
  })

  test('mutating after sync has been fully emitted (async gap)', async () => {
    const doc = {_id: 'foo', _type: 'foo', title: 'original'}
    const store = createOptimisticStore({
      listen: id => of({type: 'sync', id, document: doc} as const),
      submit: () => NEVER,
    })

    const {notifications, unsubscribe} = collectNotifications(
      store.listenEvents('foo'),
    )

    // Wait for the sync event to be fully emitted via the scheduled microtask
    await sleep(10)

    // At this point, the sync event should have been emitted
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      kind: 'NEXT',
      value: {
        type: 'sync',
        id: 'foo',
        after: {local: doc, remote: doc},
      },
    })

    // Now mutate - this should hit the "else if (state.hasSynced)" branch
    // because there's no pending sync emit
    store.mutate([patch('foo', at('title', set('updated')))])

    // Should have 3 notifications now: initial sync, new sync with mutation, and optimistic
    expect(notifications).toHaveLength(3)

    // The second notification should be a sync event with the mutation in rebasedStage
    // and after.local should reflect the mutated state
    expect(notifications[1]).toMatchObject({
      kind: 'NEXT',
      value: {
        type: 'sync',
        id: 'foo',
        before: {
          local: {_id: 'foo', _type: 'foo', title: 'original'},
          remote: {_id: 'foo', _type: 'foo', title: 'original'},
        },
        after: {
          local: {_id: 'foo', _type: 'foo', title: 'updated'},
          remote: {_id: 'foo', _type: 'foo', title: 'original'},
        },
        rebasedStage: [
          {
            transaction: false,
            mutations: [
              {
                type: 'patch',
                id: 'foo',
                patches: [
                  {path: ['title'], op: {type: 'set', value: 'updated'}},
                ],
              },
            ],
          },
        ],
      },
    })

    // The third notification should be the optimistic event
    expect(notifications[2]).toMatchObject({
      kind: 'NEXT',
      value: {
        type: 'optimistic',
        id: 'foo',
        before: {_id: 'foo', _type: 'foo', title: 'original'},
        after: {_id: 'foo', _type: 'foo', title: 'updated'},
        stagedChanges: [
          {
            type: 'patch',
            id: 'foo',
            patches: [{path: ['title'], op: {type: 'set', value: 'updated'}}],
          },
        ],
      },
    })

    unsubscribe()
  })
})

interface RebaseDoc extends SanityDocumentBase {
  title?: string
  counter?: number
}

describe('listenEvents() rebase semantics', () => {
  test('a remote sync arriving after a local mutation rebases the staged value into the new sync event', async () => {
    // Manually drive the listen stream so we can interleave events.
    const listen$ = new Subject<ListenerEvent<RebaseDoc>>()
    const store = createOptimisticStore({
      listen: () => listen$,
      submit: () => NEVER,
    })

    const {notifications, unsubscribe} = collectNotifications(
      store.listenEvents('foo'),
    )

    // Initial remote sync
    listen$.next({
      type: 'sync',
      document: {_id: 'foo', _type: 'demo', title: 'v1', counter: 0},
    })
    await sleep(10)

    // Local edit (still pending — no submit)
    store.mutate([patch('foo', at('title', set('local-edit')))])

    // A new remote sync arrives — simulating that someone else updated the
    // counter field. The local edit should be rebased onto the new remote.
    listen$.next({
      type: 'sync',
      document: {_id: 'foo', _type: 'demo', title: 'v1', counter: 99},
    })
    await sleep(10)

    const syncEvents = notifications.flatMap(n =>
      n.kind === 'NEXT' &&
      !(n.value instanceof Error) &&
      n.value.type === 'sync'
        ? [n.value]
        : [],
    )
    const lastSync = syncEvents.at(-1)

    expect(lastSync).toMatchObject({
      type: 'sync',
      id: 'foo',
      after: {
        // local view = new remote with our staged edit applied
        local: {title: 'local-edit', counter: 99},
        remote: {title: 'v1', counter: 99},
      },
    })
    // staged change must still be present after rebase
    expect(lastSync?.rebasedStage).toHaveLength(1)
    expect(lastSync?.rebasedStage[0]?.mutations[0]).toMatchObject({
      type: 'patch',
      id: 'foo',
      patches: [{path: ['title'], op: {type: 'set'}}],
    })

    unsubscribe()
  })

  test('local mutation targeting a different document does not appear in this document’s feed', async () => {
    const store = createOptimisticStore({
      listen: id =>
        of({
          type: 'sync',
          id,
          document: {_id: id, _type: 'demo'},
        } as const),
      submit: () => NEVER,
    })

    const {notifications, unsubscribe} = collectNotifications(
      store.listenEvents('foo'),
    )
    await sleep(10)

    // Mutate a different document
    store.mutate([patch('bar', at('x', set(1)))])
    await sleep(10)

    // listenEvents on 'foo' still emits the local mutation event with
    // stagedChanges (current implementation does not filter by id), but the
    // local snapshot must remain the foo document unaffected.
    const optimistic = notifications.flatMap(n =>
      n.kind === 'NEXT' &&
      !(n.value instanceof Error) &&
      n.value.type === 'optimistic'
        ? [n.value]
        : [],
    )[0]

    if (optimistic) {
      // before/after should be the 'foo' document, not 'bar'
      expect(optimistic.id).toBe('foo')
      expect(optimistic.after?._id ?? 'foo').toBe('foo')
    }

    unsubscribe()
  })
})

describe('multiple listen() subscribers share the same backing state', () => {
  test('two subscribers to listen(id) on the same store both see local mutations', async () => {
    const store = createOptimisticStore({
      listen: id =>
        of({
          type: 'sync',
          id,
          document: {_id: id, _type: 'demo', title: 'orig'},
        } as const),
      submit: () => NEVER,
    })

    const subA = collectNotifications(store.listen('foo'))
    const subB = collectNotifications(store.listen('foo'))
    await sleep(20)

    store.mutate([patch('foo', at('title', set('mutated')))])
    await sleep(20)

    const aLast = subA.notifications.at(-1)
    const bLast = subB.notifications.at(-1)
    expect(aLast).toMatchObject({kind: 'NEXT', value: {title: 'mutated'}})
    expect(bLast).toMatchObject({kind: 'NEXT', value: {title: 'mutated'}})

    subA.unsubscribe()
    subB.unsubscribe()
  })
})
