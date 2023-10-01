import {applyPatchMutation} from '@bjoerge/mutiny/_unstable_apply'
import {
  append,
  assign,
  setIfMissing,
  at,
  insert,
  insertAfter,
  insertBefore,
  patch,
  prepend,
  unassign,
  unset,
} from '@bjoerge/mutiny'

const document = {
  _id: 'test',
  _type: 'foo',
  unsetme: 'yes',
  unassignme: 'please',
  assigned: {existing: 'prop'},
} as const

const patches = patch('test', [
  at([], setIfMissing({title: 'Foo'})),
  at([], setIfMissing({cities: []})),
  at('cities', insert(['Oslo', 'San Francisco'], 'after', 0)),
  at('cities', prepend(['Krakow'])),
  at('cities', append(['Askim'])),
  at('cities', insertAfter(['Chicago'], 1)),
  at('cities', insertBefore(['Raleigh'], 3)),
  at('unsetme', unset()),
  at([], unassign(['unassignme'])),
  at('hmmm', assign({other: 'value'})),
])

const updated = applyPatchMutation(patches, document)

console.log(updated)
