import {expect, test} from 'vitest'
import {stringify} from '../stringify'
import {parse} from '../parse'
import type {Path} from '../../types'

type Equivalent = [Path, string]

const equivalents: Equivalent[] = [
  [['foo'], 'foo'],
  [['foo', 'bar'], 'foo.bar'],
  [['foo', 'bar', {_key: 'foo'}], 'foo.bar[_key=="foo"]'],
  [['foo', 'bar', {_key: 'foo'}], 'foo.bar[_key=="foo"]'],
]

test('parse()', () => {
  equivalents.forEach(([decoded, encoded]) =>
    expect(stringify(decoded)).toStrictEqual(encoded),
  )
})
test('stringify()', () => {
  equivalents.forEach(([decoded, encoded]) =>
    expect(parse(encoded)).toStrictEqual(decoded),
  )
})
