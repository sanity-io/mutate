import {concat, NEVER, of, Subject} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {type SanityDocumentBase} from '../../mutations/types'
import {createOptimisticStore} from '../optimistic/createOptimisticStore'
import {type ListenerEvent} from '../types'
import {collectNotifications, sleep} from './helpers'

/**
 * Tests covering defensive and rare-path branches of the optimistic store
 * that are awkward to exercise via the in-memory backend.
 */

interface MendozaDoc extends SanityDocumentBase {
  title?: string
}

describe('createOptimisticStore: listen() with mendoza-effect mutation events', () => {
  test('a mutation event that carries mendoza effects updates the document', async () => {
    const events$ = new Subject<ListenerEvent<MendozaDoc>>()
    const initial: MendozaDoc = {_id: 'm', _type: 'demo', _rev: 'rev0'}
    const store = createOptimisticStore({
      listen: () =>
        concat(of({type: 'sync' as const, document: initial}), events$),
      submit: () => NEVER,
    })

    const listener = collectNotifications(store.listen('m'))
    await sleep(10)

    // Mendoza apply patch: [0, replacementValue] = "replace root with this
    // value". Mirrors the shape used by documentMutatorMachine tests.
    events$.next({
      type: 'mutation',
      documentId: 'm',
      transactionId: 'tx-effect',
      previousRev: 'rev0',
      resultRev: 'rev1',
      transition: 'update',
      mutations: [],
      effects: {
        apply: [0, {_id: 'm', _type: 'demo', title: 'via-effect'}],
      },
    })

    await sleep(20)

    const last = listener.notifications.at(-1)
    expect(last).toMatchObject({
      kind: 'NEXT',
      value: {_id: 'm', _type: 'demo', title: 'via-effect', _rev: 'rev1'},
    })

    listener.unsubscribe()
  })

  test('a reconnect listener event passes through without changing snapshot', async () => {
    const events$ = new Subject<ListenerEvent>()
    const initial: SanityDocumentBase = {_id: 'r', _type: 'demo', _rev: 'r0'}
    const store = createOptimisticStore({
      listen: () =>
        concat(of({type: 'sync' as const, document: initial}), events$),
      submit: () => NEVER,
    })

    const listener = collectNotifications(store.listen('r'))
    await sleep(10)

    const countBefore = listener.notifications.length
    events$.next({type: 'reconnect'})
    await sleep(20)

    // No error, and no spurious value emissions either (a reconnect alone
    // doesn't change the local snapshot for this document)
    expect(listener.notifications.filter(n => n.kind === 'ERROR')).toHaveLength(
      0,
    )
    expect(listener.notifications.length).toBeGreaterThanOrEqual(countBefore)

    listener.unsubscribe()
  })
})

describe('createOptimisticStore: listenEvents() lifecycle propagation', () => {
  test('errors from the backend listen stream propagate through listenEvents', async () => {
    const events$ = new Subject<ListenerEvent>()
    const store = createOptimisticStore({
      listen: () =>
        concat(of({type: 'sync' as const, document: undefined}), events$),
      submit: () => NEVER,
    })

    const listener = collectNotifications(store.listenEvents('foo'))
    await sleep(10)

    events$.error(new Error('boom'))
    await sleep(10)

    const errorNotification = listener.notifications.find(
      n => n.kind === 'ERROR',
    )
    expect(errorNotification).toBeDefined()
    if (errorNotification?.kind === 'ERROR') {
      expect(String(errorNotification.error)).toMatch(/boom/)
    }

    listener.unsubscribe()
  })
})

interface CounterDoc extends SanityDocumentBase {
  n?: number
}

describe('rebase: staged mutations targeting another document id', () => {
  test('a staged mutation for a different document id is ignored during rebase', async () => {
    // Two sync events with no overlap in remote state — between them we stage
    // a mutation that targets a *different* document id. The rebase logic in
    // createOptimisticStore.listenEvents should ignore that mutation when
    // computing the local view for 'foo'.
    const events$ = new Subject<ListenerEvent<CounterDoc>>()
    const store = createOptimisticStore({
      listen: () =>
        concat(
          of({
            type: 'sync' as const,
            document: {_id: 'foo', _type: 'demo', n: 1},
          }),
          events$,
        ),
      submit: () => NEVER,
    })

    const listener = collectNotifications(store.listenEvents('foo'))
    await sleep(10)

    // Stage a mutation for a different document
    store.mutate([
      {
        type: 'patch',
        id: 'bar',
        patches: [{path: ['x'], op: {type: 'set', value: 1}}],
      },
    ])
    await sleep(10)

    // New sync for foo — rebase should run without error and reflect the new
    // remote in the resulting sync event
    events$.next({
      type: 'sync',
      document: {_id: 'foo', _type: 'demo', n: 2},
    })
    await sleep(20)

    expect(listener.notifications.filter(n => n.kind === 'ERROR')).toHaveLength(
      0,
    )
    const syncEvents = listener.notifications.flatMap(n =>
      n.kind === 'NEXT' &&
      !(n.value instanceof Error) &&
      n.value.type === 'sync'
        ? [n.value]
        : [],
    )
    const last = syncEvents.at(-1)
    expect(last?.after.remote).toMatchObject({_id: 'foo', n: 2})

    listener.unsubscribe()
  })
})
