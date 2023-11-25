import {concat, delay, NEVER, of, take} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {createContentLakeStore} from '../contentLakeStore'
import {allValuesFrom, collectNotifications, sleep} from './helpers'

describe('observing documents', () => {
  test('observing a document that does not exist on the backend', () => {
    const store = createContentLakeStore({
      observe: id => of({type: 'sync', id, document: undefined}),
      submit: () => NEVER,
    })
    expect(allValuesFrom(store.observe('foo').pipe(take(1)))).resolves.toEqual([
      {local: undefined, remote: undefined},
    ])
  })
  test('observing a document that exist on the backend', () => {
    const doc = {_id: 'foo', _type: 'foo'}
    const store = createContentLakeStore({
      observe: id =>
        of({type: 'sync', id, document: doc} as const).pipe(delay(10)),
      submit: () => NEVER,
    })
    expect(
      allValuesFrom(store.observe(doc._id).pipe(take(1))),
    ).resolves.toEqual([{local: doc, remote: doc}])
  })

  test("observing a document that doesn't exist initially, but later is created", () => {
    const doc = {_id: 'foo', _type: 'foo'}
    const store = createContentLakeStore({
      observe: id =>
        concat(
          of({type: 'sync', id, document: undefined} as const),
          of({type: 'sync', id, document: doc} as const).pipe(delay(10)),
        ),
      submit: () => NEVER,
    })
    expect(
      allValuesFrom(store.observe(doc._id).pipe(take(2))),
    ).resolves.toEqual([
      {local: undefined, remote: undefined},
      {local: doc, remote: doc},
    ])
  })
})
describe('local mutations', () => {
  test('mutating a document that does not exist on the backend', () => {
    const store = createContentLakeStore({
      observe: id => of({type: 'sync', id, document: undefined}),
      submit: () => NEVER,
    })

    const {emissions, unsubscribe} = collectNotifications(store.observe('foo'))

    store.mutate([{type: 'create', document: {_id: 'foo', _type: 'foo'}}])

    expect(emissions).toEqual([
      {type: 'next', value: {local: undefined, remote: undefined}},
      {
        type: 'next',
        value: {local: {_id: 'foo', _type: 'foo'}, remote: undefined},
      },
    ])
    unsubscribe()
  })

  test("observing a document that doesn't exist initially, but later is created locally", async () => {
    const doc = {_id: 'foo', _type: 'foo'}
    const store = createContentLakeStore({
      observe: id =>
        concat(
          of({type: 'sync', id, document: undefined} as const).pipe(delay(10)),
          of({type: 'sync', id, document: doc} as const),
        ),
      submit: () => NEVER,
    })

    const {emissions, unsubscribe} = collectNotifications(store.observe('foo'))

    store.mutate([{type: 'createIfNotExists', document: doc}])

    expect(emissions).toEqual([
      {type: 'next', value: {local: doc, remote: undefined}},
    ])

    await sleep(20)

    expect(emissions).toEqual([
      {type: 'next', value: {local: doc, remote: undefined}},
      {
        type: 'next',
        value: {local: {_id: 'foo', _type: 'foo'}, remote: undefined},
      },
      {
        type: 'next',
        value: {
          local: {_id: 'foo', _type: 'foo'},
          remote: {_id: 'foo', _type: 'foo'},
        },
      },
    ])
    unsubscribe()
  })

  test("error when creating a document locally using 'create', when it turns out later that it exists on the server ", async () => {
    const doc = {_id: 'foo', _type: 'foo'}
    const store = createContentLakeStore({
      observe: id =>
        concat(of({type: 'sync', id, document: doc} as const).pipe(delay(10))),
      submit: () => NEVER,
    })

    const {emissions, unsubscribe} = collectNotifications(store.observe('foo'))

    // this will go through at first, but then we'll get an error an instant later during rebase after the document is loaded from the server
    // this is expected, and will be similar to what would have happened if the mutation was sent directly to the server
    // It might cause the document to appear for a brief time before the error is emitted though
    // Typically, consumers should use `createIfNotExists` instead of `create` to avoid this
    store.mutate([{type: 'create', document: doc}])

    expect(emissions).toEqual([
      {type: 'next', value: {local: doc, remote: undefined}},
    ])

    await sleep(100)

    expect(emissions).toMatchObject([
      {type: 'next', value: {local: doc, remote: undefined}},
      {error: {message: 'Document already exist'}, type: 'error'},
    ])

    unsubscribe()
  })
})
