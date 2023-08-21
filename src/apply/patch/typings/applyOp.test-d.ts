import {assertType, expectTypeOf, test} from 'vitest'
import {applyOp} from '../applyOp'
import {
  assign,
  dec,
  inc,
  set,
  setIfMissing,
  unassign,
  unset,
} from '../../../mutations/operations/creators'
import type {
  AssignOp,
  DecOp,
  IncOp,
  InsertOp,
  ReplaceOp,
  SetIfMissingOp,
  SetOp,
  UnassignOp,
  UnsetOp,
} from '../../../mutations/operations/types'
import type {ApplyOp} from './applyOp'

test('applyOp function typings', () => {
  assertType<SetOp<4>>(set(4))
  assertType<4>(applyOp(inc(2), 2))

  //@ts-expect-error - Should be 4
  assertType<3>(applyOp(inc(2), 2))
  assertType<0>(applyOp(dec(2), 2))

  //@ts-expect-error - Should be 0
  assertType<1>(applyOp(dec(2), 2))
  assertType<{foo: 'bar'}>(applyOp(set({foo: 'bar'}), 2))
  assertType<'new'>(applyOp(set('new'), 'current'))
  assertType<{foo: 'bar'}>(applyOp(set({foo: 'bar'}), undefined))
  assertType<undefined>(applyOp(unset(), 'foo'))

  assertType<'current'>(applyOp(setIfMissing('new'), 'current'))
  assertType<'new'>(applyOp(setIfMissing('new'), undefined))

  // Assign
  assertType(
    <{foo: 'bar'; bar: 'ok'}>applyOp(assign({foo: 'bar'}), {bar: 'ok'}),
  )
  //@ts-expect-error can not assign to strings
  applyOp(assign({foo: 'bar'}), 'nah')

  //@ts-expect-error can not assign to numbers
  applyOp(assign({foo: 'bar'}), 2)

  //@ts-expect-error - Cannot assign to arrays
  applyOp(assign({foo: 'bar'}), ['foo'])

  //@ts-expect-error - Cannot assign to booleans
  applyOp(assign({foo: 'bar'}), true)

  // Unassign

  assertType<Record<never, never>>(applyOp(unassign(['foo']), {foo: 'ok'}))
  assertType<{bar: 'bar'}>(applyOp(unassign(['foo']), {bar: 'bar'}))
  //@ts-expect-error cannot unassign to string
  applyOp(unassign(['foo']), 'nah')

  //@ts-expect-error cannot unassign to arrays
  applyOp(unassign(['foo']), [])

  //@ts-expect-error can not unassign to numbers
  applyOp(unassign(['foo']), 2)

  //@ts-expect-error - Cannot unassign to arrays
  applyOp(unassign(['foo']), ['foo'])

  //@ts-expect-error - Cannot assign to booleans
  applyOp(unassign(['foo']), true)
})

test('The ApplyOp type', () => {
  test('ApplyOp types', () => {
    expectTypeOf<ApplyOp<SetOp<'new'>, 'old'>>().toEqualTypeOf<'new'>()
    expectTypeOf<ApplyOp<SetIfMissingOp<'new'>, 'old'>>().toEqualTypeOf<'old'>()

    expectTypeOf<
      ApplyOp<SetIfMissingOp<'new'>, undefined>
    >().toEqualTypeOf<'new'>()

    expectTypeOf<ApplyOp<UnsetOp, 'something'>>().toEqualTypeOf<undefined>()

    expectTypeOf<ApplyOp<IncOp<2>, 2>>().toEqualTypeOf<4>()

    expectTypeOf<ApplyOp<IncOp<99>, 1>>().toEqualTypeOf<100>()

    expectTypeOf<ApplyOp<DecOp<2>, 8>>().toEqualTypeOf<6>()

    expectTypeOf<IncOp<1>>().toEqualTypeOf<{type: 'inc'; amount: 1}>()

    type S = ApplyOp<InsertOp<[0], 'before', 0>, [1, 2, 3]>
    expectTypeOf<
      ApplyOp<InsertOp<[0], 'before', 0>, [1, 2, 3]>
    >().toEqualTypeOf<(0 | 1 | 2 | 3)[]>()

    // Todo: improve tuples support
    expectTypeOf<ApplyOp<InsertOp<[0], 'after', 1>, [1, 2, 3]>>().toEqualTypeOf<
      (0 | 1 | 2 | 3)[]
    >()

    expectTypeOf<ApplyOp<ReplaceOp<[0], 1>, [1, 2, 3]>>().toEqualTypeOf<
      (0 | 1 | 2 | 3)[]
    >()

    expectTypeOf<
      ApplyOp<AssignOp<{foo: 'bar'}>, {bar: 'baz'}>
    >().toEqualTypeOf<{
      foo: 'bar'
      bar: 'baz'
    }>()

    expectTypeOf<
      ApplyOp<UnassignOp<['foo']>, {foo: 'remove'; bar: 'baz'}>
    >().toEqualTypeOf<{bar: 'baz'}>()
  })
})
