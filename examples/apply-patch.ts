import {applyPatchMutation} from '@bjoerge/mutiny/_unstable_apply'
import {
  append,
  at,
  insert,
  insertAfter,
  insertBefore,
  patch,
  prepend,
  setIfMissing,
} from '@bjoerge/mutiny'

const document = {_id: 'test', _type: 'foo'}

const updated = applyPatchMutation(
  document,
  patch('test', [
    at('title', setIfMissing('Foo')),
    at('cities', setIfMissing([])),
    at('cities', insert(['Oslo', 'San Francisco'], 'after', 0)),
    at('cities', prepend(['Krakow'])),
    at('cities', append(['Askim'])),
    at('cities', insertAfter(['Chicago'], 1)),
    at('cities', insertBefore(['Raleigh'], 3)),
  ]),
)

console.log(updated)
