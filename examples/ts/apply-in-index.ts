import {createIfNotExists, del} from '@bjoerge/mutiny'
import {applyInCollection} from '@bjoerge/mutiny/_unstable_apply'

const initial = [{_id: 'deleteme', _type: 'foo'}]

const updated = applyInCollection(initial, [
  createIfNotExists({_id: 'mydocument', _type: 'foo'}),
  createIfNotExists({_id: 'anotherDocument', _type: 'foo'}),
  del('deleteme'),
])

console.log(updated)
