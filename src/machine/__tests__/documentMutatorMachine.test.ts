import {
  type ListenEvent,
  type MutationEvent,
  type SanityClient,
} from '@sanity/client'
import {concat, delay, type Observable, of} from 'rxjs'
import {describe, expect, test, vi} from 'vitest'
import {createActor, waitFor} from 'xstate'

import {documentMutatorMachine} from '../documentMutatorMachine'
import {
  expected,
  initialSnapshot,
  middleSnapshot,
  mutationEvents,
} from './mendozaFixtures'

const id = 'foo'
const createFakeClient = (
  document:
    | Record<string, unknown>
    | undefined
    | Promise<Record<string, unknown> | undefined> = undefined,
  observer: Observable<ListenEvent<Record<string, unknown>>> = of({
    type: 'welcome',
    listenerName: 'xyz',
  }),
) => {
  const client = {
    getDocument: vi.fn().mockImplementation(() => Promise.resolve(document)),
    listen: vi.fn().mockImplementation(() => observer),
  } satisfies Pick<SanityClient, 'listen' | 'getDocument'>
  Object.assign(client, {withConfig: () => client})
  return client as unknown as SanityClient
}

describe.runIf('withResolvers' in Promise)('observing documents', () => {
  test('observing a document that does not exist on the backend', async () => {
    const client = createFakeClient()

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()
    const {context} = await waitFor(actor, state => state.hasTag('ready'))
    expect(context).toMatchObject({
      id,
      local: undefined,
      remote: undefined,
    })
  })

  test('observing a document that exist on the backend', async () => {
    const doc = {_id: id, _type: 'foo'}
    const client = createFakeClient(doc)

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()
    const {context} = await waitFor(actor, state => state.hasTag('ready'))
    expect(context).toMatchObject({id, local: doc, remote: doc})
  })

  test("observing a document that doesn't exist initially, but later is created", async () => {
    const doc = {_id: id, _type: 'foo'}
    const client = createFakeClient(
      undefined,
      concat(
        of({type: 'welcome' as const, listenerName: 'xyz'}),
        of({
          type: 'mutation' as const,
          eventId: `tc4gfghO54pOTXYCOfNgyx#${id}`,
          documentId: id,
          transactionId: 'tc4gfghO54pOTXYCOfNgyx',
          transition: 'appear' as const,
          identity: 'p-Zl6P1Ubthnhn',
          resultRev: 'tc4gfghO54pOTXYCOfNgyx',
          timestamp: '2024-09-02T21:53:01.625426111Z',
          visibility: 'transaction' as const,
          mutations: [],
          effects: {
            apply: [
              0,
              {
                ...doc,
                _createdAt: '2024-09-02T21:53:01Z',
                _updatedAt: '2024-09-02T21:53:01Z',
              },
            ],
            revert: [0, null],
          },
          transactionCurrentEvent: 1,
          transactionTotalEvents: 1,
        }).pipe(delay(10)),
      ),
    )

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()

    const {context} = await waitFor(
      actor,
      state => state.hasTag('ready') && state.context.remote !== undefined,
    )
    expect(context).toMatchObject({id, local: doc, remote: doc})
  })

  test("observing a document that doesn't exist initially, but later is created, much much later", async () => {
    const doc = {_id: id, _type: 'foo'}
    const client = createFakeClient()

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()

    await waitFor(actor, state => state.hasTag('ready'))

    actor.send({
      type: 'mutation' as const,
      eventId: `tc4gfghO54pOTXYCOfNgyx#${id}`,
      documentId: id,
      transactionId: 'tc4gfghO54pOTXYCOfNgyx',
      transition: 'appear' as const,
      identity: 'p-Zl6P1Ubthnhn',
      resultRev: 'tc4gfghO54pOTXYCOfNgyx',
      timestamp: '2024-09-02T21:53:01.625426111Z',
      visibility: 'transaction' as const,
      mutations: [],
      effects: {
        apply: [
          0,
          {
            ...doc,
            _createdAt: '2024-09-02T21:53:01Z',
            _updatedAt: '2024-09-02T21:53:01Z',
          },
        ],
        revert: [0, null],
      },
      transactionCurrentEvent: 1,
      transactionTotalEvents: 1,
    })

    const {context} = await waitFor(
      actor,
      state => state.context.remote !== undefined,
    )
    expect(context).toMatchObject({id, local: doc, remote: doc})
  })

  test("observing a document that doesn't exist initially, but is created before the document is fetched", async () => {
    const doc = {_id: id, _type: 'foo'}
    const {resolve, promise} = Promise.withResolvers<undefined>()
    const client = createFakeClient(promise)

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()

    await waitFor(actor, state => state.matches('connected'))

    // Send the mutation event before resolving the document promise
    actor.send({
      type: 'mutation' as const,
      eventId: `tc4gfghO54pOTXYCOfNgyx#${id}`,
      documentId: id,
      transactionId: 'tc4gfghO54pOTXYCOfNgyx',
      transition: 'appear' as const,
      identity: 'p-Zl6P1Ubthnhn',
      resultRev: 'tc4gfghO54pOTXYCOfNgyx',
      timestamp: '2024-09-02T21:53:01.625426111Z',
      visibility: 'transaction' as const,
      mutations: [],
      effects: {
        apply: [
          0,
          {
            ...doc,
            _createdAt: '2024-09-02T21:53:01Z',
            _updatedAt: '2024-09-02T21:53:01Z',
          },
        ],
        revert: [0, null],
      },
      transactionCurrentEvent: 1,
      transactionTotalEvents: 1,
    })
    await waitFor(actor, state => state.context.mutationEvents.length === 1)
    resolve(undefined)

    const {context} = await waitFor(actor, state => state.hasTag('ready'))

    expect(context).toMatchObject({id, local: doc, remote: doc})
  })
})
describe('local mutations', () => {
  test('mutating a document that does not exist on the backend', async () => {
    const client = createFakeClient()

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()
    await waitFor(actor, state => state.hasTag('ready'))

    actor.send({
      type: 'mutate',
      mutations: [{type: 'create', document: {_id: id, _type: 'foo'}}],
    })
    const {context} = await waitFor(actor, state =>
      state.matches({connected: {loaded: 'dirty'}}),
    )
    expect(context).toMatchObject({
      id,
      local: {_id: id, _type: 'foo'},
      remote: undefined,
      stagedChanges: [
        {
          transaction: false,
          mutations: [
            {
              type: 'create',
              document: {_id: id, _type: 'foo'},
            },
          ],
        },
      ],
    })
  })

  test("observing a document that doesn't exist initially, but later is created locally", async () => {
    const doc = {_id: id, _type: 'foo'}
    const client = createFakeClient()

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()

    // Wait for initial remote snapshot fetch to resolve
    await waitFor(actor, state => state.hasTag('ready'))

    // Optimistically create a document locally
    actor.send({
      type: 'mutate',
      mutations: [{type: 'createIfNotExists', document: doc}],
    })

    // Wait for mutations to be staged
    expect(
      (
        await waitFor(actor, state =>
          state.matches({connected: {loaded: 'dirty'}}),
        )
      ).context,
    ).toMatchObject({
      id,
      local: {_id: 'foo', _type: 'foo'},
      remote: undefined,
      stagedChanges: [
        {
          transaction: false,
          mutations: [
            {
              type: 'createIfNotExists',
              document: {_id: 'foo', _type: 'foo'},
            },
          ],
        },
      ],
    })

    // Simulate a mendoza creation event from the server
    actor.send({
      type: 'mutation' as const,
      eventId: `tc4gfghO54pOTXYCOfNgyx#${id}`,
      documentId: id,
      transactionId: 'tc4gfghO54pOTXYCOfNgyx',
      transition: 'appear' as const,
      identity: 'p-Zl6P1Ubthnhn',
      resultRev: 'tc4gfghO54pOTXYCOfNgyx',
      timestamp: '2024-09-02T21:53:01.625426111Z',
      visibility: 'transaction' as const,
      mutations: [],
      effects: {
        apply: [
          0,
          {
            ...doc,
            _createdAt: '2024-09-02T21:53:01Z',
            _updatedAt: '2024-09-02T21:53:01Z',
          },
        ],
        revert: [0, null],
      },
      transactionCurrentEvent: 1,
      transactionTotalEvents: 1,
    })

    expect(
      (await waitFor(actor, state => state.context.remote !== undefined))
        .context,
    ).toMatchObject({
      id,
      local: {
        _id: 'foo',
        _type: 'foo',
        _createdAt: '2024-09-02T21:53:01Z',
        _updatedAt: '2024-09-02T21:53:01Z',
      },
      remote: {
        ...doc,
        _createdAt: '2024-09-02T21:53:01Z',
        _updatedAt: '2024-09-02T21:53:01Z',
      },
      stagedChanges: [
        {
          transaction: false,
          mutations: [
            {
              type: 'createIfNotExists',
              document: {_id: 'foo', _type: 'foo'},
            },
          ],
        },
      ],
    })
  })

  test("error when creating a document locally using 'create', when it turns out later that it exists on the server ", async () => {
    expect.hasAssertions()
    const doc = {_id: id, _type: 'foo'}
    const {resolve, promise} = Promise.withResolvers<typeof doc>()
    const client = createFakeClient(promise)

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()

    // this will go through at first, but then we'll get an error an instant later during rebase after the document is loaded from the server
    // this is expected, and will be similar to what would have happened if the mutation was sent directly to the server
    // It might cause the document to appear for a brief time before the error is emitted though
    // Typically, consumers should use `createIfNotExists` instead of `create` to avoid this
    actor.send({
      type: 'mutate',
      mutations: [{type: 'create', document: doc}],
    })

    // resolve the document promise, which should trigger the error later
    resolve(doc)

    try {
      // awaiting should trigger an error
      await waitFor(actor, state => state.hasTag('ready'))
    } catch (err) {
      expect(err).toMatchInlineSnapshot(`[Error: Document already exist]`)
    }
  })
})

