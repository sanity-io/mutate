import {assertType, describe, test} from 'vitest'

import {
  at,
  create,
  createIfNotExists,
  createOrReplace,
  del,
  patch,
} from '../../mutations/creators'
import {set} from '../../mutations/operations/creators'
import {applyInCollection} from '../applyInCollection'

// helper: assert applyInCollection succeeded and narrow off the ApplyMutationError branch
function ok<T>(value: T): Exclude<T, Error> {
  if (value instanceof Error) throw value
  return value as Exclude<T, Error>
}

describe('applyInCollection — input variance', () => {
  test('accepts a mutable Doc[] collection', () => {
    const initial = [{_id: 'a', _type: 'foo'}]
    applyInCollection(initial, [])
  })

  test('accepts a `readonly` collection (e.g. `as const`)', () => {
    const initial = [{_id: 'a', _type: 'foo'}] as const
    applyInCollection(initial, [])
  })
})

describe('applyInCollection — added document shapes appear in the result', () => {
  test('createIfNotExists contributes its document shape', () => {
    const updated = applyInCollection(
      [],
      [createIfNotExists({_id: 'a', _type: 'foo'} as const)],
    )
    assertType<readonly {readonly _id: 'a'; readonly _type: 'foo'}[]>(
      ok(updated),
    )
  })

  test('create contributes its document shape', () => {
    const updated = applyInCollection(
      [],
      [create({_id: 'a', _type: 'foo'} as const)],
    )
    assertType<readonly {readonly _id: 'a'; readonly _type: 'foo'}[]>(
      ok(updated),
    )
  })

  test('createOrReplace contributes its document shape', () => {
    const updated = applyInCollection(
      [],
      [createOrReplace({_id: 'a', _type: 'foo'} as const)],
    )
    assertType<readonly {readonly _id: 'a'; readonly _type: 'foo'}[]>(
      ok(updated),
    )
  })

  test('input + added shapes union together', () => {
    const initial = [{_id: 'existing', _type: 'foo'}] as const
    const updated = applyInCollection(initial, [
      createIfNotExists({_id: 'added', _type: 'foo'} as const),
    ])
    assertType<
      readonly (
        | {readonly _id: 'existing'; readonly _type: 'foo'}
        | {readonly _id: 'added'; readonly _type: 'foo'}
      )[]
    >(ok(updated))
  })
})

describe('applyInCollection — del() subtracts matching shapes', () => {
  test('a literal del removes the matching _id from the input union', () => {
    const initial = [
      {_id: 'keep', _type: 'foo'},
      {_id: 'goaway', _type: 'foo'},
    ] as const
    const updated = applyInCollection(initial, [del('goaway')])
    assertType<readonly {readonly _id: 'keep'; readonly _type: 'foo'}[]>(
      ok(updated),
    )
  })

  test('a literal del removes a previously-added shape with the same _id', () => {
    const updated = applyInCollection(
      [],
      [createIfNotExists({_id: 'tmp', _type: 'foo'} as const), del('tmp')],
    )
    // The added shape and the del cancel out; nothing remains in the union.
    assertType<readonly never[]>(ok(updated))
  })

  test('a non-literal del (string) does NOT subtract', () => {
    const initial = [
      {_id: 'a', _type: 'foo'},
      {_id: 'b', _type: 'foo'},
    ] as const
    const id: string = 'a'
    const updated = applyInCollection(initial, [del(id)])
    // Without a literal id, the Exclude is a no-op — the result keeps both.
    assertType<
      readonly (
        | {readonly _id: 'a'; readonly _type: 'foo'}
        | {readonly _id: 'b'; readonly _type: 'foo'}
      )[]
    >(ok(updated))
  })
})

describe('applyInCollection — patch() is shape-preserving', () => {
  test('patch does not add or subtract shapes from the result', () => {
    const initial = [{_id: 'a', _type: 'foo', name: 'x'}] as const
    const updated = applyInCollection(initial, [
      patch('a', [at(['name'], set('y'))]),
    ])
    assertType<
      readonly {
        readonly _id: 'a'
        readonly _type: 'foo'
        readonly name: 'x'
      }[]
    >(ok(updated))
  })
})

describe('applyInCollection — empty mutations preserves input shape', () => {
  test('an empty mutation list returns the input shape', () => {
    const initial = [{_id: 'a', _type: 'foo'}] as const
    const updated = applyInCollection(initial, [])
    assertType<readonly {readonly _id: 'a'; readonly _type: 'foo'}[]>(
      ok(updated),
    )
  })
})
