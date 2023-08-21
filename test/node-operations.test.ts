import {expect, test} from 'vitest'
import {at, set} from '../src'
import {applyPatch} from '../src/apply/patch/applyPatch'

test('test', () => {
  const nodePatch = at(['foo'], set('bar' as const))

  const doc = {_id: 'lol', foo: 'foo', _rev: 'ok'} as const

  expect(applyPatch(nodePatch, doc)).toEqual({
    _id: 'lol',
    foo: 'bar',
    _rev: 'ok',
  })
})