describe('remote mutations', () => {
  test('it applies mendoza patches correctly', async () => {
    const {resolve, promise} = Promise.withResolvers<typeof initialSnapshot>()
    const client = createFakeClient(promise)

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()

    // Wait for the observer to emit welcome
    await waitFor(actor, s => s.matches('connected'))

    // Replay all mendoza events
    for (const mutationEvent of mutationEvents) {
      actor.send(mutationEvent as unknown as MutationEvent)
    }

    // Resolve the initial snapshot, it should match the `expected` snapshot
    resolve(initialSnapshot)

    const {context} = await waitFor(actor, s => s.hasTag('ready'))

    expect(context.remote).toStrictEqual(expected)
  })

  test('it handles skipping mendoza patches that are already applied', async () => {
    const {resolve, promise} = Promise.withResolvers<typeof middleSnapshot>()
    const client = createFakeClient(promise)

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()

    // Wait for the observer to emit welcome
    await waitFor(actor, s => s.matches('connected'))

    // Replay all mendoza events, if none are filtered out, the test will fail
    for (const mutationEvent of mutationEvents) {
      actor.send(mutationEvent as unknown as MutationEvent)
    }

    // Resolve the middle snapshot, it should match the `expected` snapshot even though some patches were ignored
    resolve(middleSnapshot)

    const {context} = await waitFor(actor, s => s.hasTag('ready'))

    expect(context.remote).toStrictEqual(expected)
  })

  test('it handles a document that is created after the initial snapshot', async () => {
    const {resolve, promise} = Promise.withResolvers<undefined>()
    const client = createFakeClient(promise)

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()

    // Wait for the observer to emit welcome
    await waitFor(actor, s => s.matches('connected'))

    // Emulate case where a document does not exist yet
    resolve(undefined)

    await waitFor(actor, s => s.hasTag('ready'))

    // Apply mendoza patch for the document creation
    actor.send({
      type: 'mutation',
      eventId: 'P1yh4PWg0YACD6zrezLfAJ#shoe-a',
      documentId: 'shoe-a',
      transactionId: 'P1yh4PWg0YACD6zrezLfAJ',
      transition: 'appear',
      identity: 'p-Zl6P1Ubthnhn',
      resultRev: 'P1yh4PWg0YACD6zrezLfAJ',
      timestamp: '2024-08-15T22:34:29.209906232Z',
      visibility: 'transaction',
      effects: {
        apply: [
          0,
          {
            _createdAt: '2024-08-15T22:34:29Z',
            _id: 'shoe-a',
            _type: 'shoe',
            _updatedAt: '2024-08-15T22:34:29Z',
            name: 'Foo',
          },
        ],
        revert: [0, null],
      },
      transactionCurrentEvent: 1,
      transactionTotalEvents: 1,
    } as unknown as MutationEvent)

    const {context} = await waitFor(actor, s => s.hasTag('ready'))

    expect(context.remote).toStrictEqual({
      _createdAt: '2024-08-15T22:34:29Z',
      _id: 'shoe-a',
      _rev: 'P1yh4PWg0YACD6zrezLfAJ',
      _type: 'shoe',
      _updatedAt: '2024-08-15T22:34:29Z',
      name: 'Foo',
    })
  })

  test('it handles disappearing documents', async () => {
    const snapshot = {
      _createdAt: '2024-08-15T22:52:23Z',
      _id: 'shoe-a',
      _type: 'shoe',
      _updatedAt: '2024-08-15T22:52:23Z',
      model: {_type: 'airmax'},
      name: 'Test',
    } as const
    const {resolve, promise} = Promise.withResolvers<typeof snapshot>()
    const client = createFakeClient(promise)

    const actor = createActor(documentMutatorMachine, {
      input: {client, id},
    }).start()

    // Wait for the observer to emit welcome
    await waitFor(actor, s => s.matches('connected'))

    resolve(snapshot)

    await waitFor(actor, s => s.hasTag('ready'))

    // Apply mendoza patch for the document deletion
    actor.send({
      type: 'mutation',
      eventId: 'P1yh4PWg0YACD6zrezM77i#shoe-a',
      documentId: 'shoe-a',
      transactionId: 'P1yh4PWg0YACD6zrezM77i',
      transition: 'disappear',
      identity: 'p-Zl6P1Ubthnhn',
      previousRev: 'SsKAgT2uMjbvUYECwj5WPZ',
      resultRev: 'P1yh4PWg0YACD6zrezM77i',
      timestamp: '2024-08-15T22:52:55.830602676Z',
      visibility: 'transaction',
      effects: {
        apply: [0, null],
        revert: [
          0,
          {
            _createdAt: '2024-08-15T22:52:23Z',
            _id: 'shoe-a',
            _type: 'shoe',
            _updatedAt: '2024-08-15T22:52:23Z',
            model: {_type: 'airmax'},
            name: 'Test',
          },
        ],
      },
      transactionCurrentEvent: 1,
      transactionTotalEvents: 1,
    } as unknown as MutationEvent)

    const {context} = await waitFor(actor, s => s.hasTag('ready'))

    // @TODO hmmmm, it's not ideal that `null` and `undefined` are used interchangeably
    expect(context.local).toBe(undefined)
    expect(context.remote).toBe(null)
  })
})
