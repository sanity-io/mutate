import {expect, test} from 'vitest'

import {upsert} from '../../../mutations/operations/creators'
import {applyOp} from '../applyOp'

test('upsert relative to keyed path elements', () => {
  const arr = [{_key: 'foo', value: 'foo'}]
  expect(
    applyOp(
      upsert([{_key: 'hello', value: 'bar'}], 'before', {_key: 'foo'}),
      arr,
    ),
  ).toEqual([
    {_key: 'hello', value: 'bar'},
    {_key: 'foo', value: 'foo'},
  ])
  expect(
    applyOp(
      upsert([{_key: 'hello', value: 'bar'}], 'after', {_key: 'foo'}),
      arr,
    ),
  ).toEqual([
    {_key: 'foo', value: 'foo'},
    {_key: 'hello', value: 'bar'},
  ])
})

test('upsert to update existing items', () => {
  expect(
    applyOp(upsert([{_key: 'hello', value: 'UPDATED'}], 'before', 0), [
      {_key: 'hello', value: 'bar'},
      {_key: 'foo', value: 'foo'},
    ]),
  ).toEqual([
    {_key: 'hello', value: 'UPDATED'},
    {_key: 'foo', value: 'foo'},
  ])

  expect(
    applyOp(upsert([{_key: 'foo', value: 'bar'}], 'after', -1), [
      {_key: 'hello', value: 'bar'},
      {_key: 'foo', value: 'foo'},
    ]),
  ).toEqual([
    {_key: 'hello', value: 'bar'},
    {_key: 'foo', value: 'bar'},
  ])

  expect(
    applyOp(upsert([{_key: 'foo', value: 'bar'}], 'after', {_key: 'foo'}), [
      {_key: 'foo', value: 'foo'},
    ]),
  ).toEqual([{_key: 'foo', value: 'bar'}])
})

test('upsert when items doesnt exist', () => {
  expect(
    applyOp(upsert([{_key: 'new', value: 'bar'}], 'before', 0), [
      {_key: 'hello', value: 'bar'},
      {_key: 'foo', value: 'foo'},
    ]),
  ).toEqual([
    {_key: 'new', value: 'bar'},
    {_key: 'hello', value: 'bar'},
    {_key: 'foo', value: 'foo'},
  ])

  expect(
    applyOp(upsert([{_key: 'new', value: 'bar'}], 'after', -1), [
      {_key: 'hello', value: 'bar'},
      {_key: 'foo', value: 'foo'},
    ]),
  ).toEqual([
    {_key: 'hello', value: 'bar'},
    {_key: 'foo', value: 'foo'},
    {_key: 'new', value: 'bar'},
  ])

  expect(
    applyOp(upsert([{_key: 'hello', value: 'bar'}], 'after', {_key: 'foo'}), [
      {_key: 'foo', value: 'foo'},
    ]),
  ).toEqual([
    {_key: 'foo', value: 'foo'},
    {_key: 'hello', value: 'bar'},
  ])
})

test('insert relative to nonexisting keyed path elements', () => {
  const arr = [{_key: 'foo', value: 'foo'}]
  expect(() =>
    applyOp(
      upsert([{_key: 'hello', value: 'bar'}], 'before', {_key: 'doesntexist'}),
      arr,
    ),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: Found no matching array element to insert before]`,
  )
})
