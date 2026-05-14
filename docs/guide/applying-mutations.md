# Applying mutations

The apply engine exports pure functions for applying mutations to in-memory documents.

> [!NOTE]
> The apply API is experimental. Expect changes.

## Apply to a collection

`applyInCollection(documents, mutations)` takes a document array and an array of mutations, and returns the next collection state:

```ts twoslash
import {createIfNotExists, del} from '@sanity/mutate'
import {applyInCollection} from '@sanity/mutate/_unstable_apply'

const initial = [{_id: 'deleteme', _type: 'foo'}] as const

const mutations = [
  createIfNotExists({_id: 'mydocument', _type: 'foo'}),
  createIfNotExists({_id: 'anotherDocument', _type: 'foo'}),
  del('deleteme'),
]
const updated = applyInCollection(initial, mutations)
```

## Referential integrity

If a mutation does not change a value — for example, `set` to a value that already matches — the apply functions return the input unchanged:

```ts twoslash
import {at, createIfNotExists, patch, set} from '@sanity/mutate'
import {applyInCollection} from '@sanity/mutate/_unstable_apply'

const initial = [
  {
    _id: 'someDoc',
    _type: 'foo',
    value: 'ok',
    nested: {value: 'something'},
  },
] as const

const updated = applyInCollection(initial, [
  createIfNotExists({_id: 'someDoc', _type: 'foo'}),
  patch('someDoc', [at('value', set('ok'))]),
  patch('someDoc', [at('nested.value', set('something'))]),
])

console.log(initial === updated)
// => true
```

Sub-trees a mutation doesn't touch keep their identity too:

```ts twoslash
import {at, patch, set} from '@sanity/mutate'
import {applyInCollection} from '@sanity/mutate/_unstable_apply'

const initial = [
  {
    _id: 'someDoc',
    _type: 'foo',
    nested: {value: 'something'},
    otherNested: {message: 'something else'},
  },
] as const

const updated = applyInCollection(initial, [
  patch('someDoc', [at('otherNested.message', set('hello'))]),
])

console.log(initial[0]?.nested === updated[0]?.nested)
// => true (nested was not touched)
```

## Apply a single patch

`applyPatchMutation(mutation, document)` applies a single patch mutation directly to a document, as long as their ids match:

```ts twoslash
import {at, insert, patch, setIfMissing} from '@sanity/mutate'
import {applyPatchMutation} from '@sanity/mutate/_unstable_apply'

const document = {_id: 'test', _type: 'foo'}

const mutation = patch('test', [
  at('title', setIfMissing('Foo')),
  at('cities', setIfMissing([])),
  at('cities', insert(['Oslo', 'San Francisco'], 'after', 0)),
])
const updated = applyPatchMutation(mutation, document)
```

## Caveats

The local apply engine interprets a few patches more strictly than the Sanity API does — notably, `set` and `setIfMissing` don't create intermediate objects, and patches target a single node. See [Differences from the Sanity API](./differences-from-sanity-api) for the full list.
