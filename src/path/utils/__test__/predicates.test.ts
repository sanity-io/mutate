import {expect, test} from 'vitest'

import {isEqual, startsWith} from '../predicates'

test('startsWith()', () => {
  expect(startsWith(['foo'], ['foo', 'bar'])).toBe(true)
  expect(startsWith(['foo', 'bar'], ['foo', 'bar'])).toBe(true)
  expect(startsWith(['foo', 'bar', 'baz'], ['foo', 'bar'])).toBe(false)
  expect(startsWith([0, 1], [0, 1, {_key: 'test'}])).toBe(true)
})

test('isEqual()', () => {
  expect(isEqual([], [])).toBe(true)
  expect(isEqual(['foo'], ['foo'])).toBe(true)
  expect(isEqual(['foo', 0, {_key: 'a'}], ['foo', 0, {_key: 'a'}])).toBe(true)

  expect(isEqual(['foo'], ['bar'])).toBe(false)
  expect(isEqual(['foo'], ['foo', 'bar'])).toBe(false)
  expect(isEqual(['foo', 'bar'], ['foo'])).toBe(false)
  expect(isEqual(['foo', 0], ['foo', 1])).toBe(false)
  expect(isEqual(['foo', {_key: 'a'}], ['foo', {_key: 'b'}])).toBe(false)
  expect(isEqual(['foo', {_key: 'a'}], ['foo', 0])).toBe(false)
  expect(isEqual(['foo', 0], ['foo', {_key: 'a'}])).toBe(false)
})
