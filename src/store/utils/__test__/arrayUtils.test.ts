import {describe, expect, test} from 'vitest'

import {
  groupBy,
  keyBy,
  partition,
  sortedIndex,
  takeUntil,
  takeUntilRight,
} from '../arrayUtils'

describe('takeUntil', () => {
  test('inclusive', () => {
    expect(takeUntil([], x => x === 3, {inclusive: true})).toEqual([])
    expect(takeUntil([1], x => x === 3, {inclusive: true})).toEqual([1])
    expect(takeUntil([0, 3], x => x === 3, {inclusive: true})).toEqual([0, 3])
    expect(takeUntil([1, 2, 3, 4, 5], x => x === 3, {inclusive: true})).toEqual(
      [1, 2, 3],
    )
  })
  test('exclusive', () => {
    expect(takeUntil([], x => x === 3, {inclusive: false})).toEqual([])
    expect(takeUntil([1], x => x === 3, {inclusive: false})).toEqual([1])
    expect(takeUntil([0, 3], x => x === 3, {inclusive: false})).toEqual([0])

    expect(takeUntil([1, 2, 3, 4, 5], x => x === 3)).toEqual([1, 2])
  })
})

describe('takeUntilRight', () => {
  test('inclusive', () => {
    expect(takeUntilRight([], x => x === 3, {inclusive: true})).toEqual([])
    expect(takeUntilRight([1], x => x === 3, {inclusive: true})).toEqual([1])
    expect(takeUntilRight([0, 3], x => x === 3, {inclusive: true})).toEqual([3])
    expect(
      takeUntilRight([1, 2, 3, 4, 5], x => x === 3, {inclusive: true}),
    ).toEqual([5, 4, 3])
  })
  test('exclusive', () => {
    expect(takeUntilRight([], x => x === 3, {inclusive: false})).toEqual([])
    expect(takeUntilRight([1], x => x === 3, {inclusive: false})).toEqual([1])
    expect(takeUntilRight([0, 3], x => x === 3, {inclusive: false})).toEqual([])
    expect(
      takeUntilRight([1, 2, 3, 4, 5], x => x === 3, {inclusive: false}),
    ).toEqual([5, 4])
  })
})

describe('partition', () => {
  test('splits by predicate truthiness, preserving order', () => {
    expect(partition([], () => true)).toEqual([[], []])
    expect(partition([1, 2, 3, 4], x => x % 2)).toEqual([
      [1, 3],
      [2, 4],
    ])
    expect(
      partition([{doc: undefined}, {doc: 'a'}, {doc: null}], x => x.doc),
    ).toEqual([[{doc: 'a'}], [{doc: undefined}, {doc: null}]])
  })
})

describe('groupBy', () => {
  test('groups items by key in first-seen order', () => {
    expect(groupBy([], () => 'x')).toEqual({})
    expect(
      Object.values(groupBy(['b1', 'a1', 'b2', 'a2'], s => s[0]!)),
    ).toEqual([
      ['b1', 'b2'],
      ['a1', 'a2'],
    ])
  })
  test('does not collide with Object.prototype keys', () => {
    const grouped = groupBy(['__proto__', 'constructor'], s => s)
    expect(grouped['__proto__']).toEqual(['__proto__'])
    expect(grouped['constructor']).toEqual(['constructor'])
    expect(Object.keys(grouped)).toEqual(['__proto__', 'constructor'])
  })
})

describe('keyBy', () => {
  test('indexes items by key, last one wins', () => {
    expect(keyBy([], () => 'x')).toEqual({})
    expect(
      keyBy(
        [
          {id: 'a', v: 1},
          {id: 'b', v: 2},
          {id: 'a', v: 3},
        ],
        x => x.id,
      ),
    ).toEqual({a: {id: 'a', v: 3}, b: {id: 'b', v: 2}})
  })
  test('does not collide with Object.prototype keys', () => {
    expect(keyBy(['toString'], s => s)['toString']).toBe('toString')
    expect(keyBy([], () => 'x')['toString']).toBeUndefined()
  })
})

describe('sortedIndex', () => {
  test('returns the lowest index that keeps the array sorted', () => {
    expect(sortedIndex([], 'a')).toBe(0)
    expect(sortedIndex(['b', 'd'], 'a')).toBe(0)
    expect(sortedIndex(['b', 'd'], 'c')).toBe(1)
    expect(sortedIndex(['b', 'd'], 'e')).toBe(2)
    expect(sortedIndex(['a', 'b', 'b', 'c'], 'b')).toBe(1)
    expect(sortedIndex([10, 20, 30], 20)).toBe(1)
    expect(sortedIndex([10, 20, 30], 25)).toBe(2)
  })
})
