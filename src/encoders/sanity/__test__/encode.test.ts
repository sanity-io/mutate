import {expect, test} from 'vitest'
import {encode} from '../encode'
import {at, patch} from '../../../mutations/creators'
import {insert, set, unset} from '../../../mutations/operations/creators'

test('encode()', () => {
  const mutations = [
    patch('cat', [
      at('title', set('hello world')),
      at('title', unset()),
      at('hello', unset()),
    ]),
    patch('cat', [at('breed', set('forest cat'))]),
    patch('dog', [at('characteristics', insert(['furry'], 'after', -1))]),
  ]
  expect(encode(mutations)).toEqual([
    {
      patch: {
        id: 'cat',
        set: {
          title: 'hello world',
        },
      },
    },
    {
      patch: {
        id: 'cat',
        unset: ['title'],
      },
    },
    {
      patch: {
        id: 'cat',
        unset: ['hello'],
      },
    },
    {
      patch: {
        id: 'cat',
        set: {
          breed: 'forest cat',
        },
      },
    },
    {
      patch: {
        id: 'dog',
        insert: {
          after: 'characteristics[-1]',
          items: ['furry'],
        },
      },
    },
  ])
})
