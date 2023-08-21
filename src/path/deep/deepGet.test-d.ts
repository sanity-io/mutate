import {expectTypeOf, test} from 'vitest'
import {deepGet} from './deepGet'
import type {DeepGet, Get} from './deepGet'

test('Get (shallow) typings', () => {
  expectTypeOf<
    Get<
      {_key: 'baz'},
      [
        {_key: 'f'; foo: 'bar'},
        {_key: 'baz'; foo: 'baz'},
        {_key: 'q'; foo: 'qux'},
      ]
    >
  >().toEqualTypeOf<{
    _key: 'baz'
    foo: 'baz'
  }>()

  expectTypeOf<Get<2, ['foo', {_key: 'hi'}, 'bar']>>().toEqualTypeOf<'bar'>()

  expectTypeOf<Get<2, string[]>>()
    // @ts-expect-error - todo
    .toEqualTypeOf<string | undefined>()

  expectTypeOf<
    Get<{_key: 'hi'}, ['foo', {_key: 'hi'; title: 'this is the one'}, 'bar']>
  >().toEqualTypeOf<{_key: 'hi'; title: 'this is the one'}>()

  expectTypeOf<Get<{_key: 'second'}, {_key: string; title: string}[]>>()
    // @ts-expect-error - todo
    .toEqualTypeOf<{_key: string; title: string} | undefined>()

  expectTypeOf<Get<'foo', {foo: 'bar'}>>().toEqualTypeOf<'bar'>()
})

test('DeepGet typings', () => {
  expectTypeOf<
    DeepGet<[1, 'name'], [{name: 'foo'}, {name: 'bar'}, {name: 'baz'}]>
  >().toEqualTypeOf<'bar'>()

  expectTypeOf<
    DeepGet<
      [{_key: 'second'}, 'title'],
      [
        {_key: 'first'; title: 'First'},
        {_key: 'second'; title: 'Second'},
        {_key: 'third'; title: 'Third'},
      ]
    >
  >().toEqualTypeOf<'Second'>()

  expectTypeOf<
    DeepGet<[{_key: 'second'}, 'title'], {_key: string; title: string}[]>
  >()
    // @ts-expect-error - todo
    .toEqualTypeOf<string | undefined>()

  expectTypeOf<
    DeepGet<[{_key: 'zzz'; foo: 'bar'}, 2], never>
  >().toEqualTypeOf<never>()
})

test('deepGet() function', () => {
  const testDoc = {
    title: 'Example',
    items: [
      {_key: 'a', letters: ['a', 'b', 'c']},
      {_key: 'b', letters: ['a', 'b', 'c']},
      {_key: 'c', letters: ['x', 'y', 'z']},
      {_key: 'd', letters: ['a', 'b', 'c']},
    ],
  } as const

  expectTypeOf(deepGet([], testDoc)).toEqualTypeOf(testDoc)

  expectTypeOf(deepGet(['items'], testDoc)).toEqualTypeOf(testDoc.items)

  expectTypeOf(deepGet(['nonexistent'], testDoc)).toEqualTypeOf<never>()

  expectTypeOf(deepGet(['items', 3, 'letters', 2], testDoc)).toEqualTypeOf(
    'c' as const,
  )

  expectTypeOf(deepGet([1], testDoc.items)).toEqualTypeOf(testDoc.items[1])

  expectTypeOf(deepGet(['items', 2, 'letters', 2], testDoc)).toEqualTypeOf(
    testDoc.items[2].letters[2],
  )

  expectTypeOf(
    deepGet(['items', {_key: 'b'}, 'letters', 2], testDoc),
  ).toEqualTypeOf(testDoc.items[1].letters[2])

  type MostlyLiteral = {
    title: string
    items: [
      {_key: 'a'; letters: ['a', 'b', 'c']},
      {_key: 'b'; letters: ['a', 'b', 'c']},
      {_key: 'c'; letters: ['x', 'y', 'z']},
      {_key: 'd'; letters: ['a', 'b', 'c']},
    ]
  }

  const literal: MostlyLiteral = {
    title: 'hello',
    items: [
      {_key: 'a', letters: ['a', 'b', 'c']},
      {_key: 'b', letters: ['a', 'b', 'c']},
      {_key: 'c', letters: ['x', 'y', 'z']},
      {_key: 'd', letters: ['a', 'b', 'c']},
    ],
  }

  expectTypeOf(deepGet(['items', 2, 'letters', 2], literal)).toEqualTypeOf(
    literal.items[2].letters[2],
  )
})
