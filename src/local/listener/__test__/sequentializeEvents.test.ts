import {from, lastValueFrom} from 'rxjs'
import {toArray} from 'rxjs/operators'
import {expect, test} from 'vitest'

import {
  type SanityDocumentBase,
  type SanityMutation,
} from '../../../encoders/sanity'
import {type ListenerEvent, type ListenerMutationEvent} from '../../types'
import {DeadlineExceededError, MaxBufferExceededError} from '../errors'
import {sequentializeListenerEvents} from '../sequentializeListenerEvents'

interface TestDoc extends SanityDocumentBase {
  name?: string
}
function mutationEvent({
  previousRev,
  resultRev,
  mutations,
}: {
  previousRev: string
  resultRev: string
  mutations: SanityMutation<TestDoc>[]
}) {
  return {
    type: 'mutation',
    documentId: 'test',
    transactionId: resultRev,
    effects: {apply: []},
    mutations,
    previousRev: previousRev,
    resultRev: resultRev,
    transition: 'update',
    identity: 'someone',
    transactionCurrentEvent: 1,
    transactionTotalEvents: 1,
    visibility: 'transaction',
  } satisfies ListenerMutationEvent
}

test("it accumulates events that doesn't apply in a chain starting at the current head revision", async () => {
  const events = from([
    {
      type: 'sync',
      document: {
        _rev: 'one',
        _id: 'test',
        _type: 'test',
        name: 'initial',
        _createdAt: '2024-10-02T06:40:16.414Z',
        _updatedAt: '2024-10-02T06:40:16.414Z',
      },
    },
    // this has the sync revision as it's previous and should be passed on as-is
    mutationEvent({
      previousRev: 'one',
      resultRev: 'two',
      mutations: [{patch: {id: 'test', set: {name: 'OK'}}}],
    }),
    // this is part of an unbroken chain, but received out of order
    mutationEvent({
      previousRev: 'four',
      resultRev: 'five',
      mutations: [{patch: {id: 'test', set: {name: 'Out of order'}}}],
    }),
    // this is part of an unbroken chain, but received out of order
    mutationEvent({
      previousRev: 'three',
      resultRev: 'four',
      mutations: [{patch: {id: 'test', set: {name: 'Out of order'}}}],
    }),
    // we have a complete unbroken chain when receiving this
    mutationEvent({
      previousRev: 'two',
      resultRev: 'three',
      mutations: [{patch: {id: 'test', set: {name: 'Out of order'}}}],
    }),
  ] satisfies ListenerEvent<TestDoc>[])

  expect(
    (
      await lastValueFrom(events.pipe(sequentializeListenerEvents(), toArray()))
    ).map(event => {
      return [
        event.type,
        event.type === 'mutation'
          ? event.previousRev
          : event.type === 'sync'
            ? event.document?._rev
            : null,
      ]
    }),
  ).toEqual([
    ['sync', 'one'],
    ['mutation', 'one'],
    ['mutation', 'two'],
    ['mutation', 'three'],
    ['mutation', 'four'],
  ])
})

test('it ignores events already applied to the current head revision', async () => {
  const events = from([
    {
      type: 'sync',
      document: {
        _rev: 'one',
        _id: 'test',
        _type: 'test',
        name: 'initial',
        _createdAt: '2024-10-02T06:40:16.414Z',
        _updatedAt: '2024-10-02T06:40:16.414Z',
      },
    },
    // this is already applied to the sync emitted above and should be ignored
    mutationEvent({
      previousRev: 'minus-one',
      resultRev: 'zero',
      mutations: [{patch: {id: 'test', set: {name: 'SHOULD BE IGNORED'}}}],
    }),
    // this is already applied to the sync emitted above and should be ignored
    mutationEvent({
      previousRev: 'zero',
      resultRev: 'one',
      mutations: [{patch: {id: 'test', set: {name: 'SHOULD ALSO BE IGNORED'}}}],
    }),
    // this has the sync revision as it's previous and should be applied
    mutationEvent({
      previousRev: 'one',
      resultRev: 'two',
      mutations: [{patch: {id: 'test', set: {name: 'SHOULD BE APPLIED'}}}],
    }),
  ] satisfies ListenerEvent<TestDoc>[])

  expect(
    (
      await lastValueFrom(events.pipe(sequentializeListenerEvents(), toArray()))
    ).map(event => {
      return event?.type === 'mutation' ? event.mutations : event?.type
    }),
  ).toEqual(['sync', [{patch: {id: 'test', set: {name: 'SHOULD BE APPLIED'}}}]])
})

