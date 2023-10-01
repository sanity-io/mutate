import {ulid} from 'ulid'
import {insertWithKeys} from '../src/mutations/insertWithKeys'
import {applyInCollection} from '../src/apply/applyInCollection'
import {at, patch} from '../src'

const insert = insertWithKeys(() => ulid())

type Doc = {_id: string; _type: string; array: any[]}
const doc: Doc = {_id: 'some-document', _type: 'test', array: []}

const result = applyInCollection(
  [doc],
  [
    patch(
      'some-document',
      at('array', insert('after', -1, [{order: 'second'}])),
    ),
  ],
)

console.log(result)
