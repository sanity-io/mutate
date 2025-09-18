import {expect, test} from 'vitest'

import {insertIfMissing} from '../../../mutations/operations/creators'
import {applyOp} from '../applyOp'

test('insert or update relative to keyed path elements', () => {
  const arr = [{_key: 'foo', value: 'foo'}]
  expect(
    applyOp(
      insertIfMissing([{_key: 'hello', value: 'bar'}], 'before', {_key: 'foo'}),
      arr,
    ),
  ).toEqual([
    {_key: 'hello', value: 'bar'},
    {_key: 'foo', value: 'foo'},
  ])
  expect(
    applyOp(
      insertIfMissing([{_key: 'hello', value: 'bar'}], 'after', {_key: 'foo'}),
      arr,
    ),
  ).toEqual([
    {_key: 'foo', value: 'foo'},
    {_key: 'hello', value: 'bar'},
  ])
})

test('insertIfMissing when items doesnt exist', () => {
  expect(
    applyOp(insertIfMissing([{_key: 'new', value: 'bar'}], 'before', 0), [
      {_key: 'hello', value: 'bar'},
      {_key: 'foo', value: 'foo'},
    ]),
  ).toEqual([
    {_key: 'new', value: 'bar'},
    {_key: 'hello', value: 'bar'},
    {_key: 'foo', value: 'foo'},
  ])

  expect(
    applyOp(insertIfMissing([{_key: 'new', value: 'bar'}], 'after', -1), [
      {_key: 'hello', value: 'bar'},
      {_key: 'foo', value: 'foo'},
    ]),
  ).toEqual([
    {_key: 'hello', value: 'bar'},
    {_key: 'foo', value: 'foo'},
    {_key: 'new', value: 'bar'},
  ])

  expect(
    applyOp(
      insertIfMissing([{_key: 'hello', value: 'bar'}], 'after', {_key: 'foo'}),
      [{_key: 'foo', value: 'foo'}],
    ),
  ).toEqual([
    {_key: 'foo', value: 'foo'},
    {_key: 'hello', value: 'bar'},
  ])
})

test('insertIfMissing when item exist', () => {
  expect(
    applyOp(insertIfMissing([{_key: 'foo', value: 'INITIAL'}], 'before', 0), [
      {_key: 'hello', value: 'bar'},
      {_key: 'foo', value: 'foo'},
    ]),
  ).toEqual([
    {_key: 'hello', value: 'bar'},
    {_key: 'foo', value: 'foo'},
  ])
})

test('insertIfMissing when items exist', () => {
  expect(
    applyOp(
      insertIfMissing(
        [
          {_key: 'existing', value: 'INITIAL'},
          {_key: 'new', value: 'INITIAL'},
        ],
        'before',
        0,
      ),
      [
        {_key: 'existing', value: 'bar'},
        {_key: 'foo', value: 'foo'},
      ],
    ),
  ).toEqual([
    {_key: 'new', value: 'INITIAL'},
    {_key: 'existing', value: 'bar'},
    {_key: 'foo', value: 'foo'},
  ])
})

test('insert relative to nonexisting keyed path elements', () => {
  const arr = [{_key: 'foo', value: 'foo'}]
  expect(() =>
    applyOp(
      insertIfMissing([{_key: 'hello', value: 'bar'}], 'before', {
        _key: 'doesntexist',
      }),
      arr,
    ),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: Found no matching array element to insert before]`,
  )
})
