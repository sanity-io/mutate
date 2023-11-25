import {expect, test} from 'vitest'

import {rebase} from '../rebase'
import {at, patch} from '../../mutations/creators'
import {set} from '../../mutations/operations/creators'
import type {PendingTransaction} from '../types'

test('rebase() a simple case', () => {
  const oldRemote = {_id: 'test', _type: 'test', foo: 'bar\nbaz'}
  const newRemote = {_id: 'test', _type: 'test', foo: 'car\nbaz'}

  const outbox = [{mutations: [patch('test', [at('foo', set('bar\nbat'))])]}]

  const [nextOutbox, nextLocal] = rebase('test', oldRemote, newRemote, outbox)
  expect(nextLocal).toEqual({_id: 'test', _type: 'test', foo: 'car\nbat'})

  expect(nextOutbox).toEqual([
    {
      mutations: [patch('test', [at('foo', set('car\nbat'))])],
    },
  ])
})

test('rebase() without pending mutations', () => {
  const oldRemote = {_id: 'test', _type: 'test', foo: 'bar\nbaz'}
  const newRemote = {_id: 'test', _type: 'test', foo: 'car\nbaz'}

  const outbox: PendingTransaction[] = []

  const [nextOutbox, nextLocal] = rebase('test', oldRemote, newRemote, outbox)
  expect(nextLocal).toEqual(newRemote)

  expect(nextOutbox).toEqual([])
})

test('rebase() where a the new base has a deleted parent', () => {
  const oldBase = {
    _id: 'some-document',
    _type: 'person',
    content: {_type: 'code', language: 'js', text: 'foo bar'},
  }

  const newBase = {
    _id: 'some-document',
    _type: 'person',
  }

  const outbox: PendingTransaction[] = [
    {
      mutations: [
        {
          type: 'createIfNotExists',
          document: {_id: 'some-document', _type: 'person'},
        },
        {
          type: 'patch',
          id: 'some-document',
          patches: [
            {
              path: ['content'],
              op: {type: 'setIfMissing', value: {_type: 'code'}},
            },
            {
              path: ['content', 'text'],
              op: {type: 'set', value: 'foo bar baz baez'},
            },
          ],
        },
      ],
    },
  ]

  const [nextOutbox, nextLocal] = rebase(
    'some-document',
    oldBase,
    newBase,
    outbox,
  )
  expect(nextLocal).toEqual({
    _id: 'some-document',
    _type: 'person',
    content: {
      _type: 'code',
      text: 'foo bar baz baez',
    },
  })

  expect(nextOutbox).toEqual(outbox)
})
