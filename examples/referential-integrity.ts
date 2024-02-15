import {at, createIfNotExists, patch, set} from '@bjoerge/mutiny'
import {applyInCollection} from '@bjoerge/mutiny/_unstable_apply'

const initial = [
  {
    _id: 'someDoc',
    _type: 'foo',
    value: 'ok',
    nested: {value: 'something'},
    otherNested: {message: 'something else'},
  },
]

const updated = applyInCollection(initial, [
  createIfNotExists({_id: 'someDoc', _type: 'foo'}),
  patch('someDoc', [at('value', set('ok'))]),
  patch('someDoc', [at('nested.value', set('something'))]),
])

console.log(initial === updated)
