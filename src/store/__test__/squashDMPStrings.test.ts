import {expect, test} from 'vitest'

import {squashDMPStrings} from '../optimizations/squashDMPStrings'
import {at, patch} from '../../mutations/creators'
import {
  diffMatchPatch,
  set,
  setIfMissing,
  unset,
} from '../../mutations/operations/creators'

test('squashDMPStrings() a simple case', () => {
  const remote = {_id: 'test', _type: 'test', foo: 'bar\nbaz'}

  const outbox = [
    {
      mutations: [patch('test', [at('foo', set('bar\nbat'))])],
    },
  ]

  const mutations = squashDMPStrings({get: () => remote}, outbox)

  expect(mutations).toEqual([
    {
      mutations: [
        patch('test', [
          at('foo', diffMatchPatch(`@@ -3,5 +3,5 @@\n r%0Aba\n-z\n+t\n`)),
        ]),
      ],
    },
  ])
})

test('squashDMPStrings() where a value has been unset and re-set', () => {
  const remote = {
    _id: 'test',
    _type: 'test',
    foo: {something: 'bar\nbaz', other: 'x'},
  }

  const outbox = [
    {
      mutations: [
        patch('test', [
          at('foo', unset()),
          at('foo', setIfMissing({})),
          at('foo.something', set('bar\nbat')),
        ]),
      ],
    },
  ]

  const mutations = squashDMPStrings({get: () => remote}, outbox)

  expect(mutations).toEqual([
    {
      mutations: [
        patch('test', [
          at('foo', unset()),
          at('foo', setIfMissing({})),
          at('foo.something', set('bar\nbat')),
        ]),
      ],
    },
  ])
})
