import {expect, test} from 'vitest'
import {insertWithKeys} from '../src/mutations/insertWithKeys'
import {at, createIfNotExists, patch, setIfMissing} from '../src'
import {applyInCollection} from '../src/apply'
import type {Index, KeyedPathElement} from '../src'

// Example of automatic key generation of object
let i = 0
const insert = insertWithKeys(() => `a-very-random-key-${i++}`)

const insertBefore = <Item, Ref extends Index | KeyedPathElement>(
  ref: Ref,
  items: Item[],
) => insert('before', ref, items)

const prepend = <Item, Ref extends Index | KeyedPathElement>(items: Item[]) =>
  insertBefore(0, items)

const insertAfter = <Item, Ref extends Index | KeyedPathElement>(
  ref: Ref,
  items: Item[],
) => insert('after', ref, items)

const append = <Item>(items: Item[]) => insert('after', -1, items)

const mutations = [
  createIfNotExists({_id: 'some-doc', _type: 'testing'}),
  patch('some-doc', [
    at('array', setIfMissing([])),
    at('array', insert('after', 0, [{order: 'second'}])),
    at('array', append([{_key: 'third', order: 'third'}])),
    at('array', insertBefore({_key: 'third'}, [{order: 'after-second'}])),
    at('array', prepend([{_key: 'first', order: 'first'}])),
    at('array', insertAfter({_key: 'first'}, [{order: 'after-first'}])),
  ]),
]

test('it works as expected', () => {
  expect(applyInCollection([], mutations)).toEqual([
    {
      _id: 'some-doc',
      _type: 'testing',
      array: [
        {
          _key: 'first',
          order: 'first',
        },
        {
          _key: 'a-very-random-key-2',
          order: 'after-first',
        },
        {
          _key: 'a-very-random-key-0',
          order: 'second',
        },
        {
          _key: 'a-very-random-key-1',
          order: 'after-second',
        },
        {
          _key: 'third',
          order: 'third',
        },
      ],
    },
  ])
})