test('it throws an MaxBufferExceededError if the buffer exceeds `maxBuffer`', async () => {
  const events = from([
    {
      type: 'sync',
      document: {
        _rev: 'one',
        _id: 'test',
        _type: 'test',
        name: 'initial',
        _createdAt: '2024-10-02T06:40:16.414Z',
        _updatedAt: '2024-10-02T06:40:16.414Z',
      },
    },
    // this has the sync revision as it's previous and should be passed on as-is
    mutationEvent({
      previousRev: 'one',
      resultRev: 'two',
      mutations: [{patch: {id: 'test', set: {name: 'OK'}}}],
    }),
    // this is part of an unbroken chain, but received out of order
    mutationEvent({
      previousRev: 'four',
      resultRev: 'five',
      mutations: [{patch: {id: 'test', set: {name: 'Out of order'}}}],
    }),
    // this breaks the chain
    mutationEvent({
      previousRev: 'six',
      resultRev: 'seven',
      mutations: [{patch: {id: 'test', set: {name: 'Out of order'}}}],
    }),
    // this is part of an unbroken chain, but received out of order
    mutationEvent({
      previousRev: 'three',
      resultRev: 'four',
      mutations: [{patch: {id: 'test', set: {name: 'Out of order'}}}],
    }),
    // we have a complete unbroken chain when receiving this
    mutationEvent({
      previousRev: 'two',
      resultRev: 'three',
      mutations: [{patch: {id: 'test', set: {name: 'Out of order'}}}],
    }),
  ] satisfies ListenerEvent<TestDoc>[])

  await expect(
    lastValueFrom(
      events.pipe(sequentializeListenerEvents({maxBufferSize: 3}), toArray()),
    ),
  ).rejects.toThrowError(MaxBufferExceededError)
})

test('it throws an OutOfSyncError if the buffer exceeds `maxBuffer`', async () => {
  const events = from([
    {
      type: 'sync',
      document: {
        _rev: 'one',
        _id: 'test',
        _type: 'test',
        name: 'initial',
        _createdAt: '2024-10-02T06:40:16.414Z',
        _updatedAt: '2024-10-02T06:40:16.414Z',
      },
    },
    // this has the sync revision as it's previous and should be passed on as-is
    mutationEvent({
      previousRev: 'one',
      resultRev: 'two',
      mutations: [{patch: {id: 'test', set: {name: 'OK'}}}],
    }),
    // this is part of an unbroken chain, but received out of order
    mutationEvent({
      previousRev: 'four',
      resultRev: 'five',
      mutations: [{patch: {id: 'test', set: {name: 'Out of order'}}}],
    }),
    // this breaks the chain
    mutationEvent({
      previousRev: 'six',
      resultRev: 'seven',
      mutations: [{patch: {id: 'test', set: {name: 'Out of order'}}}],
    }),
    // this is part of an unbroken chain, but received out of order
    mutationEvent({
      previousRev: 'three',
      resultRev: 'four',
      mutations: [{patch: {id: 'test', set: {name: 'Out of order'}}}],
    }),
    // we have a complete unbroken chain when receiving this
    mutationEvent({
      previousRev: 'two',
      resultRev: 'three',
      mutations: [{patch: {id: 'test', set: {name: 'Out of order'}}}],
    }),
  ] satisfies ListenerEvent<TestDoc>[])

  await expect(
    lastValueFrom(
      events.pipe(
        sequentializeListenerEvents({resolveChainDeadline: 100}),
        toArray(),
      ),
    ),
  ).rejects.toThrowError(DeadlineExceededError)
})
